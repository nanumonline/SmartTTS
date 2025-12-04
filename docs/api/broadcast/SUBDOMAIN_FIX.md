# 🔧 서브도메인 경로 문제 해결

## 🚨 현재 상황

### ✅ 좋은 소식
- PHP가 정상 작동합니다!
- 파일이 서버에 올바르게 업로드되었습니다!
- `hello.php` 테스트 성공

### ❌ 문제점
**접근 경로가 다릅니다:**
- 현재 작동: `https://nanum.online/tts/api/broadcast/hello.php`
- 원하는 경로: `https://tts.nanum.online/api/broadcast/hello.php`

**서버 경로:**
```
/home/u243383165/domains/nanum.online/public_html/tts/api/broadcast/
```

---

## ✅ 해결 방법

### 방법 1: 서브도메인 설정 확인 (권장)

`tts.nanum.online` 서브도메인이 `public_html/tts/`를 루트로 가리키도록 설정해야 합니다.

#### Hostinger에서 확인:

1. **Hostinger 대시보드 로그인**
2. **도메인 (Domains)** 메뉴 클릭
3. **서브도메인 (Subdomains)** 탭 클릭
4. `tts.nanum.online` 서브도메인 확인:
   - **루트 디렉토리**: `public_html/tts` 또는 `tts`로 설정되어 있어야 함
   - 만약 설정이 없거나 다르면 수정 필요

#### 서브도메인 설정이 올바르면:

`https://tts.nanum.online/api/broadcast/test.php`로 접근 가능해야 합니다.

---

### 방법 2: 현재 경로 사용 (임시 해결책)

서브도메인 설정을 변경할 수 없다면, 현재 경로를 사용할 수 있습니다.

**현재 작동하는 경로:**
```
https://nanum.online/tts/api/broadcast/test.php
```

**전송 설정에서 엔드포인트 URL:**
```
https://nanum.online/tts/api/broadcast
```

---

### 방법 3: 경로 통합 (선택사항)

두 경로 모두 작동하도록 설정할 수 있습니다.

#### `.htaccess` 파일 수정

`public_html/tts/api/broadcast/.htaccess` 파일에 다음 추가:

```apache
# 현재 경로와 서브도메인 경로 모두 지원
# (기존 내용 유지)
```

---

## 🔍 확인 방법

### 테스트 1: 현재 경로 테스트

**브라우저:**
```
https://nanum.online/tts/api/broadcast/test.php
```

**예상 결과**: JSON 응답 표시 ✅

### 테스트 2: 서브도메인 경로 테스트

**브라우저:**
```
https://tts.nanum.online/api/broadcast/test.php
```

**예상 결과:**
- ✅ JSON 응답 표시 → 서브도메인 설정 완료
- ❌ 404 또는 HTML 표시 → 서브도메인 설정 필요

---

## 📝 전송 설정 업데이트

### 옵션 1: 현재 경로 사용 (권장 - 즉시 사용 가능)

전송 설정에서 엔드포인트 URL:
```
https://nanum.online/tts/api/broadcast
```

### 옵션 2: 서브도메인 경로 사용 (설정 후)

전송 설정에서 엔드포인트 URL:
```
https://tts.nanum.online/api/broadcast
```

---

## ✅ 다음 단계

### 즉시 사용 가능:

1. ✅ `hello.php` 테스트 성공 → PHP 작동 확인
2. ✅ 현재 경로로 API 엔드포인트 테스트:
   ```
   https://nanum.online/tts/api/broadcast/test.php
   ```
3. ✅ 전송 설정에서 엔드포인트 URL 업데이트:
   ```
   https://nanum.online/tts/api/broadcast
   ```

### 서브도메인 경로로 전환하려면:

1. Hostinger → 도메인 → 서브도메인 설정 확인
2. `tts.nanum.online`이 `public_html/tts`를 루트로 가리키는지 확인
3. 설정 수정 후 테스트:
   ```
   https://tts.nanum.online/api/broadcast/test.php
   ```

---

## 🎯 권장 사항

**현재 상황에서는:**
- ✅ **`https://nanum.online/tts/api/broadcast`** 경로를 사용하세요
- ✅ 이미 작동하고 있으므로 바로 사용 가능합니다
- ✅ 서브도메인 설정은 나중에 수정할 수 있습니다

---

**현재 경로로 바로 사용할 수 있습니다!** 🚀

