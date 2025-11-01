-- TTS 서비스 데이터베이스 스키마
-- 모든 사용자 데이터를 계정별로 관리

-- 1. 음원 생성 이력 테이블
CREATE TABLE IF NOT EXISTS public.tts_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  purpose VARCHAR(50) NOT NULL DEFAULT 'announcement',
  purpose_label VARCHAR(100),
  voice_id VARCHAR(255) NOT NULL,
  voice_name VARCHAR(255),
  saved_name VARCHAR(255),
  text_preview TEXT,
  text_length INTEGER DEFAULT 0,
  duration DECIMAL(10, 2),
  language VARCHAR(10) DEFAULT 'ko',
  model VARCHAR(100),
  style VARCHAR(50),
  speed DECIMAL(5, 2) DEFAULT 1.0,
  pitch_shift INTEGER DEFAULT 0,
  audio_blob BYTEA, -- 오디오 데이터 (Blob)
  audio_url TEXT, -- 스토리지 URL 또는 blob URL
  cache_key VARCHAR(255),
  status VARCHAR(20) DEFAULT 'ready', -- ready, mock, error
  has_audio BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 외래 키 제약조건 추가 (존재하지 않을 때만)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tts_generations_user_id_fkey'
  ) THEN
    ALTER TABLE public.tts_generations 
    ADD CONSTRAINT tts_generations_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. 즐겨찾기 음성 테이블
CREATE TABLE IF NOT EXISTS public.tts_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  voice_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, voice_id)
);

-- 외래 키 제약조건 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tts_favorites_user_id_fkey'
  ) THEN
    ALTER TABLE public.tts_favorites 
    ADD CONSTRAINT tts_favorites_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. 사용자 설정 테이블
CREATE TABLE IF NOT EXISTS public.tts_user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  selected_purpose VARCHAR(50) DEFAULT 'announcement',
  voice_settings JSONB DEFAULT '{}',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 외래 키 제약조건 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tts_user_settings_user_id_fkey'
  ) THEN
    ALTER TABLE public.tts_user_settings 
    ADD CONSTRAINT tts_user_settings_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. 클론 요청 테이블
CREATE TABLE IF NOT EXISTS public.tts_clone_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  target_name VARCHAR(255) NOT NULL,
  base_voice_id VARCHAR(255) NOT NULL,
  base_voice_name VARCHAR(255),
  language VARCHAR(10) DEFAULT 'ko',
  memo TEXT,
  sample_file BYTEA, -- 샘플 오디오 파일 (Blob)
  sample_name VARCHAR(255),
  youtube_url TEXT,
  sample_type VARCHAR(20) DEFAULT 'file', -- file, youtube
  voice_id VARCHAR(255), -- 생성된 클론 음성 ID
  voice_name VARCHAR(255),
  gender VARCHAR(20),
  status VARCHAR(20) DEFAULT 'processing', -- processing, completed, failed
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 외래 키 제약조건 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tts_clone_requests_user_id_fkey'
  ) THEN
    ALTER TABLE public.tts_clone_requests 
    ADD CONSTRAINT tts_clone_requests_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 5. 믹싱 상태 테이블
CREATE TABLE IF NOT EXISTS public.tts_mixing_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  generation_id UUID,
  settings JSONB NOT NULL DEFAULT '{}', -- MixingState 전체를 JSON으로 저장
  mixed_audio_blob BYTEA, -- 믹싱된 오디오 (Blob)
  mixed_audio_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, generation_id)
);

-- 외래 키 제약조건 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tts_mixing_states_user_id_fkey'
  ) THEN
    ALTER TABLE public.tts_mixing_states 
    ADD CONSTRAINT tts_mixing_states_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tts_mixing_states_generation_id_fkey'
  ) THEN
    ALTER TABLE public.tts_mixing_states 
    ADD CONSTRAINT tts_mixing_states_generation_id_fkey 
    FOREIGN KEY (generation_id) REFERENCES public.tts_generations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 6. 예약 요청 테이블
CREATE TABLE IF NOT EXISTS public.tts_schedule_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  generation_id UUID,
  target_channel VARCHAR(100) NOT NULL,
  target_name VARCHAR(255),
  scheduled_time TIMESTAMPTZ NOT NULL,
  repeat_option VARCHAR(20) DEFAULT 'once', -- once, daily, weekly
  status VARCHAR(20) DEFAULT 'scheduled', -- scheduled, sent, failed
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  fail_reason TEXT,
  mixing_state JSONB -- MixingState (있는 경우)
);

