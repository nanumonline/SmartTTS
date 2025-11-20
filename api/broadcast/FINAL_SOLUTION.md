# 🎯 최종 해결 방법

## 🚨 현재 상황

- **HTTP 404 응답**: 서버에서 실제로 파일을 찾을 수 없음
- **문제**: React 앱이 아니라 서버 자체에서 404 반환
- **원인 가능성**:
  1. 파일이 실제로 서버에 업로드되지 않음
  2. 경로가 잘못됨
  3. `.htaccess` 설정이 작동하지 않음

---

## ✅ 단계별 해결 방법

### 1단계: 파일 위치 재확인 (가장 중요!)

Hostinger File Manager에서 정확히 다음 위치에 파일이 있는지 확인:

```
public_html/
└── tts/
    └── api/
        └── broadcast/
            ├── index.php      ← 필수!
            ├── test.php       ← 필수!
            └── .htaccess      ← 필수!
```

**확인 방법:**
1. File Manager에서 `public_html/tts/api/broadcast/` 폴더로 이동
2. 다음 3개 파일이 정확히 있는지 확인:
   - `index.php` (파일 크기: 약 4.5KB)
   - `test.php` (파일 크기: 약 2.3KB)
   - `.htaccess` (파일 크기: 약 1KB, 숨김 파일)

**파일이 없으면 다시 업로드하세요!**

---

### 2단계: 간단한 테스트 파일 생성

PHP가 작동하는지 확인하기 위해 간단한 파일을 만들어봅시다.

**파일 이름**: `hello.php`
**파일 위치**: `public_html/tts/api/broadcast/hello.php`
**파일 내용**:
```php
<?php
header('Content-Type: text/plain');
echo "PHP is working!";
?>
```

**업로드 후 브라우저에서 테스트:**
```
https://tts.nanum.online/api/broadcast/hello.php
```

**예상 결과**: "PHP is working!" 텍스트 표시

**결과가 "PHP is working!"이면**: 
- ✅ PHP는 작동함
- ❌ `test.php` 파일에 문제가 있거나 파일이 없음

**결과가 HTML이면**: 
- ❌ `.htaccess` 설정 문제

**결과가 404면**: 
- ❌ 파일이 서버에 없거나 경로 문제

---

### 3단계: api 폴더에 .htaccess 생성 (필수!)

`public_html/tts/api/` 폴더에 `.htaccess` 파일을 만들어야 합니다.

**파일 위치:**
```
public_html/tts/api/.htaccess
```

**파일 내용 (가장 간단한 버전):**
```apache
RewriteEngine Off
```

**생성 방법:**
1. Hostinger File Manager 접속
2. `public_html/tts/api/` 폴더로 이동
3. **New File** 클릭
4. 파일 이름: `.htaccess` (점으로 시작, 숨김 파일)
5. 내용: `RewriteEngine Off`
6. 저장
7. 파일 권한: **644**

---

### 4단계: 파일 권한 확인

모든 파일과 폴더의 권한을 확인:

- **파일 권한**: **644** (`-rw-r--r--`)
- **폴더 권한**: **755** (`drwxr-xr-x`)

**권한 변경 방법:**
1. File Manager에서 파일/폴더 선택
2. 우클릭 → **Change Permissions**
3. 파일: 644, 폴더: 755

---

### 5단계: 루트 .htaccess 확인 (선택사항)

`public_html/tts/.htaccess` 파일을 확인하고, 다음 규칙이 **맨 위에** 있는지 확인:

```apache
# API 경로 예외 처리 (맨 위에!)
<IfModule mod_rewrite.c>
RewriteEngine On

# /api/* 경로는 React 앱으로 리다이렉트하지 않음
RewriteCond %{REQUEST_URI} ^/api/
RewriteCond %{REQUEST_FILENAME} -f
RewriteRule ^ - [L]
</IfModule>
```

---

## 🔍 디버깅 체크리스트

다음을 순서대로 확인하세요:

- [ ] `public_html/tts/api/broadcast/` 폴더에 `index.php`, `test.php`, `.htaccess` 파일이 있음
- [ ] 파일 크기가 0이 아님 (실제 내용이 있음)
- [ ] `public_html/tts/api/.htaccess` 파일이 생성됨
- [ ] `hello.php` 테스트 파일 생성 및 테스트 성공
- [ ] 모든 파일 권한이 644
- [ ] 모든 폴더 권한이 755
- [ ] 루트 `.htaccess`에 API 경로 예외 처리 추가됨

---

## 💡 빠른 테스트 순서

### 1. hello.php 테스트
```
https://tts.nanum.online/api/broadcast/hello.php
```
→ "PHP is working!" 표시되면 PHP 작동 ✅

### 2. test.php 테스트
```
https://tts.nanum.online/api/broadcast/test.php
```
→ JSON 응답 표시되면 성공 ✅

### 3. API 엔드포인트 테스트
```bash
curl -X POST https://tts.nanum.online/api/broadcast \
  -H "Content-Type: audio/mpeg" \
  -d "test audio data"
```
→ JSON 응답 표시되면 성공 ✅

---

## 🚨 여전히 작동하지 않으면

1. **파일 경로 재확인**: `public_html/tts/api/broadcast/` 정확한 위치 확인
2. **Hostinger 지원팀 문의**: PHP 모듈이 활성화되어 있는지 확인
3. **Cloudflare 설정 확인**: API 경로가 차단되지 않았는지 확인

---

**가장 중요한 것은 정확한 파일 위치와 `api/.htaccess` 파일입니다!** 🚀

