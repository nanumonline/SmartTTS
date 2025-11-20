# 📱 태블릿 PC 방송 송출 시스템 구현 가이드

## 🎯 목표 시나리오

### 사용자 흐름

1. **관리자 (다른 PC)**
   - 웹 서비스 로그인
   - 스케줄 관리에서 음원 송출 시간 설정
   - 전송 채널 선택 (태블릿 PC 채널)

2. **시스템 (자동)**
   - Supabase Edge Function이 1분마다 실행
   - 설정된 시간에 오디오를 Hostinger 엔드포인트로 전송
   - 엔드포인트가 오디오를 저장하고 재생 대기 목록에 추가

3. **태블릿 PC (방송 장비에 연결)**
   - 재생 대기 오디오 확인 (주기적으로 폴링)
   - 새로운 오디오 발견 시 다운로드 및 재생
   - 오디오 재생 → 방송 장비로 출력 (RJ-45 또는 오디오 케이블)

---

## ✅ 구현 방법: HTTP 폴링 방식 (권장)

### 작동 원리

1. **서버**: 오디오를 저장하고 재생 대기 목록에 추가
2. **태블릿 PC**: 주기적으로 (10초마다) 서버에 요청하여 새로운 오디오 확인
3. **재생**: 새로운 오디오가 있으면 다운로드 및 재생

---

## 📋 구현 계획

### 1단계: 데이터베이스 스키마 확장

재생 대기 오디오 목록을 저장할 테이블 필요

#### 새 마이그레이션 파일 생성

`supabase/migrations/20251120000000_create_broadcast_queue.sql`

```sql
-- 방송 대기열 테이블
-- 태블릿 PC가 재생할 오디오 목록을 관리합니다

CREATE TABLE IF NOT EXISTS public.tts_broadcast_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL, -- 채널 ID
  schedule_id UUID, -- 스케줄 ID (선택사항)
  audio_file_path TEXT NOT NULL, -- 저장된 오디오 파일 경로
  audio_url TEXT NOT NULL, -- 오디오 다운로드 URL
  status VARCHAR(50) DEFAULT 'pending', -- pending, playing, completed, failed
  scheduled_time TIMESTAMPTZ NOT NULL, -- 스케줄된 시간
  played_at TIMESTAMPTZ, -- 재생 시작 시간
  completed_at TIMESTAMPTZ, -- 재생 완료 시간
  device_id TEXT, -- 재생한 디바이스 ID (선택사항)
  error_message TEXT, -- 오류 메시지 (실패 시)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_channel_id ON public.tts_broadcast_queue(channel_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_status ON public.tts_broadcast_queue(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_scheduled_time ON public.tts_broadcast_queue(scheduled_time);

-- RLS 정책
ALTER TABLE public.tts_broadcast_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view broadcast queue" ON public.tts_broadcast_queue
  FOR SELECT USING (true); -- 모든 사용자가 볼 수 있음 (태블릿 PC용)

CREATE POLICY "Users can update broadcast queue" ON public.tts_broadcast_queue
  FOR UPDATE USING (true); -- 모든 사용자가 업데이트 가능 (태블릿 PC용)
```

---

### 2단계: 서버 API 확장

Hostinger 서버에 추가 API 엔드포인트 생성

#### 2.1. 재생 대기 목록 API

`api/broadcast/pending.php`

```php
<?php
/**
 * 재생 대기 오디오 목록 조회
 * 태블릿 PC가 주기적으로 호출하여 재생할 오디오를 확인합니다
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key');

// OPTIONS 요청 처리
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// GET 요청만 허용
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

// 채널 ID 필수
$channelId = $_GET['channel_id'] ?? null;
if (!$channelId) {
    http_response_code(400);
    echo json_encode(['error' => 'channel_id is required']);
    exit();
}

// Supabase 클라이언트 설정
// 실제로는 Supabase PHP SDK를 사용하거나 직접 HTTP 요청

// 재생 대기 오디오 조회 (예시)
// 실제로는 Supabase에서 조회해야 함
$pendingAudio = [
    [
        'id' => 'example-id',
        'audio_url' => 'https://nanum.online/tts/api/broadcast/audio/broadcast_2025-11-20_02-13-01.mp3',
        'scheduled_time' => '2025-11-20T02:13:01Z',
        'status' => 'pending'
    ]
];

http_response_code(200);
echo json_encode([
    'success' => true,
    'pending_audio' => $pendingAudio
]);
?>
```

