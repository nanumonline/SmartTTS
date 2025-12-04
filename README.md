# SmartTTS - AI 기반 TTS 방송 서비스

AI 기반 텍스트 음성 변환(TTS) 방송 서비스입니다. 공공기관 음성 메시지 자동 생성 및 예약 전송 기능을 제공합니다.

## 🚀 빠른 시작

### 개발 환경 설정

```bash
# 저장소 클론
git clone https://github.com/nanumonline/SmartTTS.git
cd SmartTTS

# 의존성 설치
npm install

# 개발 서버 실행 (localhost:8000)
npm run dev
```

### 빌드 및 배포

```bash
# 프로덕션 빌드
npm run build

# 빌드 미리보기
npm run preview
```

## 📁 프로젝트 구조

```
SmartTTS/
├── src/                    # 소스 코드
│   ├── components/         # React 컴포넌트
│   ├── pages/             # 페이지 컴포넌트
│   ├── services/          # 서비스 레이어
│   ├── lib/               # 유틸리티 함수
│   └── integrations/      # 외부 서비스 통합
├── api/                    # API 엔드포인트
│   ├── broadcast-node/    # Vercel 서버리스 함수 (Node.js)
│   └── broadcast/         # 문서 및 설정 파일
├── server/                 # 서버 파일
│   └── php/               # 호스팅용 PHP 파일
├── supabase/              # Supabase 설정
│   ├── functions/         # Edge Functions
│   └── migrations/        # 데이터베이스 마이그레이션
├── docs/                  # 문서
│   ├── deployment/        # 배포 가이드
│   ├── api/              # API 문서
│   ├── guides/            # 개발 가이드
│   └── troubleshooting/   # 문제 해결 가이드
├── public/                # 정적 파일
└── scripts/               # 빌드 스크립트
```

## 🛠 기술 스택

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: shadcn/ui + Tailwind CSS
- **State Management**: React Hooks + Context API
- **Backend**: Supabase (Database + Auth + Edge Functions)
- **Deployment**: 
  - Frontend: Vercel
  - API: Vercel Serverless Functions (Node.js) / Hostinger (PHP)

## 📚 주요 기능

- ✅ 목적별 문구 관리 (공공공지, 행사축사, 홍보, 서비스안내)
- ✅ 음성 클로닝 및 TTS 생성
- ✅ 오디오 믹싱 (배경음, 효과음)
- ✅ 예약 전송 및 스케줄 관리
- ✅ 사용량 모니터링 및 크레딧 관리

## 📖 문서

자세한 문서는 [`docs/`](./docs/) 폴더를 참고하세요:

- [배포 가이드](./docs/deployment/) - Vercel 및 호스팅 배포 방법
- [API 문서](./docs/api/) - API 엔드포인트 문서
- [개발 가이드](./docs/guides/) - 개발 관련 가이드
- [문제 해결](./docs/troubleshooting/) - 트러블슈팅 가이드

## 🔧 환경 변수

`.env.local` 파일을 생성하고 다음 변수를 설정하세요:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_OPENAI_API_KEY=your_openai_api_key
VITE_SUPERTONE_API_KEY=your_supertone_api_key
```

## 📝 라이선스

이 프로젝트는 비공개 프로젝트입니다.

## 🤝 기여

프로젝트에 기여하고 싶으시다면 이슈를 생성하거나 풀 리퀘스트를 보내주세요.
