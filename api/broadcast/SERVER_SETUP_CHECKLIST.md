# 🚨 서버 설정 확인 체크리스트

## 현재 문제

`curl https://tts.nanum.online/api/broadcast/test` 실행 시:
- ❌ API 응답이 아닌 HTML 페이지(프론트엔드 앱)가 반환됨
- ❌ 404 에러 발생

**원인**: API 파일이 Hostinger 서버에 업로드되지 않았거나, 서버가 해당 경로를 처리하지 못함

---

## ✅ 1단계: 파일 업로드 확인

### Hostinger File Manager에서 확인

1. **Hostinger 대시보드 로그인**
   - https://www.hostinger.com 접속

2. **File Manager 열기**

3. **폴더 구조 확인**
   ```
   public_html/
   └── tts/                          ← tts.nanum.online의 루트
       └── api/
           └── broadcast/            ← 여기에 파일이 있어야 함
               ├── index.php         ← 필수
               ├── test.php          ← 필수
               └── .htaccess         ← 필수 (PHP 버전)
   ```

4. **파일이 없으면 업로드**
   - 로컬 `api/broadcast/` 폴더의 파일들을:
     - `index.php`
     - `test.php`
     - `.htaccess`
   - `public_html/tts/api/broadcast/` 폴더에 업로드

---

## ✅ 2단계: 서버 경로 확인

### 정확한 업로드 경로

**❌ 잘못된 경로:**
```
public_html/api/broadcast/           ← 메인 도메인 경로 (틀림)
```

**✅ 올바른 경로:**
```
public_html/tts/api/broadcast/       ← 서브도메인 경로 (맞음)
```

**이유**: `tts.nanum.online`은 서브도메인이므로 `public_html/tts/`가 루트입니다.

---

## ✅ 3단계: PHP 버전 사용 (권장)

### 파일 준비

다음 3개 파일을 `public_html/tts/api/broadcast/`에 업로드:

1. **`index.php`** - 메인 API 파일
2. **`test.php`** - 테스트 파일
3. **`.htaccess`** - Apache 설정

### 파일 권한 확인

- 파일 권한: **644**
- 폴더 권한: **755**

### 테스트

터미널에서:
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

---

## ✅ 4단계: .htaccess 설정 확인

### .htaccess 파일 내용 확인

`public_html/tts/api/broadcast/.htaccess` 파일이 있어야 하고, 다음 내용이 포함되어야 합니다:

```apache
# CORS 설정
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "POST, OPTIONS, GET"
    Header set Access-Control-Allow-Headers "Content-Type, Content-Length, Authorization, X-API-Key"
    Header set Access-Control-Max-Age "3600"
</IfModule>

# POST 요청 허용
<Limit POST OPTIONS GET>
    Require all granted
</Limit>

# 파일 업로드 크기 제한 (50MB)
<IfModule mod_php.c>
    php_value upload_max_filesize 50M
    php_value post_max_size 50M
    php_value max_execution_time 300
    php_value max_input_time 300
</IfModule>

# 디렉토리 인덱싱 비활성화
Options -Indexes
```

---

## ✅ 5단계: 문제 해결

### 문제 1: HTML 페이지가 반환됨

**증상**: API 호출 시 React 앱 HTML이 반환됨

**원인**: 
- 파일이 업로드되지 않음
- 잘못된 경로에 업로드됨
- 서버가 PHP를 처리하지 못함

**해결**:
1. `public_html/tts/api/broadcast/` 폴더에 파일 업로드 확인
2. 파일 권한 확인 (644)
3. PHP 모듈이 활성화되어 있는지 확인 (Hostinger 기본 활성화)

### 문제 2: 404 에러

**증상**: `/api/broadcast/test` 접근 시 404

**원인**:
- 파일이 서버에 없음
- 파일 경로가 잘못됨
- `.htaccess` 설정 문제

**해결**:
1. 파일 업로드 확인
2. 경로 확인: `public_html/tts/api/broadcast/`
3. `.htaccess` 파일 확인

### 문제 3: PHP 파일이 실행되지 않음

**증상**: PHP 파일이 다운로드되거나 소스 코드가 표시됨

**원인**: PHP 모듈이 비활성화됨

**해결**:
- Hostinger에서 PHP 버전 확인
- 기본적으로 PHP는 활성화되어 있어야 함

---

## 🔍 디버깅 방법

### 1. 직접 파일 접근 테스트

브라우저에서:
```
https://tts.nanum.online/api/broadcast/test.php
```

**예상**: JSON 응답이 표시되어야 함

**실제**: HTML이 표시되면 → 파일이 없거나 경로가 잘못됨

### 2. 간단한 PHP 테스트 파일 생성

`public_html/tts/api/broadcast/hello.php` 파일 생성:
```php
<?php
echo "Hello, PHP is working!";
?>
```

브라우저에서 접근:
```
https://tts.nanum.online/api/broadcast/hello.php
```

**예상**: "Hello, PHP is working!" 텍스트 표시

**실제**: HTML이 표시되면 → PHP가 실행되지 않거나 파일이 없음

### 3. Hostinger 에러 로그 확인

1. Hostinger File Manager
2. `logs` 폴더 확인
3. 에러 로그 파일 확인

---

## 📝 최종 확인 사항

- [ ] `public_html/tts/api/broadcast/` 폴더 존재 확인
- [ ] `index.php` 파일 업로드 확인
- [ ] `test.php` 파일 업로드 확인
- [ ] `.htaccess` 파일 업로드 확인
- [ ] 파일 권한 644 확인
- [ ] 폴더 권한 755 확인
- [ ] `test.php` 직접 접근 테스트
- [ ] `curl` 명령어로 API 테스트
- [ ] PHP가 실행되는지 확인 (hello.php 테스트)

---

## 💡 빠른 해결 방법

### 방법 1: FTP로 직접 업로드

1. FTP 클라이언트 연결 (FileZilla 등)
2. `public_html/tts/api/broadcast/` 폴더로 이동
3. 로컬 `api/broadcast/` 폴더의 파일 업로드:
   - `index.php`
   - `test.php`
   - `.htaccess`

### 방법 2: Hostinger File Manager로 업로드

1. File Manager 열기
2. `public_html/tts/` 폴더로 이동
3. `api` 폴더 생성 (없으면)
4. `api/broadcast` 폴더 생성 (없으면)
5. 파일 업로드:
   - `index.php`
   - `test.php`
   - `.htaccess`

---

**파일을 업로드한 후 다시 테스트해보세요!** 🚀

