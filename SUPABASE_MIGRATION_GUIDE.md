# Supabase 마이그레이션 적용 가이드

## 🚀 방법 1: Supabase 대시보드에서 직접 실행 (가장 쉬움)

### 1단계: Supabase 대시보드 접속
1. https://supabase.com/dashboard 접속
2. 로그인 후 프로젝트 선택
   - 프로젝트 ID: `gxxralruivyhdxyftsrg`

### 2단계: SQL Editor 열기
1. 왼쪽 사이드바에서 **"SQL Editor"** 클릭
2. **"New query"** 버튼 클릭 (또는 빈 편집 영역 클릭)

### 3단계: SQL 복사 및 실행
1. 아래 SQL 코드를 **전체 복사** (Cmd+A → Cmd+C)
2. SQL Editor에 **붙여넣기** (Cmd+V)
3. **"Run"** 버튼 클릭 (또는 `Ctrl+Enter` / `Cmd+Enter`)

```sql
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
```

### 4단계: 실행 확인
- 성공 시: "Success. No rows returned" 메시지 표시
- 에러 발생 시: 에러 메시지 확인 후 수정 필요

---

## 💻 방법 2: 터미널에서 Supabase CLI 사용

### 사전 준비: Supabase CLI 설치
```bash
# Homebrew 사용 (macOS)
brew install supabase/tap/supabase

# 또는 npm 사용
npm install -g supabase
```

### 1단계: Supabase 로그인
```bash
supabase login
```
브라우저가 열리면 로그인하세요.

### 2단계: 프로젝트 링크 (처음 한 번만)
```bash
cd /Users/june/Documents/GitHub/voicecraft-designer
supabase link --project-ref gxxralruivyhdxyftsrg
```

### 3단계: 마이그레이션 적용
```bash
supabase db push
```

이 명령어는 `supabase/migrations/` 폴더의 모든 마이그레이션 파일을 순서대로 적용합니다.

### 실행 결과 확인
```
Applied migration 20251105000000_create_channels_table.sql
```

---

## ✅ 마이그레이션 적용 확인

### 방법 A: Supabase 대시보드에서 확인
1. **Table Editor** 메뉴 클릭
2. `tts_channels` 테이블이 보이는지 확인

### 방법 B: SQL Editor에서 확인
```sql
SELECT * FROM public.tts_channels LIMIT 1;
```

---

## 🎯 다음 단계

마이그레이션이 성공적으로 적용되면:

1. **채널 생성**: "전송 설정" 페이지에서 채널을 생성하고 endpoint URL을 설정하세요
2. **Edge Function 배포**: `supabase functions deploy execute-schedules` 실행
3. **스케줄 테스트**: 스케줄 관리에서 테스트 스케줄을 생성해보세요

---

## ⚠️ 문제 해결

### 에러: "relation already exists"
- 이미 테이블이 존재한다는 의미입니다
- `CREATE TABLE IF NOT EXISTS` 구문이 있어도 외래 키 제약조건 등에서 에러가 날 수 있습니다
- 각 DO 블록을 개별적으로 실행해보세요

### 에러: "function handle_updated_at does not exist"
- 이전 마이그레이션 파일(`20251101200000_tts_data_migration.sql`)이 먼저 실행되어야 합니다
- 마이그레이션 파일 순서를 확인하세요

### CLI 에러: "command not found: supabase"
- Supabase CLI가 설치되지 않았습니다
- 방법 1(Supabase 대시보드)을 사용하세요

---

## 📝 참고

- **방법 1(대시보드)**: 초보자에게 가장 쉬운 방법
- **방법 2(CLI)**: 여러 마이그레이션을 한 번에 적용할 때 편리
- 프로덕션 환경에서는 **방법 2(CLI)**를 권장합니다 (자동화 가능)

