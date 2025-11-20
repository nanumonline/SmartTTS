# 🚨 긴급 해결 방법

## 현재 상황

- 브라우저: 404 에러 (React 앱 라우터)
- 터미널: "not found" (서버에서 파일을 찾을 수 없음)

**문제**: React 앱의 `.htaccess`가 모든 요청을 `index.html`로 리다이렉트하고 있음

---

## ✅ 즉시 해결 방법

### 필수 작업: `public_html/tts/api/.htaccess` 파일 생성

이 파일이 없으면 API 경로가 React 앱으로 리다이렉트됩니다!

#### 1. Hostinger File Manager 접속

#### 2. `public_html/tts/api/` 폴더로 이동

#### 3. 새 파일 생성: `.htaccess`

**파일 이름**: `.htaccess` (점으로 시작, 숨김 파일)

**파일 내용** (아래 중 하나 선택):

**옵션 1: 가장 간단 (권장)**
```apache
RewriteEngine Off
```

**옵션 2: 상세 설정**
```apache
# API 경로는 React 앱으로 리다이렉트하지 않음
<IfModule mod_rewrite.c>
RewriteEngine On

# 실제 파일이 존재하면 직접 처리
RewriteCond %{REQUEST_FILENAME} -f
RewriteRule ^ - [L]

# 디렉토리가 존재하면 직접 처리
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]
</IfModule>

# CORS 설정
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "POST, OPTIONS, GET"
    Header set Access-Control-Allow-Headers "Content-Type, Content-Length, Authorization, X-API-Key"
    Header set Access-Control-Max-Age "3600"
</IfModule>
```

#### 4. 파일 저장

---

## 🔍 확인 사항

### 1. 파일 구조 확인

Hostinger File Manager에서 다음 구조가 있어야 합니다:

```
public_html/
└── tts/
    ├── .htaccess          ← React 앱 설정 (기존)
    └── api/
        ├── .htaccess      ← 새로 생성! (중요!)
        └── broadcast/
            ├── index.php
            ├── test.php
            └── .htaccess
```

### 2. 파일 권한 확인

- `.htaccess` 파일: **644**
- PHP 파일: **644**
- 폴더: **755**

---

## ✅ 테스트

### 1. 간단한 테스트 파일 생성

`public_html/tts/api/broadcast/hello.php` 파일 생성:

```php
<?php
header('Content-Type: text/plain');
echo "Hello, PHP is working!";
?>
```

브라우저에서:
```
https://tts.nanum.online/api/broadcast/hello.php
```

**예상 결과**: "Hello, PHP is working!" 텍스트 표시

**실제 결과가 HTML이면**: `.htaccess` 설정이 아직 작동하지 않음

### 2. test.php 테스트

브라우저에서:
```
https://tts.nanum.online/api/broadcast/test.php
```

**예상 결과**: JSON 응답 표시

---

## 🎯 핵심 포인트

### 왜 `api/.htaccess`가 필요한가?

1. **React 앱의 `.htaccess`** (`public_html/tts/.htaccess`)는:
   - 모든 요청을 `index.html`로 리다이렉트
   - SPA(Single Page Application) 라우팅을 위해 필요

2. **API 폴더의 `.htaccess`** (`public_html/tts/api/.htaccess`)는:
   - `api/` 폴더 안의 요청은 React 앱으로 리다이렉트하지 않음
   - PHP 파일을 직접 실행

3. **우선순위**:
   - 하위 폴더의 `.htaccess`가 상위 폴더보다 우선
   - `api/.htaccess`가 있으면 그 안의 요청은 React 앱으로 가지 않음

---

## 📝 체크리스트

- [ ] `public_html/tts/api/.htaccess` 파일 생성
- [ ] 파일 내용: `RewriteEngine Off` 또는 위의 상세 설정
- [ ] 파일 권한: 644
- [ ] `hello.php` 테스트 파일 생성 및 테스트
- [ ] `test.php` 접근 테스트
- [ ] 브라우저에서 JSON 응답 확인

---

**이 작업을 완료하면 API 엔드포인트가 정상 작동합니다!** 🚀

