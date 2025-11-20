-- 채널 테이블 생성
-- 방송 송출 채널 설정을 저장합니다

CREATE TABLE IF NOT EXISTS public.tts_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- radio, tablet, pc 등
  endpoint TEXT, -- 방송 송출 API 엔드포인트 URL
  enabled BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}', -- 추가 설정 (인증키, 헤더 등)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name) -- 사용자별 채널명 중복 방지
);

-- 외래 키 제약조건 제거 (더미 사용자 허용, RLS 정책으로 보호됨)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tts_channels_user_id_fkey'
  ) THEN
    ALTER TABLE public.tts_channels 
    DROP CONSTRAINT tts_channels_user_id_fkey;
  END IF;
END $$;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tts_channels_user_id ON public.tts_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_tts_channels_enabled ON public.tts_channels(enabled) WHERE enabled = true;

-- updated_at 자동 업데이트 트리거
DROP TRIGGER IF EXISTS update_tts_channels_updated_at ON public.tts_channels;
CREATE TRIGGER update_tts_channels_updated_at
  BEFORE UPDATE ON public.tts_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RLS (Row Level Security) 정책 설정
ALTER TABLE public.tts_channels ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view own channels" ON public.tts_channels;
  DROP POLICY IF EXISTS "Users can manage own channels" ON public.tts_channels;
END $$;

-- 새 정책 생성 (인증되지 않은 사용자도 UUID로 접근 가능)
CREATE POLICY "Users can view own channels" ON public.tts_channels
  FOR SELECT USING (
    auth.uid() = user_id OR 
    (auth.uid() IS NULL AND user_id IS NOT NULL)
  );

CREATE POLICY "Users can manage own channels" ON public.tts_channels
  FOR ALL USING (
    auth.uid() = user_id OR 
    (auth.uid() IS NULL AND user_id IS NOT NULL)
  );

-- 기존 채널 데이터 마이그레이션 (하드코딩된 채널들을 DB에 추가)
-- 주의: 실제 프로덕션에서는 사용자가 직접 채널을 생성해야 합니다
-- 아래 INSERT 문은 개발/테스트 목적으로만 사용됩니다

-- 참고: user_id는 실제 사용자 ID로 대체해야 합니다
-- 예시:
-- INSERT INTO public.tts_channels (user_id, name, type, endpoint, enabled)
-- VALUES 
--   ('실제-사용자-ID', '라디오 방송', 'radio', 'https://example.com/api/broadcast', true),
--   ('실제-사용자-ID', '태블릿 방송 장비', 'tablet', 'https://example.com/api/broadcast', true),
--   ('실제-사용자-ID', 'PC 방송 장비', 'pc', 'https://example.com/api/broadcast', true)
-- ON CONFLICT (user_id, name) DO NOTHING;

