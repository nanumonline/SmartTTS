-- tts_schedule_requests 테이블에 추가 필드 추가
-- 스케줄 이름, 타입, 플레이어 송출 플래그, 고객 정보 등

-- schedule_name 컬럼 추가 (스케줄 이름)
ALTER TABLE public.tts_schedule_requests 
ADD COLUMN IF NOT EXISTS schedule_name VARCHAR(255);

-- schedule_type 컬럼 추가 (스케줄 타입: immediate, delayed, scheduled)
ALTER TABLE public.tts_schedule_requests 
ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(20) DEFAULT 'scheduled';

-- is_player_broadcast 컬럼 추가 (플레이어 송출 여부)
ALTER TABLE public.tts_schedule_requests 
ADD COLUMN IF NOT EXISTS is_player_broadcast BOOLEAN DEFAULT false;

-- customer_id 컬럼 추가 (고객 ID)
ALTER TABLE public.tts_schedule_requests 
ADD COLUMN IF NOT EXISTS customer_id VARCHAR(255);

-- customer_name 컬럼 추가 (고객명)
ALTER TABLE public.tts_schedule_requests 
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);

-- category_code 컬럼 추가 (구분 코드)
ALTER TABLE public.tts_schedule_requests 
ADD COLUMN IF NOT EXISTS category_code VARCHAR(100);

-- memo 컬럼 추가 (메모)
ALTER TABLE public.tts_schedule_requests 
ADD COLUMN IF NOT EXISTS memo TEXT;

-- 인덱스 추가 (스케줄 이름으로 검색 시 성능 향상)
CREATE INDEX IF NOT EXISTS idx_tts_schedule_requests_schedule_name 
ON public.tts_schedule_requests(schedule_name);

-- 인덱스 추가 (스케줄 타입으로 검색 시 성능 향상)
CREATE INDEX IF NOT EXISTS idx_tts_schedule_requests_schedule_type 
ON public.tts_schedule_requests(schedule_type);

-- 인덱스 추가 (플레이어 송출 필터링 시 성능 향상)
CREATE INDEX IF NOT EXISTS idx_tts_schedule_requests_is_player_broadcast 
ON public.tts_schedule_requests(is_player_broadcast);

