# 방송 송출 API 엔드포인트 설정 가이드

## 📁 파일 설명

### 1. `index.php`
- 메인 API 엔드포인트 파일
- POST 요청으로 오디오 데이터를 받아 처리
- 오디오 파일 저장 및 로그 기록

### 2. `.htaccess`
- Apache 서버 설정 파일
- CORS 설정, 파일 업로드 크기 제한 등

### 3. `test.php`
- API 엔드포인트 테스트 파일
- 서버 환경 및 권한 확인

---

## 🚀 Hostinger에 업로드 방법

### 1. 파일 준비
위의 3개 파일을 준비합니다:
- `index.php`
- `.htaccess`
- `test.php` (선택사항)

### 2. 디렉토리 구조
```
tts.nanum.online/
└── api/
    └── broadcasting/
        ├── index.php
        ├── .htaccess
        ├── test.php
        ├── logs/        (자동 생성됨)
        └── audio/       (자동 생성됨)
```

### 3. Hostinger File Manager로 업로드

1. Hostinger 대시보드 로그인
2. **File Manager** 클릭
3. `public_html` 폴더로 이동
4. `api` 폴더가 없으면 생성
5. `api/broadcasting` 폴더 생성
6. 파일 업로드:
   - `index.php`
   - `.htaccess`
   - `test.php` (선택)

### 4. 권한 설정 (필요한 경우)
- `logs` 폴더: 755 권한
- `audio` 폴더: 755 권한

---

## ✅ 테스트 방법

### 1단계: 기본 테스트

웹 브라우저에서 접속:
```
https://tts.nanum.online/api/broadcasting/test.php
```

**예상 결과:**
```json
{
    "status": "ok",
    "message": "All checks passed! API endpoint is ready to use.",
    ...
}
```

### 2단계: API 엔드포인트 테스트

터미널에서 실행:
```bash
curl -X POST https://tts.nanum.online/api/broadcasting \
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
curl -X POST https://tts.nanum.online/api/broadcasting \
  -H "Content-Type: audio/mpeg" \
  -H "Content-Length: $(wc -c < audio.mp3)" \
  --data-binary @audio.mp3
```

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
$broadcastApiUrl = 'https://your-broadcast-system.com/api/play';
$ch = curl_init($broadcastApiUrl);
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

## 📊 로그 확인

로그 파일 위치:
```
tts.nanum.online/api/broadcasting/logs/broadcast_YYYY-MM-DD.log
```

각 요청마다 다음 정보가 기록됩니다:
- 타임스탬프
- 받은 데이터 크기
- Content-Type
- 클라이언트 IP
- 저장된 파일명

---

## 🔐 보안 설정 (선택사항)

### API 키 인증 활성화

`index.php` 파일에서 다음 부분의 주석을 제거하고 API 키를 설정:

```php
// API 키 검증 (선택사항 - 필요시 활성화)
$apiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
$validApiKey = getenv('BROADCAST_API_KEY') ?: 'your-secret-api-key-here';

if (!empty($validApiKey) && $apiKey !== $validApiKey) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized: Invalid API key']);
    exit();
}
```

그리고 채널 설정에서 `config` 필드에 API 키를 추가:

```json
{
  "apiKey": "your-secret-api-key-here"
}
```

---

## ⚠️ 문제 해결

### 500 에러 발생
- PHP 에러 로그 확인: `logs/php_errors.log`
- 파일 권한 확인
- `.htaccess` 설정 확인

### 404 에러 발생
- 파일 경로 확인
- `.htaccess` 파일 존재 확인
- Hostinger에서 PHP 활성화 확인

### 오디오 파일이 저장되지 않음
- `audio` 폴더 권한 확인 (755 또는 777)
- 디스크 공간 확인
- PHP `upload_max_filesize`, `post_max_size` 확인

---

**설정 완료 후 스케줄 관리에서 엔드포인트 URL을 입력하고 테스트하세요!** 🎉

