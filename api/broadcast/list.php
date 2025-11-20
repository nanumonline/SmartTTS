<?php
/**
 * 오디오 파일 목록 조회
 * 태블릿 PC가 주기적으로 호출하여 재생할 오디오를 확인합니다
 * 
 * 사용법:
 * GET https://nanum.online/tts/api/broadcast/list.php?channel_id={CHANNEL_ID}
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
    echo json_encode(['error' => 'Method not allowed', 'method' => $_SERVER['REQUEST_METHOD']]);
    exit();
}

// 디렉토리 설정
$baseDir = __DIR__;
$audioDir = $baseDir . '/audio';

// 오디오 디렉토리 확인
if (!is_dir($audioDir)) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'audio_list' => [],
        'message' => 'Audio directory not found'
    ]);
    exit();
}

// 오디오 파일 목록 조회
$audioFiles = [];
$files = scandir($audioDir);
$files = array_filter($files, function($file) {
    return preg_match('/\.(mp3|wav|ogg)$/i', $file);
});

foreach ($files as $file) {
    $filePath = $audioDir . '/' . $file;
    $fileInfo = [
        'filename' => $file,
        'url' => 'https://nanum.online/tts/api/broadcast/audio.php?file=' . urlencode($file),
        'size' => filesize($filePath),
        'modified' => date('Y-m-d H:i:s', filemtime($filePath)),
        'modified_timestamp' => filemtime($filePath),
    ];
    $audioFiles[] = $fileInfo;
}

// 수정 시간순으로 정렬 (최신이 위에)
usort($audioFiles, function($a, $b) {
    return $b['modified_timestamp'] - $a['modified_timestamp'];
});

// 최신 파일만 반환 (선택사항)
$limit = isset($_GET['limit']) ? intval($_GET['limit']) : 10;
$audioFiles = array_slice($audioFiles, 0, $limit);

// JSON 응답 반환
http_response_code(200);
header('Content-Type: application/json; charset=utf-8');
$response = [
    'success' => true,
    'audio_list' => $audioFiles,
    'count' => count($audioFiles),
    'timestamp' => date('Y-m-d H:i:s')
];

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
?>

