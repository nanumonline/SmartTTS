# 📊 Supabase 로그 확인 가이드

## 🎯 Supabase 대시보드에서 `execute-schedules` 함수 로그 확인

### 단계별 안내 (이미지 포함 가능)

---

## 1단계: Supabase 대시보드 접속

1. **Supabase 웹사이트 접속**
   - https://supabase.com 접속
   - 또는 https://app.supabase.com 접속

2. **로그인**
   - 계정으로 로그인

3. **프로젝트 선택**
   - 프로젝트 목록에서 해당 프로젝트 클릭

---

## 2단계: Logs 메뉴 찾기

### 방법 1: 왼쪽 사이드바에서 찾기 (권장)

1. **왼쪽 사이드바 확인**
   - 사이드바가 접혀 있으면 ☰ 아이콘 클릭하여 펼치기

2. **Logs 메뉴 찾기**
   - 사이드바에서 **"Logs"** 메뉴 클릭
   - 또는 **"Observability"** → **"Logs"** 클릭
   - (Supabase 버전에 따라 위치가 약간 다를 수 있음)

### 방법 2: 검색으로 찾기

1. **검색 아이콘 클릭** (보통 상단에 있음)
2. **"logs"** 또는 **"edge functions"** 검색
3. **Logs** 또는 **Edge Functions** 메뉴 선택

---

## 3단계: Edge Functions 로그 선택

### Logs 페이지에서:

1. **상단 탭 확인**
   - **"Edge Functions"** 탭 클릭
   - 또는 **"Functions"** 탭 클릭
   - 또는 드롭다운에서 **"Edge Functions"** 선택

2. **함수 목록 확인**
   - 함수 목록이 표시됩니다
   - 목록에서 **`execute-schedules`** 찾기

### 함수 목록에서 찾기

1. **함수 선택 드롭다운 클릭**
   - "Select a function" 또는 "All functions" 드롭다운 클릭
   - 또는 함수 검색창에 **`execute-schedules`** 입력

2. **`execute-schedules` 선택**
   - 목록에서 **`execute-schedules`** 클릭

---

## 4단계: 로그 확인

### 로그 표시 영역:

1. **로그 목록 확인**
   - 시간순으로 로그가 표시됩니다 (최근 로그가 위에)
   - 각 로그는 타임스탬프와 내용이 함께 표시됩니다

2. **로그 내용 확인**
   - `[execute-schedules] Current time (UTC): ...`
   - `[execute-schedules] Checking schedules between ...`
   - `[execute-schedules] Found X schedules to execute`
   - `[execute-schedules] Sending audio to https://nanum.online/tts/api/broadcast/`
   - `[execute-schedules] Successfully sent to ...`
   - `[execute-schedules] Response status: 200`

### 로그 검색 및 필터링:

1. **검색창 사용**
   - 상단 검색창에 키워드 입력 (예: "Successfully", "Failed", "endpoint")
   - 관련 로그만 필터링됩니다

2. **시간 범위 선택**
   - 시간 범위 드롭다운에서 선택 (예: "Last hour", "Last 24 hours")
   - 또는 시작/종료 시간 직접 입력

---

## 📍 메뉴 위치 정리

### Supabase 대시보드 메뉴 구조:

```
대시보드 (Dashboard)
├── Table Editor
├── SQL Editor
├── Authentication
├── Storage
├── Database
│   ├── Tables
│   ├── Migrations
│   └── ...
├── Edge Functions  ← 함수 관리 메뉴
├── Logs            ← 로그 메뉴 (여기!)
│   ├── API
│   ├── Auth
│   ├── Postgres
│   ├── Edge Functions  ← 여기서 함수 로그 확인!
│   └── ...
└── Settings
```

### 정확한 경로:

1. **왼쪽 사이드바** → **"Logs"** 클릭
2. **"Edge Functions"** 탭 클릭
3. 함수 드롭다운에서 **"execute-schedules"** 선택

---

## 🔍 로그 확인 팁

### 1. 로그가 안 보일 때:

**확인 사항:**
- ✅ 올바른 프로젝트에 로그인했는지
- ✅ 시간 범위를 확인 (최근 1시간 이내)
- ✅ `execute-schedules` 함수가 실제로 실행되었는지
- ✅ 함수 이름이 정확한지 (`execute-schedules`)

**해결 방법:**
- 시간 범위를 넓혀서 확인 (예: "Last 24 hours")
- "All functions" 선택 후 모든 함수 로그 확인
- 검색창에 "execute-schedules" 입력하여 필터링

### 2. 로그 내용 확인:

**성공 로그 예시:**
```
[execute-schedules] Current time (UTC): 2025-11-20T02:10:00.000Z
[execute-schedules] Found 1 schedules to execute
[execute-schedules] Sending audio to https://nanum.online/tts/api/broadcast/
[execute-schedules] Successfully sent to https://nanum.online/tts/api/broadcast/
[execute-schedules] Response status: 200
[execute-schedules] Response body: {"success":true,...}
```

**실패 로그 예시:**
```
[execute-schedules] Failed to send to channel https://...
[execute-schedules] Error details: HTTP 404: Not Found
```

---

## 📝 빠른 확인 체크리스트

- [ ] Supabase 대시보드 접속
- [ ] 왼쪽 사이드바에서 "Logs" 메뉴 클릭
- [ ] "Edge Functions" 탭 클릭
- [ ] 함수 드롭다운에서 "execute-schedules" 선택
- [ ] 최근 로그 확인
- [ ] "Successfully sent to..." 메시지 확인

---

## 🚀 직접 URL 접근 (고급)

### Supabase 로그 직접 URL:

1. **프로젝트 URL 확인**
   - Supabase 대시보드 URL 형식:
   ```
   https://app.supabase.com/project/[PROJECT_REF]
   ```

2. **로그 URL**
   ```
   https://app.supabase.com/project/[PROJECT_REF]/logs/edge-functions
   ```
   - `[PROJECT_REF]`는 프로젝트 ID로 대체

3. **특정 함수 로그 URL**
   ```
   https://app.supabase.com/project/[PROJECT_REF]/logs/edge-functions?function=execute-schedules
   ```

---

## 💡 추가 확인 방법

### Supabase CLI 사용:

터미널에서:
```bash
# Supabase CLI 설치 확인
supabase --version

# 프로젝트 연결
supabase link --project-ref [PROJECT_REF]

# 함수 로그 확인
supabase functions logs execute-schedules
```

---

**이 가이드를 따라하면 Supabase 로그를 쉽게 확인할 수 있습니다!** 🚀

