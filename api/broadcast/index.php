<?php
/**
 * TTS 방송 송출 API 엔드포인트
 * 
 * 사용법:
 * POST https://tts.nanum.online/api/broadcast
 * 
 * Headers:
 * - Content-Type: audio/mpeg (또는 audio/wav 등)
 * - Content-Length: 파일 크기
 * - X-API-Key: (선택사항) API 키 인증
 * 
 * Body: 오디오 파일 바이너리 데이터
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Content-Length, Authorization, X-API-Key');

// CORS preflight 요청 처리
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// GET 요청 처리 (헬스 체크 또는 정보 확인)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    http_response_code(200);
    echo json_encode([
        'service' => 'TTS Broadcasting API',
        'version' => '1.0.0',
        'endpoints' => [
            'POST /api/broadcast/' => 'Broadcast audio',
            'GET /api/broadcast/list.php' => 'List audio files',
            'GET /api/broadcast/audio.php?file={filename}' => 'Download audio file',
            'GET /api/broadcast/player.html' => 'Tablet PC player'
        ],
        'timestamp' => date('Y-m-d H:i:s')
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit();
}

// POST 요청 처리
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed', 'method' => $_SERVER['REQUEST_METHOD']]);
    exit();
}

// API 키 검증 (선택사항 - 필요시 활성화)
/*
$apiKey = $_SERVER['HTTP_X_API_KEY'] ?? '';
$validApiKey = getenv('BROADCAST_API_KEY') ?: 'your-secret-api-key-here';

if (!empty($validApiKey) && $apiKey !== $validApiKey) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized: Invalid API key']);
    exit();
}
*/

// 오디오 데이터 받기 (바이너리 데이터)
$audioData = file_get_contents('php://input');
$contentType = $_SERVER['CONTENT_TYPE'] ?? 'audio/mpeg';
$contentLength = $_SERVER['CONTENT_LENGTH'] ?? strlen($audioData);

// 디버깅: 처음 몇 바이트 확인 (JSON 배열 문자열인지 확인)
if (strlen($audioData) > 0) {
    $firstBytes = substr($audioData, 0, min(20, strlen($audioData)));
    $isJsonArray = (substr($firstBytes, 0, 1) === '[');
    
    if ($isJsonArray) {
        // JSON 배열 문자열인 경우, 실제 바이너리 데이터로 변환
        error_log("[index.php] WARNING: Received JSON array string instead of binary data. Attempting to parse...");
        
        try {
            $parsedArray = json_decode($audioData, true);
            if (is_array($parsedArray)) {
                // JSON 배열을 바이너리 데이터로 변환
                $binaryData = '';
                foreach ($parsedArray as $byte) {
                    $binaryData .= chr($byte);
                }
                $audioData = $binaryData;
                $contentLength = strlen($audioData);
                error_log("[index.php] Converted JSON array to binary data: " . strlen($audioData) . " bytes");
            }
        } catch (Exception $e) {
            error_log("[index.php] Failed to parse JSON array: " . $e->getMessage());
        }
    }
}

// 디렉토리 설정 (먼저 설정하여 로그에 사용)
$baseDir = __DIR__;
$logDir = $baseDir . '/logs';
$audioDir = $baseDir . '/audio';

// 디렉토리 생성
foreach ([$logDir, $audioDir] as $dir) {
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
}

// 입력 데이터 검증
if (empty($audioData)) {
    http_response_code(400);
    echo json_encode(['error' => 'No audio data received']);
    exit();
}

