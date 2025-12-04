# 🔍 스케줄 및 pg_cron 확인 가이드

## 🚨 문제: 오후 1시 이후 로그가 없음

오후 1시 이후 로그가 없다는 것은 `execute-schedules` 함수가 실행되지 않았을 가능성이 있습니다.

---

## ✅ 확인 사항

### 1. 스케줄이 실제로 생성되었는지 확인

**SQL Editor에서 확인:**

```sql
SELECT 
  id,
  schedule_name,
  scheduled_time,
  status,
  generation_id,
  target_channel,
  created_at
FROM tts_schedule_requests
WHERE scheduled_time >= '2025-11-20 13:00:00'
ORDER BY scheduled_time DESC
LIMIT 10;
```

**확인 사항:**
- [ ] 스케줄이 실제로 생성되었는지
- [ ] `scheduled_time`이 오후 1시 이후인지
- [ ] `status`가 'scheduled'인지
- [ ] `generation_id`가 유효한지
- [ ] `target_channel`이 설정되어 있는지

---

### 2. pg_cron이 작동하는지 확인

**SQL Editor에서 확인:**

```sql
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  nodename,
  nodeport,
  database,
  username,
  command
FROM cron.job
WHERE jobname = 'execute-schedules-job';
```

**확인 사항:**
- [ ] `active`가 `true`인지
- [ ] `schedule`이 `* * * * *` (매분)인지
- [ ] `command`가 올바른지

**pg_cron 로그 확인:**

```sql
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid = (
  SELECT jobid FROM cron.job WHERE jobname = 'execute-schedules-job'
)
ORDER BY start_time DESC
LIMIT 10;
```

**확인 사항:**
- [ ] 최근 실행 기록이 있는지
- [ ] `status`가 'succeeded'인지
- [ ] `return_message`에 오류가 없는지

---

### 3. 수동으로 함수 실행 테스트

**터미널에서 실행:**

```bash
curl -X POST https://gxxralruivyhdxyftsrg.supabase.co/functions/v1/execute-schedules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"trigger": "manual"}'
```

**또는 Supabase 대시보드에서:**
1. Edge Functions → `execute-schedules` 선택
2. "Invoke function" 버튼 클릭
3. 로그 확인

**확인 사항:**
- [ ] 함수가 정상 실행되는지
- [ ] 로그에 메시지가 표시되는지
- [ ] 오디오 전송이 이루어지는지

---

### 4. 스케줄 시간 확인

**현재 시간과 스케줄 시간 비교:**

```sql
SELECT 
  id,
  schedule_name,
  scheduled_time,
  status,
  NOW() as current_time,
  scheduled_time - NOW() as time_until_execution
FROM tts_schedule_requests
WHERE status = 'scheduled'
ORDER BY scheduled_time ASC
LIMIT 10;
```

**확인 사항:**
- [ ] 스케줄 시간이 현재 시간보다 미래인지
- [ ] 시간대가 올바른지 (UTC vs KST)

---

## 🔧 문제 해결

### 문제 1: pg_cron이 비활성화됨

**해결 방법:**

```sql
-- pg_cron 활성화
UPDATE cron.job
SET active = true
WHERE jobname = 'execute-schedules-job';
```

### 문제 2: pg_cron이 실행되지 않음

**해결 방법:**

```sql
-- pg_cron 확장 확인
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- pg_cron이 없으면 설치
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### 문제 3: 스케줄이 생성되지 않음

**해결 방법:**
- 웹 서비스에서 스케줄 다시 생성
- 스케줄 생성 시 시간 확인 (오후 1시 이후)

### 문제 4: 스케줄 시간이 과거

**해결 방법:**
- 스케줄 시간을 현재 시간보다 미래로 설정
- 예: 현재 시간 + 5분

---

## 🚀 빠른 테스트 방법

### 1. 수동으로 함수 실행

**터미널에서:**

```bash
curl -X POST https://gxxralruivyhdxyftsrg.supabase.co/functions/v1/execute-schedules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"trigger": "manual"}'
```

**Supabase 대시보드에서:**
1. Edge Functions → `execute-schedules` 선택
2. "Invoke function" 버튼 클릭

### 2. 즉시 실행할 스케줄 생성

**웹 서비스에서:**
1. 스케줄 관리 페이지로 이동
2. 새 스케줄 생성
3. 시간: 현재 시간 + 2분
4. 저장

### 3. 로그 확인

**Supabase 대시보드:**
```
Logs & Analytics → Edge Functions → execute-schedules
```

**확인 사항:**
- [ ] 함수 실행 로그 확인
- [ ] 오디오 전송 메시지 확인
- [ ] 오디오 크기 확인

---

## 📋 체크리스트

### 스케줄 확인
- [ ] SQL Editor에서 스케줄 존재 확인
- [ ] 스케줄 시간이 올바른지 확인
- [ ] 스케줄 상태가 'scheduled'인지 확인

### pg_cron 확인
- [ ] pg_cron이 활성화되어 있는지 확인
- [ ] pg_cron 실행 기록 확인
- [ ] pg_cron 오류 확인

### 수동 테스트
- [ ] 함수 수동 실행
- [ ] 로그 확인
- [ ] 오디오 전송 확인

---

**먼저 SQL Editor에서 스케줄과 pg_cron 상태를 확인해보세요!** 🚀