-- 외래 키 제약조건 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tts_schedule_requests_user_id_fkey'
  ) THEN
    ALTER TABLE public.tts_schedule_requests 
    ADD CONSTRAINT tts_schedule_requests_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tts_schedule_requests_generation_id_fkey'
  ) THEN
    ALTER TABLE public.tts_schedule_requests 
    ADD CONSTRAINT tts_schedule_requests_generation_id_fkey 
    FOREIGN KEY (generation_id) REFERENCES public.tts_generations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 7. 검수 상태 테이블
CREATE TABLE IF NOT EXISTS public.tts_review_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  generation_id UUID NOT NULL,
  status VARCHAR(20) DEFAULT 'draft', -- draft, review, approved, rejected
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, generation_id)
);

-- 외래 키 제약조건 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tts_review_states_user_id_fkey'
  ) THEN
    ALTER TABLE public.tts_review_states 
    ADD CONSTRAINT tts_review_states_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tts_review_states_generation_id_fkey'
  ) THEN
    ALTER TABLE public.tts_review_states 
    ADD CONSTRAINT tts_review_states_generation_id_fkey 
    FOREIGN KEY (generation_id) REFERENCES public.tts_generations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 8. 메시지 이력 테이블
CREATE TABLE IF NOT EXISTS public.tts_message_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  text TEXT NOT NULL,
  purpose VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 외래 키 제약조건 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tts_message_history_user_id_fkey'
  ) THEN
    ALTER TABLE public.tts_message_history 
    ADD CONSTRAINT tts_message_history_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 9. 음성 카탈로그 테이블 (일별 동기화)
