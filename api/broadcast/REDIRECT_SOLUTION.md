# 🔧 301 리다이렉트 해결 방법

## 🚨 문제 상황

### 301 Moved Permanently 에러

**원인:**
- HTTP로 접근 시 HTTPS로 리다이렉트됨 (정상 동작)
- Hostinger 서버가 자동으로 HTTP → HTTPS 리다이렉트 설정

**테스트 결과:**
- ✅ `https://nanum.online/tts/api/broadcast/test.php` → HTTP 200 OK
- ⚠️ `http://nanum.online/tts/api/broadcast/test.php` → HTTP 301 → HTTPS로 리다이렉트

---

## ✅ 해결 방법

### 방법 1: 항상 HTTPS 사용 (권장)

**중요**: 엔드포인트 URL을 **항상 HTTPS**로 설정해야 합니다!

**전송 설정에서 엔드포인트 URL:**
```
https://nanum.online/tts/api/broadcast
```

**⚠️ 주의**: `http://`를 사용하지 마세요! 항상 `https://`로 시작해야 합니다.

---

### 방법 2: Supabase Edge Function에서 리다이렉트 처리

`execute-schedules` Edge Function이 리다이렉트를 자동으로 따라가도록 설정되어 있는지 확인합니다.

**확인 사항:**
- Supabase Edge Function에서 POST 요청 시 리다이렉트를 따라가도록 설정되어 있는지
- `fetch()` API는 기본적으로 리다이렉트를 따라갑니다

---

## 🔍 테스트

### 1. HTTPS 직접 접근 테스트

**터미널:**
```bash
curl -X POST https://nanum.online/tts/api/broadcast \
  -H "Content-Type: audio/mpeg" \
  -d "test audio data"
```

**예상 결과:**
```json
{
  "success": true,
  "message": "Broadcast received successfully",
  ...
}
```

### 2. 리다이렉트 자동 처리 테스트

**터미널:**
```bash
curl -L -X POST http://nanum.online/tts/api/broadcast \
  -H "Content-Type: audio/mpeg" \
  -d "test audio data"
```

**예상 결과:** HTTPS로 리다이렉트된 후 정상 응답

---

## 📝 전송 설정 체크리스트

- [ ] 엔드포인트 URL이 **HTTPS**로 시작하는지 확인
- [ ] `http://` 대신 `https://` 사용
- [ ] URL 끝에 슬래시(`/`) 없음: `https://nanum.online/tts/api/broadcast`
- [ ] POST 요청 테스트 성공

---

## ✅ 최종 엔드포인트 URL

**올바른 URL:**
```
https://nanum.online/tts/api/broadcast
```

**잘못된 URL (사용하지 마세요):**
```
http://nanum.online/tts/api/broadcast  ← HTTP는 301 리다이렉트 발생
https://nanum.online/tts/api/broadcast/  ← 끝에 슬래시 불필요
```

---

## 💡 추가 정보

### 301 리다이렉트가 문제가 되는 경우

1. **Supabase Edge Function에서 POST 요청 시**
   - `fetch()` API는 기본적으로 리다이렉트를 따라갑니다
   - 하지만 POST 요청이 GET으로 변환될 수 있습니다 (일부 서버)
   - **해결**: 처음부터 HTTPS로 요청

2. **브라우저에서 접근 시**
   - 브라우저가 자동으로 리다이렉트를 처리합니다
   - 문제 없음

---

## 🎯 결론

**301 리다이렉트는 정상 동작입니다!**

**해결책:**
- ✅ 항상 **HTTPS**로 엔드포인트 URL 설정
- ✅ `https://nanum.online/tts/api/broadcast` 사용
- ✅ 전송 설정에서 올바른 URL 확인

---

**HTTPS로 설정하면 문제 없이 작동합니다!** 🚀

