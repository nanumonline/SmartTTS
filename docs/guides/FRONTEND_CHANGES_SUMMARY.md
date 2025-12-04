# 프론트엔드 변경 사항 요약

## 📁 변경된 파일 목록

### 1. 새로 생성된 파일
- `src/components/BroadcastDialog.tsx` - 송출 다이얼로그 컴포넌트

### 2. 수정된 파일
- `src/services/dbService.ts` - 송출 함수 추가
- `src/pages/ScheduleManagerPage.tsx` - 송출 버튼 및 다이얼로그 연동
- `api/broadcast/player-pc.html` - 폴링 간격 조정 및 즉시 송출 감지

### 3. 백엔드 변경 (참고)
- `supabase/functions/broadcast-now/index.ts` - 새 Edge Function 생성

---

## 🔧 주요 변경 내용

### **1. BroadcastDialog 컴포넌트 (`src/components/BroadcastDialog.tsx`)**

**기능**:
- 즉시 송출 및 지연 송출 UI 제공
- 플레이어 송출 옵션 선택 가능
- 고객 구분 정보 입력 (고객 ID, 고객명, 구분 코드, 메모)
- 채널 선택 및 지연 시간 설정

**주요 Props**:
```typescript
interface BroadcastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  generationId: string;
  generationName?: string;
  onSuccess?: () => void;
}
```

**사용 예시**:
```tsx
<BroadcastDialog
  open={broadcastDialog.open}
  onOpenChange={(open) => setBroadcastDialog({ ...broadcastDialog, open })}
  generationId={broadcastDialog.generationId}
  generationName={broadcastDialog.generationName}
  onSuccess={() => {
    // 송출 성공 후 처리
    loadSchedules();
  }}
/>
```

---

### **2. dbService 송출 함수 (`src/services/dbService.ts`)**

**추가된 인터페이스**:
```typescript
export interface CustomerInfo {
  customerId: string;
  customerName: string;
  categoryCode: string;
  memo?: string;
}

export interface BroadcastOptions {
  generationId: string;
  channelId: string;
  scheduleName?: string;
  customerInfo?: CustomerInfo; // 플레이어 송출 옵션 선택 시
}
```

**추가된 함수**:
1. **`broadcastImmediately(options: BroadcastOptions)`**
   - 즉시 송출 실행
   - 반환: `{ success: boolean; data?: any; error?: string }`

2. **`broadcastDelayed(options: BroadcastOptions, delayMinutes: number)`**
   - 지연 송출 예약
   - `delayMinutes`는 1 이상이어야 함

3. **`broadcastScheduled(options: BroadcastOptions, scheduledTime: string)`**
   - 스케줄 송출 예약
   - `scheduledTime`은 ISO 문자열 형식

**사용 예시**:
```typescript
// 즉시 송출
const result = await dbService.broadcastImmediately({
  generationId: "123",
  channelId: "channel-uuid",
  scheduleName: "테스트 송출",
  customerInfo: {
    customerId: "CUST001",
    customerName: "테스트 고객",
    categoryCode: "VIP",
    memo: "중요 고객"
  }
});

// 지연 송출 (10분 후)
const result = await dbService.broadcastDelayed({
  generationId: "123",
  channelId: "channel-uuid",
  scheduleName: "테스트 지연 송출"
}, 10);
```

---

### **3. ScheduleManagerPage 수정 (`src/pages/ScheduleManagerPage.tsx`)**

**추가된 기능**:
1. **송출 버튼 추가**
   - 음원 목록 테이블에 "송출" 컬럼 추가
   - 각 음원 행에 송출 버튼 표시

2. **BroadcastDialog 연동**
   - 송출 버튼 클릭 시 BroadcastDialog 열림
   - 송출 성공 후 `handleBroadcastSuccess()` 콜백 실행

3. **실시간 상태 추적**
   - 송출 성공 후 즉시 스케줄 목록 새로고침
   - 5초, 10초 후 추가 새로고침으로 상태 업데이트 확인

**변경된 UI**:
```tsx
// 음원 목록 테이블 헤더
<th>음원명</th>
<th>카테고리</th>
<th>미리듣기</th>
<th>송출</th>  // ← 새로 추가된 컬럼

// 음원 행에 송출 버튼 추가
<td className="px-3 py-2 text-center">
  <Button
    variant="outline"
    size="sm"
    className="h-6 px-2 text-[10px]"
    onClick={(e) => {
      e.stopPropagation();
      setBroadcastDialog({
        open: true,
        generationId: String(gen.id || ""),
        generationName: gen.savedName || undefined,
      });
    }}
  >
    송출
  </Button>
</td>
```

---

### **4. 플레이어 개선 (`api/broadcast/player-pc.html`)**

**추가된 기능**:
1. **폴링 간격 조정 UI**
   ```html
   <select id="pollingIntervalSelect" onchange="changePollingInterval()">
     <option value="5000">5초</option>
     <option value="10000" selected>10초</option>
     <option value="30000">30초</option>
   </select>
   ```

