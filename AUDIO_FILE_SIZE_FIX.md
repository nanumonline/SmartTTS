# 🔧 오디오 파일 크기 문제 해결

## 🚨 발견된 문제

### 문제점

오디오 파일 크기가 **4-15 bytes**로 매우 작습니다:
- `broadcast_2025-11-20_02-13-01.mp3`: 15 bytes
- `broadcast_2025-11-20_02-10-49.mp3`: 15 bytes
- `broadcast_2025-11-20_02-10-47.mp3`: 15 bytes
- `broadcast_2025-11-20_02-10-28.mp3`: 4 bytes

**일반적인 MP3 파일 크기:**
- 최소: 수 KB (초 단위 음성)
- 보통: 수십 KB ~ 수 MB

**문제 원인:**
- 실제 오디오 데이터가 전송되지 않았을 가능성
- 테스트 데이터가 전송되었을 가능성
- `execute-schedules`에서 오디오 데이터를 제대로 로드하지 못했을 가능성

---

## ✅ 해결 방법

### 1. `index.php` 수정

**추가된 기능:**
- 오디오 데이터 크기 검증 (최소 100 bytes)
- 작은 데이터는 저장하지 않고 경고만 기록
- 로그에 경고 메시지 기록

**수정 내용:**
```php
// 오디오 데이터 크기 검증 (최소 100 bytes)
if (strlen($audioData) < 100) {
    $logFile = $logDir . '/broadcast_' . date('Y-m-d') . '.log';
    $warningMsg = sprintf(
        "[%s] WARNING: Received very small audio data: %d bytes. This may not be a valid audio file.\n",
        date('Y-m-d H:i:s'),
        strlen($audioData)
    );
    file_put_contents($logFile, $warningMsg, FILE_APPEND);
    
    // 작은 데이터는 저장하지 않고 경고만 기록
    http_response_code(200);
    echo json_encode([
        'success' => false,
        'warning' => 'Audio data too small (less than 100 bytes). File not saved.',
        'received_size' => strlen($audioData),
        'message' => 'Audio data may be incomplete or invalid'
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit();
}
```

### 2. `check-audio.php` 생성

**기능:**
- 저장된 오디오 파일 정보 확인
- 파일 헤더 확인 (MP3 시그니처 검증)
- 파일 유효성 검증

**사용법:**
```
GET https://nanum.online/tts/api/broadcast/check-audio.php
```

**응답 예시:**
```json
{
    "success": true,
    "audio_files": [
        {
            "filename": "broadcast_2025-11-20_02-13-01.mp3",
            "size": 15,
            "size_kb": 0.01,
            "modified": "2025-11-20 02:13:01",
            "header_hex": "49 44 33 03 00 00 00 00 00 00 00 00 00 00 00 00",
            "is_valid_mp3": true,
            "status": "TOO_SMALL"
        }
    ],
    "count": 1,
    "timestamp": "2025-11-20 03:22:51"
}
```

---

## 🔍 문제 진단

### 1. 오디오 파일 확인

**방법 1: `check-audio.php` 사용**
```
https://nanum.online/tts/api/broadcast/check-audio.php
```

**확인 사항:**
- 파일 크기
- MP3 시그니처 유효성
- 상태 (`TOO_SMALL`, `VALID`, `INVALID`)

### 2. Supabase 로그 확인

**`execute-schedules` 로그에서 확인:**
- 실제로 전송된 오디오 크기
- 오디오 데이터 로드 성공 여부
- 오류 메시지

**로그 확인 위치:**
```
Supabase 대시보드 → Logs & Analytics → Edge Functions → execute-schedules
```

**확인할 로그 메시지:**
```
[execute-schedules] Sending audio to {endpoint} ({size} bytes, {mimeType})
```

### 3. 오디오 데이터 로드 확인

**`execute-schedules` 함수에서 오디오 데이터를 로드하는 방법:**
1. Supabase Storage에서 로드
2. `audio_url`에서 다운로드
3. DB의 `audio_blob` 컬럼에서 로드

**확인 사항:**
- 오디오 데이터가 실제로 로드되었는지
- 오디오 데이터 크기가 올바른지

---

## 🚀 다음 단계

### 1. 파일 업로드

다음 파일을 Hostinger 서버에 업로드:

1. `index.php` - 오디오 데이터 크기 검증 추가
2. `check-audio.php` - 오디오 파일 확인 도구

### 2. 기존 작은 파일 삭제

**방법 1: Hostinger File Manager**
- `public_html/tts/api/broadcast/audio/` 폴더로 이동
- 4-15 bytes 크기의 파일 삭제

**방법 2: 새 파일로 덮어쓰기**
- 새로운 오디오 파일이 저장되면 기존 파일 자동 덮어쓰기

### 3. 테스트

1. **오디오 파일 확인**
   ```
   https://nanum.online/tts/api/broadcast/check-audio.php
   ```

2. **새 스케줄 생성**
   - 웹 서비스에서 새 스케줄 생성
   - 유효한 음원 선택
   - 채널 선택

3. **자동 송출 확인**
   - 설정된 시간에 오디오 전송
   - `index.php`에서 오디오 데이터 크기 확인
   - 저장된 파일 크기 확인

4. **플레이어 확인**
   ```
   https://nanum.online/tts/api/broadcast/player.html
   ```
   - 오디오 목록 확인
   - 오디오 재생 확인

---

## 💡 추가 확인 사항

### Supabase에서 오디오 데이터 확인

**SQL Editor에서 확인:**
```sql
SELECT 
  id,
  schedule_name,
  scheduled_time,
  status,
  generation_id,
  fail_reason
FROM tts_schedule_requests
ORDER BY scheduled_time DESC
LIMIT 10;
```

**오디오 데이터 확인:**
```sql
SELECT 
  id,
  saved_name,
  duration,
  has_audio,
  audio_url,
  LENGTH(audio_blob) as audio_size_bytes
FROM tts_generations
WHERE has_audio = true
ORDER BY created_at DESC
LIMIT 10;
```

---

## ✅ 체크리스트

### 파일 업로드
- [ ] `index.php` 업로드 (오디오 데이터 크기 검증 추가)
- [ ] `check-audio.php` 업로드 (오디오 파일 확인 도구)

### 기존 파일 정리
- [ ] 작은 오디오 파일 삭제 (선택사항)
- [ ] 오디오 디렉토리 확인

### 테스트
- [ ] `check-audio.php` 접속하여 파일 정보 확인
- [ ] 새 스케줄 생성 및 자동 송출 테스트
- [ ] 저장된 오디오 파일 크기 확인
- [ ] 플레이어에서 오디오 재생 확인

---

**이제 수정된 파일을 업로드하고, 실제 오디오 데이터가 전송되는지 확인해보세요!** 🚀

