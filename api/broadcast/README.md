# 방송 송출 API 엔드포인트 설정 가이드

## 🎯 엔드포인트 URL

```
https://tts.nanum.online/api/broadcast
```

---

## 📁 파일 설명

### 1. `index.php` (PHP 버전)
- PHP 기반 메인 API 엔드포인트 파일
- POST 요청으로 오디오 데이터를 받아 처리
- 오디오 파일 저장 및 로그 기록
- Hostinger 기본 지원

### 2. `index.js` (Node.js 버전)
- Node.js/Express 기반 메인 API 엔드포인트 파일
- POST 요청으로 오디오 데이터를 받아 처리
- 오디오 파일 저장 및 로그 기록
- `package.json`과 함께 사용

### 3. `package.json` (Node.js용)
- Node.js 프로젝트 설정 파일
- Express 의존성 정의
- 실행 스크립트 정의

### 4. `.htaccess` (PHP용)
- Apache 서버 설정 파일
- CORS 설정, 파일 업로드 크기 제한 등
- PHP 버전 사용 시 필요

### 5. `test.php` (PHP 테스트용)
- API 엔드포인트 테스트 파일
- 서버 환경 및 권한 확인

---

## 🚀 Hostinger에 업로드 방법

### 언어 선택: PHP 또는 Node.js

#### 방법 A: PHP 버전 사용 (권장 - 가장 간단)

**파일 준비:**
- `index.php`
- `.htaccess`
- `test.php` (선택사항)

#### 방법 B: Node.js 버전 사용

**파일 준비:**
- `index.js`
- `package.json`
- Node.js 환경 필요 (Hostinger에서 Node.js 지원 확인 필요)

### 2. 디렉토리 구조

#### ⚠️ 중요: 서브도메인 구조

`tts.nanum.online`은 `nanum.online`의 **서브도메인**입니다.
Hostinger에서 서브도메인은 `public_html/tts/` 폴더를 루트로 사용합니다.

#### 📂 실제 서버 폴더 구조

```
public_html/
└── tts/                          ← tts.nanum.online의 루트 디렉토리
    └── api/
        └── broadcast/
            ├── index.php         ← PHP 버전 (메인 API 파일)
            ├── index.js          ← Node.js 버전 (메인 API 파일)
            ├── package.json      ← Node.js 버전용 의존성
            ├── .htaccess         ← Apache 설정 (PHP용)
            ├── test.php          ← 테스트 파일 (PHP용)
            ├── logs/             (자동 생성됨)
            └── audio/            (자동 생성됨)
```

#### 🌐 URL 매핑

- **서버 경로**: `public_html/tts/api/broadcast/index.php`
- **접근 URL**: `https://tts.nanum.online/api/broadcast`

### 3. Hostinger File Manager로 업로드

1. **Hostinger 대시보드 로그인**
   - https://www.hostinger.com 접속 후 로그인

2. **File Manager 클릭**

3. **서브도메인 폴더 확인 및 이동**
   - `public_html` 폴더로 이동
   - **`tts` 폴더 확인** (tts.nanum.online 서브도메인의 루트)
     - **있으면**: `tts` 폴더로 이동
     - **없으면**: 
       - Hostinger → **도메인** → **서브도메인** 메뉴 확인
       - 또는 `tts` 폴더 생성 (서브도메인이 자동 연결될 수 있음)

4. **디렉토리 생성** (`tts` 폴더 안에서)
   - `api` 폴더가 없으면 생성 (우클릭 → New Folder)
   - `api` 폴더 안에 `broadcast` 폴더 생성

5. **파일 업로드** (`tts/api/broadcast` 폴더로 이동)
   
   **PHP 버전 사용 시:**
   - `index.php`
   - `.htaccess`
   - `test.php` (선택)
   
   **Node.js 버전 사용 시:**
   - `index.js`
   - `package.json`
   - 터미널에서 `npm install` 실행 (Express 설치)

**⚠️ 주의**: 
- `public_html` 바로 아래가 아니라 `public_html/tts` 아래에 업로드해야 합니다!
- Node.js 버전을 사용하려면 Hostinger에서 Node.js 지원 여부를 확인하세요

