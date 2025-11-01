# TTS 서비스 IA 기반 페이지 스캐폴드 설계문서 (Next.js + shadcn/ui)

## 1. 개요
이 문서는 TTS 서비스의 전체 서비스 플로우(문구 작성 → 음성 스타일 선택 → TTS/클로닝 생성 → 믹싱 → 전송·스케줄 → 관리/리포트)에 기반한 **Next.js 라우팅 구조 및 shadcn/ui 컴포넌트 스캐폴드 설계서**입니다.

본 설계는 **localhost:8000** 환경에서 메뉴 네비게이션 및 페이지 생성이 가능한 형태를 목표로 합니다.

---

## 2. 기술 스택
- **Frontend:** Next.js 14 (App Router)
- **UI Framework:** shadcn/ui + Tailwind CSS
- **State Management:** React Query + Zustand
- **Audio Rendering:** Web Audio API, react-audio-mixer, react-wavesurfer
- **Build & Run:** Vite / Bun / Yarn
- **Port:** `localhost:8000`

---

## 3. 디렉토리 구조
```bash
src/
├─ app/
│  ├─ layout.tsx                # AppShell + NavLayout
│  ├─ page.tsx                  # Dashboard
│  ├─ campaigns/                # 캠페인
│  │  ├─ page.tsx               # 캠페인 리스트
│  │  └─ new/page.tsx           # 캠페인 생성 Stepper Flow
│  ├─ scripts/                  # 문구·대본 관리
│  │  ├─ page.tsx               # 문구 리스트
│  │  └─ templates/page.tsx     # 템플릿 모음
│  ├─ audio/                    # 음원 생성 (TTS, 클로닝)
│  │  ├─ styles/page.tsx        # 음성 스타일
│  │  ├─ tts/page.tsx           # TTS 생성
│  │  ├─ cloning/page.tsx       # 클로닝 생성
│  │  └─ history/page.tsx       # 생성 내역
│  ├─ mix/                      # 믹싱 기능
│  │  ├─ board/page.tsx         # 믹스보드 (react-audio-mixer UI)
│  │  └─ presets/page.tsx       # 프리셋 목록
│  ├─ send/                     # 전송 및 스케줄
│  │  ├─ setup/page.tsx         # 전송 설정
│  │  ├─ schedule/page.tsx      # 스케줄 관리
│  │  └─ audience/page.tsx      # 대상자 관리
│  ├─ manage/                   # 자산/작업 관리
│  │  ├─ assets/page.tsx        # 파일 자산 관리
│  │  ├─ jobs/page.tsx          # 작업 큐 관리
│  │  ├─ compliance/page.tsx    # 승인 및 컴플라이언스
│  │  └─ audit/page.tsx         # 감사로그
│  ├─ reports/                  # 리포트 대시보드
│  │  ├─ page.tsx               # 요약 대시보드
│  │  ├─ sends/page.tsx         # 전송 리포트
│  │  └─ quality/page.tsx       # 음원 품질 리포트
│  └─ settings/                 # 설정 및 통합관리
│     ├─ integrations/page.tsx  # API, 외부 연동
│     ├─ roles/page.tsx         # 권한 설정
│     └─ brand/page.tsx         # 브랜드 정책
│
├─ components/                  # shadcn 기반 UI 컴포넌트
│  ├─ layout/
│  │  ├─ Sidebar.tsx            # 좌측 메뉴 네비게이션
│  │  ├─ TopNav.tsx             # 상단 메뉴바
│  │  └─ AppShell.tsx           # 기본 레이아웃 구성
│  ├─ ui/                       # shadcn 확장 컴포넌트
│  │  ├─ Stepper.tsx
│  │  ├─ DataTable.tsx
│  │  ├─ Drawer.tsx
│  │  └─ Toast.tsx
│  ├─ audio/
│  │  ├─ WaveformPlayer.tsx
│  │  ├─ MixTrack.tsx
│  │  └─ VolumeMeter.tsx
│  └─ forms/
│     ├─ ScriptEditor.tsx
│     ├─ VoiceStylePicker.tsx
│     ├─ ScheduleForm.tsx
│     └─ AudienceUploader.tsx
│
├─ lib/
│  ├─ api.ts                    # API wrapper (axios 기반)
│  ├─ store.ts                  # Zustand store
│  ├─ constants.ts              # 라우트 및 메뉴 상수 정의
│  └─ utils/                    # 공통 함수
│
├─ styles/
│  ├─ globals.css
│  └─ theme.css                 # Tailwind 토큰 확장
```

---

## 4. 네비게이션 설계

### `Sidebar.tsx`
```tsx
export const navItems = [
  { title: "캠페인", href: "/campaigns" },
  { title: "문구·대본", href: "/scripts" },
  { title: "음원 생성", href: "/audio" },
  { title: "믹싱", href: "/mix" },
  { title: "전송·스케줄", href: "/send" },
  { title: "관리", href: "/manage" },
  { title: "리포트", href: "/reports" },
  { title: "설정", href: "/settings" }
];
```

### `AppShell.tsx`
```tsx
import { Sidebar } from '@/components/layout/Sidebar'
import { TopNav } from '@/components/layout/TopNav'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopNav />
        <main className="p-6 overflow-y-auto bg-muted/30">
          {children}
        </main>
      </div>
    </div>
  );
}
```

---

## 5. 메뉴별 라우트 템플릿

### 예시 1) `/audio/tts/page.tsx`
```tsx
export default function TTSPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">TTS 음원 생성</h1>
      <p className="text-muted-foreground">문구를 선택하고 음성 스타일을 지정하여 음원을 생성합니다.</p>
      <div className="grid grid-cols-2 gap-6">
        <ScriptEditor />
        <VoiceStylePicker />
      </div>
      <Button variant="default" className="mt-4">음원 생성</Button>
    </div>
  )
}
```

### 예시 2) `/mix/board/page.tsx`
```tsx
import { MixTrack } from '@/components/audio/MixTrack'
export default function MixBoard() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">오디오 믹싱 보드</h1>
      <MixTrack />
    </div>
  )
}
```

---

## 6. 실행 방법
```bash
yarn install
yarn dev --port 8000
```
실행 후 `http://localhost:8000` 접속 시, 좌측 사이드바 메뉴 기반으로 전체 IA 네비게이션이 작동합니다.

---

## 7. 개발 체크리스트
- [ ] AppShell / Sidebar / TopNav 구현
- [ ] 메뉴별 page.tsx 스켈레톤 생성
- [ ] Zustand 스토어(오디오 상태/캠페인 플로우)
- [ ] shadcn 테마 적용 (`npx shadcn-ui@latest init`)
- [ ] react-audio-mixer & waveform preview 연결
- [ ] MixBoard에서 BGM/Voice 트랙 믹스 기능 연결
- [ ] RRULE 기반 스케줄러 구현
- [ ] Dashboard 요약 리포트 페이지 생성

---

## 8. 참고 링크
- [shadcn/ui Docs](https://ui.shadcn.com)
- [React Audio Mixer (GitHub)](https://github.com/smujmaiku/react-audio-mixer)
- [Web Audio API MDN Docs](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

---

**작성자:** GPT-5 (TTS 서비스 설계 지원)
**버전:** v1.0 — 2025-11-02

