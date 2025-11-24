<?php
/**
 * 오디오 파일 진단 스크립트
 * 저장된 오디오 파일이 올바른 형식인지 확인
 * 
 * 사용법:
 * GET https://nanum.online/tts/api/broadcast/check-file.php?file=테스트_방송_2025-11-24_15-50-20.mp3
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$filename = $_GET['file'] ?? null;
if (!$filename) {
    http_response_code(400);
    echo json_encode(['error' => 'file parameter is required']);
    exit();
}

$filename = basename($filename);
$audioDir = __DIR__ . '/audio';
$metadataDir = __DIR__ . '/metadata';
$audioFile = $audioDir . '/' . $filename;
$metadataFile = $metadataDir . '/' . $filename . '.json';

if (!file_exists($audioFile)) {
    http_response_code(404);
    echo json_encode(['error' => 'File not found', 'file' => $filename]);
    exit();
}

$fileSize = filesize($audioFile);
$fileContent = file_get_contents($audioFile);

$result = [
    'filename' => $filename,
    'file_size' => $fileSize,
    'is_json_array' => false,
    'first_bytes_hex' => bin2hex(substr($fileContent, 0, 20)),
    'first_bytes_ascii' => substr($fileContent, 0, 20),
    'is_valid_mp3' => false,
    'is_valid_wav' => false,
    'metadata_exists' => file_exists($metadataFile),
    'metadata' => null
];

// JSON 배열 문자열인지 확인
if (strlen($fileContent) > 0 && $fileContent[0] === '[') {
    $result['is_json_array'] = true;
    $result['json_array_length'] = null;
    
    try {
        $parsedArray = json_decode($fileContent, true);
        if (is_array($parsedArray)) {
            $result['json_array_length'] = count($parsedArray);
            $result['json_array_first_10'] = array_slice($parsedArray, 0, 10);
        }
    } catch (Exception $e) {
        $result['json_decode_error'] = $e->getMessage();
    }
}

// MP3 시그니처 확인
$firstBytes = substr($fileContent, 0, 3);
if (strlen($firstBytes) >= 3) {
    if ($firstBytes === 'ID3') {
        $result['is_valid_mp3'] = true;
        $result['mp3_type'] = 'ID3 tag';
    } elseif (ord($firstBytes[0]) === 0xFF && (ord($firstBytes[1]) & 0xE0) === 0xE0) {
        $result['is_valid_mp3'] = true;
        $result['mp3_type'] = 'Frame sync';
    }
}

// WAV 시그니처 확인
if (strlen($fileContent) >= 12) {
    $riffHeader = substr($fileContent, 0, 4);
    $waveHeader = substr($fileContent, 8, 4);
    if ($riffHeader === 'RIFF' && $waveHeader === 'WAVE') {
        $result['is_valid_wav'] = true;
    }
}

// 메타데이터 읽기
if (file_exists($metadataFile)) {
    $metadataContent = file_get_contents($metadataFile);
    if ($metadataContent !== false) {
        $metadata = json_decode($metadataContent, true);
        if (is_array($metadata)) {
            $result['metadata'] = $metadata;
        }
    }
}

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
exit();
?>

