# 🔧 송출 리스트 이름 일관성 개선

## 🚨 발견된 문제

### 문제 1: MP3 재생 안 됨

**증상:**
- WAV 파일은 재생됨
- MP3 파일은 재생 안 됨
- 이전 JSON 배열 문자열 파일 때문일 수 있음

**원인:**
- JSON 배열 문자열로 저장된 MP3 파일
- `audio.php` 변환이 제대로 작동하지 않음

### 문제 2: 송출 리스트 이름 불일치

**증상:**
- 웹 서비스: 스케줄 이름 (예: "8시테스트")
- 플레이어: 파일명 (예: "broadcast_2025-11-20_10-11-11.wav")
- 일관성 없음

---

## ✅ 수정 사항

### 1. 스케줄 이름을 파일명에 포함

#### `execute-schedules/index.ts` 수정

**수정 내용:**
```typescript
// 스케줄 이름을 헤더로 전송 (파일명에 포함하기 위해)
if (schedule.schedule_name) {
    headers["X-Schedule-Name"] = schedule.schedule_name;
}
// 스케줄 ID도 헤더로 전송 (추적용)
headers["X-Schedule-Id"] = schedule.id;
```

**효과:**
- ✅ 스케줄 이름을 `index.php`로 전송
- ✅ 파일명에 스케줄 이름 포함

#### `index.php` 수정

**수정 내용:**
```php
// 스케줄 이름 가져오기 (헤더에서)
$scheduleName = $_SERVER['HTTP_X_SCHEDULE_NAME'] ?? null;

// 파일명 생성 (스케줄 이름이 있으면 포함)
if ($scheduleName && !empty(trim($scheduleName))) {
    // 스케줄 이름을 파일명에 안전하게 포함
    $safeScheduleName = preg_replace('/[^a-zA-Z0-9가-힣_\-]/u', '_', trim($scheduleName));
    $filename = $safeScheduleName . '_' . $timestamp . '.' . $extension;
} else {
    $filename = 'broadcast_' . $timestamp . '.' . $extension;
}
```

**효과:**
- ✅ 파일명: `8시테스트_2025-11-20_10-11-11.wav`
- ✅ 스케줄 이름이 파일명에 포함됨

### 2. `list.php`에서 스케줄 이름 추출

**수정 내용:**
```php
// 파일명에서 스케줄 이름 추출
if (preg_match('/^(.+?)_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})\.(mp3|wav|ogg)$/i', $file, $matches)) {
    $potentialScheduleName = $matches[1];
    if (strtolower($potentialScheduleName) !== 'broadcast') {
        $scheduleName = $potentialScheduleName;
    }
}

$fileInfo = [
    'filename' => $file,
    'schedule_name' => $scheduleName, // 스케줄 이름
    'display_name' => $displayName, // 표시 이름
    // ...
];
```

**효과:**
- ✅ 파일명에서 스케줄 이름 추출
- ✅ 플레이어에 스케줄 이름 전달

### 3. 플레이어에서 스케줄 이름 표시

**수정 내용:**
```javascript
// 스케줄 이름이 있으면 표시, 없으면 파일명 표시
const displayName = audio.schedule_name || audio.display_name || audio.filename;

// 오디오 목록에 표시
<div class="audio-filename">${displayName}</div>
```

**효과:**
- ✅ 웹 서비스와 동일한 스케줄 이름 표시
- ✅ 일관성 있는 사용자 경험

---

## 🚀 사용 방법

### 1. 파일 업로드

수정된 파일을 Hostinger 서버에 업로드:
- `api/broadcast/index.php`
- `api/broadcast/list.php`
- `api/broadcast/player-pc.html`

### 2. Edge Function 재배포

```bash
npx supabase functions deploy execute-schedules
```

### 3. 테스트

1. **웹 서비스에서 스케줄 생성**
   - 스케줄 이름: "8시테스트"
   - 시간 설정 및 저장

2. **자동 송출 확인**
   - 설정된 시간에 오디오 전송
   - 파일명: `8시테스트_2025-11-20_10-11-11.mp3`

3. **플레이어에서 확인**
   - 오디오 목록에 "8시테스트" 표시
   - 웹 서비스와 동일한 이름

---

## 📋 파일명 형식

### 이전 형식
```
broadcast_2025-11-20_10-11-11.wav
```

### 새로운 형식
```
8시테스트_2025-11-20_10-11-11.wav
```

**규칙:**
- 스케줄 이름이 있으면: `{스케줄이름}_{타임스탬프}.{확장자}`
- 스케줄 이름이 없으면: `broadcast_{타임스탬프}.{확장자}`

---

## ✅ 수정 완료

### 변경된 파일

- `supabase/functions/execute-schedules/index.ts`
  - 스케줄 이름을 헤더로 전송

- `api/broadcast/index.php`
  - 스케줄 이름을 파일명에 포함

- `api/broadcast/list.php`
  - 파일명에서 스케줄 이름 추출

- `api/broadcast/player-pc.html`
  - 스케줄 이름 표시
  - 웹 서비스와 동일한 이름 사용

### 개선 사항

- ✅ 웹 서비스와 플레이어의 이름 일관성
- ✅ 스케줄 이름이 파일명에 포함
- ✅ 사용자 경험 개선

---

**이제 웹 서비스와 플레이어에서 동일한 스케줄 이름이 표시됩니다!** 🚀

