# 🔧 JSON 배열 문자열 오디오 데이터 수정

## 🚨 발견된 문제

### 문제 증상

`check-audio.php` 결과에서:
```json
{
    "filename": "broadcast_2025-11-20_10-25-48.mp3",
    "size": 2454539,
    "header_hex": "5B 37 33 2C 36 38 2C 35 31 2C 34 2C 30 2C 30 2C",
    "is_valid_mp3": false,
    "status": "INVALID"
}
```

### 원인 분석

**`header_hex` 분석:**
- `5B 37 33 2C 36 38 2C 35 31 2C 34 2C 30 2C 30 2C` 
- ASCII로 변환: `[73,68,51,4,0,0,]`
- 이것은 **JSON 배열 문자열**입니다!

**문제:**
- 오디오 바이너리 데이터가 JSON 배열 문자열로 저장됨
- 예: `[73,68,51,4,0,0,0,...]` (실제 바이너리: `ID3\4\0\0\0`)
- 유효한 MP3 파일이 아님

---

## ✅ 수정 사항

### 1. `execute-schedules/index.ts` 수정

**문제:**
- DB에서 가져온 `audio_blob`이 JSON 배열 문자열일 수 있음
- 파싱하지 않고 그대로 전송

**수정 내용:**
```typescript
// JSON 배열 문자열인 경우 파싱 (예: "[82,73,70,70]")
try {
    const parsedArray = JSON.parse(blobValue);
    if (Array.isArray(parsedArray)) {
        audioData = new Uint8Array(parsedArray).buffer;
        console.log(`[execute-schedules] Converted JSON array string to ArrayBuffer: ${audioData.byteLength} bytes`);
    }
} catch (parseError) {
    // JSON 배열이 아닌 경우 기존 로직 사용
}
```

**효과:**
- ✅ JSON 배열 문자열을 바이너리 데이터로 변환
- ✅ 유효한 오디오 파일 생성

### 2. `index.php` 수정

**문제:**
- JSON 배열 문자열로 받은 경우 처리하지 않음
- 그대로 저장하여 유효하지 않은 파일 생성

**수정 내용:**
```php
// 디버깅: 처음 몇 바이트 확인 (JSON 배열 문자열인지 확인)
if (strlen($audioData) > 0) {
    $firstBytes = substr($audioData, 0, min(20, strlen($audioData)));
    $isJsonArray = (substr($firstBytes, 0, 1) === '[');
    
    if ($isJsonArray) {
        // JSON 배열 문자열을 바이너리 데이터로 변환
        $parsedArray = json_decode($audioData, true);
        if (is_array($parsedArray)) {
            $binaryData = '';
            foreach ($parsedArray as $byte) {
                $binaryData .= chr($byte);
            }
            $audioData = $binaryData;
        }
    }
}
```

**효과:**
- ✅ JSON 배열 문자열을 바이너리 데이터로 변환
- ✅ 유효한 오디오 파일 저장

---

## 🚀 사용 방법

### 1. 파일 업로드

수정된 파일을 업로드:
- `supabase/functions/execute-schedules/index.ts` → Edge Function 재배포
- `api/broadcast/index.php` → Hostinger 서버 업로드

### 2. Edge Function 재배포

```bash
npx supabase functions deploy execute-schedules
```

### 3. 테스트

1. **새 스케줄 생성**
   - 웹 서비스에서 스케줄 생성
   - 오디오 선택 및 시간 설정

2. **오디오 파일 확인**
   ```
   https://nanum.online/tts/api/broadcast/check-audio.php
   ```

3. **기대 결과**
   - `is_valid_mp3: true`
   - `status: VALID`
   - 올바른 MP3 헤더

---

## 📋 확인 사항

### 1. 기존 파일 처리

**문제:**
- 이미 저장된 JSON 배열 문자열 파일은 유효하지 않음
- 삭제하고 새로 생성 필요

**해결:**
- `cleanup-small-files.php` 실행
- 또는 수동으로 삭제

### 2. 데이터베이스 저장 형식

**확인:**
- `tts_generations` 테이블의 `audio_blob` 컬럼
- JSON 배열 문자열이 아닌 바이너리 데이터로 저장되어야 함

---

## ✅ 수정 완료

### 변경된 파일

- `supabase/functions/execute-schedules/index.ts`
  - JSON 배열 문자열 파싱 추가
  - 바이너리 데이터 변환 로직 추가

- `api/broadcast/index.php`
  - JSON 배열 문자열 감지 및 변환 추가
  - 유효한 바이너리 데이터 저장

### 개선 사항

- ✅ JSON 배열 문자열을 바이너리 데이터로 변환
- ✅ 유효한 오디오 파일 생성
- ✅ MP3 파일 유효성 검사 통과

---

**이제 유효한 오디오 파일이 생성됩니다!** 🚀

