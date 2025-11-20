# 🔍 오디오 재생 오류 디버깅 가이드

## 🚨 현재 문제

### 오류 메시지

```
MediaError {code: 4, message: ''}
Network state: 3 (NETWORK_NO_SOURCE)
Ready state: 0 (HAVE_NOTHING)
NotSupportedError: The element has no supported sources.
```

### 가능한 원인

1. **`audio.php`가 JSON 배열 문자열을 변환하지 못함**
   - 파일이 여전히 JSON 배열 문자열로 저장됨
   - 변환 로직이 작동하지 않음

2. **변환된 데이터가 올바르지 않음**
   - JSON 파싱 실패
   - 바이너리 변환 오류

3. **파일 전송 오류**
   - 헤더 설정 문제
   - 데이터 전송 중단

---

## 🔧 디버깅 방법

### 1. 브라우저 개발자 도구 확인

**Network 탭:**
1. `audio.php?file=...` 요청 확인
2. Response Headers 확인:
   - `Content-Type: audio/mpeg`
   - `Content-Length: ...`
3. Response Preview 확인:
   - 바이너리 데이터인지 확인
   - JSON 배열 문자열이 아닌지 확인

**Console 탭:**
- `Audio file first bytes (hex):` 로그 확인
- `5b 37 33...` (JSON 배열) vs `49 44 33` (ID3) 또는 `ff fb` (MPEG)

### 2. 직접 파일 확인

**`check-audio.php` 실행:**
```
https://nanum.online/tts/api/broadcast/check-audio.php
```

**확인 사항:**
- `header_hex`: JSON 배열 문자열인지 확인
- `is_valid_mp3`: `true`인지 확인
- `status`: `VALID`인지 확인

### 3. `audio.php` 로그 확인

**Hostinger 서버 로그 확인:**
- PHP 에러 로그
- `error_log` 메시지 확인:
  - `[audio.php] Converting JSON array string to binary: ...`
  - `[audio.php] Converted JSON array to binary: ... bytes`

---

## ✅ 해결 방법

### 방법 1: 파일 재생성 (권장)

**가장 확실한 방법:**
1. 기존 파일 삭제
2. 새 스케줄 생성
3. `execute-schedules` 함수가 올바른 바이너리 데이터 전송
4. `index.php`가 JSON 배열 문자열을 바이너리로 변환
5. 유효한 MP3 파일 생성

### 방법 2: `audio.php` 변환 확인

**확인 사항:**
1. `audio.php`가 최신 버전인지 확인
2. JSON 배열 문자열 감지 로직 확인
3. 변환 로직 확인

**테스트:**
```php
// audio.php에 디버깅 코드 추가
error_log("[audio.php] File: {$filename}, First byte: " . ord($firstBytes[0]));
error_log("[audio.php] Is JSON array: " . ($isJsonArray ? 'yes' : 'no'));
```

### 방법 3: 수동 변환 스크립트

**변환 스크립트 생성:**
```php
<?php
// convert-json-files.php
$audioDir = __DIR__ . '/audio';
$files = scandir($audioDir);

foreach ($files as $file) {
    if (preg_match('/\.(mp3|wav)$/i', $file)) {
        $filePath = $audioDir . '/' . $file;
        $content = file_get_contents($filePath);
        
        if (substr($content, 0, 1) === '[') {
            // JSON 배열 문자열인 경우 변환
            $parsedArray = json_decode($content, true);
            if (is_array($parsedArray)) {
                $binaryData = '';
                foreach ($parsedArray as $byte) {
                    $binaryData .= chr($byte);
                }
                file_put_contents($filePath, $binaryData);
                echo "Converted: {$file}\n";
            }
        }
    }
}
?>
```

---

## 📋 확인 체크리스트

### 1. 파일 상태 확인

- [ ] `check-audio.php`로 파일 확인
- [ ] `header_hex`가 JSON 배열이 아닌지 확인
- [ ] `is_valid_mp3: true`인지 확인

### 2. `audio.php` 확인

- [ ] 최신 버전 업로드 확인
- [ ] JSON 배열 변환 로직 확인
- [ ] PHP 에러 로그 확인

### 3. 브라우저 확인

- [ ] Network 탭에서 Response 확인
- [ ] Console 탭에서 로그 확인
- [ ] 첫 바이트가 JSON 배열이 아닌지 확인

---

## 🚀 다음 단계

1. **브라우저 개발자 도구에서 확인**
   - Network 탭에서 `audio.php` 응답 확인
   - Response Preview에서 바이너리 데이터 확인

2. **`check-audio.php` 실행**
   - 파일 상태 확인
   - JSON 배열 문자열인지 확인

3. **필요시 파일 재생성**
   - 기존 파일 삭제
   - 새 스케줄 생성

---

**디버깅 정보를 확인하고 결과를 알려주세요!** 🔍

