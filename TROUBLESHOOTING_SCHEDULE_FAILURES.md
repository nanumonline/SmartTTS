# 🔧 스케줄 실패 문제 해결 가이드

## 📋 8:40, 42, 45분 스케줄 실패 원인 확인

### 1. Supabase 로그 확인

**Edge Functions 로그 확인:**
1. Supabase 대시보드 → **Logs** → **Edge Functions**
2. `execute-schedules` 함수 선택
3. 실패한 시간대의 로그 확인

**확인 사항:**
- `[execute-schedules] Processing schedule` 로그가 있는지
- `[execute-schedules] ❌ Failed to send` 로그 확인
- 에러 메시지 확인

---

## 🔍 실패 원인별 확인 방법

### 원인 1: 스케줄이 조회되지 않음

**증상:**
- 로그에 "No schedules to execute" 메시지
- 스케줄 상태가 "scheduled"가 아님

**확인:**
```sql
SELECT id, schedule_name, scheduled_time, status, fail_reason
FROM tts_schedule_requests
WHERE scheduled_time >= NOW() - INTERVAL '15 minutes'
  AND scheduled_time <= NOW() + INTERVAL '5 minutes'
ORDER BY scheduled_time;
```

**해결:**
- 스케줄 상태가 "scheduled"인지 확인
- 시간 범위 확인 (과거 10분 ~ 미래 5분)

---

### 원인 2: 오디오 데이터 로드 실패

**증상:**
- 로그에 "No audio data available" 메시지
- `fail_reason: "Audio data not available"`

**확인:**
1. Generation ID 확인
2. 오디오 데이터 소스 확인:
   - `audio_url` (data URL 또는 HTTP URL)
   - `cache_key` (Supabase Storage)
   - `audio_blob` (DB bytea 컬럼)

**해결:**
- Generation 테이블에서 오디오 데이터 확인
- 오디오 생성이 완료되었는지 확인

---

### 원인 3: 오디오 데이터 크기 검증 실패

**증상:**
- 로그에 "Audio data too small" 메시지
- `fail_reason: "Audio data too small: X bytes"`

**확인:**
- 오디오 파일 크기가 100 bytes 이상인지 확인

**해결:**
- 오디오 생성 과정 확인
- JSON 배열 문자열 변환 확인

---

### 원인 4: 채널 조회 실패

**증상:**
- 로그에 "Channel not configured" 메시지
- `fail_reason: "Channel not configured or disabled"`

**확인:**
```sql
SELECT id, type, name, endpoint, enabled, user_id
FROM tts_channels
WHERE user_id = 'YOUR_USER_ID';
```

**해결:**
- 채널이 생성되어 있는지 확인
- 채널이 활성화(`enabled = true`)되어 있는지 확인
- `target_channel`이 올바른 UUID 또는 타입인지 확인

---

### 원인 5: 채널 endpoint 없음

**증상:**
- 로그에 "Channel endpoint not configured" 메시지
- `fail_reason: "Channel endpoint not configured"`

**확인:**
- 채널 설정에서 endpoint URL 확인
- endpoint가 올바르게 설정되어 있는지 확인

**해결:**
- 전송 채널 설정 페이지에서 endpoint URL 설정
- `https://nanum.online/tts/api/broadcast` 형식 확인

---

### 원인 6: 엔드포인트 전송 실패

**증상:**
- 로그에 "Failed to send to channel" 메시지
- HTTP 에러 코드 (404, 500 등)

**확인:**
1. 엔드포인트 URL 접근 가능 여부
2. 서버 로그 확인 (Hostinger)
3. CORS 설정 확인

**해결:**
- 엔드포인트 URL 직접 접근 테스트
- 서버 로그 확인 (`index.php` 로그)
- 네트워크 연결 확인

---

## 🧪 디버깅 단계

### 1단계: 스케줄 상태 확인

```sql
-- 실패한 스케줄 확인
SELECT 
  id,
  schedule_name,
  scheduled_time,
  status,
  fail_reason,
  target_channel,
  generation_id
FROM tts_schedule_requests
WHERE scheduled_time >= '2025-11-20 08:35:00'
  AND scheduled_time <= '2025-11-20 08:50:00'
ORDER BY scheduled_time;
```

### 2단계: 채널 설정 확인

```sql
-- 사용자의 채널 확인
SELECT 
  id,
  type,
  name,
  endpoint,
  enabled,
  config
FROM tts_channels
WHERE user_id = 'YOUR_USER_ID';
```

### 3단계: 오디오 데이터 확인

```sql
-- Generation 확인
SELECT 
  id,
  audio_url,
  cache_key,
  mime_type,
  created_at
FROM tts_generations
WHERE id = 'GENERATION_ID';
```

### 4단계: Edge Function 로그 확인

**Supabase 대시보드:**
1. **Logs** → **Edge Functions**
2. `execute-schedules` 선택
3. 실패 시간대의 로그 확인

**확인할 로그:**
- `[execute-schedules] Processing schedule`
- `[execute-schedules] Audio data loaded`
- `[execute-schedules] Found channel`
- `[execute-schedules] Sending audio to endpoint`
- `[execute-schedules] ❌ Failed to send`

---

## 🔧 일반적인 해결 방법

### 1. Edge Function 재배포

```bash
npx supabase functions deploy execute-schedules
```

### 2. 채널 설정 확인

- 전송 채널 설정 페이지에서:
  - 채널이 생성되어 있는지 확인
  - endpoint URL이 올바른지 확인
  - 채널이 활성화되어 있는지 확인

### 3. 스케줄 재생성

- 실패한 스케줄 삭제
- 새 스케줄 생성
- 시간 설정 확인 (KST 기준)

### 4. 서버 로그 확인

**Hostinger File Manager:**
- `public_html/tts/api/broadcast/logs/` 확인
- `index.php` 로그 확인

---

## 📝 체크리스트

- [ ] 스케줄 상태가 "scheduled"인지 확인
- [ ] 스케줄 시간이 올바른지 확인 (KST 기준)
- [ ] 채널이 생성되어 있고 활성화되어 있는지 확인
- [ ] 채널 endpoint URL이 올바른지 확인
- [ ] 오디오 데이터가 생성되어 있는지 확인
- [ ] Edge Function이 재배포되었는지 확인
- [ ] Supabase 로그에서 에러 메시지 확인
- [ ] 서버 로그에서 POST 요청 확인

---

**다음 단계:** Supabase 로그를 확인하여 정확한 실패 원인을 파악하세요! 🔍

