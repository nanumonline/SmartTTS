# broadcast-now Edge Function 수정 사항

## 문제점
- `"[object Object]" is not valid JSON` 오류 발생
- `req.text()` → `JSON.parse()` 방식에서 문제 발생

## 수정 내용
- `req.json()`을 직접 사용하도록 변경
- Supabase Functions `invoke`는 자동으로 JSON을 직렬화하므로 `req.json()`으로 직접 파싱 가능

## 배포 필요
Edge Function을 다시 배포해야 합니다:

```bash
cd /Users/june/Documents/GitHub/voicecraft-designer
supabase functions deploy broadcast-now
```

## 변경된 코드 위치
- 파일: `supabase/functions/broadcast-now/index.ts`
- 라인: 99-140 (요청 본문 파싱 부분)

## 변경 전
```typescript
const bodyText = await req.text();
if (!bodyText || bodyText.trim() === "") {
  // ...
}
requestData = JSON.parse(bodyText);
```

## 변경 후
```typescript
requestData = await req.json();
```

## 참고
다른 Edge Function들(`openai-text-generation`, `execute-schedules`)도 `req.json()`을 직접 사용하고 있습니다.

