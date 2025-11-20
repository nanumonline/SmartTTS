<?php
/**
 * 방송 송출 API 테스트 파일
 * 
 * 사용법: 웹 브라우저에서 접속
 * https://tts.nanum.online/api/broadcast/test.php
 */

header('Content-Type: application/json; charset=utf-8');

$testResults = [
    'api_endpoint' => '/api/broadcast',
    'timestamp' => date('Y-m-d H:i:s'),
    'server_info' => [
        'php_version' => PHP_VERSION,
        'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
        'document_root' => $_SERVER['DOCUMENT_ROOT'] ?? 'Unknown',
        'script_filename' => __FILE__,
    ],
    'directory_check' => [],
    'permissions_check' => [],
    'test_results' => []
];

// 디렉토리 확인
$baseDir = __DIR__;
$logDir = $baseDir . '/logs';
$audioDir = $baseDir . '/audio';

$testResults['directory_check']['base_dir'] = [
    'path' => $baseDir,
    'exists' => is_dir($baseDir),
    'writable' => is_writable($baseDir)
];

$testResults['directory_check']['logs_dir'] = [
    'path' => $logDir,
    'exists' => is_dir($logDir),
    'writable' => is_dir($logDir) ? is_writable($logDir) : false
];

$testResults['directory_check']['audio_dir'] = [
    'path' => $audioDir,
    'exists' => is_dir($audioDir),
    'writable' => is_dir($audioDir) ? is_writable($audioDir) : false
];

// 권한 확인
$testResults['permissions_check']['can_write_logs'] = is_writable($logDir) || is_writable($baseDir);
$testResults['permissions_check']['can_write_audio'] = is_writable($audioDir) || is_writable($baseDir);

// PHP 함수 확인
$testResults['test_results']['file_get_contents'] = function_exists('file_get_contents');
$testResults['test_results']['file_put_contents'] = function_exists('file_put_contents');
$testResults['test_results']['mkdir'] = function_exists('mkdir');

// 전체 상태
$allTestsPassed = 
    $testResults['permissions_check']['can_write_logs'] &&
    $testResults['permissions_check']['can_write_audio'] &&
    $testResults['test_results']['file_get_contents'] &&
    $testResults['test_results']['file_put_contents'];

$testResults['status'] = $allTestsPassed ? 'ok' : 'warning';
$testResults['message'] = $allTestsPassed 
    ? 'All checks passed! API endpoint is ready to use.'
    : 'Some checks failed. Please review the results.';

echo json_encode($testResults, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
?>

