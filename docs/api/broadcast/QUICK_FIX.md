# 🚨 빠른 해결 방법

## 현재 문제

- 브라우저: 404 에러 (React 앱 라우터가 가로챔)
- 터미널: "not found" (서버에서 파일을 찾을 수 없음)

## ✅ 해결 단계

### 1단계: 파일 존재 확인

Hostinger File Manager에서 확인:
```
public_html/tts/api/broadcast/
├── index.php      ← 있어야 함
├── test.php       ← 있어야 함
└── .htaccess      ← 있어야 함
```

**파일이 없으면 다시 업로드하세요!**

### 2단계: api 폴더에 .htaccess 추가 (중요!)

`public_html/tts/api/` 폴더에 `.htaccess` 파일을 만들어야 합니다.

**파일 위치:**
```
public_html/tts/api/.htaccess
```

**파일 내용:**
```apache
# API 경로는 React 앱으로 리다이렉트하지 않음
RewriteEngine Off
```

**또는 더 상세한 설정:**
```apache
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} -f
RewriteRule ^ - [L]
</IfModule>
```

### 3단계: 루트 .htaccess 확인

`public_html/tts/.htaccess` 파일을 확인하고, 다음 규칙이 **맨 위에** 있는지 확인:

```apache
# API 경로 예외 처리 (맨 위에!)
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
```

---

## 🔍 디버깅

### 테스트 1: 직접 파일 접근

브라우저에서:
```
https://tts.nanum.online/api/broadcast/test.php
```

**결과가 HTML이면**: `.htaccess` 설정 문제
**결과가 404면**: 파일이 없거나 경로 문제

### 테스트 2: 간단한 PHP 파일 생성

`public_html/tts/api/broadcast/hello.php` 파일 생성:
```php
<?php
echo "Hello, PHP is working!";
?>
```

브라우저에서:
```
https://tts.nanum.online/api/broadcast/hello.php
```

**"Hello, PHP is working!"이 표시되면**: PHP는 작동하지만 `test.php` 파일 문제
**HTML이 표시되면**: `.htaccess` 설정 문제

---

## 💡 가장 간단한 해결책

### 방법: api 폴더에 .htaccess 추가

1. Hostinger File Manager
2. `public_html/tts/api/` 폴더로 이동
3. 새 파일 생성: `.htaccess`
4. 내용:
```apache
RewriteEngine Off
```

이렇게 하면 `api/` 폴더 안의 모든 요청은 React 앱으로 리다이렉트되지 않고 직접 처리됩니다.

---

**이 방법을 시도해보시고 결과를 알려주세요!**

