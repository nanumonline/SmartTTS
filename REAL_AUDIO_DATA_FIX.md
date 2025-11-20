# 🔧 실제 오디오 데이터 전송 문제 해결

## 🚨 발견된 문제

### 문제점

오디오 파일이 **테스트 문자열**로 저장되고 있습니다:
- `broadcast_2025-11-20_02-10-28.mp3`: 4 bytes - 헤더: `74 65 73 74` = "test"
- `broadcast_2025-11-20_02-10-47.mp3`: 15 bytes - 헤더: `74 65 73 74 20 61 75 64 69 6F 20 64 61 74 61` = "test audio data"

**원인:**
- 실제 오디오 데이터가 전송되지 않음
- `execute-schedules` 함수에서 오디오 데이터를 제대로 로드하지 못함
- 테스트 데이터가 전송됨

---

## 🔍 문제 진단

### 1. Supabase 로그 확인

**`execute-schedules` 로그에서 확인:**

```
Supabase 대시보드 → Logs & Analytics → Edge Functions → execute-schedules
```

**확인할 로그 메시지:**
```
[execute-schedules] Sending audio to {endpoint} ({size} bytes, {mimeType})
```

**실제로 전송된 오디오 크기를 확인하세요:**
- 실제 오디오 파일: 수 KB ~ 수 MB
- 테스트 데이터: 4-15 bytes

### 2. 오디오 데이터 로드 확인

**`execute-schedules` 함수에서 오디오 데이터를 로드하는 방법:**

1. **Supabase Storage에서 로드** (우선)
   ```typescript
   const { data: audioBlob, error: storageError } = await supabaseClient.storage
     .from('tts-audio')
     .download(generation.storage_path);
   ```

2. **`audio_url`에서 다운로드**
   ```typescript
   const audioResponse = await fetch(generation.audio_url);
   const audioBlob = await audioResponse.blob();
   ```

3. **DB의 `audio_blob` 컬럼에서 로드**
   ```typescript
   const { data: blobRow } = await supabaseClient
     .from("tts_generations")
     .select("audio_blob")
     .eq("id", generation.id)
     .single();
   ```

---

## ✅ 해결 방법

### 1. 기존 작은 파일 삭제

**방법 1: `cleanup-small-files.php` 사용**

```
GET https://nanum.online/tts/api/broadcast/cleanup-small-files.php
```

100 bytes 미만의 파일을 자동으로 삭제합니다.

**방법 2: Hostinger File Manager**

1. `public_html/tts/api/broadcast/audio/` 폴더로 이동
2. 4-15 bytes 크기의 파일 선택
3. 삭제

### 2. `execute-schedules` 함수 확인

**오디오 데이터 로드 로직 확인:**

1. **Storage에서 오디오 로드**
   - `storage_path`가 올바른지 확인
   - Storage 버킷 권한 확인

2. **오디오 URL에서 다운로드**
   - `audio_url`이 유효한지 확인
   - URL이 접근 가능한지 확인

3. **DB blob에서 로드**
   - `audio_blob` 컬럼에 데이터가 있는지 확인
   - blob 데이터 변환 로직 확인

### 3. 실제 오디오로 테스트

**테스트 방법:**

1. **웹 서비스에서 TTS 음원 생성**
   - 실제 텍스트로 TTS 생성
   - 음원 생성 완료 확인

2. **스케줄 생성**
   - 생성된 음원 선택
   - 채널 선택
   - 시간 설정

3. **자동 송출 확인**
   - 설정된 시간에 오디오 전송
   - Supabase 로그에서 전송 크기 확인
   - 저장된 파일 크기 확인 (100 bytes 이상)

---

## 📋 체크리스트

### 파일 정리
- [ ] `cleanup-small-files.php` 실행하여 작은 파일 삭제
- [ ] 또는 Hostinger File Manager에서 수동 삭제

### Supabase 로그 확인
- [ ] `execute-schedules` 로그 접속
- [ ] 전송된 오디오 크기 확인 (수 KB 이상인지)
- [ ] 오디오 로드 오류 메시지 확인

### 오디오 데이터 확인
- [ ] TTS 음원이 실제로 생성되었는지 확인
- [ ] Storage에 오디오 파일이 저장되었는지 확인
- [ ] `audio_url`이 유효한지 확인

### 테스트
- [ ] 실제 TTS 음원으로 스케줄 생성
- [ ] 자동 송출 확인
- [ ] 저장된 오디오 파일 크기 확인 (100 bytes 이상)
- [ ] 플레이어에서 오디오 재생 확인

---

## 🔧 `execute-schedules` 함수 개선

### 오디오 데이터 로드 순서

**우선순위:**
1. **Supabase Storage** (가장 안정적)
2. **`audio_url`** (Public URL)
3. **DB `audio_blob`** (백업)

### 오디오 데이터 검증

**로드한 오디오 데이터 검증:**
```typescript
// 최소 크기 검증 (100 bytes)
if (!audioData || audioData.byteLength < 100) {
    console.error('Audio data too small:', audioData?.byteLength);
    // 오류 처리
}
```

---

## 💡 문제 해결 팁

### 1. Supabase Storage 확인

**Storage 버킷 확인:**
```
Supabase 대시보드 → Storage → tts-audio 버킷
```

**확인 사항:**
- 오디오 파일이 실제로 저장되어 있는지
- 파일 경로 (`storage_path`)가 올바른지
- 버킷 권한이 올바른지

### 2. 오디오 URL 확인

**Public URL 확인:**
```
웹 서비스 → 음원 목록 → 오디오 재생 확인
```

**확인 사항:**
- `audio_url`이 유효한지
- URL이 접근 가능한지
- 오디오가 실제로 재생되는지

### 3. DB 확인

**SQL Editor에서 확인:**
```sql
SELECT 
  id,
  saved_name,
  duration,
  has_audio,
  audio_url,
  storage_path,
  LENGTH(audio_blob) as audio_size_bytes
FROM tts_generations
WHERE has_audio = true
ORDER BY created_at DESC
LIMIT 10;
```

**확인 사항:**
- `has_audio`가 `true`인지
- `audio_url` 또는 `storage_path`가 있는지
- `audio_blob` 크기가 0이 아닌지

---

## 🚀 다음 단계

1. **작은 파일 삭제**
   - `cleanup-small-files.php` 실행

2. **Supabase 로그 확인**
   - `execute-schedules` 로그 확인
   - 실제 전송된 오디오 크기 확인

3. **실제 오디오로 테스트**
   - TTS 음원 생성
   - 스케줄 생성 및 자동 송출

4. **결과 확인**
   - 저장된 파일 크기 확인 (100 bytes 이상)
   - 플레이어에서 재생 확인

---

**먼저 `cleanup-small-files.php`를 실행하여 작은 파일을 삭제하고, Supabase 로그를 확인하여 실제 오디오 데이터가 전송되는지 확인해보세요!** 🚀

