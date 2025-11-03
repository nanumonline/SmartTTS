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
import MixPresetsPage from "./pages/MixPresetsPage";
import SendAudiencePage from "./pages/SendAudiencePage";
import ManageJobsPage from "./pages/ManageJobsPage";
import ManageCompliancePage from "./pages/ManageCompliancePage";
import ManageAuditPage from "./pages/ManageAuditPage";
import ReportsQualityPage from "./pages/ReportsQualityPage";
import SettingsIntegrationsPage from "./pages/SettingsIntegrationsPage";
import SettingsRolesPage from "./pages/SettingsRolesPage";
import SettingsBrandPage from "./pages/SettingsBrandPage";
import StorageSettingsPage from "./pages/StorageSettingsPage";
import ScriptsTemplatesPage from "./pages/ScriptsTemplatesPage";
import MessageManagementPage from "./pages/MessageManagementPage";
import MessageTemplatePage from "./pages/MessageTemplatePage";

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
              path="/scripts/messages" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <MessageManagementPage />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/scripts/templates" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <MessageTemplatePage />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            
            {/* 음원 생성 */}
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
                    <MixPresetsPage />
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
                    <SendAudiencePage />
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
                    <ManageJobsPage />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/manage/compliance" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <ManageCompliancePage />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/manage/audit" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <ManageAuditPage />
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
                    <ReportsSendsPage />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports/quality" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <ReportsQualityPage />
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
                    <SettingsIntegrationsPage />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings/integrations" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <SettingsIntegrationsPage />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings/roles" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <SettingsRolesPage />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings/brand" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <SettingsBrandPage />
                  </AppShell>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings/storage" 
              element={
                <ProtectedRoute>
                  <AppShell>
                    <StorageSettingsPage />
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
