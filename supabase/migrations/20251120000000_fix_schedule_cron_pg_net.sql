-- pg_cron 수정: net.http_post 대신 pg_net 사용
-- Supabase에서는 pg_net 확장을 사용하여 HTTP 요청을 보냅니다

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
-- pg_net을 사용하여 HTTP POST 요청 전송
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

-- 참고:
-- 1. pg_net 확장이 활성화되어 있어야 합니다
-- 2. Edge Function은 verify_jwt = false로 설정되어 있어 인증 없이 호출 가능합니다
-- 3. Edge Function 내부에서 SUPABASE_SERVICE_ROLE_KEY 환경 변수를 사용합니다

