# Supabase 작업 체크리스트

## 📋 작업 개요

지연 송출 기능의 500 오류를 해결하기 위해 다음 두 가지 작업이 필요합니다:

1. **데이터베이스 마이그레이션**: `tts_schedule_requests` 테이블에 필요한 컬럼 추가
2. **Edge Function 배포**: 수정된 `broadcast-now` 함수 배포

---

## 1️⃣ 데이터베이스 마이그레이션 (필수)

### 작업 위치
- Supabase 대시보드 → SQL Editor

### 실행할 SQL

```sql
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
```

### 실행 방법
1. Supabase 대시보드 접속
2. 좌측 메뉴에서 **SQL Editor** 클릭
3. 위 SQL 코드를 복사하여 붙여넣기
4. **Run** 버튼 클릭
5. 성공 메시지 확인

### 확인 방법
다음 SQL로 컬럼이 추가되었는지 확인:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'tts_schedule_requests'
  AND column_name IN ('schedule_name', 'schedule_type', 'is_player_broadcast', 'customer_id', 'customer_name', 'category_code', 'memo')
ORDER BY column_name;
```

---

## 2️⃣ Edge Function 배포 (필수)

### 작업 위치
- 로컬 터미널 또는 Supabase CLI

### 배포 명령어

```bash
cd /Users/june/Documents/GitHub/voicecraft-designer
supabase functions deploy broadcast-now
```

### 또는 Supabase 대시보드에서
1. Supabase 대시보드 → **Edge Functions** 메뉴
2. `broadcast-now` 함수 선택
3. 코드를 수동으로 업데이트하거나 CLI로 배포

### 수정된 내용
- JSON 파싱 로직 개선 (`req.text()` → `JSON.parse()` 방식으로 변경)
- 에러 처리 강화 (상세 로깅 추가)

### 확인 방법
1. Supabase 대시보드 → **Edge Functions** → `broadcast-now`
2. **Logs** 탭에서 최근 배포 로그 확인
3. 배포 성공 메시지 확인

---

## 3️⃣ 작업 순서

1. **먼저 데이터베이스 마이그레이션 실행** (1️⃣)
2. **그 다음 Edge Function 배포** (2️⃣)
3. **프론트엔드에서 테스트**

---

## 4️⃣ 테스트 방법

작업 완료 후:

1. 브라우저 새로고침 (Ctrl+Shift+R 또는 Cmd+Shift+R)
2. 즉시 송출 페이지 또는 스케줄 관리 페이지 접속
3. "송출" 버튼 클릭
4. 지연 송출 선택 후 "송출" 버튼 클릭
5. 오류가 발생하지 않는지 확인

---

## 5️⃣ 문제 해결

### 마이그레이션 오류 시
- `IF NOT EXISTS`를 사용했으므로 이미 컬럼이 있어도 오류가 발생하지 않습니다
- 특정 컬럼이 이미 존재한다는 오류가 나오면 해당 컬럼만 제외하고 나머지 실행

### Edge Function 배포 오류 시
- Supabase CLI가 최신 버전인지 확인: `supabase --version`
- 프로젝트가 올바르게 연결되어 있는지 확인: `supabase projects list`
- 로그 확인: Supabase 대시보드 → Edge Functions → `broadcast-now` → Logs

---

## 📝 참고 파일

- 마이그레이션 SQL: `supabase/migrations/20251121000000_add_schedule_fields.sql`
- Edge Function 코드: `supabase/functions/broadcast-now/index.ts`

