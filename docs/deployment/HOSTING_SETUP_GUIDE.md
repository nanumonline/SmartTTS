# 🎯 Hostinger 호스팅 방송 송출 엔드포인트 설정 가이드

## 📋 개요

이 가이드는 Hostinger 호스팅에서 `tts.nanum.online/api/broadcast` 엔드포인트를 설정하여 방송 송출을 받는 방법을 설명합니다.

---

## 🚀 1단계: Hostinger 대시보드에서 도메인 확인

### 1. Hostinger 로그인
1. https://www.hostinger.com 접속 후 로그인
2. 대시보드에서 도메인 `tts.nanum.online` 확인

### 2. 도메인 연결 확인
- 도메인이 Hostinger DNS로 연결되어 있는지 확인
- DNS 설정이 올바른지 확인

---

## 📁 2단계: 서버 구조 설정

### ⚠️ 중요: 서브도메인 구조 이해

`tts.nanum.online`은 `nanum.online`의 **서브도메인**입니다.
Hostinger에서 서브도메인은 일반적으로 별도의 폴더를 사용합니다:

- `tts.nanum.online` → `public_html/tts/` 폴더가 루트 디렉토리
- 따라서 `tts.nanum.online/api/broadcast`에 접근하려면 `public_html/tts/api/broadcast`에 파일을 업로드해야 합니다

### 📂 실제 서버 폴더 구조

Hostinger File Manager에서 다음 구조를 만듭니다:

```
public_html/
└── tts/                          ← tts.nanum.online의 루트
    └── api/
        └── broadcast/
            ├── index.php         ← 메인 API 파일
            ├── .htaccess         ← Apache 설정 (필요한 경우)
            └── test.php          ← 테스트 파일 (선택)
```

### 🔍 확인 방법

Hostinger File Manager에서:
1. `public_html` 폴더 확인
2. `tts` 폴더가 있는지 확인
3. 없다면 서브도메인 설정을 확인하거나 Hostinger에서 서브도메인을 생성

---

## 🔧 3단계: API 엔드포인트 구현

Hostinger는 여러 언어를 지원합니다. 원하는 언어를 선택하세요.

### 방법 1: PHP (가장 간단, Hostinger 기본 지원)

#### 파일 위치 (서버 실제 경로)
```
public_html/tts/api/broadcast/index.php
```

실제 URL로 접근:
```
https://tts.nanum.online/api/broadcast
```

#### 코드 작성

```php
<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Content-Length, Authorization, X-API-Key');

// CORS preflight 요청 처리
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// POST 요청만 허용
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

// 오디오 데이터 받기
$audioData = file_get_contents('php://input');
$contentType = $_SERVER['CONTENT_TYPE'] ?? 'audio/mpeg';
$contentLength = $_SERVER['CONTENT_LENGTH'] ?? strlen($audioData);

// 로그 기록 (선택사항)
$logDir = __DIR__ . '/logs';
if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
}

$logFile = $logDir . '/broadcast_' . date('Y-m-d') . '.log';
$logEntry = date('Y-m-d H:i:s') . " - Received audio: {$contentLength} bytes, Type: {$contentType}\n";
file_put_contents($logFile, $logEntry, FILE_APPEND);

// 오디오 파일 저장 (선택사항)
$audioDir = __DIR__ . '/audio';
if (!is_dir($audioDir)) {
    mkdir($audioDir, 0755, true);
}

$timestamp = date('Y-m-d_H-i-s');
$extension = 'mp3'; // MIME 타입에 따라 변경 가능
if (strpos($contentType, 'wav') !== false) {
    $extension = 'wav';
} elseif (strpos($contentType, 'mpeg') !== false || strpos($contentType, 'mp3') !== false) {
    $extension = 'mp3';
}

$audioFile = $audioDir . '/broadcast_' . $timestamp . '.' . $extension;
file_put_contents($audioFile, $audioData);

// 여기서 실제 방송 송출 로직을 구현합니다
// 예시:
// 1. 외부 방송 시스템 API 호출
// 2. 라디오 방송 장비로 전송
// 3. 스트리밍 서버로 푸시
// 등등...

// 응답 반환
http_response_code(200);
echo json_encode([
    'success' => true,
    'message' => 'Broadcast received successfully',
    'timestamp' => date('Y-m-d H:i:s'),
    'file_size' => $contentLength,
    'content_type' => $contentType,
    'saved_file' => basename($audioFile)
]);
?>
```

