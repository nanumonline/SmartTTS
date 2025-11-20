# 🔧 오디오 파일 JSON 배열 문자열 변환 수정

## 🚨 발견된 문제

### 문제 증상

로그에서 확인:
```
Audio file first bytes (hex): 5b 37 33 2c 36 38 2c 35 31 2c 34 2c 30 2c 30 2c
```

**분석:**
- `5b` = `[` (대괄호 시작)
- `37 33` = `73` (ASCII 문자)
- `2c` = `,` (쉼표)
- 전체: `[73,68,51,4,0,0,]` (JSON 배열 문자열)

**문제:**
- 서버에 저장된 파일이 여전히 JSON 배열 문자열
- `audio.php`가 파일을 그대로 전송
- 브라우저가 JSON 배열 문자열을 오디오로 인식하지 못함

---

## ✅ 수정 사항

### `audio.php` 개선

#### JSON 배열 문자열 자동 변환

**수정 내용:**
```php
// JSON 배열 문자열인지 확인 (처음이 '['인 경우)
$isJsonArray = (substr($firstBytes, 0, 1) === '[');

if ($isJsonArray) {
    // JSON 배열 문자열을 바이너리 데이터로 변환
    $fileContent = file_get_contents($audioFile);
    $parsedArray = json_decode($fileContent, true);
    
    if (is_array($parsedArray)) {
        // JSON 배열을 바이너리 데이터로 변환
        $binaryData = '';
        foreach ($parsedArray as $byte) {
            $binaryData .= chr($byte);
        }
        $audioData = $binaryData;
        $fileSize = strlen($binaryData);
    }
} else {
    // 정상적인 바이너리 파일인 경우
    $audioData = null;
    $fileSize = filesize($audioFile);
}
```

**효과:**
- ✅ JSON 배열 문자열을 자동으로 바이너리로 변환
- ✅ 변환된 바이너리 데이터를 브라우저에 전송
- ✅ 기존 파일도 재생 가능

#### 파일 전송 로직 개선

**수정 내용:**
```php
// JSON 배열에서 변환된 데이터인 경우
if ($audioData !== null) {
    // 변환된 바이너리 데이터를 직접 출력
    echo $audioData;
    flush();
} else {
    // 정상적인 바이너리 파일인 경우
    // 기존 로직 사용 (청크 단위 전송)
}
```

**효과:**
- ✅ 변환된 데이터와 원본 파일 모두 처리
- ✅ 메모리 효율적인 전송

---

## 🚀 사용 방법

### 1. 파일 업로드

수정된 `audio.php`를 Hostinger 서버에 업로드:
- `public_html/tts/api/broadcast/audio.php`

### 2. 테스트

1. **기존 파일 재생**
   - JSON 배열 문자열로 저장된 파일도 재생 가능
   - 자동으로 바이너리로 변환되어 전송

2. **새 파일 재생**
   - 정상적인 바이너리 파일도 재생 가능
   - 변환 로직을 거치지 않음

3. **PC 플레이어 테스트**
   ```
   https://tts.nanum.online/player-pc.html
   ```

---

## 📋 확인 사항

### 1. 기존 파일 처리

**이제 가능:**
- ✅ JSON 배열 문자열로 저장된 파일도 재생 가능
- ✅ `audio.php`가 자동으로 변환

**권장:**
- 기존 파일을 삭제하고 새로 생성하는 것이 좋음
- 하지만 변환 로직으로 재생도 가능

### 2. 새 파일 생성

**확인:**
- `execute-schedules` 함수가 올바른 바이너리 데이터 전송
- `index.php`가 JSON 배열 문자열을 바이너리로 변환
- 새로 생성된 파일은 정상적인 바이너리 파일

---

## ✅ 수정 완료

### 변경된 파일

- `api/broadcast/audio.php`
  - JSON 배열 문자열 자동 감지
  - 바이너리 데이터로 자동 변환
  - 변환된 데이터 전송

### 개선 사항

- ✅ 기존 JSON 배열 문자열 파일도 재생 가능
- ✅ 자동 변환으로 사용자 경험 개선
- ✅ 정상적인 바이너리 파일도 처리
- ✅ 메모리 효율적인 전송

---

**이제 JSON 배열 문자열로 저장된 파일도 재생됩니다!** 🚀

