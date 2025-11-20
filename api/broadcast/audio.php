<?php
/**
 * 오디오 파일 다운로드
 * 태블릿 PC가 오디오를 다운로드하여 재생합니다
 * 
 * 사용법:
 * GET https://nanum.online/tts/api/broadcast/audio.php?file=broadcast_2025-11-20_02-13-01.mp3
 */

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

$filename = $_GET['file'] ?? null;
if (!$filename) {
    http_response_code(400);
    echo json_encode(['error' => 'file parameter is required']);
    exit();
}

// 보안: 파일명에 경로 문자 포함 방지
$filename = basename($filename);

// 오디오 디렉토리
$audioDir = __DIR__ . '/audio';
$audioFile = $audioDir . '/' . $filename;

// 파일 존재 확인
if (!file_exists($audioFile)) {
    http_response_code(404);
    echo json_encode(['error' => 'Audio file not found', 'file' => $filename]);
    exit();
}

// 파일 크기 확인
$fileSize = filesize($audioFile);
if ($fileSize < 100) {
    http_response_code(400);
    echo json_encode(['error' => 'Audio file too small', 'file' => $filename, 'size' => $fileSize]);
    exit();
}

// 파일 유효성 검사 (처음 몇 바이트 확인)
$handle = fopen($audioFile, 'rb');
if ($handle === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to open audio file']);
    exit();
}

$firstBytes = fread($handle, 3);
fclose($handle);

// JSON 배열 문자열인지 확인 (처음이 '['인 경우)
if (substr($firstBytes, 0, 1) === '[') {
    http_response_code(400);
    echo json_encode([
        'error' => 'Invalid audio file: JSON array string detected',
        'file' => $filename,
        'message' => 'File appears to be a JSON array string, not binary audio data'
    ]);
    exit();
}

// MP3 파일 시그니처 확인
$isValidMP3 = false;
if (substr($firstBytes, 0, 3) === 'ID3') {
    $isValidMP3 = true;
} elseif (ord($firstBytes[0]) === 0xFF && (ord($firstBytes[1]) & 0xE0) === 0xE0) {
    $isValidMP3 = true;
}

// MIME 타입 결정
$extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
$mimeType = 'audio/mpeg'; // 기본값

switch ($extension) {
    case 'mp3':
        $mimeType = 'audio/mpeg';
        break;
    case 'wav':
        $mimeType = 'audio/wav';
        break;
    case 'ogg':
        $mimeType = 'audio/ogg';
        break;
    case 'm4a':
        $mimeType = 'audio/mp4';
        break;
}

// 오디오 파일 전송
header('Content-Type: ' . $mimeType);
header('Content-Length: ' . filesize($audioFile));
header('Content-Disposition: inline; filename="' . basename($filename) . '"');
header('Accept-Ranges: bytes');
header('Cache-Control: public, max-age=3600');
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
$bytesSent = 0;
while (!feof($handle)) {
    $chunk = fread($handle, 8192); // 8KB 청크
    if ($chunk === false) {
        break;
    }
    echo $chunk;
    flush();
    $bytesSent += strlen($chunk);
}

fclose($handle);

// 실제 전송된 바이트 수 확인
if ($bytesSent !== $fileSize) {
    error_log("[audio.php] WARNING: File size mismatch. Expected: {$fileSize}, Sent: {$bytesSent}");
}

exit();
?>