### 방법 2: Node.js (Express.js 사용)

#### 파일 위치
```
tts.nanum.online/api/broadcast/index.js
```

#### package.json 생성

```json
{
  "name": "broadcasting-api",
  "version": "1.0.0",
  "description": "TTS Broadcasting API Endpoint",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "multer": "^1.4.5-lts.1",
    "fs": "^0.0.1-security"
  }
}
```

#### 코드 작성 (index.js)

```javascript
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS 설정
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Content-Length, Authorization, X-API-Key');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 미들웨어: raw body 파싱
app.use('/api/broadcast', express.raw({ type: '*/*', limit: '50mb' }));

// 로그 디렉토리 생성
const logDir = path.join(__dirname, 'logs');
const audioDir = path.join(__dirname, 'audio');

[logDir, audioDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 로그 작성 함수
function writeLog(message) {
  const logFile = path.join(logDir, `broadcast_${new Date().toISOString().split('T')[0]}.log`);
  const logEntry = `${new Date().toISOString()} - ${message}\n`;
  fs.appendFileSync(logFile, logEntry);
}

// 방송 송출 엔드포인트
app.post('/api/broadcast', (req, res) => {
  try {
    const audioData = req.body;
    const contentType = req.get('Content-Type') || 'audio/mpeg';
    const contentLength = req.get('Content-Length') || audioData.length;

    writeLog(`Received audio: ${contentLength} bytes, Type: ${contentType}`);

    // 오디오 파일 저장
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    let extension = 'mp3';
    if (contentType.includes('wav')) extension = 'wav';
    else if (contentType.includes('mp3') || contentType.includes('mpeg')) extension = 'mp3';

    const audioFile = path.join(audioDir, `broadcast_${timestamp}.${extension}`);
    fs.writeFileSync(audioFile, audioData);

    writeLog(`Saved audio file: ${audioFile}`);

    // 여기서 실제 방송 송출 로직을 구현합니다
    // 예시: 외부 API 호출, 방송 장비 제어 등

    res.status(200).json({
      success: true,
      message: 'Broadcast received successfully',
      timestamp: new Date().toISOString(),
      file_size: contentLength,
      content_type: contentType,
      saved_file: path.basename(audioFile)
    });
  } catch (error) {
    writeLog(`Error: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 헬스 체크 엔드포인트
app.get('/api/broadcast/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Broadcasting API server is running on port ${PORT}`);
  writeLog('Server started');
});
```

### 방법 3: Python (Flask 사용)

#### 파일 위치
```
tts.nanum.online/api/broadcast/app.py
```

#### requirements.txt

```
Flask==2.3.3
flask-cors==4.0.0
```

#### 코드 작성 (app.py)

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from datetime import datetime
import logging

app = Flask(__name__)
CORS(app)

# 디렉토리 설정
LOG_DIR = os.path.join(os.path.dirname(__file__), 'logs')
AUDIO_DIR = os.path.join(os.path.dirname(__file__), 'audio')

for directory in [LOG_DIR, AUDIO_DIR]:
    os.makedirs(directory, exist_ok=True)

# 로깅 설정
logging.basicConfig(
    filename=os.path.join(LOG_DIR, f'broadcast_{datetime.now().strftime("%Y-%m-%d")}.log'),
    level=logging.INFO,
    format='%(asctime)s - %(message)s'
)

@app.route('/api/broadcast', methods=['POST', 'OPTIONS'])
def broadcasting():
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        # 오디오 데이터 받기
        audio_data = request.data
        content_type = request.headers.get('Content-Type', 'audio/mpeg')
        content_length = request.headers.get('Content-Length', str(len(audio_data)))
        
        logging.info(f"Received audio: {content_length} bytes, Type: {content_type}")
        
        # 파일 확장자 결정
        extension = 'mp3'
        if 'wav' in content_type:
            extension = 'wav'
        elif 'mp3' in content_type or 'mpeg' in content_type:
            extension = 'mp3'
        
        # 오디오 파일 저장
        timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        audio_file = os.path.join(AUDIO_DIR, f'broadcast_{timestamp}.{extension}')
        
        with open(audio_file, 'wb') as f:
            f.write(audio_data)
        
        logging.info(f"Saved audio file: {os.path.basename(audio_file)}")
        
        # 여기서 실제 방송 송출 로직을 구현합니다
        # 예시: 외부 API 호출, 방송 장비 제어 등
        
        return jsonify({
            'success': True,
            'message': 'Broadcast received successfully',
            'timestamp': datetime.now().isoformat(),
            'file_size': content_length,
            'content_type': content_type,
            'saved_file': os.path.basename(audio_file)
        }), 200
        
    except Exception as e:
        logging.error(f"Error: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/broadcast/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'timestamp': datetime.now().isoformat()
    }), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
```