#### 2.2. 오디오 다운로드 API

`api/broadcast/audio.php`

```php
<?php
/**
 * 오디오 파일 다운로드
 * 태블릿 PC가 오디오를 다운로드하여 재생합니다
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');

// OPTIONS 요청 처리
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$fileId = $_GET['id'] ?? null;
if (!$fileId) {
    http_response_code(400);
    echo json_encode(['error' => 'id is required']);
    exit();
}

$audioDir = __DIR__ . '/audio';
$audioFile = $audioDir . '/' . basename($fileId);

if (!file_exists($audioFile)) {
    http_response_code(404);
    echo json_encode(['error' => 'Audio file not found']);
    exit();
}

// 오디오 파일 전송
header('Content-Type: audio/mpeg');
header('Content-Length: ' . filesize($audioFile));
header('Content-Disposition: inline; filename="' . basename($audioFile) . '"');
readfile($audioFile);
?>
```

#### 2.3. 재생 완료 신호 API

`api/broadcast/played.php`

```php
<?php
/**
 * 재생 완료 신호 수신
 * 태블릿 PC가 오디오 재생 완료 후 호출합니다
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');

// OPTIONS 요청 처리
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

$input = json_decode(file_get_contents('php://input'), true);
$queueId = $input['queue_id'] ?? null;
$deviceId = $input['device_id'] ?? null;

if (!$queueId) {
    http_response_code(400);
    echo json_encode(['error' => 'queue_id is required']);
    exit();
}

// Supabase에서 재생 완료 처리
// 실제로는 Supabase API를 호출하여 status를 'completed'로 업데이트

http_response_code(200);
echo json_encode([
    'success' => true,
    'message' => 'Playback completed'
]);
?>
```

---

### 3단계: 태블릿 PC용 플레이어 웹페이지

`api/broadcast/player.html`

```html
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>방송 플레이어 - 태블릿 PC</title>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: Arial, sans-serif;
            background: #000;
            color: #fff;
        }
        .status {
            text-align: center;
            padding: 20px;
        }
        .status.connected {
            color: #0f0;
        }
        .status.disconnected {
            color: #f00;
        }
        audio {
            width: 100%;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="status" id="status">연결 중...</div>
    <div id="currentAudio"></div>
    <audio id="audioPlayer" controls></audio>

    <script>
        const API_BASE = 'https://nanum.online/tts/api/broadcast';
        const CHANNEL_ID = 'YOUR_CHANNEL_ID'; // 채널 ID 설정 필요
        const POLL_INTERVAL = 10000; // 10초마다 확인

        let currentQueueId = null;
        let isPlaying = false;

        // 재생 대기 오디오 확인
        async function checkPendingAudio() {
            try {
                const response = await fetch(`${API_BASE}/pending.php?channel_id=${CHANNEL_ID}`);
                const data = await response.json();

                if (data.success && data.pending_audio && data.pending_audio.length > 0) {
                    const audio = data.pending_audio[0];
                    
                    // 이미 재생 중이 아니면 새 오디오 재생
                    if (!isPlaying && currentQueueId !== audio.id) {
                        currentQueueId = audio.id;
                        playAudio(audio);
                    }
                } else {
                    updateStatus('대기 중... (재생할 오디오 없음)', 'disconnected');
                }
            } catch (error) {
                console.error('Error checking pending audio:', error);
                updateStatus('연결 오류', 'disconnected');
            }
        }

        // 오디오 재생
        function playAudio(audio) {
            const audioPlayer = document.getElementById('audioPlayer');
            audioPlayer.src = audio.audio_url;
            
            updateStatus(`재생 중: ${new Date(audio.scheduled_time).toLocaleString('ko-KR')}`, 'connected');
            
            isPlaying = true;
            
            audioPlayer.onended = async () => {
                // 재생 완료 신호 전송
                await markAsPlayed(audio.id);
                isPlaying = false;
                currentQueueId = null;
                
                // 다음 오디오 확인
                setTimeout(checkPendingAudio, 1000);
            };

            audioPlayer.onerror = async () => {
                console.error('Audio playback error');
                await markAsFailed(audio.id);
                isPlaying = false;
                currentQueueId = null;
            };

            audioPlayer.play().catch(error => {
                console.error('Play error:', error);
                updateStatus('재생 오류', 'disconnected');
            });
        }

        // 재생 완료 신호 전송
        async function markAsPlayed(queueId) {
            try {
                await fetch(`${API_BASE}/played.php`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        queue_id: queueId,
                        device_id: getDeviceId()
                    })
                });
            } catch (error) {
                console.error('Error marking as played:', error);
            }
        }

        // 재생 실패 신호 전송
        async function markAsFailed(queueId) {
            try {
                await fetch(`${API_BASE}/failed.php`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        queue_id: queueId,
                        device_id: getDeviceId(),
                        error: 'Playback failed'
                    })
                });
            } catch (error) {
                console.error('Error marking as failed:', error);
            }
        }

        // 상태 업데이트
        function updateStatus(message, className) {
            const statusEl = document.getElementById('status');
            statusEl.textContent = message;
            statusEl.className = 'status ' + (className || '');
        }

        // 디바이스 ID 생성 (또는 저장된 값 사용)
        function getDeviceId() {
            let deviceId = localStorage.getItem('device_id');
            if (!deviceId) {
                deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('device_id', deviceId);
            }
            return deviceId;
        }

        // 주기적으로 확인
        setInterval(checkPendingAudio, POLL_INTERVAL);
        checkPendingAudio(); // 즉시 확인
    </script>
</body>
</html>
```

