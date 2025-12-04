# 🔧 JSON 파싱 오류 및 오디오 재생 오류 수정

## 🚨 발견된 오류

### 1. JSON 파싱 오류
```
SyntaxError: Unexpected end of JSON input
```

**원인:**
- 서버 응답이 비어있거나 불완전한 JSON
- PHP 출력 버퍼링 문제
- JSON 인코딩 오류

**해결:**
- JSON 파싱 전에 응답 텍스트 확인
- PHP에서 JSON 인코딩 오류 확인
- 출력 후 명시적으로 `exit()` 호출

### 2. 오디오 재생 오류
```
Audio playback error
```

**원인:**
- 오디오 파일을 찾을 수 없음
- 네트워크 오류
- 파일 형식 문제
- CORS 문제

**해결:**
- 오디오 파일 존재 확인
- CORS 헤더 추가
- 오류 코드별 메시지 개선
- 파일 접근 확인

---

## ✅ 수정 사항

### 1. `list.php` 수정

#### JSON 응답 개선

**추가된 기능:**
- JSON 인코딩 오류 확인
- 명시적인 `exit()` 호출
- Content-Type 헤더 명시

**수정 내용:**
```php
// JSON 인코딩 및 출력
$jsonOutput = json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

// JSON 인코딩 오류 확인
if ($jsonOutput === false) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'JSON encoding error: ' . json_last_error_msg()
    ]);
    exit();
}

echo $jsonOutput;
exit();
```

#### 빈 디렉토리 처리 개선

**수정 내용:**
```php
if (!is_dir($audioDir)) {
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => true,
        'audio_list' => [],
        'message' => 'Audio directory not found',
        'count' => 0,
        'timestamp' => date('Y-m-d H:i:s')
    ], JSON_UNESCAPED_UNICODE);
    exit();
}
```

### 2. `audio.php` 수정

#### 오디오 파일 전송 개선

**추가된 기능:**
- CORS 헤더 추가
- 출력 버퍼링 비활성화
- 청크 단위로 파일 전송 (메모리 효율)
- 파일 읽기 오류 처리

**수정 내용:**
```php
// CORS 헤더 추가
header('Access-Control-Allow-Origin: *');

// 출력 버퍼링 비활성화 (대용량 파일을 위해)
if (ob_get_level()) {
    ob_end_clean();
}

// 파일 출력
$handle = fopen($audioFile, 'rb');
if ($handle === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to open audio file']);
    exit();
}

// 청크 단위로 출력 (메모리 효율)
while (!feof($handle)) {
    echo fread($handle, 8192); // 8KB 청크
    flush();
}

fclose($handle);
exit();
```

### 3. `player.html` 수정

#### JSON 파싱 개선

**추가된 기능:**
- 응답 텍스트 먼저 확인
- JSON 파싱 오류 처리
- 상세한 오류 메시지

**수정 내용:**
```javascript
// 응답 텍스트 먼저 확인
const responseText = await response.text();

if (!responseText || responseText.trim() === '') {
    throw new Error('Empty response from server');
}

// JSON 파싱
let data;
try {
    data = JSON.parse(responseText);
} catch (parseError) {
    console.error('JSON parse error:', parseError);
    console.error('Response text:', responseText.substring(0, 200));
    throw new Error('Invalid JSON response: ' + parseError.message);
}
```

#### 오디오 재생 오류 처리 개선

**추가된 기능:**
- 오류 코드별 상세 메시지
- 오디오 URL 확인 (HEAD 요청)

**수정 내용:**
```javascript
audioPlayer.onerror = (error) => {
    console.error('Audio playback error:', error);
    console.error('Audio URL:', audio.url);
    console.error('Audio element error:', audioPlayer.error);
    
    let errorMessage = '재생 오류: 오디오 파일을 확인할 수 없습니다';
    
    // 오디오 엘리먼트 오류 코드 확인
    if (audioPlayer.error) {
        switch (audioPlayer.error.code) {
            case MediaError.MEDIA_ERR_ABORTED:
                errorMessage = '재생 중단됨';
                break;
            case MediaError.MEDIA_ERR_NETWORK:
                errorMessage = '네트워크 오류: 오디오 파일을 다운로드할 수 없습니다';
                break;
            case MediaError.MEDIA_ERR_DECODE:
                errorMessage = '디코드 오류: 오디오 파일 형식을 인식할 수 없습니다';
                break;
            case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                errorMessage = '지원되지 않는 형식: 오디오 파일 형식을 지원하지 않습니다';
                break;
            default:
                errorMessage = '재생 오류: 알 수 없는 오류';
        }
    }
    
    updateStatus(errorMessage, 'disconnected');
    
    // 오디오 URL 직접 확인 (디버깅용)
    fetch(audio.url, { method: 'HEAD' })
        .then(response => {
            if (!response.ok) {
                console.error('Audio file not found:', response.status, response.statusText);
            }
        })
        .catch(err => {
            console.error('Failed to check audio URL:', err);
        });
};
```

---

## 🚀 사용 방법

### 1. 파일 업로드

수정된 파일을 Hostinger 서버에 업로드:

1. `list.php` - JSON 응답 개선
2. `audio.php` - 오디오 파일 전송 개선
3. `player.html` - JSON 파싱 및 오디오 재생 오류 처리 개선

### 2. 테스트

1. **오디오 목록 확인**
   ```
   https://nanum.online/tts/api/broadcast/list.php
   ```
   - JSON 응답 확인
   - 오디오 목록 확인

2. **오디오 파일 직접 확인**
   ```
   https://nanum.online/tts/api/broadcast/audio.php?file=broadcast_2025-11-20_02-13-01.mp3
   ```
   - 오디오 파일 다운로드 확인

3. **플레이어 페이지 확인**
   ```
   https://nanum.online/tts/api/broadcast/player.html
   ```
   - JSON 파싱 오류 해결 확인
   - 오디오 재생 확인

---

## ✅ 체크리스트

### 파일 업로드
- [ ] `list.php` 업로드 (JSON 응답 개선)
- [ ] `audio.php` 업로드 (오디오 파일 전송 개선)
- [ ] `player.html` 업로드 (JSON 파싱 및 오디오 재생 오류 처리 개선)

### 테스트
- [ ] `list.php` 직접 접속하여 JSON 응답 확인
- [ ] `audio.php` 직접 접속하여 오디오 파일 다운로드 확인
- [ ] 플레이어 페이지에서 JSON 파싱 오류 해결 확인
- [ ] 오디오 목록 표시 확인
- [ ] 오디오 재생 확인

---

## 💡 문제 해결

### JSON 파싱 오류가 계속 발생하면

1. **서버 응답 확인**
   - `list.php` 직접 접속하여 응답 확인
   - 브라우저 개발자 도구에서 Network 탭 확인

2. **PHP 오류 확인**
   - PHP 오류 로그 확인
   - 출력 버퍼링 문제 확인

3. **파일 권한 확인**
   - 파일 읽기 권한 확인
   - 디렉토리 접근 권한 확인

### 오디오 재생 오류가 계속 발생하면

1. **오디오 파일 확인**
   - `audio/` 폴더에 파일이 있는지 확인
   - 파일 이름이 올바른지 확인

2. **오디오 URL 확인**
   - `audio.php?file=파일명` 직접 접속하여 다운로드 확인
   - CORS 헤더 확인

3. **브라우저 콘솔 확인**
   - 오류 메시지 확인
   - 네트워크 탭에서 오디오 파일 요청 확인

---

**이제 수정된 파일을 업로드하고 테스트해보세요!** 🚀

