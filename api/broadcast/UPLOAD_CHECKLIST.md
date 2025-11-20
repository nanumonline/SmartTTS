# ✅ 업로드 체크리스트

## 🎯 업로드 경로 확인

**Hostinger 서버 경로:**
```
public_html/tts/api/broadcast/
```

**File Manager 링크:**
```
https://srv1865-files.hstgr.io/a30877308e077662/files/public_html/tts/api/broadcast/
```

✅ **경로가 올바릅니다!** 이 경로에 파일을 업로드하세요.

---

## 📤 업로드할 파일 목록

### 필수 파일 (PHP 버전)

다음 3개 파일을 `public_html/tts/api/broadcast/` 폴더에 업로드하세요:

1. ✅ **`index.php`**
   - 메인 API 엔드포인트 파일
   - POST 요청으로 오디오 데이터를 받아 처리
   - 위치: `api/broadcast/index.php`

2. ✅ **`test.php`**
   - API 테스트 파일
   - 서버 환경 및 권한 확인
   - 위치: `api/broadcast/test.php`

3. ✅ **`.htaccess`**
   - Apache 서버 설정 파일
   - CORS 설정, 파일 업로드 크기 제한 등
   - 위치: `api/broadcast/.htaccess`
   - ⚠️ **숨김 파일** - 업로드 시 "모든 파일 표시" 옵션 활성화

---

## 📋 업로드 단계별 체크리스트

### 1단계: 파일 준비
- [ ] `index.php` 파일 확인
- [ ] `test.php` 파일 확인
- [ ] `.htaccess` 파일 확인

### 2단계: Hostinger File Manager 접속
- [ ] Hostinger 대시보드 로그인
- [ ] File Manager 열기
- [ ] `public_html/tts/api/broadcast/` 폴더로 이동 확인

### 3단계: 파일 업로드
- [ ] `index.php` 업로드
- [ ] `test.php` 업로드
- [ ] `.htaccess` 업로드 (숨김 파일 주의)

### 4단계: 파일 권한 설정
- [ ] 모든 파일 권한 **644** 설정
- [ ] 폴더 권한 **755** 설정

### 5단계: 업로드 확인
- [ ] File Manager에서 3개 파일이 보이는지 확인
- [ ] 파일 크기가 0이 아닌지 확인
- [ ] `.htaccess` 파일이 보이는지 확인

---

## ✅ 업로드 후 테스트

### 테스트 1: 브라우저에서 직접 접근

**URL:**
```
https://tts.nanum.online/api/broadcast/test.php
```

**예상 결과:**
```json
{
  "status": "ok",
  "message": "All checks passed! API endpoint is ready to use.",
  "timestamp": "2025-11-20 10:30:00",
  ...
}
```

**실제 결과가 HTML이면**: 
- ❌ 파일이 업로드되지 않았거나
- ❌ 잘못된 경로에 업로드됨

### 테스트 2: 터미널에서 curl 테스트

```bash
# test.php 테스트
curl https://tts.nanum.online/api/broadcast/test.php

# 메인 API 엔드포인트 테스트 (POST)
curl -X POST https://tts.nanum.online/api/broadcast \
  -H "Content-Type: audio/mpeg" \
  -d "test audio data"
```

**예상 결과:**
```json
{
  "success": true,
  "message": "Broadcast received successfully",
  ...
}
```

---

## 🔍 문제 해결

### 문제 1: `.htaccess` 파일이 보이지 않음

**해결:**
- File Manager에서 "숨김 파일 표시" 옵션 활성화
- 또는 직접 파일 이름 입력: `.htaccess`

### 문제 2: 파일을 업로드했는데 여전히 HTML이 반환됨

**확인 사항:**
1. 파일이 올바른 경로에 있는지 확인: `public_html/tts/api/broadcast/`
2. 파일 이름이 정확한지 확인 (대소문자 구분)
3. 파일 크기가 0이 아닌지 확인
4. 브라우저 캐시 삭제 후 다시 시도

### 문제 3: 404 에러 계속 발생

**확인 사항:**
1. 파일 경로: `public_html/tts/api/broadcast/`
2. 파일이 실제로 업로드되었는지 File Manager에서 확인
3. 파일 권한이 644인지 확인

---

## 📝 빠른 참고

### 로컬 파일 위치
```
/Users/june/Documents/GitHub/voicecraft-designer/api/broadcast/
├── index.php
├── test.php
└── .htaccess
```

### 서버 업로드 위치
```
public_html/tts/api/broadcast/
├── index.php
├── test.php
└── .htaccess
```

### 접근 URL
```
https://tts.nanum.online/api/broadcast/test.php
https://tts.nanum.online/api/broadcast          (POST)
```

---

**파일 업로드 완료 후 테스트 결과를 알려주세요!** 🚀

