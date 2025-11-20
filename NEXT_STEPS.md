# ✅ 다음 단계 안내

## 🎉 완료된 작업

1. ✅ **채널 테이블 생성** - 마이그레이션 적용 완료
2. ✅ **Edge Function 배포** - `execute-schedules` 배포 완료
3. ✅ **방송 송출 로직 활성화** - 실제 채널 endpoint로 방송 전송 가능
4. ✅ **채널 관리 기능 구현** - DB에서 채널 저장/로드 기능 추가

---

## 📋 다음 단계

### 1. 채널 생성 (필수)

실제 방송 송출을 위해서는 **채널을 생성하고 endpoint URL을 설정**해야 합니다.

#### 방법: 전송 설정 페이지에서 생성

1. **"전송 설정"** 메뉴로 이동
2. 오른쪽 **"새 채널 추가"** 버튼 클릭
3. 다음 정보 입력:
   - **채널 이름**: 예) "라디오 방송", "태블릿 방송 장비" 등
   - **채널 유형**: 라디오 방송 / 태블릿 방송 장비 / PC 방송 장비
   - **엔드포인트 URL**: 방송 송출 API URL
     - 예: `https://your-broadcast-api.com/api/broadcast`
     - 이 endpoint는 POST 요청으로 오디오 파일을 받을 수 있어야 합니다
   - **채널 활성화**: ON (활성화된 채널만 스케줄에서 사용 가능)
4. **"저장"** 버튼 클릭

#### 채널 endpoint 요구사항

방송 송출 endpoint는 다음 형식으로 오디오 데이터를 받아야 합니다:

```
POST {endpoint_url}
Content-Type: audio/mpeg (또는 다른 MIME 타입)
Content-Length: {audio_file_size}
Body: {binary audio data}
```

---

### 2. 스케줄 생성 및 테스트

1. **"스케줄 관리"** 페이지로 이동
2. **"새 스케줄"** 버튼 클릭
3. 스케줄 정보 입력:
   - **스케줄명**: 예) "아침 안내방송"
   - **음원 선택**: 전송할 음원 선택
   - **전송 채널**: 위에서 생성한 채널 선택
   - **기간**: 시작일 ~ 종료일
   - **전송 시간**: 예) 09:00
   - **하루 전송 횟수**: 1회 ~ 6회
4. **"생성"** 버튼 클릭

#### 테스트 방법

**방법 A: 가까운 시간에 스케줄 생성**
- 현재 시간 + 1~2분 후로 스케줄 생성
- 1분마다 자동 실행되므로 약 1~2분 내 실행됨

**방법 B: 수동으로 Edge Function 호출 (테스트용)**
```bash
curl -X POST https://gxxralruivyhdxyftsrg.supabase.co/functions/v1/execute-schedules \
  -H "Content-Type: application/json" \
  -d '{"trigger": "manual"}'
```

---

### 3. 스케줄 실행 확인

#### 방법 A: 스케줄 관리 페이지에서 확인

1. **"스케줄 관리"** 페이지로 이동
2. 생성한 스케줄의 **상태** 확인:
   - `예약됨` (scheduled): 아직 실행되지 않음
   - `전송됨` (sent): 성공적으로 전송됨
   - `실패` (failed): 전송 실패 (실패 이유 확인 가능)

#### 방법 B: Supabase 로그 확인

1. Supabase 대시보드 접속
2. **"Logs"** → **"Edge Functions"** 메뉴 선택
3. `execute-schedules` 함수 로그 확인
   - 성공: "Successfully sent to {endpoint}"
   - 실패: 에러 메시지 확인

#### 방법 C: SQL Editor에서 확인

```sql
SELECT 
  id,
  schedule_name,
  target_channel,
  scheduled_time,
  status,
  sent_at,
  fail_reason
FROM tts_schedule_requests
WHERE user_id = 'your-user-id'
ORDER BY scheduled_time DESC
LIMIT 10;
```

---

## 🔧 문제 해결

### 문제: 스케줄이 실행되지 않음

**원인 1: pg_cron이 설정되지 않음**
- 해결: `supabase/migrations/20251104000000_setup_schedule_cron.sql` 파일 실행 확인

**원인 2: 채널 endpoint가 설정되지 않음**
- 해결: 전송 설정 페이지에서 채널 endpoint URL 설정 확인

**원인 3: 채널이 비활성화됨**
- 해결: 채널 활성화 상태 확인

### 문제: 전송 실패 (failed 상태)

**원인 1: 채널 endpoint URL 오류**
- 해결: endpoint URL이 올바른지 확인
- 해결: endpoint가 POST 요청을 받을 수 있는지 확인

**원인 2: 네트워크 오류**
- 해결: endpoint 서버가 실행 중인지 확인
- 해결: 방화벽/보안 그룹 설정 확인

**원인 3: 오디오 데이터 없음**
- 해결: 음원이 제대로 저장되어 있는지 확인
- 해결: Supabase Storage 또는 DB에서 음원 데이터 확인

---

## 📝 추가 설정 (선택)

### 채널 인증 설정

인증이 필요한 endpoint의 경우, 채널의 `config` 필드에 인증 정보를 저장할 수 있습니다:

```typescript
// 향후 SendSetupPage에서 config 설정 UI 추가 가능
const channelConfig = {
  authHeader: "Bearer YOUR_API_TOKEN",
  // 또는
  apiKey: "YOUR_API_KEY",
  // 또는
  customHeaders: {
    "X-Custom-Header": "value"
  }
};
```

현재는 기본 헤더만 전송하지만, 향후 `SendSetupPage`에서 인증 정보를 입력할 수 있도록 확장 가능합니다.

---

## 🎯 체크리스트

스케줄 방송 송출이 정상적으로 동작하는지 확인:

- [ ] 채널 생성 완료 (최소 1개)
- [ ] 채널 endpoint URL 설정 완료
- [ ] 채널 활성화 상태 확인
- [ ] 테스트 스케줄 생성 (1~2분 후 실행)
- [ ] 스케줄 실행 확인 (상태가 "전송됨"으로 변경)
- [ ] endpoint 서버에서 실제 방송 송출 확인
- [ ] 로그에서 에러 없음 확인

---

## 🚀 다음 개선 사항 (선택)

1. **채널 테스트 기능**: SendSetupPage에서 테스트 전송 버튼으로 실제 endpoint 동작 확인
2. **스케줄 실행 로그**: 스케줄 실행 이력 상세 확인 페이지
3. **실시간 알림**: Supabase Realtime으로 스케줄 실행 상태 실시간 업데이트
4. **재시도 로직**: 전송 실패 시 자동 재시도
5. **채널 인증 설정 UI**: SendSetupPage에서 API 키, 인증 헤더 등 설정 가능

---

**모든 설정이 완료되면 스케줄 관리에서 지정한 시간에 자동으로 방송이 송출됩니다!** 🎉

