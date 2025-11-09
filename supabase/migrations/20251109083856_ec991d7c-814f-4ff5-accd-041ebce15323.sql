-- Fix RLS bypass vulnerability in all user tables
-- Remove the dangerous 'auth.uid() IS NULL' condition that allows unauthenticated access

-- 1. tts_generations table
DROP POLICY IF EXISTS "Users can view own generations" ON public.tts_generations;
DROP POLICY IF EXISTS "Users can insert own generations" ON public.tts_generations;
DROP POLICY IF EXISTS "Users can update own generations" ON public.tts_generations;
DROP POLICY IF EXISTS "Users can delete own generations" ON public.tts_generations;

CREATE POLICY "Users can view own generations" ON public.tts_generations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generations" ON public.tts_generations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generations" ON public.tts_generations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own generations" ON public.tts_generations
  FOR DELETE USING (auth.uid() = user_id);

-- 2. tts_favorites table
DROP POLICY IF EXISTS "Users can view own favorites" ON public.tts_favorites;
DROP POLICY IF EXISTS "Users can manage own favorites" ON public.tts_favorites;

CREATE POLICY "Users can view own favorites" ON public.tts_favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own favorites" ON public.tts_favorites
  FOR ALL USING (auth.uid() = user_id);

-- 3. tts_user_settings table
DROP POLICY IF EXISTS "Users can view own settings" ON public.tts_user_settings;
DROP POLICY IF EXISTS "Users can manage own settings" ON public.tts_user_settings;

CREATE POLICY "Users can view own settings" ON public.tts_user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own settings" ON public.tts_user_settings
  FOR ALL USING (auth.uid() = user_id);

-- 4. tts_clone_requests table
DROP POLICY IF EXISTS "Users can view own clone requests" ON public.tts_clone_requests;
DROP POLICY IF EXISTS "Users can manage own clone requests" ON public.tts_clone_requests;

CREATE POLICY "Users can view own clone requests" ON public.tts_clone_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own clone requests" ON public.tts_clone_requests
  FOR ALL USING (auth.uid() = user_id);

-- 5. tts_mixing_states table
DROP POLICY IF EXISTS "Users can view own mixing states" ON public.tts_mixing_states;
DROP POLICY IF EXISTS "Users can manage own mixing states" ON public.tts_mixing_states;

CREATE POLICY "Users can view own mixing states" ON public.tts_mixing_states
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own mixing states" ON public.tts_mixing_states
  FOR ALL USING (auth.uid() = user_id);

-- 6. tts_schedule_requests table
DROP POLICY IF EXISTS "Users can view own schedule requests" ON public.tts_schedule_requests;
DROP POLICY IF EXISTS "Users can manage own schedule requests" ON public.tts_schedule_requests;

CREATE POLICY "Users can view own schedule requests" ON public.tts_schedule_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own schedule requests" ON public.tts_schedule_requests
  FOR ALL USING (auth.uid() = user_id);

-- 7. tts_review_states table
DROP POLICY IF EXISTS "Users can view own review states" ON public.tts_review_states;
DROP POLICY IF EXISTS "Users can manage own review states" ON public.tts_review_states;

CREATE POLICY "Users can view own review states" ON public.tts_review_states
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own review states" ON public.tts_review_states
  FOR ALL USING (auth.uid() = user_id);

-- 8. tts_message_history table
DROP POLICY IF EXISTS "Users can view own message history" ON public.tts_message_history;
DROP POLICY IF EXISTS "Users can manage own message history" ON public.tts_message_history;

CREATE POLICY "Users can view own message history" ON public.tts_message_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own message history" ON public.tts_message_history
  FOR ALL USING (auth.uid() = user_id);

-- Fix voice catalog write vulnerability
-- Only service role should be able to modify the catalog
DROP POLICY IF EXISTS "Anyone can insert voice catalog" ON public.tts_voice_catalog;
DROP POLICY IF EXISTS "Anyone can update voice catalog" ON public.tts_voice_catalog;
DROP POLICY IF EXISTS "Authenticated users can update voice catalog" ON public.tts_voice_catalog;

-- Keep SELECT open for all users (read-only access)
-- Restrict INSERT/UPDATE/DELETE to service role only
CREATE POLICY "Service role can manage voice catalog" ON public.tts_voice_catalog
  FOR ALL USING (auth.role() = 'service_role');