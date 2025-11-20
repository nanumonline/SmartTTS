# 📁 업로드된 파일 설명

## ✅ 파일 업로드 완료!

다음 파일들이 `public_html/tts/api/broadcast/` 폴더에 업로드되었습니다:

1. ✅ `index.php` - PHP 버전 (메인 API)
2. ✅ `test.php` - PHP 테스트 파일
3. ✅ `.htaccess` - Apache 설정 파일
4. ✅ `index.js` - Node.js 버전 (선택사항)
5. ✅ `package.json` - Node.js 의존성 파일 (선택사항)
6. ✅ `README.md` - 문서
7. ✅ `TROUBLESHOOTING.md` - 문제 해결 가이드

---

## ❓ PHP와 Node.js 파일이 함께 있어도 되나요?

### ✅ 네, 문제 없습니다!

**이유:**

1. **Apache/PHP 서버**는:
   - `.php` 파일만 처리합니다
   - `.js` 파일은 무시하거나 정적 파일로 제공합니다
   - `.htaccess` 파일이 있으면 `index.php`를 자동으로 실행합니다

2. **Node.js**는:
   - 별도의 프로세스로 실행해야 합니다
   - `.js` 파일이 있어도 자동으로 실행되지 않습니다
   - 별도로 설정해야 작동합니다

3. **실제 작동 방식:**
   - PHP 버전: `https://tts.nanum.online/api/broadcast/` → `index.php` 실행
   - Node.js 버전: 프로세스가 실행 중이면 작동, 아니면 무시됨

---

## 🎯 현재 사용할 버전: PHP

### Hostinger에서 PHP 버전 권장 이유:

1. ✅ **기본 지원**: Hostinger는 PHP를 기본적으로 지원
2. ✅ **간단한 설정**: `.htaccess` 파일만 있으면 바로 작동
3. ✅ **추가 설정 불필요**: Node.js 프로세스 관리 불필요
4. ✅ **자동 실행**: 파일이 있으면 자동으로 처리

### Node.js 파일은?

- ❌ **지금은 사용하지 않아도 됩니다**
- 📦 보관해두면 나중에 필요할 때 사용 가능
- 🔧 Node.js를 사용하려면 별도 설정 필요 (프로세스 관리, PM2 등)

---

## ✅ 테스트 방법

### 1. PHP 버전 테스트

**브라우저:**
```
https://tts.nanum.online/api/broadcast/test.php
```

**터미널:**
```bash
curl https://tts.nanum.online/api/broadcast/test.php
```

**예상 결과:**
```json
{
  "status": "ok",
  "message": "All checks passed! API endpoint is ready to use.",
  ...
}
```

### 2. 메인 API 엔드포인트 테스트

**터미널:**
```bash
curl -X POST https://tts.nanum.online/api/broadcast \
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

---

## 🔍 파일 우선순위

### Apache/PHP 서버에서:

1. **POST 요청**: `https://tts.nanum.online/api/broadcast`
   - `.htaccess`의 `DirectoryIndex` 설정에 따라
   - `index.php`가 실행됩니다

2. **GET 요청**: `https://tts.nanum.online/api/broadcast/test.php`
   - 직접 `test.php`가 실행됩니다

3. **`.js` 파일**: 무시됨 (PHP 서버는 처리하지 않음)

---

## 💡 정리

### ✅ 지금은:
- **PHP 버전 (`index.php`)** 사용
- Node.js 파일들은 무시됨
- `.htaccess`가 PHP를 처리하도록 설정됨

### 🔄 나중에 Node.js로 전환하려면:
1. Node.js 프로세스 시작
2. PM2 등으로 프로세스 관리
3. 또는 `.htaccess`에서 Node.js로 리다이렉트 설정

---

## 📋 최종 확인

현재 상태:
- ✅ 파일 업로드 완료
- ✅ PHP 버전 (`index.php`) 준비 완료
- ✅ `.htaccess` 설정 완료
- ✅ 테스트 파일 (`test.php`) 준비 완료

**이제 테스트를 해보세요!** 🚀

```bash
curl https://tts.nanum.online/api/broadcast/test.php
```

