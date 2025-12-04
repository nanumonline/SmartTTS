# 🚨 POST 요청 301 리다이렉트 문제 해결

## 현재 문제

**POST 요청 시 301 Moved Permanently 에러 발생**

```
curl -X POST https://nanum.online/tts/api/broadcast \
  -H "Content-Type: audio/mpeg" \
  -d "test audio data"
```

**결과:** 301 HTML 응답 (정상 JSON 응답이 아님)

---

## ✅ 해결 방법

### 방법 1: URL 끝에 슬래시 추가 (확인 필요)

일부 서버 설정에서 디렉토리 요청 시 슬래시가 필요할 수 있습니다.

**테스트:**
```bash
curl -X POST https://nanum.online/tts/api/broadcast/ \
  -H "Content-Type: audio/mpeg" \
  -d "test audio data"
```

### 방법 2: .htaccess 수정

`public_html/tts/api/broadcast/.htaccess` 파일에 다음 추가:

```apache
# POST 요청 리다이렉트 방지
RewriteEngine On

# POST 요청은 리다이렉트하지 않음
RewriteCond %{REQUEST_METHOD} POST
RewriteRule ^ - [L]

# 기존 내용...
```

### 방법 3: Supabase Edge Function에서 리다이렉트 처리

`execute-schedules` Edge Function이 리다이렉트를 자동으로 처리하도록 설정 (기본적으로 `fetch()`는 리다이렉트를 따라감)

---

## 🔍 디버깅

### 1. POST 요청 헤더 확인

```bash
curl -v -X POST https://nanum.online/tts/api/broadcast \
  -H "Content-Type: audio/mpeg" \
  -d "test audio data" 2>&1 | head -30
```

### 2. Location 헤더 확인

리다이렉트되는 위치 확인:
```bash
curl -I -X POST https://nanum.online/tts/api/broadcast \
  -H "Content-Type: audio/mpeg" 2>&1 | grep -i location
```

### 3. index.php 직접 접근 테스트

```bash
curl -X POST https://nanum.online/tts/api/broadcast/index.php \
  -H "Content-Type: audio/mpeg" \
  -d "test audio data"
```

---

## 💡 빠른 해결책

### 옵션 1: URL에 index.php 명시

전송 설정에서 엔드포인트 URL:
```
https://nanum.online/tts/api/broadcast/index.php
```

### 옵션 2: .htaccess에서 DirectoryIndex 설정 확인

`public_html/tts/api/broadcast/.htaccess`에 다음이 있는지 확인:
```apache
DirectoryIndex index.php index.html
```

---

## 📝 확인 사항

- [ ] POST 요청이 리다이렉트되지 않도록 `.htaccess` 설정
- [ ] `index.php` 파일이 올바른 위치에 있는지 확인
- [ ] Supabase Edge Function에서 리다이렉트를 따라가는지 확인
- [ ] 실제 오디오 데이터로 테스트

---

**POST 요청이 정상 작동하는지 확인 후 결과를 알려주세요!** 🚀

