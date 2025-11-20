# 🔧 PC 플레이어 오디오 재생 오류 수정

## 🚨 발견된 오류

### 오류 메시지

```
Audio playback error: Event
Audio URL: https://nanum.online/tts/api/broadcast/audio.php?file=broadcast_2025-11-20_10-25-48.mp3
Audio element error: MediaError
Play error: NotSupportedError: The element has no supported sources.
```

### 원인 분석

1. **오디오 파일이 너무 작음**
   - 이전에 발견된 문제와 동일
   - 오디오 파일이 4-15 bytes로 유효한 MP3가 아님

2. **오디오 파일 유효성 검사 부족**
   - 재생 전에 파일 크기 확인하지 않음
   - 유효하지 않은 파일을 재생 시도

3. **오류 처리 부족**
   - 오류 발생 시 자세한 정보 제공 안 함
   - 디버깅 정보 부족

---

## ✅ 수정 사항

### 1. 오디오 파일 크기 필터링

**수정 내용:**
```javascript
// 유효한 오디오만 필터링 (크기 100 bytes 이상)
const validAudios = data.audio_list.filter(audio => {
    const size = audio.size || 0;
    if (size < 100) {
        console.warn(`Skipping invalid audio (too small): ${audio.filename} (${size} bytes)`);
        return false;
    }
    return true;
});
```

**효과:**
- ✅ 100 bytes 미만의 파일은 재생 목록에서 제외
- ✅ 유효하지 않은 파일 재생 시도 방지

### 2. 오디오 파일 사전 검증

**수정 내용:**
```javascript
// 오디오 파일 유효성 사전 확인 (HEAD 요청)
try {
    const headResponse = await fetch(audio.url, { method: 'HEAD' });
    if (!headResponse.ok) {
        throw new Error(`HTTP ${headResponse.status}: ${headResponse.statusText}`);
    }
    
    const contentLength = headResponse.headers.get('Content-Length');
    if (contentLength && parseInt(contentLength) < 100) {
        console.error(`Audio file too small (from HEAD): ${audio.filename} (${contentLength} bytes)`);
        updateStatus(`오디오 파일이 너무 작습니다: ${audio.filename} (${contentLength} bytes)`, 'disconnected');
        return;
    }
} catch (headError) {
    console.warn('HEAD request failed, proceeding anyway:', headError);
}
```

**효과:**
- ✅ 재생 전에 파일 크기 확인
- ✅ 유효하지 않은 파일 재생 방지

### 3. 오류 처리 개선

**수정 내용:**
```javascript
audioPlayer.onerror = async (error) => {
    // ... 기존 오류 처리 ...
    
    // 추가 디버깅: 오디오 파일 직접 확인
    try {
        const response = await fetch(audio.url, { method: 'HEAD' });
        console.log('Audio file HEAD response:', {
            status: response.status,
            statusText: response.statusText,
            contentType: response.headers.get('Content-Type'),
            contentLength: response.headers.get('Content-Length')
        });
        
        if (response.status !== 200) {
            errorMessage += ` (HTTP ${response.status})`;
        }
        
        const contentLength = response.headers.get('Content-Length');
        if (contentLength && parseInt(contentLength) < 100) {
            errorMessage = `오디오 파일이 너무 작습니다: ${contentLength} bytes (유효한 MP3 파일이 아닙니다)`;
        }
    } catch (fetchError) {
        console.error('Failed to check audio file:', fetchError);
        errorMessage += ' (파일 확인 실패)';
    }
};
```

**효과:**
- ✅ 오류 발생 시 자세한 정보 제공
- ✅ 파일 크기 및 상태 확인
- ✅ 디버깅 정보 개선

### 4. 이벤트 리스너 정리

**수정 내용:**
```javascript
// 기존 이벤트 리스너 제거
audioPlayer.onended = null;
audioPlayer.onerror = null;
audioPlayer.oncanplay = null;
```

**효과:**
- ✅ 중복 이벤트 리스너 방지
- ✅ 메모리 누수 방지

### 5. 추가 이벤트 리스너

**수정 내용:**
```javascript
audioPlayer.onloadedmetadata = () => {
    console.log('Audio metadata loaded:', {
        filename: audio.filename,
        duration: audioPlayer.duration,
        size: audio.size
    });
};

audioPlayer.onloadstart = () => {
    console.log('Audio load started:', audio.filename);
};
```

**효과:**
- ✅ 오디오 로드 과정 추적
- ✅ 디버깅 정보 개선

---

## 🚀 사용 방법

### 1. 파일 업로드

수정된 `player-pc.html`을 Hostinger 서버에 업로드:
- `public_html/tts/api/broadcast/player-pc.html`

### 2. 테스트

1. **PC에서 플레이어 열기**
   ```
   https://tts.nanum.online/player-pc.html
   ```

2. **오디오 목록 확인**
   - 유효한 오디오만 표시됨
   - 100 bytes 미만 파일은 제외

3. **오디오 재생**
   - 재생 전에 파일 크기 확인
   - 유효하지 않은 파일은 재생하지 않음

---

## 📋 확인 사항

### 1. 오디오 파일 크기

**확인 방법:**
```bash
# check-audio.php로 확인
https://nanum.online/tts/api/broadcast/check-audio.php
```

**기대 결과:**
- 모든 오디오 파일이 100 bytes 이상
- `is_valid_mp3: true`
- `status: VALID`

### 2. 오디오 파일 생성

**문제:**
- `execute-schedules` 함수가 작은 오디오 파일 생성
- 유효한 MP3 파일이 아님

**해결:**
- `execute-schedules` 함수에서 오디오 데이터 크기 확인
- 100 bytes 미만이면 저장하지 않음

---

## ✅ 수정 완료

### 변경된 파일

- `api/broadcast/player-pc.html`
  - 오디오 파일 크기 필터링 추가
  - 오디오 파일 사전 검증 추가
  - 오류 처리 개선
  - 이벤트 리스너 정리

### 개선 사항

- ✅ 유효하지 않은 오디오 파일 재생 방지
- ✅ 오류 발생 시 자세한 정보 제공
- ✅ 디버깅 정보 개선
- ✅ 사용자 경험 개선

---

**이제 유효한 오디오 파일만 재생됩니다!** 🚀

