# 📁 파일 확인 가이드

## 1. 전송된 오디오 파일 확인

### Hostinger File Manager에서 확인 방법

#### 단계별 안내:

1. **Hostinger 대시보드 접속**
   - https://www.hostinger.com 로그인

2. **File Manager 열기**
   - 대시보드 → **File Manager** 클릭

3. **폴더 이동 경로**
   ```
   public_html/
   └── tts/
       └── api/
           └── broadcast/
               └── audio/          ← 여기!
   ```

4. **단계별 이동:**
   - `public_html` 폴더 클릭
   - `tts` 폴더 클릭
   - `api` 폴더 클릭
   - `broadcast` 폴더 클릭
   - `audio` 폴더 클릭

5. **파일 확인**
   - `audio` 폴더 안에 오디오 파일이 저장됩니다
   - 파일명 형식: `broadcast_YYYY-MM-DD_HH-MM-SS.mp3`
   - 예: `broadcast_2025-11-20_02-13-01.mp3`

---

## 2. 로그 파일 확인

### Hostinger File Manager에서 확인 방법

#### 단계별 안내:

1. **Hostinger 대시보드 접속**
   - https://www.hostinger.com 로그인

2. **File Manager 열기**
   - 대시보드 → **File Manager** 클릭

3. **폴더 이동 경로**
   ```
   public_html/
   └── tts/
       └── api/
           └── broadcast/
               └── logs/           ← 여기!
   ```

4. **단계별 이동:**
   - `public_html` 폴더 클릭
   - `tts` 폴더 클릭
   - `api` 폴더 클릭
   - `broadcast` 폴더 클릭
   - `logs` 폴더 클릭

5. **로그 파일 확인**
   - `logs` 폴더 안에 로그 파일이 저장됩니다
   - 파일명 형식: `broadcast_YYYY-MM-DD.log`
   - 예: `broadcast_2025-11-20.log`

6. **로그 파일 보기**
   - 파일을 클릭하면 내용을 볼 수 있습니다
   - 또는 우클릭 → **Edit** 또는 **View**

---

## 3. Supabase 로그 확인

### Supabase 대시보드에서 확인 방법

#### 단계별 안내:

1. **Supabase 대시보드 접속**
   - https://supabase.com 접속
   - 프로젝트 로그인

2. **로그 메뉴 찾기**
   - 왼쪽 사이드바에서 **Logs** 메뉴 클릭
   - 또는 **Observability** → **Logs** 클릭
   - (Supabase 버전에 따라 메뉴 위치가 약간 다를 수 있습니다)

3. **Edge Functions 로그 선택**
   - Logs 페이지에서 **Edge Functions** 탭 클릭
   - 또는 **Function Logs** 선택
   - 또는 드롭다운에서 **Edge Functions** 선택

4. **함수 선택**
   - 함수 목록에서 **`execute-schedules`** 선택
   - 또는 검색창에 `execute-schedules` 입력

5. **로그 확인**
   - 시간대별로 로그가 표시됩니다
   - 최근 로그가 위에 표시됩니다
   - 로그 내용:
     - `[execute-schedules] Current time (UTC): ...`
     - `[execute-schedules] Checking schedules between ...`
     - `[execute-schedules] Sending audio to ...`
     - `[execute-schedules] Successfully sent to ...`

---

### Supabase 로그 확인의 다른 방법

#### 방법 1: 직접 URL 접근

1. Supabase 대시보드 URL 형식:
   ```
   https://app.supabase.com/project/[PROJECT_ID]/logs/edge-functions
   ```
   - `[PROJECT_ID]`는 프로젝트 ID로 대체

2. 또는:
   ```
   https://app.supabase.com/project/[PROJECT_ID]/logs?resource=functions&function=execute-schedules
   ```

#### 방법 2: Supabase CLI 사용

터미널에서:
```bash
supabase functions logs execute-schedules
```

---

## 🔍 파일이 보이지 않을 때

### 문제 1: audio 폴더가 없음

**해결:**
- 폴더가 자동으로 생성되지만, 첫 번째 요청 전까지는 없을 수 있습니다
- 첫 번째 POST 요청 후 자동 생성됩니다

**수동 생성:**
1. File Manager에서 `broadcast` 폴더로 이동
2. **New Folder** 클릭
3. 이름: `audio`
4. 권한: 755

### 문제 2: logs 폴더가 없음

**해결:**
- 폴더가 자동으로 생성되지만, 첫 번째 요청 전까지는 없을 수 있습니다
- 첫 번째 POST 요청 후 자동 생성됩니다

**수동 생성:**
1. File Manager에서 `broadcast` 폴더로 이동
2. **New Folder** 클릭
3. 이름: `logs`
4. 권한: 755

### 문제 3: Supabase 로그가 안 보임

**확인 사항:**
1. 올바른 프로젝트에 로그인했는지 확인
2. Edge Functions가 실제로 실행되었는지 확인
3. 시간 범위를 확인 (최근 1시간 이내 로그 확인)
4. 필터에서 `execute-schedules` 함수가 선택되었는지 확인

---

## 📝 빠른 확인 체크리스트

### Hostinger File Manager:
- [ ] `public_html/tts/api/broadcast/audio/` 폴더 존재 확인
- [ ] 오디오 파일 목록 확인 (`broadcast_*.mp3`)
- [ ] `public_html/tts/api/broadcast/logs/` 폴더 존재 확인
- [ ] 로그 파일 목록 확인 (`broadcast_*.log`)

### Supabase 대시보드:
- [ ] Logs 메뉴 접근
- [ ] Edge Functions 탭 선택
- [ ] `execute-schedules` 함수 선택
- [ ] 최근 로그 확인

---

**이 가이드를 따라하면 파일과 로그를 쉽게 확인할 수 있습니다!** 🚀

