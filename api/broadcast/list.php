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

function sanitize_channel_id($value) {
    if ($value === null) {
        return 'public';
    }
    $value = strtolower(trim((string)$value));
    if ($value === '') {
        return 'public';
    }
    $value = preg_replace('/[^a-z0-9_\-]/', '_', $value);
    return $value !== '' ? $value : 'public';
}

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

// 채널 ID 필수
$rawChannelId = $_GET['channel_id'] ?? null;
if ($rawChannelId === null) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'channel_id is required'
    ]);
    exit();
}
$channelId = sanitize_channel_id($rawChannelId);

// 디렉토리 설정
$baseDir = __DIR__;
$audioDir = $baseDir . '/audio';
$metadataDir = $baseDir . '/metadata';

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
    $metadataFile = $metadataDir . '/' . $file . '.json';
    $fileChannelId = 'public';
    $customerName = null;
    $categoryCode = null;
    $customerMemo = null;
    
    if (file_exists($metadataFile)) {
        $metadataContent = file_get_contents($metadataFile);
        if ($metadataContent !== false) {
            $metadata = json_decode($metadataContent, true);
            if (is_array($metadata)) {
                if (!empty($metadata['channel_id'])) {
                    $fileChannelId = sanitize_channel_id($metadata['channel_id']);
                } elseif (!empty($metadata['customer_id'])) {
                    $fileChannelId = sanitize_channel_id($metadata['customer_id']);
                }
                $customerName = $metadata['customer_name'] ?? null;
                $categoryCode = $metadata['category_code'] ?? null;
                $customerMemo = $metadata['memo'] ?? null;
            }
        }
    }
    
    if ($fileChannelId !== $channelId) {
        continue;
    }
    
    // 파일명에서 스케줄 이름 추출
    // 형식 1: "스케줄이름_2025-11-20_10-11-11.mp3" (새 형식)
    // 형식 2: "broadcast_2025-11-20_10-11-11.mp3" (기존 형식)
    // 형식 3: URL 인코딩된 파일명: "_EA_B5_90_..._2025-11-20_10-11-11.wav"
    $scheduleName = null;
    $displayName = $file;
    
    // 파일명에서 스케줄 이름 추출 시도 (정규식 개선)
    // 패턴: "문자열_YYYY-MM-DD_HH-MM-SS.확장자"
    if (preg_match('/^(.+?)_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})\.(mp3|wav|ogg)$/i', $file, $matches)) {
        $potentialScheduleName = $matches[1];
        
        // URL 인코딩된 파일명인지 확인 (퍼센트 인코딩 또는 언더스코어로 구분된 hex 패턴)
        // 예: "_EA_B5_90_EC_9C_A1..." 형식 (언더스코어로 구분된 hex 문자)
        $isUrlEncoded = false;
        $decodedName = $potentialScheduleName;
        
        // 언더스코어로 구분된 hex 문자 패턴 확인
        // 패턴: 언더스코어로 시작하고, hex 문자 두 자리 + 언더스코어가 반복되는 형태
        // 예: _EA_B5_90_EC_9C_A1... 또는 _EA_B5_90__EB_AF_B9... (이중 언더스코어 포함)
        // 모든 연속된 언더스코어를 단일 언더스코어로 치환한 후 패턴 확인
        $normalized = preg_replace('/_+/', '_', $potentialScheduleName);
        // 언더스코어로 시작하고, hex 문자(2자리)와 언더스코어가 반복되는 패턴 확인
        // 패턴을 더 관대하게 수정: 언더스코어로 시작하고 대부분이 hex 문자인 경우
        if (preg_match('/^_[0-9A-F]{2}(_[0-9A-F]{2})+_?$/i', $normalized) || 
            (preg_match('/^_[0-9A-F_]+$/i', $normalized) && substr_count($normalized, '_') >= 3)) {
            // 모든 언더스코어를 제거하여 hex 문자열 생성
            $hexString = preg_replace('/_+/', '', $potentialScheduleName);
            // hex 문자열이 비어있지 않은지 확인 (홀수 길이도 처리)
            if (strlen($hexString) > 0 && ctype_xdigit($hexString)) {
                // 홀수 길이인 경우 마지막 바이트 제거 (불완전한 바이트 처리)
                if (strlen($hexString) % 2 !== 0) {
                    $hexString = substr($hexString, 0, -1);
                }
                
                // hex 문자열을 바이트로 변환
                $bytes = '';
                for ($i = 0; $i < strlen($hexString); $i += 2) {
                    $hexByte = substr($hexString, $i, 2);
                    if (strlen($hexByte) === 2) {
                        $bytes .= chr(hexdec($hexByte));
                    }
                }
                // UTF-8 바이트 배열을 문자열로 디코딩
                if (!empty($bytes)) {
                    // UTF-8 디코딩 (깨진 문자 무시)
                    $decodedName = @mb_convert_encoding($bytes, 'UTF-8', 'UTF-8');
                    
                    // 디코딩 성공 여부 확인 (유효한 UTF-8 문자열이고 한글/영문 포함)
                    // 마지막 문자가 깨져도 중간에 한글이 있으면 디코딩 성공으로 간주
                    if ($decodedName !== false && 
                        mb_strlen($decodedName, 'UTF-8') > 0) {
                        // 한글 또는 영문/숫자가 포함되어 있으면 유효한 디코딩으로 간주
                        if (preg_match('/[\x{AC00}-\x{D7A3}]/u', $decodedName) || 
                            preg_match('/[a-zA-Z0-9]/', $decodedName)) {
                            $isUrlEncoded = true;
                            // 마지막 문자가 깨진 경우(물음표, 특수문자 등), 해당 문자 제거
                            $decodedName = preg_replace('/[?\x00-\x08\x0B-\x1F\x7F]$/u', '', $decodedName);
                            // 선행/후행 공백 제거
                            $decodedName = trim($decodedName);
                        } else {
                            // 디코딩 실패 시 원본 사용
                            $decodedName = $potentialScheduleName;
                        }
                    } else {
                        // 디코딩 실패 시 원본 사용
                        $decodedName = $potentialScheduleName;
                    }
                }
            }
        } elseif (strpos($potentialScheduleName, '%') !== false) {
            // 퍼센트 인코딩된 경우 (예: %EA%B5%90...)
            $decodedName = urldecode($potentialScheduleName);
            if ($decodedName !== $potentialScheduleName && mb_check_encoding($decodedName, 'UTF-8')) {
                $isUrlEncoded = true;
            } else {
                $decodedName = $potentialScheduleName;
            }
        }
        
        // "broadcast"가 아닌 경우에만 스케줄 이름으로 사용
        if (strtolower($potentialScheduleName) !== 'broadcast' && 
            strtolower($decodedName) !== 'broadcast') {
            
            // URL 인코딩이 해제되었거나 원래 한글/영문이 포함된 경우
            if ($isUrlEncoded && $decodedName !== $potentialScheduleName) {
                // 디코딩된 이름이 유효한지 확인
                if (mb_strlen($decodedName, 'UTF-8') > 0 && mb_check_encoding($decodedName, 'UTF-8')) {
                    // 유효한 UTF-8 문자열이면 사용 (한글, 영문, 숫자, 공백 등 포함 가능)
                    $scheduleName = $decodedName;
                    $displayName = $decodedName;
                } else {
                    // 디코딩 실패 시 원본 사용
                    $displayName = $file;
                }
            } else {
                // 원본이 이미 올바른 형식인 경우 (한글 포함 가능)
                // broadcast가 아니고, 일반 한글/영문/숫자로 시작하는 경우
                if (strtolower($potentialScheduleName) !== 'broadcast' && 
                    (preg_match('/^[가-힣]/u', $potentialScheduleName) || 
                     preg_match('/^[a-zA-Z0-9]/', $potentialScheduleName))) {
                    $scheduleName = $potentialScheduleName;
                    $displayName = $potentialScheduleName;
                }
            }
        }
    }
    
    $fileInfo = [
        'filename' => $file,
        'schedule_name' => $scheduleName, // 스케줄 이름 (있으면)
        'display_name' => $displayName, // 표시 이름 (스케줄 이름 또는 파일명)
        'url' => 'https://nanum.online/tts/api/broadcast/audio.php?file=' . urlencode($file) . '&channel_id=' . urlencode($fileChannelId),
        'size' => filesize($filePath),
        'modified' => date('Y-m-d H:i:s', filemtime($filePath)),
        'modified_timestamp' => filemtime($filePath),
        'channel_id' => $fileChannelId,
        'customer_name' => $customerName,
        'category_code' => $categoryCode,
        'customer_memo' => $customerMemo,
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
    'channel_id' => $channelId,
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
