# 🔧 루트 .htaccess 파일 수정 필요

## 🚨 문제 원인

브라우저에서 `/api/broadcast/test.php`에 접근할 때:
- ❌ React 앱의 라우터가 먼저 처리
- ❌ 404 에러 발생
- ❌ PHP 파일이 실행되지 않음

**원인**: `public_html/tts/.htaccess` 파일이 모든 요청을 React 앱으로 리다이렉트하고 있음

---

## ✅ 해결 방법

### 방법 1: 루트 .htaccess 파일 수정 (권장)

`public_html/tts/.htaccess` 파일을 수정하여 `/api/*` 경로는 PHP로 직접 처리하도록 설정

#### 현재 .htaccess 파일 위치:
```
public_html/tts/.htaccess
```

#### 수정 내용:

기존 내용에 다음 규칙을 **맨 위에** 추가:

```apache
# API 경로는 React 앱으로 리다이렉트하지 않음
RewriteEngine On

# /api/* 경로는 PHP 파일로 직접 처리
RewriteCond %{REQUEST_URI} ^/api/
RewriteCond %{REQUEST_FILENAME} -f
RewriteRule ^ - [L]

# /api/*.php 파일은 직접 처리
RewriteCond %{REQUEST_URI} ^/api/.*\.php$
RewriteRule ^ - [L]

# 나머지는 기존 React 앱 리다이렉트 규칙
# (기존 내용)
```

### 방법 2: api 폴더에 별도 .htaccess 추가

`public_html/tts/api/.htaccess` 파일 생성하여 API 경로만 처리

#### 파일 위치:
```
public_html/tts/api/.htaccess
```

#### 파일 내용:

```apache
# API 경로는 React 앱으로 리다이렉트하지 않음
RewriteEngine On

# /api/* 경로는 직접 처리
RewriteCond %{REQUEST_FILENAME} -f
RewriteRule ^ - [L]

# PHP 파일은 직접 실행
RewriteCond %{REQUEST_URI} \.php$
RewriteRule ^ - [L]
```

---

## 📝 단계별 해결 방법

### 1단계: 루트 .htaccess 파일 확인

1. Hostinger File Manager 접속
2. `public_html/tts/` 폴더로 이동
3. `.htaccess` 파일 확인

### 2단계: .htaccess 파일 수정

**옵션 A: 루트 .htaccess 수정**

`.htaccess` 파일 열기 → **맨 위에** 다음 추가:

```apache
# API 경로 예외 처리 (맨 위에 추가)
<IfModule mod_rewrite.c>
RewriteEngine On

# /api/* 경로는 React 앱으로 리다이렉트하지 않음
RewriteCond %{REQUEST_URI} ^/api/
RewriteCond %{REQUEST_FILENAME} -f
RewriteRule ^ - [L]

# /api/*.php 파일은 직접 실행
RewriteCond %{REQUEST_URI} ^/api/.*\.php$
RewriteRule ^ - [L]
</IfModule>

# 기존 내용은 그대로 유지...
```

**옵션 B: api 폴더에 새 .htaccess 생성**

1. `public_html/tts/api/` 폴더로 이동
2. 새 파일 생성: `.htaccess`
3. 위의 "방법 2" 내용 복사

### 3단계: 테스트

브라우저에서:
```
https://tts.nanum.online/api/broadcast/test.php
```

터미널에서:
```bash
curl https://tts.nanum.online/api/broadcast/test.php
```

**예상 결과**: JSON 응답이 표시되어야 함

---

## 🔍 확인 방법

### 현재 .htaccess 파일 내용 확인

`public_html/tts/.htaccess` 파일을 열어서:

1. **API 경로 예외 처리가 있는지 확인**
   - `/api/*` 경로를 처리하는 규칙이 있는지
   
2. **React 앱 리다이렉트 규칙 확인**
   - 모든 요청을 `index.html`로 리다이렉트하는 규칙이 있는지

### 일반적인 React 앱 .htaccess 내용:

```apache
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /

# API 경로 예외 처리 (추가 필요!)
RewriteCond %{REQUEST_URI} ^/api/
RewriteCond %{REQUEST_FILENAME} -f
RewriteRule ^ - [L]

# 정적 파일은 그대로 제공
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d

# 나머지는 index.html로 리다이렉트 (React 앱)
RewriteRule . /index.html [L]
</IfModule>
```

---

## 💡 빠른 해결책

### 방법 1: api 폴더에 .htaccess 추가 (가장 간단)

1. Hostinger File Manager
2. `public_html/tts/api/` 폴더로 이동
3. 새 파일 생성: `.htaccess`
4. 다음 내용 붙여넣기:

```apache
# API 경로는 React 앱으로 리다이렉트하지 않음
RewriteEngine Off
```

**또는:**

```apache
# API 경로 직접 처리
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} -f
RewriteRule ^ - [L]
</IfModule>
```

이렇게 하면 `api/` 폴더 안의 모든 요청은 React 앱으로 리다이렉트되지 않고 직접 처리됩니다.

---

**이 방법을 시도해보시고 결과를 알려주세요!** 🚀