### 4. 권한 설정 (필요한 경우)
- `logs` 폴더: 755 권한 (자동 생성됨)
- `audio` 폴더: 755 권한 (자동 생성됨)

---

## ✅ 테스트 방법

### 1단계: 기본 테스트

**PHP 버전:**
웹 브라우저에서 접속:
```
https://tts.nanum.online/api/broadcast/test.php
```

**Node.js 버전:**
웹 브라우저에서 접속:
```
https://tts.nanum.online/api/broadcast/test
```

**예상 결과:**
```json
{
    "status": "ok",
    "message": "API endpoint is working",
    "timestamp": "2025-11-20T10:30:00.000Z",
    ...
}
```

### 2단계: API 엔드포인트 테스트

터미널에서 실행:
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
    "timestamp": "2025-11-20 10:30:00",
    "file_size": 15,
    "content_type": "audio/mpeg",
    "saved_file": "broadcast_2025-11-20_10-30-00.mp3"
}
```

### 3단계: 실제 오디오 파일 테스트

```bash
curl -X POST https://tts.nanum.online/api/broadcast \
  -H "Content-Type: audio/mpeg" \
  -H "Content-Length: $(wc -c < audio.mp3)" \
  --data-binary @audio.mp3
```

---

## 📊 확인 방법

### 1. 헬스 체크

브라우저에서 접속:
```
https://tts.nanum.online/api/broadcast/test.php
```

### 2. 로그 확인

Hostinger File Manager에서:
```
tts.nanum.online/api/broadcast/logs/broadcast_2025-11-20.log
```

### 3. 저장된 오디오 파일 확인

```
tts.nanum.online/api/broadcast/audio/broadcast_2025-11-20_10-30-00.mp3
```

### 4. Supabase 로그 확인

1. Supabase 대시보드 접속
2. **Logs** → **Edge Functions** 메뉴
3. `execute-schedules` 함수 로그 확인
4. "Successfully sent to https://tts.nanum.online/api/broadcast" 메시지 확인

---

## 🔧 실제 방송 송출 구현

`index.php` 파일의 다음 부분을 수정하여 실제 방송 송출 로직을 구현하세요:

```php
// ============================================
// 여기서 실제 방송 송출 로직을 구현하세요
// ============================================
```

### 예시: 외부 API 호출

```php
$broadcastUrl = 'https://your-broadcast-system.com/api/play';
$ch = curl_init($broadcastUrl);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $audioData);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: ' . $contentType,
    'Authorization: Bearer YOUR_API_TOKEN'
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);
```

---

## ⚠️ 문제 해결

### 404 에러
- 파일 경로 확인: `public_html/api/broadcast/index.php`
- `.htaccess` 파일 존재 확인

### 500 에러
- PHP 에러 로그 확인: `logs/php_errors.log`
- 파일 권한 확인

### 오디오 파일 저장 실패
- `audio` 폴더 권한 확인 (755)
- PHP `upload_max_filesize`, `post_max_size` 확인

---

---

## 📝 언어별 사용 가이드

### PHP 버전 (권장)

**장점:**
- Hostinger 기본 지원
- 추가 설정 불필요
- `.htaccess`로 간단한 설정 가능

**사용 방법:**
1. `index.php`, `.htaccess`, `test.php` 파일 업로드
2. 파일 권한 설정 (755)
3. 바로 사용 가능

### Node.js 버전

**장점:**
- 더 유연한 로직 구현 가능
- Express.js 미들웨어 활용 가능
- 모던 JavaScript 사용

**사용 방법:**
1. `index.js`, `package.json` 파일 업로드
2. SSH 또는 터미널 접속 후:
   ```bash
   cd public_html/tts/api/broadcast
   npm install
   ```
3. Node.js 프로세스 관리자 (PM2 등)로 실행:
   ```bash
   pm2 start index.js --name broadcast-api
   ```
4. 또는 Hostinger의 Node.js 관리 도구 사용

**⚠️ 주의:**
- Hostinger에서 Node.js 지원 여부 확인 필요
- PHP 버전과 동시에 사용 불가 (같은 경로에서)
- 프로세스 관리 필요 (항상 실행 중이어야 함)

---

**설정 완료 후 전송 설정에서 엔드포인트 URL `https://tts.nanum.online/api/broadcast`를 입력하세요!** 🎉