---

## ⚙️ 4단계: 서버 설정

### Hostinger에서 파일 업로드

#### 방법 A: File Manager 사용 (서브도메인)

**⚠️ 중요: `tts.nanum.online` 서브도메인인 경우 `public_html/tts` 폴더에 업로드합니다!**

1. Hostinger 대시보드 → **File Manager** 클릭
2. `public_html` 폴더로 이동
3. `tts` 폴더 확인
   - **있으면**: `tts` 폴더로 이동
   - **없으면**: 
     - Hostinger → **도메인** → **서브도메인** 메뉴에서 서브도메인 설정 확인
     - 또는 `tts` 폴더를 직접 생성 (서브도메인이 자동으로 연결됨)
4. `tts` 폴더 안에서:
   - `api` 폴더 생성 (없는 경우)
   - `api/broadcast` 폴더 생성
5. 위에서 작성한 파일들을 `api/broadcast` 폴더에 업로드

**최종 경로 구조:**
```
public_html/
└── tts/                    ← 여기가 tts.nanum.online의 루트
    └── api/
        └── broadcast/      ← 여기에 파일 업로드
            ├── index.php
            ├── .htaccess
            └── test.php
```

#### 방법 B: FTP 사용 (서브도메인)

```bash
# FTP 연결 정보 (Hostinger에서 제공)
# 호스트: ftp.hostinger.com
# 사용자: your_username
# 비밀번호: your_password

# 연결 후
cd public_html
cd tts                    # tts 서브도메인 폴더로 이동
mkdir -p api/broadcast    # api/broadcast 폴더 생성
cd api/broadcast          # 해당 폴더로 이동
# 파일 업로드 (index.php, .htaccess, test.php)
```

### .htaccess 설정 (Apache인 경우)

**서버 실제 경로:** `public_html/tts/api/broadcast/.htaccess`  
**URL:** `https://tts.nanum.online/api/broadcast`

`.htaccess` 파일 생성:

```apache
# CORS 설정
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "POST, OPTIONS"
    Header set Access-Control-Allow-Headers "Content-Type, Content-Length, Authorization, X-API-Key"
</IfModule>

# POST 요청 허용
<Limit POST>
    Require all granted
</Limit>

# 파일 업로드 크기 제한 (50MB)
php_value upload_max_filesize 50M
php_value post_max_size 50M

# 디렉토리 인덱싱 비활성화
Options -Indexes
```

---

## 🧪 5단계: 테스트 방법

### 방법 1: cURL로 테스트

```bash
# 간단한 테스트
curl -X POST https://tts.nanum.online/api/broadcast \
  -H "Content-Type: audio/mpeg" \
  -d "test audio data"

# 실제 오디오 파일로 테스트
curl -X POST https://tts.nanum.online/api/broadcast \
  -H "Content-Type: audio/mpeg" \
  -H "Content-Length: $(wc -c < audio.mp3)" \
  --data-binary @audio.mp3
```

### 방법 2: 브라우저에서 테스트 (JavaScript)

