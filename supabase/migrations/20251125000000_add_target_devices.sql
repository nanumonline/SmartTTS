-- Adds a target_devices column to store registered output devices for each schedule
ALTER TABLE IF EXISTS public.tts_schedule_requests
ADD COLUMN IF NOT EXISTS target_devices text[] DEFAULT ARRAY[]::text[];

-- Ensure existing null values are initialized to empty arrays
UPDATE public.tts_schedule_requests
SET target_devices = ARRAY[]::text[]
WHERE target_devices IS NULL;
