-- tts_user_settings 테이블에 storage_path 컬럼 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tts_user_settings' 
    AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE public.tts_user_settings 
    ADD COLUMN storage_path TEXT;
    
    COMMENT ON COLUMN public.tts_user_settings.storage_path IS '로컬 파일 저장 경로 (Electron 환경에서 사용)';
  END IF;
END $$;