```javascript
// 브라우저 콘솔에서 실행
async function testBroadcasting() {
  // 테스트용 더미 오디오 데이터 (실제로는 오디오 파일을 읽어야 함)
  const audioBlob = new Blob(['test audio data'], { type: 'audio/mpeg' });
  const arrayBuffer = await audioBlob.arrayBuffer();
  
  try {
    const response = await fetch('https://tts.nanum.online/api/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': arrayBuffer.byteLength.toString()
      },
      body: arrayBuffer
    });
    
    const result = await response.json();
    console.log('Response:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

testBroadcasting();
```

### 방법 3: Postman 사용

1. Postman 열기
2. 새 요청 생성:
   - Method: **POST**
   - URL: `https://tts.nanum.online/api/broadcast`
   - Headers:
     - `Content-Type`: `audio/mpeg`
   - Body:
     - `binary` 선택
     - 오디오 파일 선택
3. **Send** 클릭

### 방법 4: 웹 인터페이스에서 테스트

1. **전송 설정** 페이지에서 채널 생성
2. 엔드포인트 URL 입력: `https://tts.nanum.online/api/broadcast`
3. 저장
4. **스케줄 관리**에서 테스트 스케줄 생성
5. 실행 확인

---

## ✅ 6단계: 확인 방법

### 1. 헬스 체크

```bash
# 웹 브라우저에서 접속
https://tts.nanum.online/api/broadcast/health

# 또는 cURL
curl https://tts.nanum.online/api/broadcast/health
```

**예상 응답:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-20T10:30:00Z"
}
```

### 2. 로그 확인

서버에 업로드한 로그 파일 확인:
```
tts.nanum.online/api/broadcast/logs/broadcast_2025-11-20.log
```

### 3. 저장된 오디오 파일 확인

서버에 업로드한 오디오 파일 확인:
```
tts.nanum.online/api/broadcast/audio/broadcast_2025-11-20_10-30-00.mp3
```

### 4. Supabase 로그 확인

1. Supabase 대시보드 접속
2. **Logs** → **Edge Functions** 메뉴
3. `execute-schedules` 함수 로그 확인
4. "Successfully sent to https://tts.nanum.online/api/broadcast" 메시지 확인

---

## 🔐 7단계: 보안 강화 (선택사항)

### 1. API 키 인증 추가

#### PHP 예시

```php
<?php
// API 키 검증
$apiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
$validApiKey = 'your-secret-api-key-here'; // 환경 변수나 설정 파일에서 가져오기

if ($apiKey !== $validApiKey) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit();
}

// 나머지 코드...
?>
```

#### Node.js 예시

```javascript
const validApiKey = process.env.API_KEY || 'your-secret-api-key-here';

