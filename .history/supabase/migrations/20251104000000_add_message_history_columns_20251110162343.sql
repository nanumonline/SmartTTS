-- tts_message_history 테이블에 필요한 컬럼 추가
-- tags, is_template, template_name, template_category 컬럼 추가

-- tags 컬럼 추가 (JSONB 타입으로 태그 배열 저장)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tts_message_history' 
    AND column_name = 'tags'
  ) THEN
    ALTER TABLE public.tts_message_history 
    ADD COLUMN tags TEXT;
  END IF;
END $$;

-- is_template 컬럼 추가 (템플릿 여부)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tts_message_history' 
    AND column_name = 'is_template'
  ) THEN
    ALTER TABLE public.tts_message_history 
    ADD COLUMN is_template BOOLEAN DEFAULT false;
  END IF;
END $$;

-- template_name 컬럼 추가 (템플릿 이름)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tts_message_history' 
    AND column_name = 'template_name'
  ) THEN
    ALTER TABLE public.tts_message_history 
    ADD COLUMN template_name VARCHAR(255);
  END IF;
END $$;

-- template_category 컬럼 추가 (템플릿 카테고리)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tts_message_history' 
    AND column_name = 'template_category'
  ) THEN
    ALTER TABLE public.tts_message_history 
    ADD COLUMN template_category VARCHAR(50);
  END IF;
END $$;

-- 기존 데이터의 is_template을 false로 설정 (NULL인 경우)
UPDATE public.tts_message_history 
SET is_template = false 
WHERE is_template IS NULL;

