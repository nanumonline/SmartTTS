<?php
/**
 * 오디오 파일 확인
 * 저장된 오디오 파일의 정보를 확인합니다
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
    $size = filesize($filePath);
    
    // 파일 내용 일부 확인 (16진수)
    $handle = fopen($filePath, 'rb');
    $header = '';
    if ($handle) {
        $headerBytes = fread($handle, 16);
        fclose($handle);
        
        // 16진수로 변환
        $hex = '';
        for ($i = 0; $i < strlen($headerBytes) && $i < 16; $i++) {
            $hex .= sprintf('%02X ', ord($headerBytes[$i]));
        }
        $header = trim($hex);
    }
    
    // MP3 파일 시그니처 확인 (ID3 또는 MP3 프레임)
    $isValidMP3 = false;
    if ($size > 0) {
        $handle = fopen($filePath, 'rb');
        if ($handle) {
            $firstBytes = fread($handle, 3);
            fclose($handle);
            
            // ID3 태그 확인 (ID3)
            if (substr($firstBytes, 0, 3) === 'ID3') {
                $isValidMP3 = true;
            }
            // MP3 프레임 시그니처 확인 (0xFF 0xFB 또는 0xFF 0xF3)
            elseif (ord($firstBytes[0]) === 0xFF && (ord($firstBytes[1]) & 0xE0) === 0xE0) {
                $isValidMP3 = true;
            }
        }
    }
    
    $audioInfo[] = [
        'filename' => $file,
        'size' => $size,
        'size_kb' => round($size / 1024, 2),
        'modified' => date('Y-m-d H:i:s', filemtime($filePath)),
        'header_hex' => $header,
        'is_valid_mp3' => $isValidMP3,
        'status' => $size < 100 ? 'TOO_SMALL' : ($isValidMP3 ? 'VALID' : 'INVALID')
    ];
}

echo json_encode([
    'success' => true,
    'audio_files' => $audioInfo,
    'count' => count($audioInfo),
    'timestamp' => date('Y-m-d H:i:s')
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
?>

