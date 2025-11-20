-- 스케줄 실행을 위한 pg_cron 설정
-- 1분마다 execute-schedules Edge Function을 호출하여 스케줄된 방송을 실행합니다.

-- pg_cron 확장 활성화 (이미 활성화되어 있다면 무시됨)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 기존 작업이 있다면 삭제 (에러 방지를 위해 조건부 처리)
DO $$
BEGIN
  -- cron.job 테이블에서 작업이 존재하는지 확인
  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'execute-schedules-job'
  ) THEN
    PERFORM cron.unschedule('execute-schedules-job');
    RAISE NOTICE '기존 작업 삭제 완료: execute-schedules-job';
  ELSE
    RAISE NOTICE '기존 작업이 없습니다. 새로 생성합니다.';
  END IF;
END $$;

-- 1분마다 execute-schedules Edge Function 호출
-- Supabase Edge Function URL 형식: https://{project_ref}.supabase.co/functions/v1/{function_name}
-- 
-- 주의: Edge Function은 verify_jwt = false로 설정되어 있어 인증 없이 호출 가능합니다.
-- Edge Function 내부에서 SUPABASE_SERVICE_ROLE_KEY 환경 변수를 사용하여
-- 데이터베이스에 접근하므로 보안상 문제없습니다.
SELECT cron.schedule(
  'execute-schedules-job',
  '* * * * *', -- 매분 실행 (cron 형식: 분 시 일 월 요일)
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
-- 1. Edge Function은 verify_jwt = false로 설정되어 있어 인증 없이 호출 가능합니다
-- 2. Edge Function 내부에서 SUPABASE_SERVICE_ROLE_KEY 환경 변수를 사용하므로 보안상 안전합니다
-- 3. 이 마이그레이션은 Supabase 대시보드의 SQL Editor에서 직접 실행하거나,
--    Supabase CLI를 통해 적용할 수 있습니다
-- 4. pg_cron이 활성화되지 않은 경우, 외부 cron 서비스를 사용하세요 (GitHub Actions, Vercel Cron 등)
-- 5. Edge Function 배포 후 Secrets에 SUPABASE_SERVICE_ROLE_KEY를 설정해야 합니다

