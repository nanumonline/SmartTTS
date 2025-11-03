-- tts_generations 테이블의 VARCHAR(255) 필드 길이 확장
-- 이 마이그레이션은 기존 데이터에 영향을 주지 않으며, 더 긴 문자열을 저장할 수 있게 합니다.

DO $$ 
BEGIN
  -- voice_id: VARCHAR(255) → VARCHAR(500)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tts_generations' 
    AND column_name = 'voice_id'
    AND character_maximum_length = 255
  ) THEN
    ALTER TABLE public.tts_generations 
    ALTER COLUMN voice_id TYPE VARCHAR(500);
  END IF;

  -- voice_name: VARCHAR(255) → VARCHAR(500)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tts_generations' 
    AND column_name = 'voice_name'
    AND character_maximum_length = 255
  ) THEN
    ALTER TABLE public.tts_generations 
    ALTER COLUMN voice_name TYPE VARCHAR(500);
  END IF;

  -- saved_name: VARCHAR(255) → VARCHAR(500)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tts_generations' 
    AND column_name = 'saved_name'
    AND character_maximum_length = 255
  ) THEN
    ALTER TABLE public.tts_generations 
    ALTER COLUMN saved_name TYPE VARCHAR(500);
  END IF;

  -- cache_key: VARCHAR(255) → VARCHAR(500)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tts_generations' 
    AND column_name = 'cache_key'
    AND character_maximum_length = 255
  ) THEN
    ALTER TABLE public.tts_generations 
    ALTER COLUMN cache_key TYPE VARCHAR(500);
  END IF;
  
  -- mime_type 컬럼 추가 (오디오 MIME 타입 저장용)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tts_generations' 
    AND column_name = 'mime_type'
  ) THEN
    ALTER TABLE public.tts_generations 
    ADD COLUMN mime_type VARCHAR(100) DEFAULT 'audio/mpeg';
  END IF;
END $$;

