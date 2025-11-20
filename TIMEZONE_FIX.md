# 🔧 시간대(UTC/KST) 처리 수정 가이드

## 🚨 확인된 문제

### 문제점

1. **브라우저 시간대 의존성**
   - `localTimeToISOString`과 `isoToLocalDateTimeString`이 브라우저의 로컬 시간대를 사용
   - 사용자가 다른 시간대에 있으면 문제 발생 가능

2. **localhost:8000 vs tts.nanum.online 차이**
   - 둘 다 같은 코드를 사용하므로 시간대 처리는 동일해야 함
   - 하지만 브라우저 시간대 설정에 따라 다를 수 있음

---

## ✅ 수정 사항

### 1. `localTimeToISOString` 수정

**이전:**
```typescript
const localDate = new Date(year, month, day, hours, minutes, 0, 0);
return localDate.toISOString();
```

**수정 후:**
```typescript
// 명시적으로 KST(Asia/Seoul, UTC+9) 시간대 사용
const kstDateString = `${year}-${month}-${day}T${hours}:${minutes}:00+09:00`;
const kstDate = new Date(kstDateString);
return kstDate.toISOString();
```

**개선 사항:**
- ✅ 명시적으로 KST(UTC+9) 시간대 지정
- ✅ localhost:8000과 tts.nanum.online에서 동일하게 작동
- ✅ 브라우저 시간대 설정과 무관

### 2. `isoToLocalDateTimeString` 수정

**이전:**
```typescript
const date = new Date(iso);
const year = date.getFullYear();
// ...
```

**수정 후:**
```typescript
// 명시적으로 KST(Asia/Seoul, UTC+9) 시간대로 변환
const utcDate = new Date(iso);
const kstDate = new Date(utcDate.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
const year = kstDate.getFullYear();
// ...
```

**개선 사항:**
- ✅ 명시적으로 KST(UTC+9) 시간대로 변환
- ✅ localhost:8000과 tts.nanum.online에서 동일하게 작동
- ✅ 브라우저 시간대 설정과 무관

### 3. `execute-schedules` 로그 개선

**추가된 로그:**
- KST 시간 표시 추가
- UTC와 KST 시간 모두 표시
- 시간 비교 시 KST 시간도 표시

---

## 📋 시간대 처리 흐름

### 1. 스케줄 생성 (웹 서비스)

**사용자 입력:**
- 날짜: 2025-11-20
- 시간: 13:00 (KST)

**처리:**
1. `localTimeToISOString(2025, 10, 20, 13, 0)` 호출
2. KST 13:00을 UTC 04:00으로 변환
3. DB에 UTC 시간 저장: `2025-11-20T04:00:00Z`

### 2. 스케줄 표시 (웹 서비스)

**DB에서 조회:**
- UTC 시간: `2025-11-20T04:00:00Z`

**처리:**
1. `isoToLocalDateTimeString('2025-11-20T04:00:00Z')` 호출
2. UTC 04:00을 KST 13:00으로 변환
3. 사용자에게 KST 13:00 표시

### 3. 스케줄 실행 (Edge Function)

**현재 시간:**
- UTC: `2025-11-20T04:00:00Z`
- KST: `2025-11-20 13:00:00`

**스케줄 시간:**
- UTC: `2025-11-20T04:00:00Z`
- KST: `2025-11-20 13:00:00`

**비교:**
- UTC 시간으로 비교 (정확함)
- 로그에 KST 시간도 표시 (이해하기 쉬움)

---

## ✅ 확인 사항

### 1. 시간 변환 정확성

**테스트:**
1. 웹 서비스에서 스케줄 생성 (KST 13:00)
2. DB에서 UTC 시간 확인 (04:00)
3. 웹 서비스에서 스케줄 표시 확인 (KST 13:00)
4. Edge Function 로그에서 KST 시간 확인

### 2. localhost vs tts.nanum.online

**확인:**
- [ ] localhost:8000에서 스케줄 생성
- [ ] tts.nanum.online에서 스케줄 확인
- [ ] 시간이 동일하게 표시되는지 확인

### 3. Edge Function 로그

**확인:**
- [ ] UTC 시간 표시
- [ ] KST 시간 표시
- [ ] 시간 비교 정확성

---

## 🚀 배포

### 1. Edge Function 배포

```bash
npx supabase functions deploy execute-schedules
```

### 2. 프론트엔드 빌드

```bash
npm run build
```

### 3. Git Push

```bash
git add .
git commit -m "fix: 명시적으로 KST 시간대 사용하여 UTC 변환 정확성 개선"
git push
```

---

## 📝 변경 사항 요약

### 수정된 파일

1. **`src/lib/pageUtils.ts`**
   - `localTimeToISOString`: 명시적으로 KST(UTC+9) 사용
   - `isoToLocalDateTimeString`: 명시적으로 KST(UTC+9) 사용

2. **`supabase/functions/execute-schedules/index.ts`**
   - KST 시간 로그 추가
   - 시간 비교 시 KST 시간 표시

### 개선 사항

- ✅ 명시적으로 KST(UTC+9) 시간대 사용
- ✅ 브라우저 시간대 설정과 무관
- ✅ localhost:8000과 tts.nanum.online에서 동일하게 작동
- ✅ 로그에 UTC와 KST 시간 모두 표시

---

**이제 시간대 처리가 명확하고 정확합니다!** 🚀

