# 🔧 태블릿 PC 플레이어 오류 수정

## 🚨 발견된 오류

### 1. GET 요청 405 오류
```
GET https://nanum.online/tts/api/broadcast/ 405 (Method Not Allowed)
```

**원인:**
- `index.php`가 POST 요청만 허용
- 브라우저가 기본 경로(`/api/broadcast/`)로 GET 요청을 보냄

**해결:**
- `index.php`에 GET 요청 핸들러 추가
- GET 요청 시 API 정보 반환

### 2. 자동 재생 오류
```
NotAllowedError: play() failed because the user didn't interact with the document first
```

**원인:**
- 브라우저 자동 재생 정책
- 사용자 상호작용 없이는 오디오 자동 재생 불가

**해결:**
- 사용자 상호작용 감지 및 기록
- 상호작용 후 자동 재생 활성화
- 화면 터치/클릭 안내 메시지 표시

### 3. 오디오 소스 없음 오류
```
NotSupportedError: The element has no supported sources
```

**원인:**
- 오디오 URL이 유효하지 않음
- 오디오 파일이 없거나 로드 실패

**해결:**
- 오디오 URL 유효성 검사
- 오디오 로드 완료 후 재생 시도
- 에러 처리 개선

---

## ✅ 수정 사항

### 1. `index.php` 수정

**추가된 기능:**
- GET 요청 핸들러 추가
- API 정보 반환 (엔드포인트 목록 등)

**수정 내용:**
```php
// GET 요청 처리 (헬스 체크 또는 정보 확인)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    http_response_code(200);
    echo json_encode([
        'service' => 'TTS Broadcasting API',
        'version' => '1.0.0',
        'endpoints' => [...],
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    exit();
}
```

### 2. `player.html` 수정

#### 자동 재생 개선

**추가된 기능:**
- 사용자 상호작용 감지 (클릭, 터치, 키보드)
- 상호작용 상태 저장 (`localStorage`)
- 상호작용 후 자동 재생 활성화

**수정 내용:**
```javascript
// 사용자 상호작용 감지
const markUserInteraction = () => {
    localStorage.setItem('user_interacted', 'true');
    // 이미 오디오가 로드되어 있으면 재생 시도
    ...
};

// 이벤트 등록
document.addEventListener('click', markUserInteraction, { once: true });
document.addEventListener('touchstart', markUserInteraction, { once: true });
document.addEventListener('keydown', markUserInteraction, { once: true });
```

#### 오디오 재생 개선

**추가된 기능:**
- 오디오 정보 유효성 검사
- 오디오 로드 완료 후 재생 (`oncanplay`)
- 에러 처리 개선

**수정 내용:**
```javascript
// 유효한 오디오 URL 확인
if (!audio || !audio.url || !audio.filename) {
    console.error('Invalid audio data:', audio);
    updateStatus('오디오 정보 오류', 'disconnected');
    return;
}

// 오디오 로드 완료 후 재생
audioPlayer.oncanplay = () => {
    const hasUserInteraction = localStorage.getItem('user_interacted') === 'true';
    
    if (hasUserInteraction) {
        audioPlayer.play().then(() => {
            isPlaying = true;
            updateStatus(`재생 중: ${audio.filename}`, 'connected');
        });
    }
};
```

#### 오디오 목록 확인 개선

**추가된 기능:**
- HTTP 응답 상태 확인
- 데이터 유효성 검사
- 에러 메시지 개선

**수정 내용:**
```javascript
const response = await fetch(`${API_BASE}/list.php?limit=5`);

if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
}

const data = await response.json();

if (!data || !data.success) {
    throw new Error(data?.error || 'Invalid response');
}
```

---

## 🚀 사용 방법

### 1. 파일 업로드

수정된 파일을 Hostinger 서버에 업로드:

1. `index.php` - GET 요청 처리 추가
2. `player.html` - 자동 재생 개선

### 2. 태블릿 PC 설정

1. **플레이어 페이지 접속**
   ```
   https://nanum.online/tts/api/broadcast/player.html
   ```

2. **화면 터치/클릭**
   - "초기화 완료 - 화면을 한 번 터치하거나 클릭하세요" 메시지 표시
   - 화면을 한 번 터치하거나 클릭
   - "초기화 완료 - 자동 재생 활성화" 메시지 확인

3. **자동 재생 확인**
   - 새로운 오디오가 있으면 자동으로 재생
   - 재생 상태 표시 확인

---

## ✅ 체크리스트

### 파일 업로드
- [ ] `index.php` 업로드 (GET 요청 처리 추가)
- [ ] `player.html` 업로드 (자동 재생 개선)

### 테스트
- [ ] 플레이어 페이지 접속 확인
- [ ] GET 요청 405 오류 해결 확인
- [ ] 화면 터치/클릭 후 자동 재생 확인
- [ ] 오디오 목록 표시 확인
- [ ] 오디오 재생 확인

---

## 💡 주의사항

### 브라우저 자동 재생 정책

**대부분의 브라우저는 다음 정책을 적용합니다:**
- 사용자 상호작용 없이는 오디오 자동 재생 불가
- 한 번 상호작용하면 이후 자동 재생 가능

**해결 방법:**
- 플레이어 페이지를 열면 화면을 한 번 터치/클릭
- `localStorage`에 상호작용 상태 저장
- 이후 자동 재생 활성화

### 오디오 파일 확인

**오디오가 재생되지 않으면:**
1. 오디오 목록 확인: `https://nanum.online/tts/api/broadcast/list.php`
2. 오디오 파일 직접 접속: `https://nanum.online/tts/api/broadcast/audio.php?file=broadcast_xxx.mp3`
3. 브라우저 콘솔에서 오류 메시지 확인

---

**이제 수정된 파일을 업로드하고 테스트해보세요!** 🚀