// 오디오 데이터 크기 검증 (최소 100 bytes)
if (strlen($audioData) < 100) {
    $logFile = $logDir . '/broadcast_' . date('Y-m-d') . '.log';
    $warningMsg = sprintf(
        "[%s] WARNING: Received very small audio data: %d bytes. This may not be a valid audio file.\n",
        date('Y-m-d H:i:s'),
        strlen($audioData)
    );
    file_put_contents($logFile, $warningMsg, FILE_APPEND);
    
    // 작은 데이터는 저장하지 않고 경고만 기록
    http_response_code(200);
    echo json_encode([
        'success' => false,
        'warning' => 'Audio data too small (less than 100 bytes). File not saved.',
        'received_size' => strlen($audioData),
        'message' => 'Audio data may be incomplete or invalid'
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit();
}

// 로그 기록
$logFile = $logDir . '/broadcast_' . date('Y-m-d') . '.log';
$logEntry = sprintf(
    "[%s] Received broadcast: %d bytes, Type: %s, IP: %s\n",
    date('Y-m-d H:i:s'),
    $contentLength,
    $contentType,
    $_SERVER['REMOTE_ADDR'] ?? 'unknown'
);
file_put_contents($logFile, $logEntry, FILE_APPEND);

// 파일 확장자 결정
$extension = 'mp3';
if (stripos($contentType, 'wav') !== false) {
    $extension = 'wav';
} elseif (stripos($contentType, 'mpeg') !== false || stripos($contentType, 'mp3') !== false) {
    $extension = 'mp3';
} elseif (stripos($contentType, 'ogg') !== false) {
    $extension = 'ogg';
}

// 스케줄 이름 가져오기 (헤더에서)
$scheduleName = $_SERVER['HTTP_X_SCHEDULE_NAME'] ?? null;
$scheduleId = $_SERVER['HTTP_X_SCHEDULE_ID'] ?? null;

// 파일명 생성 (스케줄 이름이 있으면 포함)
$timestamp = date('Y-m-d_H-i-s');
if ($scheduleName && !empty(trim($scheduleName))) {
    // 스케줄 이름을 파일명에 안전하게 포함 (특수문자 제거)
    $safeScheduleName = preg_replace('/[^a-zA-Z0-9가-힣_\-]/u', '_', trim($scheduleName));
    $safeScheduleName = mb_substr($safeScheduleName, 0, 50); // 최대 50자
    $filename = $safeScheduleName . '_' . $timestamp . '.' . $extension;
} else {
    $filename = 'broadcast_' . $timestamp . '.' . $extension;
}

$audioFile = $audioDir . '/' . $filename;

if (file_put_contents($audioFile, $audioData) === false) {
    $errorMsg = 'Failed to save audio file';
    error_log($errorMsg);
    file_put_contents($logFile, date('Y-m-d H:i:s') . " - ERROR: {$errorMsg}\n", FILE_APPEND);
    http_response_code(500);
    echo json_encode(['error' => $errorMsg]);
    exit();
}

file_put_contents($logFile, date('Y-m-d H:i:s') . " - Saved: " . basename($audioFile) . "\n", FILE_APPEND);

// ============================================
// 여기서 실제 방송 송출 로직을 구현하세요
// ============================================

// 예시 1: 외부 API 호출
/*
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
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    file_put_contents($logFile, date('Y-m-d H:i:s') . " - ERROR: Broadcast API returned {$httpCode}\n", FILE_APPEND);
}
*/

// 예시 2: 로컬 방송 장비 제어
/*
// ffmpeg를 사용한 스트리밍 (예시)
$command = sprintf(
    'ffmpeg -i %s -f alsa default 2>&1',
    escapeshellarg($audioFile)
);
exec($command, $output, $returnCode);
*/

// 예시 3: 파일 시스템 경로로 복사
/*
$broadcastPath = '/path/to/broadcast/system/audio/';
if (is_dir($broadcastPath)) {
    copy($audioFile, $broadcastPath . basename($audioFile));
}
*/

// 성공 응답 반환
http_response_code(200);
echo json_encode([
    'success' => true,
    'message' => 'Broadcast received successfully',
    'timestamp' => date('Y-m-d H:i:s'),
    'file_size' => $contentLength,
    'content_type' => $contentType,
    'saved_file' => basename($audioFile),
    'server_time' => time()
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
?>

