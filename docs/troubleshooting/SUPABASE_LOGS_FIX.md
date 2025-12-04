# 🔍 Supabase 로그에서 execute-schedules 찾기

## 🚨 현재 상황

### ✅ 확인된 사항
- Hostinger 로그 정상 작동 ✅
- 오디오 파일 저장 성공 ✅
- POST 요청 정상 수신 ✅

### ❌ 문제
- Supabase 로그에서 "No results found" 표시
- `execute-schedules` 함수 로그가 보이지 않음

---

## 💡 문제 원인

**가장 가능성 높은 원인:**
- `execute-schedules` 함수가 **아직 실행되지 않았음**
- 로그는 함수가 실행될 때만 생성됩니다

---

## ✅ 해결 방법

### 방법 1: 함수 수동 실행하여 로그 생성

#### 1단계: Supabase 대시보드에서 함수 실행

1. **Supabase 대시보드 접속**
   - https://app.supabase.com 접속
   - 프로젝트 선택

2. **Edge Functions 메뉴 접근**
   - 왼쪽 사이드바 → **"Edge Functions"** 클릭
   - 또는 상단 검색: "Edge Functions"

3. **`execute-schedules` 함수 찾기**
   - 함수 목록에서 **`execute-schedules`** 클릭
   - 함수 페이지로 이동

4. **함수 테스트/실행**
   - **"Invoke"** 또는 **"Test"** 버튼 클릭
   - 또는 **"Run"** 버튼 클릭
   - 요청 본문 (선택사항):
     ```json
     {
       "trigger": "manual"
     }
     ```
   - 실행 버튼 클릭

#### 2단계: 로그 다시 확인

함수 실행 후:

1. **Logs & Analytics** 메뉴로 이동
2. **"Edge Functions"** 탭 선택
3. **함수 드롭다운**에서 **"execute-schedules"** 선택
4. **시간 범위**: "Last hour" 선택
5. **새로고침** 아이콘 클릭
6. 로그 확인

---

### 방법 2: 터미널에서 함수 실행

#### curl 명령어로 실행

**프로젝트 URL 확인:**
- Supabase 대시보드 → Settings → API
- Project URL 확인

**함수 실행:**
```bash
curl -X POST https://gxxralruivyhdxyftsrg.supabase.co/functions/v1/execute-schedules \
  -H "Content-Type: application/json" \
  -d '{"trigger": "manual"}'
```

**예상 응답:**
```json
{
  "message": "Schedule execution completed",
  "executed": 0,
  "failed": 0,
  "results": []
}
```

**로그가 있는 응답:**
```json
{
  "message": "Schedule execution completed",
  "executed": 1,
  "failed": 0,
  "results": [...]
}
```

---

### 방법 3: 로그 검색 방법 개선

#### Supabase 로그 화면에서:

1. **"Edge Functions" 탭 확인** ✅ (이미 선택하셨음)

2. **검색창 사용**
   - 상단 검색창에 입력:
     ```
     execute-schedules
     ```
   - 또는:
     ```
     execute
     ```

3. **시간 범위 확대**
   - "Last hour" 드롭다운 클릭
   - "Last 24 hours" 또는 "Last 7 days" 선택

4. **필터 확인**
   - "Status" 필터가 있는지 확인
   - 필터 제거 (모든 로그 보기)

5. **함수 드롭다운 확인**
   - "Select a function" 드롭다운 클릭
   - "All functions" 선택 (모든 함수 로그 확인)
   - 또는 함수 목록에서 `execute-schedules` 확인

6. **새로고침**
   - 새로고침 아이콘 클릭 (보통 상단 오른쪽)

---

## 🔍 함수 실행 확인 방법

### 1. 스케줄 실행 여부 확인

SQL Editor에서:

```sql
SELECT 
  id,
  schedule_name,
  scheduled_time,
  status,
  sent_at,
  fail_reason
FROM tts_schedule_requests
ORDER BY scheduled_time DESC
LIMIT 10;
```

**확인 사항:**
- `status`가 'sent'인 스케줄이 있는지 확인
- `sent_at`이 설정되어 있는지 확인

### 2. pg_cron 작업 확인

SQL Editor에서:

```sql
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active,
  nodename,
  database
FROM cron.job;
```

**확인 사항:**
- `execute-schedules-job`이 있는지 확인
- `active`가 `true`인지 확인

---

## 📊 Supabase 로그 화면 사용 팁

### 로그가 안 보일 때:

1. **검색 키워드 변경**
   ```
   execute-schedules
   execute
   schedules
   broadcast
   ```

2. **시간 범위 조정**
   - "Last hour" → "Last 24 hours"
   - 또는 시작/종료 시간 직접 설정

3. **필터 제거**
   - 모든 필터 제거
   - "All functions" 선택

4. **새로고침**
   - 새로고침 버튼 클릭

5. **다른 함수 로그 확인**
   - 다른 함수가 실행되었는지 확인
   - 로그 시스템이 작동하는지 확인

---

## 🎯 단계별 해결 가이드

### 즉시 시도해볼 방법:

1. **함수 수동 실행**
   - Supabase 대시보드 → Edge Functions → execute-schedules → Invoke
   - 또는 curl 명령어 실행

2. **로그 다시 확인**
   - Logs & Analytics → Edge Functions
   - 시간 범위: "Last hour"
   - 검색: `execute-schedules`
   - 새로고침

3. **SQL로 확인**
   - SQL Editor에서 스케줄 상태 확인
   - pg_cron 작업 확인

---

## 💡 빠른 테스트

### 터미널에서 함수 실행:

```bash
curl -X POST https://gxxralruivyhdxyftsrg.supabase.co/functions/v1/execute-schedules \
  -H "Content-Type: application/json" \
  -d '{"trigger": "manual"}'
```

**실행 후 로그 확인:**
- Logs & Analytics → Edge Functions
- "Last hour" 선택
- 검색: `execute-schedules`
- 새로고침

---

## 📝 체크리스트

- [ ] Edge Functions 탭이 선택되었는지 확인
- [ ] 시간 범위를 "Last 24 hours"로 확대
- [ ] 검색창에 `execute-schedules` 입력
- [ ] 모든 필터 제거
- [ ] 함수 드롭다운에서 "All functions" 확인
- [ ] 새로고침 버튼 클릭
- [ ] 함수를 수동으로 실행
- [ ] SQL Editor에서 스케줄 상태 확인
- [ ] pg_cron 작업 확인

---

**함수를 수동으로 실행하면 로그가 생성됩니다!** 🚀

**다음 단계:**
1. 함수를 수동으로 실행 (위 방법 참고)
2. 로그 다시 확인
3. 로그가 나타나면 함수가 정상 작동하는 것입니다

