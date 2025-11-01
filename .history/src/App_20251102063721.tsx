import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/layout/AppShell";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Pricing from "./pages/Pricing";
import PublicVoiceGenerator from "./pages/PublicVoiceGenerator";
import VoiceCloning from "./pages/VoiceCloning";
import AdvancedVoiceGenerator from "./pages/AdvancedVoiceGenerator";
import ScheduleManager from "./pages/ScheduleManager";
import Analytics from "./pages/Analytics";
import NotFound from "./pages/NotFound";
import ScriptsPage from "./pages/ScriptsPage";
import AudioHistoryPage from "./pages/AudioHistoryPage";
import MixBoardPage from "./pages/MixBoardPage";
import SendSetupPage from "./pages/SendSetupPage";
import ScheduleManagerPage from "./pages/ScheduleManagerPage";
import ManageAssetsPage from "./pages/ManageAssetsPage";
import ReportsSendsPage from "./pages/ReportsSendsPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/pricing" element={<Pricing />} />
            
            {/* Protected Routes with AppShell */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Dashboard />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            
            {/* 문구·대본 */}
            <Route 
              path="/scripts" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <ScriptsPage />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/scripts/templates" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <div className="space-y-4">
                      <h1 className="text-2xl font-semibold">템플릿</h1>
                      <p className="text-muted-foreground">문구 템플릿을 관리합니다.</p>
                      {/* TODO: 템플릿 컴포넌트 추가 */}
                    </div>
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            
            {/* 음원 생성 */}
            <Route 
              path="/audio/styles" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <AdvancedVoiceGenerator />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/audio/tts" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <PublicVoiceGenerator />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/audio/cloning" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <VoiceCloning />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/audio/history" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <AudioHistoryPage />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            {/* 하위 호환성: 기존 라우트 */}
            <Route 
              path="/voice-generator" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <PublicVoiceGenerator />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/voice-cloning" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <VoiceCloning />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/advanced-voice" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <AdvancedVoiceGenerator />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            
            {/* 믹싱 */}
            <Route 
              path="/mix/board" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <MixBoardPage />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/mix/presets" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <div className="space-y-4">
                      <h1 className="text-2xl font-semibold">프리셋</h1>
                      <p className="text-muted-foreground">믹싱 프리셋을 관리합니다.</p>
                    </div>
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            
            {/* 전송·스케줄 */}
            <Route 
              path="/send/setup" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <SendSetupPage />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/send/schedule" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <ScheduleManagerPage />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/send/audience" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <div className="space-y-4">
                      <h1 className="text-2xl font-semibold">대상자 관리</h1>
                      <p className="text-muted-foreground">전송 대상자를 관리합니다.</p>
                    </div>
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            {/* 하위 호환성 */}
            <Route 
              path="/schedule" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <ScheduleManagerPage />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            
            {/* 관리 */}
            <Route 
              path="/manage/assets" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <ManageAssetsPage />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/manage/jobs" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <div className="space-y-4">
                      <h1 className="text-2xl font-semibold">작업 큐</h1>
                      <p className="text-muted-foreground">작업 큐를 관리합니다.</p>
                    </div>
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/manage/compliance" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <div className="space-y-4">
                      <h1 className="text-2xl font-semibold">승인·컴플라이언스</h1>
                      <p className="text-muted-foreground">승인 및 컴플라이언스를 관리합니다.</p>
                    </div>
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/manage/audit" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <div className="space-y-4">
                      <h1 className="text-2xl font-semibold">감사로그</h1>
                      <p className="text-muted-foreground">감사 로그를 확인합니다.</p>
                    </div>
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            
            {/* 리포트 */}
            <Route 
              path="/reports" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Analytics />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports/sends" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <div className="space-y-4">
                      <h1 className="text-2xl font-semibold">전송 리포트</h1>
                      <p className="text-muted-foreground">전송 통계를 확인합니다.</p>
                    </div>
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports/quality" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <div className="space-y-4">
                      <h1 className="text-2xl font-semibold">품질 리포트</h1>
                      <p className="text-muted-foreground">음원 품질 통계를 확인합니다.</p>
                    </div>
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            {/* 하위 호환성 */}
            <Route 
              path="/analytics" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Analytics />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            
            {/* 설정 */}
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <div className="space-y-4">
                      <h1 className="text-2xl font-semibold">설정</h1>
                      <p className="text-muted-foreground">서비스 설정을 관리합니다.</p>
                    </div>
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings/integrations" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <div className="space-y-4">
                      <h1 className="text-2xl font-semibold">통합 관리</h1>
                      <p className="text-muted-foreground">API 및 외부 연동을 관리합니다.</p>
                    </div>
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings/roles" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <div className="space-y-4">
                      <h1 className="text-2xl font-semibold">권한 설정</h1>
                      <p className="text-muted-foreground">사용자 권한을 관리합니다.</p>
                    </div>
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings/brand" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <div className="space-y-4">
                      <h1 className="text-2xl font-semibold">브랜드 정책</h1>
                      <p className="text-muted-foreground">브랜드 정책을 설정합니다.</p>
                    </div>
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            
            {/* 루트 경로 리다이렉트 */}
            <Route 
              path="/audio" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <PublicVoiceGenerator />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/mix" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <div className="space-y-4">
                      <h1 className="text-2xl font-semibold">믹싱</h1>
                      <p className="text-muted-foreground">오디오 믹싱 기능입니다.</p>
                    </div>
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/send" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <ScheduleManagerPage />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/manage" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <div className="space-y-4">
                      <h1 className="text-2xl font-semibold">관리</h1>
                      <p className="text-muted-foreground">자산 및 작업을 관리합니다.</p>
                    </div>
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            
            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
