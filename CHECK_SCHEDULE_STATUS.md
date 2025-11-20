# 🔍 스케줄 상태 확인 가이드

## 📋 현재 상황

**로그 분석:**
- 모든 요청이 `status_code: 200`으로 성공
- 함수는 정상적으로 실행됨
- 하지만 실제 스케줄 처리 결과는 알 수 없음

**확인 필요:**
1. 실제 로그 메시지 (console.log 출력)
2. 스케줄 상태 (데이터베이스)
3. 응답 본문 내용

---

## 🔍 1단계: 실제 로그 메시지 확인

### Supabase 대시보드에서:

1. **Logs** → **Edge Functions**
2. `execute-schedules` 함수 선택
3. 실패한 시간대의 로그 클릭
4. **"View Logs"** 또는 **"Invocations"** 탭 확인

**확인할 로그:**
```
[execute-schedules] Processing schedule ...
[execute-schedules] Audio data loaded: ...
[execute-schedules] Found channel: ...
[execute-schedules] Sending audio to endpoint: ...
[execute-schedules] ❌ Failed to send ...
```

---

## 🔍 2단계: 스케줄 상태 확인 (데이터베이스)

### Supabase SQL Editor에서 실행:

```sql
-- 8:40, 42, 45분 스케줄 확인
SELECT 
  id,
  schedule_name,
  scheduled_time,
  status,
  fail_reason,
  target_channel,
  generation_id,
  created_at,
  updated_at
FROM tts_schedule_requests
WHERE scheduled_time >= '2025-11-20 08:35:00'
  AND scheduled_time <= '2025-11-20 08:50:00'
ORDER BY scheduled_time;
```

**확인 사항:**
- `status`가 "failed"인지
- `fail_reason` 메시지 확인
- `scheduled_time`이 올바른지

---

## 🔍 3단계: 응답 본문 확인

### Supabase 대시보드에서:

1. **Logs** → **Edge Functions**
2. `execute-schedules` 함수 선택
3. 실패한 시간대의 로그 클릭
4. **"Response"** 또는 **"Body"** 확인

**기대 응답:**
```json
{
  "message": "Schedule execution completed",
  "executed": 0,
  "failed": 1,
  "results": [
    {
      "scheduleId": "...",
      "status": "failed",
      "reason": "..."
    }
  ]
}
```

---

## 🔍 4단계: 채널 설정 확인

### Supabase SQL Editor에서 실행:

```sql
-- 활성화된 채널 확인
SELECT 
  id,
  type,
  name,
  endpoint,
  enabled,
  user_id,
  config
FROM tts_channels
WHERE enabled = true;
```

**확인 사항:**
- 채널이 활성화되어 있는지
- `endpoint` URL이 올바른지
- `target_channel`과 일치하는지

---

## 🔍 5단계: 오디오 데이터 확인

### Supabase SQL Editor에서 실행:

```sql
-- Generation 확인 (스케줄의 generation_id 사용)
SELECT 
  id,
  audio_url,
  cache_key,
  mime_type,
  created_at
FROM tts_generations
WHERE id IN (
  SELECT generation_id 
  FROM tts_schedule_requests
  WHERE scheduled_time >= '2025-11-20 08:35:00'
    AND scheduled_time <= '2025-11-20 08:50:00'
);
```

**확인 사항:**
- 오디오 데이터가 있는지
- `audio_url`, `cache_key`가 올바른지

---

## 🧪 디버깅 쿼리 (통합)

### 모든 정보를 한 번에 확인:

```sql
SELECT 
  s.id,
  s.schedule_name,
  s.scheduled_time,
  s.status,
  s.fail_reason,
  s.target_channel,
  s.generation_id,
  c.name as channel_name,
  c.endpoint as channel_endpoint,
  c.enabled as channel_enabled,
  g.audio_url,
  g.cache_key,
  g.mime_type
FROM tts_schedule_requests s
LEFT JOIN tts_channels c ON c.id = s.target_channel OR c.type = s.target_channel
LEFT JOIN tts_generations g ON g.id = s.generation_id
WHERE s.scheduled_time >= '2025-11-20 08:35:00'
  AND s.scheduled_time <= '2025-11-20 08:50:00'
ORDER BY s.scheduled_time;
```

---

## 📝 다음 단계

1. **실제 로그 메시지 확인** (Supabase 대시보드)
2. **스케줄 상태 확인** (SQL 쿼리)
3. **응답 본문 확인** (Supabase 대시보드)
4. **채널 설정 확인** (SQL 쿼리)
5. **오디오 데이터 확인** (SQL 쿼리)

**결과를 공유해 주시면 정확한 원인을 파악하겠습니다!** 🔍

