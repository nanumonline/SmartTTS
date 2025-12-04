# 📊 Supabase 로그 분석 가이드

## ✅ 로그 확인 완료!

`execute-schedules` 함수의 실행 기록을 성공적으로 찾았습니다!

---

## 📊 로그 분석

### 현재 확인된 로그 정보

**로그 항목 수:** 9개 (최근 실행 기록)

**로그 형식:**
```json
{
  "deployment_id": "...",
  "event_message": "POST | 200 | https://...",
  "execution_time_ms": 364,
  "function_id": "...",
  "id": "...",
  "method": "POST",
  "status_code": 200,
  "timestamp": 1763605838888000,
  "version": "5"
}
```

### 로그 항목 분석

#### 최신 실행 기록:

1. **POST | 200** - 실행 시간: 364ms (version 5)
   - ✅ 성공 (HTTP 200)
   - ✅ 최신 버전 (version 5)
   - ✅ 실행 시간: 약 0.4초

2. **GET | 200** - 실행 시간: 2712ms (version 5)
   - ✅ 성공 (HTTP 200)
   - ⚠️ 실행 시간: 약 2.7초 (약간 느림)

3. **POST | 200** - 실행 시간: 10019ms (version 4)
   - ✅ 성공 (HTTP 200)
   - ⚠️ 실행 시간: 약 10초 (오래 걸림)

---

## 🔍 로그 상세 확인 방법

### 1. 각 로그 항목 클릭하여 상세 정보 확인

Supabase 로그 화면에서:

1. **로그 항목 클릭**
   - 목록에서 로그 항목 클릭
   - 상세 정보 패널이 열립니다

2. **상세 정보 확인**
   - **Request ID**: 요청 고유 ID
   - **Method**: GET 또는 POST
   - **Status Code**: HTTP 상태 코드 (200 = 성공)
   - **Execution Time**: 실행 시간 (밀리초)
   - **Timestamp**: 실행 시간
   - **Version**: 함수 버전

3. **로그 메시지 확인**
   - 상세 패널에서 `console.log()` 메시지 확인
   - 예: `[execute-schedules] Current time (UTC): ...`
   - 예: `[execute-schedules] Checking schedules between ...`
   - 예: `[execute-schedules] Successfully sent to ...`

---

## 📝 로그 항목 의미

### event_message 분석

**형식:** `METHOD | STATUS_CODE | URL`

**예시:**
- `POST | 200 | https://.../execute-schedules`
  - POST 요청, HTTP 200 (성공)
- `GET | 200 | https://.../execute-schedules`
  - GET 요청, HTTP 200 (성공)

### status_code 의미

- **200**: 성공 ✅
- **400**: 잘못된 요청
- **404**: 함수를 찾을 수 없음
- **500**: 서버 오류

### execution_time_ms 의미

- **< 1000ms** (1초 미만): 빠름 ✅
- **1000-5000ms** (1-5초): 보통
- **> 5000ms** (5초 이상): 느림 ⚠️

---

## 🎯 로그 확인 팁

### 1. 로그 필터링

Supabase 로그 화면에서:

1. **검색창 사용**
   ```
   execute-schedules
   ```

2. **시간 범위 조정**
   - "Last hour" → "Last 24 hours"
   - 또는 시작/종료 시간 직접 설정

3. **Status 필터**
   - "Status" 드롭다운에서 "200" 선택 (성공만 보기)

4. **Method 필터**
   - "Method" 드롭다운에서 "POST" 선택 (POST 요청만 보기)

### 2. 로그 상세 확인

1. **로그 항목 클릭**
   - 목록에서 로그 항목 클릭

2. **로그 메시지 확인**
   - `console.log()` 메시지 확인
   - `console.error()` 메시지 확인

3. **Request/Response 확인**
   - 요청 본문 확인
   - 응답 본문 확인

---

## ✅ 로그 확인 체크리스트

- [ ] `execute-schedules` 함수 로그 확인 완료
- [ ] HTTP 200 상태 코드 확인 (성공)
- [ ] 실행 시간 확인 (정상 범위 내)
- [ ] 최신 버전 (version 5) 확인
- [ ] 로그 상세 정보 확인
- [ ] `console.log()` 메시지 확인

---

## 🚀 다음 단계

### 1. 로그 상세 정보 확인

각 로그 항목을 클릭하여:
- `console.log()` 메시지 확인
- 실행 내용 확인
- 오류 메시지 확인 (있는 경우)

### 2. 스케줄 실행 확인

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
- `status`가 'sent'인 스케줄 확인
- `sent_at`이 설정되어 있는지 확인

### 3. 자동 실행 확인

pg_cron이 1분마다 함수를 호출하는지 확인:

```sql
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname = 'execute-schedules-job';
```

**확인 사항:**
- `active`가 `true`인지 확인
- `schedule`이 `* * * * *` (매분)인지 확인

---

## 💡 로그 해석 가이드

### 정상 작동 로그 예시:

**로그 항목:**
```json
{
  "event_message": "POST | 200 | ...",
  "execution_time_ms": 364,
  "status_code": 200
}
```

**상세 로그 (클릭하면 보임):**
```
[execute-schedules] Current time (UTC): 2025-11-20T02:30:38.795Z
[execute-schedules] Checking schedules between ...
[execute-schedules] Found 0 schedules to execute
```

**의미:**
- ✅ 함수가 정상 실행됨
- ✅ HTTP 200 (성공)
- ✅ 실행 시간 정상
- ℹ️ 실행할 스케줄 없음 (정상)

### 스케줄 실행 로그 예시:

**상세 로그:**
```
[execute-schedules] Current time (UTC): ...
[execute-schedules] Found 1 schedules to execute
[execute-schedules] Processing schedule ...
[execute-schedules] Sending audio to https://nanum.online/tts/api/broadcast/
[execute-schedules] Successfully sent to https://nanum.online/tts/api/broadcast/
[execute-schedules] Response status: 200
```

**의미:**
- ✅ 스케줄 찾음
- ✅ 오디오 전송 성공
- ✅ 엔드포인트 응답 성공

---

## 📋 로그 확인 가이드 요약

### Supabase 로그 확인 위치:

1. **Supabase 대시보드** 접속
2. **왼쪽 사이드바** → **"Logs & Analytics"** 클릭
3. **"Edge Functions"** 탭 선택
4. 함수 드롭다운에서 **"execute-schedules"** 선택
5. 로그 목록 확인
6. 로그 항목 클릭하여 상세 정보 확인

---

## 🎉 완료!

로그 확인이 완료되었습니다! 함수가 정상 작동하고 있습니다.

**다음 단계:**
1. 로그 상세 정보 확인 (로그 항목 클릭)
2. 스케줄 생성 및 실행 테스트
3. 자동 실행 확인 (pg_cron)

---

**이제 스케줄을 생성하여 실제 방송 송출을 테스트할 수 있습니다!** 🚀

