-- Fix tts_voice_catalog RLS policy to allow authenticated users to sync
-- 음성 카탈로그는 인증된 사용자가 동기화할 수 있도록 정책 수정

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Service role can manage voice catalog" ON public.tts_voice_catalog;
DROP POLICY IF EXISTS "Anyone can view voice catalog" ON public.tts_voice_catalog;
DROP POLICY IF EXISTS "Anyone can insert voice catalog" ON public.tts_voice_catalog;
DROP POLICY IF EXISTS "Anyone can update voice catalog" ON public.tts_voice_catalog;

-- 읽기: 모든 인증된 사용자 가능
CREATE POLICY "Authenticated users can view voice catalog" ON public.tts_voice_catalog
  FOR SELECT USING (auth.role() = 'authenticated');

-- 쓰기: 인증된 사용자 가능 (동기화를 위해)
CREATE POLICY "Authenticated users can manage voice catalog" ON public.tts_voice_catalog
  FOR ALL USING (auth.role() = 'authenticated');