app.use('/api/broadcast', (req, res, next) => {
  const apiKey = req.get('X-API-Key');
  
  if (apiKey !== validApiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
});
```

### 2. Rate Limiting 추가 (과도한 요청 방지)

#### PHP 예시

```php
<?php
session_start();

$requestCount = $_SESSION['request_count'] ?? 0;
$lastRequestTime = $_SESSION['last_request_time'] ?? 0;
$currentTime = time();

// 1분에 10회 제한
if ($currentTime - $lastRequestTime < 60) {
    if ($requestCount >= 10) {
        http_response_code(429);
        echo json_encode(['error' => 'Too many requests']);
        exit();
    }
    $_SESSION['request_count'] = $requestCount + 1;
} else {
    $_SESSION['request_count'] = 1;
    $_SESSION['last_request_time'] = $currentTime;
}
?>
```

### 3. HTTPS 강제 (SSL 인증서 설정)

Hostinger에서 SSL 인증서 활성화:
1. Hostinger 대시보드 → **SSL** 메뉴
2. `tts.nanum.online` 도메인 선택
3. SSL 인증서 활성화 (Let's Encrypt 무료 제공)

---

## 🚨 8단계: 문제 해결

### 문제 1: 404 에러

**원인**: 경로가 올바르지 않음

**해결**:
1. 파일 경로 확인: `public_html/tts/api/broadcast/index.php` (서브도메인인 경우)
   - 일반 도메인이면: `public_html/api/broadcast/index.php`
   - 서브도메인이면: `public_html/tts/api/broadcast/index.php`
2. `.htaccess` 파일 확인 (Apache인 경우)
3. Hostinger 지원팀에 문의 (서버 설정 확인)

### 문제 2: 405 Method Not Allowed

**원인**: POST 요청이 허용되지 않음

**해결**:
1. `.htaccess`에서 POST 허용 확인
2. Hostinger 설정에서 POST 메서드 허용 확인

### 문제 3: 413 Payload Too Large

**원인**: 파일 크기 제한

**해결**:
1. `.htaccess`에서 `upload_max_filesize`, `post_max_size` 증가
2. `php.ini` 수정 (가능한 경우)
3. Hostinger 지원팀에 문의

### 문제 4: CORS 에러

**원인**: CORS 헤더가 설정되지 않음

**해결**:
1. 서버 코드에서 CORS 헤더 추가 확인
2. `.htaccess`에서 CORS 헤더 설정 확인

### 문제 5: 오디오 데이터를 받을 수 없음

**원인**: Body 파싱 설정 오류

**해결**:
- PHP: `file_get_contents('php://input')` 사용 확인
- Node.js: `express.raw()` 미들웨어 사용 확인
- Python: `request.data` 사용 확인

---

## 📝 9단계: 실제 방송 송출 구현

위 코드는 오디오 데이터를 받아서 저장만 합니다. 실제 방송 송출을 위해서는 다음 중 하나를 구현해야 합니다:

### 예시 1: 외부 API 호출

```php
<?php
// 예시: 외부 방송 시스템 API 호출
$broadcastUrl = 'https://your-broadcast-system.com/api/play';
$ch = curl_init($broadcastUrl);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $audioData);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: ' . $contentType,
    'Authorization: Bearer YOUR_API_TOKEN'
]);
$response = curl_exec($ch);
curl_close($ch);
?>
```

### 예시 2: 로컬 장비 제어

```php
<?php
// 예시: 로컬 방송 장비에 명령 전송
exec("ffmpeg -i {$audioFile} -f alsa default", $output);
?>
```

### 예시 3: 스트리밍 서버 푸시

```php
<?php
// 예시: Icecast/Shoutcast 스트리밍 서버로 푸시
$streamUrl = 'icecast://your-server:8000/stream';
// 스트리밍 로직 구현
?>
```

---

## ✅ 체크리스트

설정 완료 확인:

- [ ] Hostinger에서 도메인 연결 확인
- [ ] `api/broadcast` 폴더 생성
- [ ] 서버 코드 업로드 (PHP/Node.js/Python 중 선택)
- [ ] `.htaccess` 설정 (Apache인 경우)
- [ ] SSL 인증서 활성화 (HTTPS)
- [ ] 헬스 체크 테스트 성공
- [ ] cURL로 POST 요청 테스트 성공
- [ ] 스케줄 관리에서 엔드포인트 설정
- [ ] 실제 스케줄 실행 테스트
- [ ] 로그 및 파일 저장 확인
- [ ] (선택) API 키 인증 설정
- [ ] (선택) Rate Limiting 설정

---

## 🔗 참고 자료

- [Hostinger 도움말](https://www.hostinger.com/tutorials)
- [Hostinger File Manager 가이드](https://www.hostinger.com/tutorials/file-manager)
- [Hostinger SSL 설정 가이드](https://www.hostinger.com/tutorials/ssl)

---

## 💡 추가 팁

1. **테스트용 간단한 PHP 파일 생성** (테스트용):

```php
<?php
// test.php
header('Content-Type: application/json');
echo json_encode([
    'status' => 'ok',
    'message' => 'API endpoint is working',
    'timestamp' => date('Y-m-d H:i:s')
]);
?>
```

2. **실시간 로그 확인**:
   - Hostinger File Manager에서 로그 파일 확인
   - 또는 SSH 접속 가능한 경우 `tail -f logs/broadcast_*.log`

3. **모니터링 설정**:
   - 정기적으로 로그 확인
   - 오류 발생 시 알림 설정 (이메일 등)

---

**설정이 완료되면 스케줄 관리에서 엔드포인트 URL을 입력하고 테스트해보세요!** 🎉

