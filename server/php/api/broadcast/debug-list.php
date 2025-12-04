<?php
/**
 * 디버깅용: 오디오 목록 조회 (상세 정보 포함)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$audioDir = __DIR__ . '/audio';

if (!is_dir($audioDir)) {
    echo json_encode(['error' => 'Audio directory not found']);
    exit();
}

$files = scandir($audioDir);
$files = array_filter($files, function($file) {
    return preg_match('/\.(mp3|wav|ogg)$/i', $file);
});

$audioInfo = [];
foreach ($files as $file) {
    $filePath = $audioDir . '/' . $file;
    
    // 파일명에서 스케줄 이름 추출 시도
    $scheduleName = null;
    $displayName = $file;
    $extractionMethod = 'none';
    
    // 정규식 패턴 매칭
    if (preg_match('/^(.+?)_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})\.(mp3|wav|ogg)$/i', $file, $matches)) {
        $potentialScheduleName = $matches[1];
        $extractionMethod = 'regex_match';
        
        // "broadcast"가 아닌 경우에만 스케줄 이름으로 사용
        if (strtolower($potentialScheduleName) !== 'broadcast') {
            // 한글, 영문, 숫자, 언더스코어, 하이픈만 허용
            if (preg_match('/^[a-zA-Z0-9가-힣_\-]+$/u', $potentialScheduleName)) {
                $scheduleName = $potentialScheduleName;
                $displayName = $scheduleName;
                $extractionMethod = 'extracted';
            } else {
                $extractionMethod = 'invalid_chars';
            }
        } else {
            $extractionMethod = 'is_broadcast';
        }
    } else {
        $extractionMethod = 'no_match';
    }
    
    // 파일 크기 및 첫 바이트 확인
    $size = filesize($filePath);
    $firstBytes = '';
    $isJsonArray = false;
    
    if ($size > 0) {
        $handle = fopen($filePath, 'rb');
        if ($handle) {
            $header = fread($handle, 3);
            fclose($handle);
            
            $hex = '';
            for ($i = 0; $i < min(3, strlen($header)); $i++) {
                $hex .= sprintf('%02X ', ord($header[$i]));
            }
            $firstBytes = trim($hex);
            
            // JSON 배열 문자열인지 확인
            if (strlen($header) > 0 && $header[0] === '[') {
                $isJsonArray = true;
            }
        }
    }
    
    $audioInfo[] = [
        'filename' => $file,
        'schedule_name' => $scheduleName,
        'display_name' => $displayName,
        'extraction_method' => $extractionMethod,
        'potential_schedule_name' => $matches[1] ?? null,
        'is_json_array' => $isJsonArray,
        'first_bytes_hex' => $firstBytes,
        'size' => $size,
        'size_kb' => round($size / 1024, 2),
        'modified' => date('Y-m-d H:i:s', filemtime($filePath)),
        'modified_timestamp' => filemtime($filePath),
    ];
}

// 수정 시간순으로 정렬 (최신이 위에)
usort($audioInfo, function($a, $b) {
    return $b['modified_timestamp'] - $a['modified_timestamp'];
});

echo json_encode([
    'success' => true,
    'audio_files' => $audioInfo,
    'count' => count($audioInfo),
    'timestamp' => date('Y-m-d H:i:s'),
    'debug_info' => [
        'audio_dir' => $audioDir,
        'files_found' => count($files),
        'extraction_pattern' => '/^(.+?)_(\\d{4}-\\d{2}-\\d{2}_\\d{2}-\\d{2}-\\d{2})\\.(mp3|wav|ogg)$/i'
    ]
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
?>

