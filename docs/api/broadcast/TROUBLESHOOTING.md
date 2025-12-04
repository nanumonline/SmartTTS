# 문제 해결 가이드

## 404 에러: `/api/broadcast/test.php` 접근 불가

### 원인

**Node.js 버전을 사용하는 경우:**
- Node.js Express 서버는 `.php` 파일을 직접 처리하지 않습니다
- `/api/broadcast/test.php` 경로는 PHP 파일로 인식되지만, Node.js 서버는 이를 라우트로 처리합니다

### 해결 방법

#### 방법 1: Node.js 버전 사용 시 (권장)

**.php 확장자 없이 접근:**
```
https://tts.nanum.online/api/broadcast/test
```

**또는:**
```
https://tts.nanum.online/api/broadcast/health
```

#### 방법 2: PHP 버전으로 전환

Node.js 대신 PHP 버전을 사용하려면:

1. `index.js` 프로세스 중지 (실행 중인 경우)
2. `index.php`, `.htaccess`, `test.php` 파일 업로드 확인
3. `.php` 파일로 접근:
   ```
   https://tts.nanum.online/api/broadcast/test.php
   ```

#### 방법 3: Node.js에서 `.php` 경로도 지원 (업데이트됨)

최신 `index.js`는 `/api/broadcast/test.php` 경로도 처리합니다.

### 확인 사항

1. **어떤 버전을 사용 중인가요?**
   - PHP: `index.php` 파일 사용
   - Node.js: `index.js` 파일 사용 (프로세스 실행 필요)

2. **파일이 서버에 업로드되었나요?**
   ```
   public_html/tts/api/broadcast/
   ├── index.php (또는 index.js)
   ├── test.php
   └── .htaccess (PHP 버전만)
   ```

3. **서버 환경 확인**
   
   **PHP 버전:**
   - Apache 서버인지 확인
   - PHP 모듈이 활성화되어 있는지 확인
   
   **Node.js 버전:**
   - Node.js 프로세스가 실행 중인지 확인
   - 포트가 올바르게 설정되어 있는지 확인

### 빠른 테스트

**터미널에서:**
```bash
# PHP 버전 테스트
curl https://tts.nanum.online/api/broadcast/test.php

# Node.js 버전 테스트
curl https://tts.nanum.online/api/broadcast/test
```

**예상 결과:**
```json
{
  "status": "ok",
  "message": "API endpoint is working",
  ...
}
```

### 추가 문제 해결

**여전히 404 에러가 발생하면:**

1. **파일 경로 확인**
   - Hostinger File Manager에서 파일 위치 확인
   - `public_html/tts/api/broadcast/` 폴더에 파일이 있는지 확인

2. **서버 설정 확인**
   - `.htaccess` 파일이 PHP 버전을 사용하는 경우 필요
   - Node.js 버전은 `.htaccess` 불필요

3. **권한 확인**
   - 파일 권한: 644
   - 폴더 권한: 755

4. **로그 확인**
   - PHP 에러 로그 확인
   - Node.js 콘솔 로그 확인

---

**도움이 필요하신가요?**
- PHP 버전: Hostinger 기본 지원, 설정 간단
- Node.js 버전: 추가 설정 필요, 더 유연함

