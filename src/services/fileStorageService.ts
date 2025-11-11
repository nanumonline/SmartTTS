/**
 * 로컬 파일 저장 서비스
 * 브라우저 다운로드 API 및 Electron 파일 시스템 지원
 */

// Electron 환경 체크
const isElectron = () => {
  return typeof window !== 'undefined' && 
         (window as any).electron !== undefined ||
         (window as any).require !== undefined;
};

// 파일 시스템 접근 (Electron)
const getElectronFS = async () => {
  if (!isElectron()) return null;
  try {
    // Electron 환경에서 fs 모듈 사용
    const fs = (window as any).require?.('fs');
    const path = (window as any).require?.('path');
    const { dialog } = (window as any).require?.('electron').remote || {};
    return { fs, path, dialog };
  } catch (e) {
    console.warn('Electron fs 모듈 로드 실패:', e);
    return null;
  }
};

/**
 * 저장 경로 설정 가져오기
 */
export async function getStorageRootPath(): Promise<string | null> {
  try {
    // Electron 환경에서 설정된 경로 가져오기
    if (isElectron()) {
      const electron = (window as any).electron;
      if (electron?.getStoragePath) {
        return await electron.getStoragePath();
      }
    }
    
    // 기본 경로 (브라우저: 다운로드 폴더)
    return null; // 브라우저에서는 null 반환 (다운로드 API 사용)
  } catch (e) {
    console.warn('저장 경로 가져오기 실패:', e);
    return null;
  }
}

/**
 * 저장 경로 설정하기
 */
export async function setStorageRootPath(path: string): Promise<boolean> {
  try {
    if (isElectron()) {
      const electron = (window as any).electron;
      if (electron?.setStoragePath) {
        await electron.setStoragePath(path);
        return true;
      }
    }
    // 브라우저에서는 설정 불가 (다운로드 폴더만 사용)
    return false;
  } catch (e) {
    console.error('저장 경로 설정 실패:', e);
    return false;
  }
}

/**
 * 디렉토리 생성 (Electron)
 */
async function ensureDirectoryExists(dirPath: string): Promise<boolean> {
  try {
    const electronFS = await getElectronFS();
    if (!electronFS?.fs || !electronFS?.path) return false;
    
    const { fs, path } = electronFS;
    
    // 디렉토리가 존재하는지 확인
    if (fs.existsSync(dirPath)) {
      return true;
    }
    
    // 상위 디렉토리 생성
    const parentDir = path.dirname(dirPath);
    if (!fs.existsSync(parentDir)) {
      await ensureDirectoryExists(parentDir);
    }
    
    // 디렉토리 생성
    fs.mkdirSync(dirPath, { recursive: true });
    return true;
  } catch (e) {
    console.error('디렉토리 생성 실패:', e);
    return false;
  }
}

/**
 * 파일 저장 (Electron)
 */
async function saveFileElectron(filePath: string, blob: Blob): Promise<boolean> {
  try {
    const electronFS = await getElectronFS();
    if (!electronFS?.fs || !electronFS?.path) return false;
    
    const { fs, path } = electronFS;
    
    // 디렉토리 생성
    const dirPath = path.dirname(filePath);
    const dirCreated = await ensureDirectoryExists(dirPath);
    if (!dirCreated) {
      console.error('디렉토리 생성 실패:', dirPath);
      return false;
    }
    
    // Blob을 ArrayBuffer로 변환
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 파일 쓰기
    fs.writeFileSync(filePath, buffer);
    return true;
  } catch (e) {
    console.error('Electron 파일 저장 실패:', e);
    return false;
  }
}

/**
 * 파일 저장 (브라우저 다운로드 API)
 */
async function saveFileBrowser(blob: Blob, filename: string): Promise<boolean> {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // 다운로드 트리거 직후 즉시 revoke하면 일부 브라우저에서 GET blob 실패 가능성
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch (e) {
    console.error('브라우저 파일 저장 실패:', e);
    return false;
  }
}

/**
 * 파일 저장 (통합)
 * @param relativePath 상대 경로 (예: /audio/tts/2024/1102/voice_hash.mp3)
 * @param blob 저장할 Blob
 * @param rootPath 루트 경로 (선택사항, 없으면 기본 경로 사용)
 * @returns 저장된 전체 경로 또는 null
 */
export async function saveAudioFile(
  relativePath: string,
  blob: Blob,
  rootPath?: string | null
): Promise<string | null> {
  try {
    // 상대 경로 정규화 (앞의 / 제거)
    const normalizedPath = relativePath.startsWith('/') 
      ? relativePath.slice(1) 
      : relativePath;
    
    // Electron 환경
    if (isElectron()) {
      const storageRoot = rootPath || await getStorageRootPath();
      if (!storageRoot) {
        console.warn('저장 경로가 설정되지 않았습니다. 브라우저 다운로드로 대체합니다.');
        // 브라우저 다운로드로 폴백
        const filename = normalizedPath.split('/').pop() || 'audio.mp3';
        await saveFileBrowser(blob, filename);
        return null; // 브라우저에서는 전체 경로 반환 불가
      }
      
      const fullPath = `${storageRoot}/${normalizedPath}`;
      const success = await saveFileElectron(fullPath, blob);
      return success ? fullPath : null;
    }
    
    // 브라우저 환경: 다운로드 API 사용
    const filename = normalizedPath.split('/').pop() || 'audio.mp3';
    await saveFileBrowser(blob, filename);
    return null; // 브라우저에서는 전체 경로 반환 불가
  } catch (e) {
    console.error('파일 저장 실패:', e);
    return null;
  }
}

/**
 * 파일 존재 여부 확인 (Electron)
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    if (isElectron()) {
      const electronFS = await getElectronFS();
      if (electronFS?.fs) {
        return electronFS.fs.existsSync(filePath);
      }
    }
    return false;
  } catch (e) {
    console.warn('파일 존재 확인 실패:', e);
    return false;
  }
}

/**
 * 파일 읽기 (Electron)
 */
export async function readAudioFile(filePath: string): Promise<Blob | null> {
  try {
    if (isElectron()) {
      const electronFS = await getElectronFS();
      if (!electronFS?.fs) return null;
      
      const { fs } = electronFS;
      
      if (!fs.existsSync(filePath)) {
        return null;
      }
      
      const buffer = fs.readFileSync(filePath);
      const blob = new Blob([buffer], { type: 'audio/mpeg' });
      return blob;
    }
    return null;
  } catch (e) {
    console.error('파일 읽기 실패:', e);
    return null;
  }
}

/**
 * 저장 경로 선택 다이얼로그 (Electron)
 */
export async function selectStoragePathDialog(): Promise<string | null> {
  try {
    if (isElectron()) {
      const electron = (window as any).electron;
      if (electron?.showOpenDialog) {
        const result = await electron.showOpenDialog({
          properties: ['openDirectory'],
        });
        return result?.filePaths?.[0] || null;
      }
      
      // 폴백: remote dialog 사용
      const electronFS = await getElectronFS();
      if (electronFS?.dialog) {
        const result = await electronFS.dialog.showOpenDialog({
          properties: ['openDirectory'],
        });
        return result?.filePaths?.[0] || null;
      }
    }
    return null;
  } catch (e) {
    console.error('경로 선택 다이얼로그 실패:', e);
    return null;
  }
}