2. **동적 폴링 간격**
   - 기본 폴링 간격: `POLL_INTERVAL` (10초)
   - 빠른 폴링 간격: `fastPollingInterval` (5초 또는 선택 간격의 절반)
   - 즉시 송출 감지 시 자동으로 빠른 폴링 모드로 전환

3. **즉시 송출 감지 로직**
   ```javascript
   // 파일이 5분 이내에 생성되었으면 즉시 송출로 판단
   const isRecentAudio = timeSinceAudio < 5 * 60 * 1000; // 5분 이내
   
   // 즉시 송출 감지 시 빠른 폴링 모드로 전환
   if (isNewAudio && isRecentAudio && !isFastPolling) {
     isFastPolling = true;
     restartPolling();
   }
   ```

---

## 🎯 사용 방법

### **즉시 송출**
1. 스케줄 관리 페이지 접속
2. 음원 목록에서 원하는 음원 찾기
3. "송출" 버튼 클릭
4. 송출 다이얼로그에서:
   - 스케줄 이름 입력
   - 채널 선택
   - "즉시 송출" 선택
   - "송출" 버튼 클릭
5. 성공 메시지 확인 후 플레이어에서 재생 확인

### **지연 송출**
1. 위와 동일하게 송출 다이얼로그 열기
2. "지연 송출" 선택
3. 지연 시간 선택 (10분/30분/60분 또는 직접 입력)
4. "송출" 버튼 클릭
5. 스케줄 목록에서 예약된 스케줄 확인

### **플레이어 송출 (고객 정보 포함)**
1. 송출 다이얼로그에서 "플레이어 송출" 체크
2. 고객 구분 정보 입력:
   - 고객 ID (필수)
   - 고객명 (필수)
   - 구분 코드 (필수)
   - 메모 (선택)
3. 송출 실행
4. 서버 로그 또는 플레이어에서 고객 정보 확인

---

## 📊 데이터 흐름

### **즉시 송출 프로세스**:
```
프론트 (BroadcastDialog)
  ↓
dbService.broadcastImmediately()
  ↓
Edge Function: broadcast-now
  ↓
오디오 데이터 로드 (Supabase Storage/DB)
  ↓
채널 endpoint로 POST 요청 (고객 정보 헤더 포함)
  ↓
서버 (index.php)에 오디오 파일 저장
  ↓
플레이어 (player-pc.html)가 폴링하여 감지
  ↓
자동 재생 시작 (빠른 폴링 모드로 전환)
```

### **지연 송출 프로세스**:
```
프론트 (BroadcastDialog)
  ↓
dbService.broadcastDelayed()
  ↓
Edge Function: broadcast-now
  ↓
스케줄 생성 (tts_schedule_requests 테이블)
  ↓
pg_cron이 1분마다 execute-schedules 호출
  ↓
지연 시간 경과 후 execute-schedules가 스케줄 실행
  ↓
채널 endpoint로 POST 요청
  ↓
플레이어가 감지하여 재생
```

---

## 🔍 디버깅 팁

### **브라우저 개발자 도구**
1. **콘솔 (Console)**
   - 송출 함수 호출 로그 확인
   - 에러 메시지 확인
   - Edge Function 응답 확인

2. **네트워크 (Network)**
   - `broadcast-now` Edge Function 호출 확인
   - `tts_schedule_requests` API 호출 확인
   - 응답 상태 코드 및 본문 확인

### **Supabase 대시보드**
1. **Logs → Edge Functions**
   - `broadcast-now` 함수 실행 로그
   - `execute-schedules` 함수 실행 로그
   - 에러 메시지 및 디버그 정보

2. **Table Editor**
   - `tts_schedule_requests` 테이블에서 스케줄 상태 확인
   - `status` 컬럼: "scheduled" → "sent" / "failed"
   - `sent_at` 컬럼: 전송 시간 확인
   - `metadata` 컬럼: 고객 정보 확인 (JSON 형식)

### **서버 로그 (Hostinger)**
- `public_html/tts/api/broadcast/logs/broadcast_YYYY-MM-DD.log`
- 오디오 파일 저장 로그
- POST 요청 헤더 로그 (고객 정보 포함)

---

## ✅ 체크리스트

### **개발 완료 항목**
- [x] BroadcastDialog 컴포넌트 생성
- [x] dbService 송출 함수 추가
- [x] ScheduleManagerPage에 송출 버튼 추가
- [x] 플레이어 폴링 간격 조정 기능
- [x] 즉시 송출 감지 및 빠른 폴링 모드 전환
- [x] 송출 상태 실시간 추적
- [x] 고객 구분 정보 입력 및 전달

### **향후 개선 사항**
- [ ] AudioHistoryPage에 송출 버튼 추가
- [ ] 송출 이력 페이지 생성
- [ ] 실시간 알림 (WebSocket/SSE)
- [ ] 송출 통계 대시보드
- [ ] 배치 송출 기능 (여러 음원 동시 송출)

---

**모든 변경 사항이 적용되었으며, 테스트 가이드를 참고하여 기능을 확인하세요!** 🎉

