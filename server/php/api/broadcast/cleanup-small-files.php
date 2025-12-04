<?php
/**
 * 작은 오디오 파일 삭제
 * 100 bytes 미만의 오디오 파일을 삭제합니다
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

$deletedFiles = [];
$keptFiles = [];

foreach ($files as $file) {
    $filePath = $audioDir . '/' . $file;
    $size = filesize($filePath);
    
    if ($size < 100) {
        // 작은 파일 삭제
        if (unlink($filePath)) {
            $deletedFiles[] = [
                'filename' => $file,
                'size' => $size
            ];
        }
    } else {
        $keptFiles[] = [
            'filename' => $file,
            'size' => $size
        ];
    }
}

echo json_encode([
    'success' => true,
    'deleted_count' => count($deletedFiles),
    'kept_count' => count($keptFiles),
    'deleted_files' => $deletedFiles,
    'kept_files' => $keptFiles,
    'timestamp' => date('Y-m-d H:i:s')
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
?>

