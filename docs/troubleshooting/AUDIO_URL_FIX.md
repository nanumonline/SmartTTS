# 🔧 오디오 URL 다운로드 로직 추가

## 🚨 발견된 문제

### 문제점

`execute-schedules` 함수에서 **`audio_url`이 HTTP/HTTPS URL인 경우 다운로드하는 로직이 없었습니다**.

**오디오 데이터 로드 순서 (이전):**
1. data URL에서 디코드
2. Supabase Storage에서 다운로드 (`cache_key`)
3. DB의 `audio_blob` 컬럼에서 로드

**문제:**
- `audio_url`이 Supabase Storage의 public URL이나 일반 HTTP URL인 경우 다운로드하지 못함
- 실제 오디오 데이터 대신 테스트 데이터("test", "test audio data")가 전송됨

---

## ✅ 해결 방법

### `execute-schedules` 함수 수정

**추가된 기능:**
1. `audio_url`이 HTTP/HTTPS URL인 경우 다운로드 로직 추가
2. 오디오 데이터 크기 검증 (최소 100 bytes)
3. 상세한 로그 메시지 추가
4. `storage_path` 지원 추가

**수정된 오디오 데이터 로드 순서:**
1. data URL에서 디코드
2. **`audio_url`이 HTTP/HTTPS URL인 경우 다운로드** ← 새로 추가
3. `storage_path`가 있으면 Supabase Storage에서 다운로드
4. `cache_key`가 있으면 Supabase Storage에서 다운로드
5. DB의 `audio_blob` 컬럼에서 로드

---

## 📋 수정 사항

### 1. `audio_url` 다운로드 로직 추가

```typescript
// 2. audio_url이 HTTP/HTTPS URL인 경우 다운로드
if (!audioData && generation.audio_url && !generation.audio_url.startsWith("data:")) {
  try {
    console.log(`[execute-schedules] Downloading audio from URL: ${generation.audio_url}`);
    const audioResponse = await fetch(generation.audio_url);
    
    if (!audioResponse.ok) {
      throw new Error(`HTTP ${audioResponse.status}: ${audioResponse.statusText}`);
    }
    
    const audioBlob = await audioResponse.blob();
    audioData = await audioBlob.arrayBuffer();
    mimeType = audioBlob.type || audioResponse.headers.get("content-type") || mimeType;
    
    console.log(`[execute-schedules] Successfully downloaded audio from URL: ${audioData.byteLength} bytes`);
  } catch (err) {
    console.warn(`[execute-schedules] Failed to download from URL:`, err);
  }
}
```

### 2. 오디오 데이터 크기 검증 추가

```typescript
// 오디오 데이터 크기 검증 (최소 100 bytes)
if (audioData.byteLength < 100) {
  console.error(
    `[execute-schedules] Audio data too small: ${audioData.byteLength} bytes for generation ${generation.id}`
  );
  await supabaseClient
    .from("tts_schedule_requests")
    .update({
      status: "failed",
      fail_reason: `Audio data too small: ${audioData.byteLength} bytes`,
    })
    .eq("id", schedule.id);

  results.push({
    scheduleId: schedule.id,
    status: "failed",
    reason: `Audio data too small: ${audioData.byteLength} bytes`,
  });
  continue;
}
```

### 3. 상세한 로그 메시지 추가

```typescript
console.log(`[execute-schedules] Audio data loaded: ${audioData.byteLength} bytes, type: ${mimeType}`);
```

### 4. `storage_path` 지원 추가

```typescript
// 3. storage_path가 있으면 Supabase Storage에서 조회
if (!audioData && (generation as any).storage_path) {
  try {
    const storagePath = (generation as any).storage_path;
    console.log(`[execute-schedules] Loading audio from storage path: ${storagePath}`);
    const { data: blobData, error: blobError } = await supabaseClient.storage
      .from("tts-audio")
      .download(storagePath);

    if (!blobError && blobData) {
      audioData = await blobData.arrayBuffer();
      mimeType = blobData.type || mimeType;
      console.log(`[execute-schedules] Successfully loaded audio from storage path: ${audioData.byteLength} bytes`);
    }
  } catch (err) {
    console.warn(`[execute-schedules] Failed to load from storage path:`, err);
  }
}
```

---

## 🚀 배포 방법

### 1. Edge Function 배포

```bash
cd /Users/june/Documents/GitHub/voicecraft-designer

# Supabase 함수 배포
npx supabase functions deploy execute-schedules
```

### 2. 배포 확인

**Supabase 대시보드에서 확인:**
```
Supabase 대시보드 → Edge Functions → execute-schedules
```

**버전 확인:**
- 최신 버전이 배포되었는지 확인

---

## ✅ 테스트 방법

### 1. 작은 파일 삭제

**`cleanup-small-files.php` 실행:**
```
GET https://nanum.online/tts/api/broadcast/cleanup-small-files.php
```

또는 Hostinger File Manager에서 수동 삭제

### 2. 실제 오디오로 스케줄 생성

1. **웹 서비스에서 TTS 음원 생성**
   - 실제 텍스트로 TTS 생성
   - 음원 생성 완료 확인

2. **스케줄 생성**
   - 생성된 음원 선택
   - 채널 선택
   - 시간 설정 (예: 5분 후)

### 3. 자동 송출 확인

1. **Supabase 로그 확인**
   ```
   Supabase 대시보드 → Logs & Analytics → Edge Functions → execute-schedules
   ```

2. **확인할 로그 메시지:**
   ```
   [execute-schedules] Downloading audio from URL: {audio_url}
   [execute-schedules] Successfully downloaded audio from URL: {size} bytes
   [execute-schedules] Audio data loaded: {size} bytes, type: {mimeType}
   [execute-schedules] Sending audio to {endpoint} ({size} bytes, {mimeType})
   ```

3. **저장된 파일 확인**
   ```
   https://nanum.online/tts/api/broadcast/check-audio.php
   ```
   - 파일 크기가 100 bytes 이상인지 확인
   - MP3 시그니처가 유효한지 확인

4. **플레이어 확인**
   ```
   https://nanum.online/tts/api/broadcast/player.html
   ```
   - 오디오 목록 확인
   - 오디오 재생 확인

---

## 📋 체크리스트

### Edge Function 배포
- [ ] `execute-schedules` 함수 배포
- [ ] 배포 버전 확인

### 파일 정리
- [ ] `cleanup-small-files.php` 실행하여 작은 파일 삭제
- [ ] 또는 Hostinger File Manager에서 수동 삭제

### 테스트
- [ ] 실제 TTS 음원으로 스케줄 생성
- [ ] Supabase 로그에서 오디오 다운로드 확인
- [ ] 전송된 오디오 크기 확인 (수 KB 이상)
- [ ] 저장된 파일 크기 확인 (100 bytes 이상)
- [ ] 플레이어에서 오디오 재생 확인

---

**이제 `execute-schedules` 함수를 배포하고, 실제 오디오 데이터가 전송되는지 확인해보세요!** 🚀