---

### 4단계: 엔드포인트 수정

`api/broadcast/index.php` 수정하여 재생 대기열에 추가

```php
// 오디오 저장 후
file_put_contents($audioFile, $audioData);

// ============================================
// 재생 대기열에 추가 (Supabase)
// ============================================
// 채널 ID는 요청 헤더나 쿼리 파라미터에서 가져와야 함
$channelId = $_SERVER['HTTP_X_CHANNEL_ID'] ?? $_GET['channel_id'] ?? null;

if ($channelId) {
    // Supabase API 호출하여 재생 대기열에 추가
    // 실제 구현 필요
}
```

---

## 💡 구현 전 확인 사항

### 1. 태블릿 PC 환경

- **OS**: Android, iOS, Windows, Chrome OS?
- **브라우저**: Chrome, Safari, Edge?
- **연결 방식**: RJ-45 (네트워크) 또는 오디오 케이블?

### 2. 방송 장비

- **장비 타입**: 라디오 방송 장비, PA 시스템?
- **연결 방식**: 네트워크 연결 또는 오디오 출력?
- **제어 방법**: 자동 재생 가능 또는 수동 제어 필요?

### 3. 네트워크 환경

- **태블릿 PC**: 인터넷 연결 필요
- **방송 장비**: 태블릿 PC와 네트워크 연결?

---

## 📝 구현 단계

### 단계 1: 데이터베이스 스키마 생성

1. 재생 대기열 테이블 생성 마이그레이션 파일 작성
2. Supabase에서 마이그레이션 실행

### 단계 2: 서버 API 확장

1. `pending.php` - 재생 대기 목록 조회
2. `audio.php` - 오디오 파일 다운로드
3. `played.php` - 재생 완료 신호
4. `index.php` 수정 - 재생 대기열에 추가

### 단계 3: 태블릿 PC 플레이어 생성

1. `player.html` 생성
2. 태블릿 PC에 배포 및 테스트

### 단계 4: 통합 테스트

1. 스케줄 생성
2. 자동 송출 확인
3. 태블릿 PC 재생 확인

---

**태블릿 PC 환경과 방송 장비 연결 방식을 알려주시면 더 구체적인 구현 방법을 제안하겠습니다!** 🚀

