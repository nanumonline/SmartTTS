# 🚀 Smart TTS 서비스 배포 가이드

## 📌 프로젝트 개요

**AI 기반 TTS 방송 서비스**
- 공공기관 음성 메시지 자동 생성
- Supertone API 기반 음성 합성
- 목적별 문구 관리 & 예약 전송
- 사용량 모니터링 & 크레딧 관리

---

## ✨ 구현 기능

### Phase 1: 문구 관리
- ✅ 목적별 선택 (공공공지, 행사축사, 홍보, 서비스안내)
- ✅ 검수 체크리스트 제시
- ✅ 생성 기록 & 즐겨찾기
- ✅ 음성별 샘플 (한국어 우선)

### Phase 2: 음성 클로닝
- ✅ 샘플 업로드 & 클론 생성
- ✅ 기준 음성 선택
- ✅ 진행 상태 추적
- ✅ 자동 모니터링 대시보드

### Phase 3: 믹싱 & 예약
- ✅ 배경음/효과음 선택
- ✅ 음량 조절 (슬라이더)
- ✅ 채널별 전송 예약
- ✅ 반복 옵션 (1회/매일/매주)

### Phase 4: 모니터링
- ✅ 사용량 통계 (호출, 시간)
- ✅ 크레딧 잔액 & 임계치 경고
- ✅ 운영 로그 (이벤트 추적)
- ✅ 30초 자동 갱신

### 품질 보증
- ✅ 입력값 검증 (텍스트 2~5000자, 파일 ≤50MB)
- ✅ 에러 처리 & 재시도 로직
- ✅ 작업 로그 (success/warning/error/info)
- ✅ 로컬스토리지 자동 저장

---

## 🔧 기술 스택

```
Frontend: React 18 + TypeScript + Vite
UI: shadcn/ui + Tailwind CSS
State: React Hooks + Context API
Storage: localStorage + Map
API: Supabase Edge Functions
Backend: Deno Runtime
```

---

## 📦 빌드 & 배포

### 빌드 실행
```bash
npm run build
# 또는
bun run build
```

### 빌드 결과
```
dist/index.html              1.17 kB
dist/assets/index.css       75.02 kB (gzip: 12.73 kB)
dist/assets/index.js       812.55 kB (gzip: 239.50 kB) ⚠️
Built in: 9.11s
```

### 배포 옵션

#### 1️⃣ Vercel (추천)
```bash
npm i -g vercel
vercel deploy
# 환경 변수 설정: SUPERTONE_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

#### 2️⃣ GitHub Pages
```bash
npm run build
git add dist/
git commit -m "build: production build"
git push origin main
# Settings → Pages → Deploy from branch → main/dist
```

#### 3️⃣ Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
CMD ["npm", "run", "preview"]
```

---

## 🔑 환경 변수 설정

`.env.production` 또는 배포 플랫폼 환경 변수:

```env
# Supabase
VITE_SUPABASE_URL=https://[project-id].supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]

# Supertone API (Edge Function에서만 사용)
SUPERTONE_API_KEY=[your-api-key]

# 선택사항
VITE_API_BASE_URL=https://[project-id].supabase.co/functions/v1
```

---

## ✅ 배포 후 체크리스트

- [ ] 모든 페이지 로드 확인
- [ ] 음성 탐색 필터 동작 확인
- [ ] 음성 생성 및 재생 테스트
- [ ] 클로닝 요청 시뮬레이션
- [ ] 모바일 반응형 확인
- [ ] 콘솔 오류 확인 (개발자 도구)
- [ ] 로컬스토리지 저장 확인
- [ ] 네트워크 요청 분석 (Supabase 호출)

---

## 🎯 다음 단계 (선택)

### 즉시 수행 가능
1. **청크 코드 분할** (CSS-in-JS 라이브러리 분리)
2. **Lazy Loading** (라우트 기반 동적 로드)
3. **이미지 최적화** (hero-bg 변환/압축)

### 추후 고도화
1. **배치 생성 & 대량 예약**
2. **실시간 알림** (Supabase Realtime)
3. **고급 분석** (CSV 내보내기)
4. **다국어 지원** (i18n)
5. **API 속도 최적화** (GraphQL, 캐싱)

---

## 🆘 문제 해결

### 빌드 실패
```bash
# 캐시 삭제 후 재시도
rm -rf node_modules package-lock.json dist/
npm install
npm run build
```

### API 오류
- Supabase URL 확인
- API 키 만료 여부 확인
- CORS 정책 확인 (Edge Function 헤더)
- 네트워크 탭에서 요청 상태 확인

### 음성 생성 실패
- Supertone API 키 유효성 확인
- 음성 ID 형식 확인
- 텍스트 길이 확인 (≤5000자)
- 크레딧 잔액 확인

---

## 📊 성능 지표 (목표)

| 메트릭 | 현재 | 목표 |
|--------|------|------|
| Lighthouse Score | TBD | ≥90 |
| FCP (First Contentful Paint) | TBD | <1.5s |
| LCP (Largest Contentful Paint) | TBD | <2.5s |
| Bundle Size | 812.55 KB | <500 KB |

---

## 📝 라이센스 & 지원

- **Supertone API**: [공식 문서](https://docs.supertoneapi.com)
- **Supabase**: [공식 문서](https://supabase.com/docs)
- **shadcn/ui**: [컴포넌트 라이브러리](https://ui.shadcn.com)

---

**배포 일시**: 2025-11-01
**프로젝트 상태**: ✅ 프로덕션 준비 완료
