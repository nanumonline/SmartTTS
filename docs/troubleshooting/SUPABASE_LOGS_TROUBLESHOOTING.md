# 🔍 Supabase 로그에서 execute-schedules 함수 찾기

## 🚨 현재 상황

### ✅ 확인된 사항
- Hostinger 로그 정상 작동 ✅
- 오디오 파일 저장 성공 ✅
- POST 요청 정상 수신 ✅

### ❌ 문제
- Supabase 로그에서 `execute-schedules` 함수 로그가 "No results found"로 표시됨

---

## 🔍 문제 원인 분석

### 가능한 원인

1. **함수가 아직 실행되지 않음**
   - 스케줄이 아직 실행 시간이 안 되었을 수 있음
   - pg_cron이 설정되지 않았을 수 있음

2. **로그 필터링 문제**
   - 시간 범위가 너무 좁을 수 있음
   - 함수 이름 검색 문제

3. **함수 이름 불일치**
   - 함수 이름이 다를 수 있음

---

## ✅ 해결 방법

### 방법 1: 함수가 실행되었는지 확인

#### 1단계: 스케줄 확인

프로젝트에서 SQL Editor로 이동:

```sql
SELECT 
  id,
  schedule_name,
  target_channel,
  scheduled_time,
  status,
  sent_at,
  fail_reason,
  created_at
FROM tts_schedule_requests
ORDER BY scheduled_time DESC
LIMIT 10;
```

**확인 사항:**
- `status`가 'sent'인 스케줄이 있는지 확인
- `sent_at`이 설정되어 있는지 확인

#### 2단계: pg_cron 확인

SQL Editor에서:

```sql
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job;
```

**확인 사항:**
- `execute-schedules` 관련 cron 작업이 있는지 확인
- `active`가 `true`인지 확인

---

### 방법 2: 로그 검색 방법

#### 1단계: Supabase 로그 화면에서

1. **"Edge Functions" 탭 확인** ✅ (이미 선택하셨음)

2. **검색창 사용**
   - 상단 검색창에 다음 키워드 입력:
     - `execute-schedules`
     - `execute`
     - `schedules`

3. **시간 범위 확대**
   - "Last hour" 드롭다운 클릭
   - "Last 24 hours" 또는 "Last 7 days" 선택

4. **필터 초기화**
   - 모든 필터 제거
   - "Status" 필터 제거

#### 2단계: 함수 목록 확인

1. **함수 선택 드롭다운 클릭**
   - "Select a function" 또는 "All functions" 클릭
   - 함수 목록 확인:
     - `execute-schedules` 있는지 확인
     - 다른 함수 이름이 있는지 확인

2. **모든 함수 로그 확인**
   - "All functions" 선택
   - 로그가 있는지 확인

---

### 방법 3: 함수 수동 실행하여 로그 생성

#### 수동으로 함수 실행 (테스트용)

1. **Supabase 대시보드에서**
   - 왼쪽 사이드바 → **"Edge Functions"** 클릭
   - 함수 목록에서 **`execute-schedules`** 찾기
   - 함수 클릭 → **"Invoke"** 또는 **"Test"** 버튼 클릭

2. **또는 curl로 실행**

프로젝트 URL과 anon key가 필요합니다.

```bash
curl -X POST https://[YOUR_PROJECT_REF].supabase.co/functions/v1/execute-schedules \
  -H "Authorization: Bearer [YOUR_ANON_KEY]" \
  -H "Content-Type: application/json"
```

**프로젝트 정보 찾기:**
1. Supabase 대시보드 → Settings → API
2. Project URL 확인: `https://[PROJECT_REF].supabase.co`
3. anon public key 확인

#### 3단계: 로그 다시 확인

수동 실행 후 로그 페이지로 돌아가서:
- "Last hour" 선택
- 검색창에 `execute-schedules` 입력
- 로그 확인

---

## 📝 Supabase 로그 화면 사용 팁

### 로그가 안 보일 때:

1. **검색창 사용**
   ```
   execute-schedules
   ```

2. **시간 범위 확인**
   - "Last hour" → "Last 24 hours"로 변경
   - 또는 시작/종료 시간 직접 설정

3. **필터 확인**
   - "Status" 필터 제거
   - "All functions" 선택

4. **새로고침**
   - 새로고침 아이콘 클릭

---

## 🎯 단계별 확인 가이드

### 1단계: 함수 존재 확인

Supabase 대시보드:
- 왼쪽 사이드바 → **"Edge Functions"** 클릭
- 함수 목록에서 `execute-schedules` 확인

### 2단계: 함수 실행 확인

SQL Editor에서:
```sql
-- 최근 스케줄 실행 확인
SELECT 
  id,
  schedule_name,
  scheduled_time,
  status,
  sent_at
FROM tts_schedule_requests
WHERE status = 'sent'
ORDER BY sent_at DESC
LIMIT 5;
```

### 3단계: 로그 다시 확인

1. Logs & Analytics → Edge Functions
2. 시간 범위: "Last 24 hours"
3. 검색: `execute-schedules`
4. 필터 모두 제거
5. 새로고침

---

## 💡 추가 확인 방법

### Supabase CLI 사용

터미널에서:
```bash
# Supabase CLI 설치 확인
supabase --version

# 프로젝트 연결
supabase link --project-ref [YOUR_PROJECT_REF]

# 함수 로그 확인
supabase functions logs execute-schedules --follow
```

---

## 🔍 디버깅 체크리스트

- [ ] Edge Functions 탭이 선택되었는지 확인
- [ ] 시간 범위를 "Last 24 hours"로 확대
- [ ] 검색창에 `execute-schedules` 입력
- [ ] 모든 필터 제거
- [ ] 함수 목록에서 `execute-schedules` 확인
- [ ] SQL Editor에서 스케줄 실행 여부 확인
- [ ] 함수를 수동으로 실행하여 로그 생성
- [ ] 새로고침 버튼 클릭

---

**함수 로그를 찾지 못하면 함수가 아직 실행되지 않았을 가능성이 높습니다!** 🚀

**다음 단계:**
1. 함수가 실제로 배포되었는지 확인
2. 스케줄이 생성되었는지 확인
3. 스케줄 실행 시간이 되었는지 확인
4. 함수를 수동으로 실행하여 로그 생성

