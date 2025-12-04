# 🔧 pg_cron 오류 수정 가이드

## 🚨 발견된 문제

### 오류 메시지
```
ERROR: schema "net" does not exist
LINE 3:     net.http_post(
```

### 원인
- `net.http_post` 함수를 사용하려고 했지만 `net` 확장이 설치되지 않음
- Supabase에서는 `pg_net` 확장을 사용해야 함

---

## ✅ 해결 방법

### 1. 새 마이그레이션 파일 생성

**파일:** `supabase/migrations/20251120000000_fix_schedule_cron_pg_net.sql`

이 파일은 `pg_net` 확장을 사용하도록 수정된 버전입니다.

### 2. 마이그레이션 실행

**Supabase SQL Editor에서 실행:**

```sql
-- pg_net 확장 활성화
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 기존 작업 삭제
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'execute-schedules-job'
  ) THEN
    PERFORM cron.unschedule('execute-schedules-job');
    RAISE NOTICE '기존 작업 삭제 완료: execute-schedules-job';
  END IF;
END $$;

-- 1분마다 execute-schedules Edge Function 호출
SELECT cron.schedule(
  'execute-schedules-job',
  '* * * * *', -- 매분 실행
  $$
  SELECT
    net.http_post(
      url := 'https://gxxralruivyhdxyftsrg.supabase.co/functions/v1/execute-schedules',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('trigger', 'cron')
    ) AS request_id;
  $$
);
```

---

## 📋 실행 단계

### 1단계: SQL Editor 열기

1. Supabase 대시보드 접속
2. SQL Editor 열기

### 2단계: 마이그레이션 실행

1. 위의 SQL 코드를 복사
2. SQL Editor에 붙여넣기
3. 실행 버튼 클릭

### 3단계: 확인

**pg_cron 작업 확인:**
```sql
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname = 'execute-schedules-job';
```

**pg_cron 실행 기록 확인:**
```sql
SELECT 
  jobid,
  runid,
  status,
  return_message,
  start_time
FROM cron.job_run_details
WHERE jobid = (
  SELECT jobid FROM cron.job WHERE jobname = 'execute-schedules-job'
)
ORDER BY start_time DESC
LIMIT 5;
```

**확인 사항:**
- [ ] `status`가 'succeeded'인지 확인
- [ ] `return_message`에 오류가 없는지 확인

---

## 🚀 테스트

### 1. 수동으로 함수 실행

**Supabase 대시보드에서:**
1. Edge Functions → `execute-schedules` 선택
2. "Invoke function" 버튼 클릭
3. 로그 확인

### 2. 자동 실행 확인

**1분 후:**
1. pg_cron 실행 기록 확인
2. `execute-schedules` 로그 확인
3. 오디오 전송 확인

---

## ⚠️ 주의사항

### 스케줄 시간 확인

현재 스케줄이 모두 **미래 날짜**(11월 26일~30일)로 설정되어 있습니다:

```sql
SELECT 
  id,
  scheduled_time,
  status
FROM tts_schedule_requests
WHERE status = 'scheduled'
ORDER BY scheduled_time ASC
LIMIT 5;
```

**오늘(11월 20일) 테스트하려면:**
- 새 스케줄 생성 시 오늘 날짜로 설정
- 또는 기존 스케줄 시간을 오늘로 수정

---

## 📋 체크리스트

### 마이그레이션 실행
- [ ] SQL Editor에서 마이그레이션 실행
- [ ] pg_net 확장 활성화 확인
- [ ] pg_cron 작업 재생성 확인

### pg_cron 확인
- [ ] pg_cron 작업이 활성화되어 있는지 확인
- [ ] pg_cron 실행 기록 확인
- [ ] 오류가 없는지 확인

### 테스트
- [ ] 수동으로 함수 실행 테스트
- [ ] 1분 후 자동 실행 확인
- [ ] 로그 확인

---

**먼저 SQL Editor에서 마이그레이션을 실행하세요!** 🚀

