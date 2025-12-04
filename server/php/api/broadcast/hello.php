<?php
/**
 * 간단한 PHP 테스트 파일
 * 이 파일로 PHP가 작동하는지 확인하세요
 */

header('Content-Type: text/plain; charset=utf-8');

echo "PHP is working!\n";
echo "Server Time: " . date('Y-m-d H:i:s') . "\n";
echo "PHP Version: " . PHP_VERSION . "\n";
echo "Document Root: " . ($_SERVER['DOCUMENT_ROOT'] ?? 'Unknown') . "\n";
echo "Script Path: " . __FILE__ . "\n";