CREATE TABLE IF NOT EXISTS public.tts_voice_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_id VARCHAR(255) NOT NULL UNIQUE,
  voice_data JSONB NOT NULL, -- Supertone API에서 가져온 전체 음성 데이터
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tts_generations_user_id ON public.tts_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_tts_generations_created_at ON public.tts_generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tts_favorites_user_id ON public.tts_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_tts_clone_requests_user_id ON public.tts_clone_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_tts_mixing_states_user_id ON public.tts_mixing_states(user_id);
CREATE INDEX IF NOT EXISTS idx_tts_mixing_states_generation_id ON public.tts_mixing_states(generation_id);
CREATE INDEX IF NOT EXISTS idx_tts_schedule_requests_user_id ON public.tts_schedule_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_tts_schedule_requests_scheduled_time ON public.tts_schedule_requests(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_tts_review_states_user_id ON public.tts_review_states(user_id);
CREATE INDEX IF NOT EXISTS idx_tts_review_states_generation_id ON public.tts_review_states(generation_id);
CREATE INDEX IF NOT EXISTS idx_tts_message_history_user_id ON public.tts_message_history(user_id);
CREATE INDEX IF NOT EXISTS idx_tts_message_history_updated_at ON public.tts_message_history(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tts_voice_catalog_synced_at ON public.tts_voice_catalog(synced_at DESC);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- updated_at 트리거 적용
DROP TRIGGER IF EXISTS update_tts_generations_updated_at ON public.tts_generations;
CREATE TRIGGER update_tts_generations_updated_at
  BEFORE UPDATE ON public.tts_generations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_tts_user_settings_updated_at ON public.tts_user_settings;
CREATE TRIGGER update_tts_user_settings_updated_at
  BEFORE UPDATE ON public.tts_user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_tts_mixing_states_updated_at ON public.tts_mixing_states;
CREATE TRIGGER update_tts_mixing_states_updated_at
  BEFORE UPDATE ON public.tts_mixing_states
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_tts_review_states_updated_at ON public.tts_review_states;
CREATE TRIGGER update_tts_review_states_updated_at
  BEFORE UPDATE ON public.tts_review_states
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_tts_message_history_updated_at ON public.tts_message_history;
CREATE TRIGGER update_tts_message_history_updated_at
  BEFORE UPDATE ON public.tts_message_history
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_tts_voice_catalog_updated_at ON public.tts_voice_catalog;
CREATE TRIGGER update_tts_voice_catalog_updated_at
  BEFORE UPDATE ON public.tts_voice_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RLS (Row Level Security) 정책 설정
ALTER TABLE public.tts_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tts_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tts_user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tts_clone_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tts_mixing_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tts_schedule_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tts_review_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tts_message_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tts_voice_catalog ENABLE ROW LEVEL SECURITY; -- 공개 읽기, 관리자만 쓰기

-- RLS 정책: 사용자는 자신의 데이터만 접근 가능 (존재하지 않을 때만 생성)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'tts_generations' 
    AND policyname = 'Users can view own generations'
  ) THEN
    CREATE POLICY "Users can view own generations" ON public.tts_generations
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- 나머지 RLS 정책들도 존재 확인 후 생성
DO $$
BEGIN
  -- tts_generations 정책들
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tts_generations' AND policyname = 'Users can insert own generations') THEN
    CREATE POLICY "Users can insert own generations" ON public.tts_generations
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tts_generations' AND policyname = 'Users can update own generations') THEN
    CREATE POLICY "Users can update own generations" ON public.tts_generations
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tts_generations' AND policyname = 'Users can delete own generations') THEN
    CREATE POLICY "Users can delete own generations" ON public.tts_generations
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
  
  -- tts_favorites 정책들
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tts_favorites' AND policyname = 'Users can view own favorites') THEN
    CREATE POLICY "Users can view own favorites" ON public.tts_favorites
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tts_favorites' AND policyname = 'Users can manage own favorites') THEN
    CREATE POLICY "Users can manage own favorites" ON public.tts_favorites
      FOR ALL USING (auth.uid() = user_id);
  END IF;
  
  -- tts_user_settings 정책들
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tts_user_settings' AND policyname = 'Users can view own settings') THEN
    CREATE POLICY "Users can view own settings" ON public.tts_user_settings
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tts_user_settings' AND policyname = 'Users can manage own settings') THEN
    CREATE POLICY "Users can manage own settings" ON public.tts_user_settings
      FOR ALL USING (auth.uid() = user_id);
  END IF;
  
  -- tts_clone_requests 정책들
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tts_clone_requests' AND policyname = 'Users can view own clone requests') THEN
    CREATE POLICY "Users can view own clone requests" ON public.tts_clone_requests
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tts_clone_requests' AND policyname = 'Users can manage own clone requests') THEN
    CREATE POLICY "Users can manage own clone requests" ON public.tts_clone_requests
      FOR ALL USING (auth.uid() = user_id);
  END IF;
  
  -- tts_mixing_states 정책들
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tts_mixing_states' AND policyname = 'Users can view own mixing states') THEN
    CREATE POLICY "Users can view own mixing states" ON public.tts_mixing_states
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tts_mixing_states' AND policyname = 'Users can manage own mixing states') THEN
    CREATE POLICY "Users can manage own mixing states" ON public.tts_mixing_states
      FOR ALL USING (auth.uid() = user_id);
  END IF;
  
  -- tts_schedule_requests 정책들
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tts_schedule_requests' AND policyname = 'Users can view own schedule requests') THEN
    CREATE POLICY "Users can view own schedule requests" ON public.tts_schedule_requests
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tts_schedule_requests' AND policyname = 'Users can manage own schedule requests') THEN
    CREATE POLICY "Users can manage own schedule requests" ON public.tts_schedule_requests
      FOR ALL USING (auth.uid() = user_id);
  END IF;
  
  -- tts_review_states 정책들
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tts_review_states' AND policyname = 'Users can view own review states') THEN
    CREATE POLICY "Users can view own review states" ON public.tts_review_states
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tts_review_states' AND policyname = 'Users can manage own review states') THEN
    CREATE POLICY "Users can manage own review states" ON public.tts_review_states
      FOR ALL USING (auth.uid() = user_id);
  END IF;
  
  -- tts_message_history 정책들
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tts_message_history' AND policyname = 'Users can view own message history') THEN
    CREATE POLICY "Users can view own message history" ON public.tts_message_history
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tts_message_history' AND policyname = 'Users can manage own message history') THEN
    CREATE POLICY "Users can manage own message history" ON public.tts_message_history
      FOR ALL USING (auth.uid() = user_id);
  END IF;
  
  -- tts_voice_catalog 정책들 (공개 읽기, 공개 쓰기 - RLS 완화)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tts_voice_catalog' AND policyname = 'Anyone can view voice catalog') THEN
    CREATE POLICY "Anyone can view voice catalog" ON public.tts_voice_catalog
      FOR SELECT USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tts_voice_catalog' AND policyname = 'Anyone can insert voice catalog') THEN
    CREATE POLICY "Anyone can insert voice catalog" ON public.tts_voice_catalog
      FOR INSERT WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tts_voice_catalog' AND policyname = 'Anyone can update voice catalog') THEN
    CREATE POLICY "Anyone can update voice catalog" ON public.tts_voice_catalog
      FOR UPDATE USING (true);
  END IF;
END $$;

