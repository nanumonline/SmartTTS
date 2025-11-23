import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import * as dbService from "@/services/dbService";
import { loadBrandSettings, getLogoUrl } from "@/lib/brandSettings";
import { 
  Mic2, 
  Radio, 
  Calendar, 
  Settings, 
  BarChart3, 
  Play, 
  Pause, 
  Volume2,
  Clock,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Building2,
  Plus,
  Download,
  Eye,
  FileText,
  ClipboardList,
  FileSearch,
  LayoutDashboard,
} from "lucide-react";

type UsageStats = {
  totalCalls: number;
  totalDuration: number;
  callsThisMonth: number;
  durationThisMonth: number;
  lastUpdated: string;
};

type CreditBalance = {
  balance: number;
  currency: string;
  lastUpdated: string;
};

type OperationLog = {
  id: number;
  type: "error" | "warning" | "success" | "info";
  message: string;
  timestamp: string;
  context?: any;
  resolved?: boolean;
};

const Dashboard = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [recentGenerations, setRecentGenerations] = useState<dbService.GenerationEntry[]>([]);
  const [scheduledBroadcasts, setScheduledBroadcasts] = useState<dbService.ScheduleRequestEntry[]>([]);
  const [stats, setStats] = useState({
    totalBroadcasts: 0,
    activeBroadcasts: 0,
    totalDuration: "0분",
    successRate: 0,
    monthlyUsage: 0,
    // 작업큐 통계
    pendingJobs: 0, // 대기중
    processingJobs: 0, // 처리중/송출중
    completedJobs: 0, // 완료
    failedJobs: 0, // 실패
  });
  const [recentBroadcasts, setRecentBroadcasts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [logoUrl, setLogoUrl] = useState<string | undefined>();

  // 브랜드 로고 로드
  useEffect(() => {
    const loadLogo = () => {
      const settings = loadBrandSettings();
      const logo = getLogoUrl(settings);
      setLogoUrl(logo);
    };
    
    loadLogo();
    
    // localStorage 변경 감지
    const handleStorageChange = () => {
      loadLogo();
    };
    
    // 커스텀 이벤트 감지 (같은 탭에서 설정 변경 시)
    const handleBrandSettingsChange = () => {
      loadLogo();
    };
    
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("brandSettingsChanged", handleBrandSettingsChange);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("brandSettingsChanged", handleBrandSettingsChange);
    };
  }, []);

  // 사용량 & 크레딧 모니터링 상태
  const [usageStats, setUsageStats] = useState<UsageStats>({
    totalCalls: 0,
    totalDuration: 0,
    callsThisMonth: 0,
    durationThisMonth: 0,
    lastUpdated: new Date().toISOString(),
  });
  const [creditBalance, setCreditBalance] = useState<CreditBalance>({
    balance: 0,
    currency: "KRW",
    lastUpdated: new Date().toISOString(),
  });
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
  const [isMonitoringPanelOpen, setIsMonitoringPanelOpen] = useState(false);
  const usagePollingRef = useRef<number | null>(null);

  // 고유 ID 생성
  const generateUniqueId = (): number => {
    const base = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return base * 10000 + random;
  };

  const addOperationLog = (type: OperationLog["type"], message: string, context?: any) => {
    const log: OperationLog = {
      id: generateUniqueId(),
      type,
      message,
      timestamp: new Date().toISOString(),
      context,
      resolved: false,
    };
    setOperationLogs((prev) => [log, ...prev].slice(0, 50)); // 최대 50개 유지
  };

  const fetchUsageStats = async () => {
    if (!user?.id) return;
    
    try {
      // 실제 DB에서 사용량 통계 계산
      const generations = await dbService.loadGenerations(user.id, 1000);
      
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // 전체 통계
      const totalCalls = generations.length;
      const totalDuration = generations.reduce((sum, gen) => sum + (gen.duration || 0), 0);
      
      // 이번 달 통계
      const callsThisMonth = generations.filter(gen => {
        if (!gen.createdAt) return false;
        const createdAt = new Date(gen.createdAt);
        return createdAt >= startOfMonth;
      }).length;
      
      const durationThisMonth = generations
        .filter(gen => {
          if (!gen.createdAt) return false;
          const createdAt = new Date(gen.createdAt);
          return createdAt >= startOfMonth;
        })
        .reduce((sum, gen) => sum + (gen.duration || 0), 0);
      
      const usage: UsageStats = {
        totalCalls,
        totalDuration,
        callsThisMonth,
        durationThisMonth,
        lastUpdated: new Date().toISOString(),
      };
      
      setUsageStats(usage);
      addOperationLog("success", "사용량 데이터 업데이트 완료");
    } catch (error: any) {
      addOperationLog("error", `사용량 조회 실패: ${error.message}`);
    }
  };

  // 요금제 정보 가져오기
  const getPlanInfo = (planId: string) => {
    const plans = {
      basic: { name: "기본", credits: 20000, description: "약 30분" },
      standard: { name: "표준", credits: 100000, description: "약 150분" },
      premium: { name: "프리미엄", credits: 500000, description: "약 800분" },
      custom: { name: "맞춤형", credits: 0, description: "무제한" },
    };
    return plans[planId as keyof typeof plans] || plans.standard;
  };

  const fetchCreditBalance = async () => {
    try {
      // 사용자 요금제 정보 가져오기
      const planInfo = getPlanInfo(user?.plan || "standard");
      
      // 요금제 정보를 크레딧 형태로 표시
      const planCredit: CreditBalance = {
        balance: planInfo.credits,
        currency: "KRW",
        lastUpdated: new Date().toISOString(),
      };
      setCreditBalance(planCredit);
    } catch (error: any) {
      addOperationLog("error", `요금제 정보 조회 실패: ${error.message}`);
    }
  };

  const startUsagePolling = () => {
    if (usagePollingRef.current) return; // 이미 실행 중이면 중복 방지
    fetchUsageStats();
    fetchCreditBalance();
    // 30초마다 갱신
    usagePollingRef.current = window.setInterval(() => {
      fetchUsageStats();
      fetchCreditBalance();
    }, 30000);
  };

  const stopUsagePolling = () => {
    if (usagePollingRef.current) {
      window.clearInterval(usagePollingRef.current);
      usagePollingRef.current = null;
    }
  };

  // 대시보드 데이터 로드
  const loadDashboardData = async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // 병렬로 데이터 로드
      const [generations, schedules] = await Promise.all([
        dbService.loadGenerations(user.id, 100),
        dbService.loadScheduleRequests(user.id),
      ]);

      // 최근 생성된 음성 목록 (최근 10개)
      setRecentGenerations(generations.slice(0, 10));

      // 예정된 방송 목록
      setScheduledBroadcasts(schedules);

      // 통계 계산
      const totalBroadcasts = generations.length;
      const activeBroadcasts = schedules.filter(
        s => s.status === "scheduled" || s.status === "sent"
      ).length;
      
      // 총 방송 시간 계산 (초 단위)
      const totalDurationSeconds = generations.reduce(
        (sum, gen) => sum + (gen.duration || 0), 
        0
      );
      
      // 시간 포맷팅 함수
      const formatDuration = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
          return `${hours}시간 ${minutes}분`;
        }
        return `${minutes}분`;
      };

      // 성공률 계산 (status가 'ready'이고 hasAudio가 true인 것)
      const successfulGenerations = generations.filter(
        gen => gen.status === "ready" && gen.hasAudio !== false
      ).length;
      const successRate = totalBroadcasts > 0 
        ? Math.round((successfulGenerations / totalBroadcasts) * 100 * 10) / 10
        : 0;

      // 이번 달 사용량 (퍼센트, 예시로 89% 고정 - 실제로는 요금제 기준으로 계산)
      const monthlyUsage = 89; // TODO: 실제 요금제 기준으로 계산

      // 작업큐 통계 계산 (스케줄 기반)
      const pendingJobs = schedules.filter(s => s.status === "scheduled").length;
      const processingJobs = schedules.filter(s => s.status === "processing").length;
      const completedJobs = schedules.filter(s => s.status === "sent").length;
      const failedJobs = schedules.filter(s => s.status === "failed").length;

      setStats({
        totalBroadcasts,
        activeBroadcasts,
        totalDuration: formatDuration(totalDurationSeconds),
        successRate,
        monthlyUsage,
        // 작업큐 통계
        pendingJobs,
        processingJobs,
        completedJobs,
        failedJobs,
      });

      // 최근 방송 목록 생성 (예약 요청과 생성 이력 결합)
      const now = new Date();
      const recentBroadcastsList = schedules
        .slice(0, 10)
        .map(schedule => {
          const generation = generations.find(g => g.id === schedule.generationId);
          const scheduledTime = new Date(schedule.scheduledTime);
          const isPast = scheduledTime < now;
          
          let status: "active" | "scheduled" | "completed" = "scheduled";
          if (schedule.status === "sent") {
            status = isPast ? "completed" : "active";
          } else if (schedule.status === "failed") {
            status = "completed";
          }

          // 다음 실행 시간 포맷팅
          const nextRun = isPast && schedule.status === "sent"
            ? "완료"
            : scheduledTime.toLocaleTimeString("ko-KR", { 
                hour: "2-digit", 
                minute: "2-digit" 
              });

          // duration 포맷팅
          const duration = generation?.duration
            ? formatDuration(generation.duration)
            : "0분";

          return {
            id: schedule.id,
            title: generation?.savedName || generation?.purposeLabel || "제목 없음",
            status,
            duration,
            nextRun,
            voice: generation?.voiceName || "알 수 없음",
            scheduledTime: schedule.scheduledTime,
          };
        })
        .sort((a, b) => {
          // 예약 시간 기준으로 정렬 (최신순)
          return new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime();
        });

      setRecentBroadcasts(recentBroadcastsList);

      addOperationLog("success", "대시보드 데이터 로드 완료");
    } catch (error: any) {
      console.error("대시보드 데이터 로드 실패:", error);
      addOperationLog("error", `대시보드 데이터 로드 실패: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadDashboardData();
    }
  }, [user?.id]);

  useEffect(() => {
    startUsagePolling();
    return () => {
      stopUsagePolling();
    };
  }, [user?.id]);

  const handlePlayVoice = (voiceId: string) => {
    setIsPlaying(!isPlaying);
    // 실제 오디오 재생 로직
  };

  const handleDownloadVoice = (voiceId: string) => {
    // 실제 다운로드 로직
    console.log("다운로드:", voiceId);
  };

  const handleCreateNewVoice = () => {
    navigate("/audio/tts");
  };

  const quickActions = [
    {
      title: "음원 바로 만들기",
      description: "목적 선택부터 음원 생성까지",
      icon: Mic2,
      color: "text-blue-500",
      bgColor: "bg-blue-50",
      onClick: () => navigate("/audio/tts"),
    },
    {
      title: "템플릿에서 시작",
      description: "저장된 템플릿 사용",
      icon: FileText,
      color: "text-purple-500",
      bgColor: "bg-purple-50",
      onClick: () => navigate("/scripts/templates"),
    },
    {
      title: "저장된 문구로",
      description: "문구 목록에서 선택",
      icon: ClipboardList,
      color: "text-green-500",
      bgColor: "bg-green-50",
      onClick: () => navigate("/scripts"),
    },
  ];

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        title="대시보드"
        description="AI 음성 방송 시스템 관리"
        icon={LayoutDashboard}
        showBreadcrumb={false}
        action={{
          label: "설정",
          onClick: () => navigate("/settings"),
          icon: Settings,
        }}
      />

      {user && (
        <div className="mb-6 space-y-2 p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-3">
            {logoUrl && (
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-white flex items-center justify-center border border-border shadow-sm">
                <img
                  src={logoUrl}
                  alt="로고"
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{user.organization}</span>
                {user.department && <span className="flex-shrink-0">• {user.department}</span>}
                {user.position && <span className="flex-shrink-0">• {user.position}</span>}
          </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <Users className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{user.name}님</span>
                <span className="flex-shrink-0">•</span>
                <span className="truncate">{user.email}</span>
                <span className="flex-shrink-0">•</span>
                <Badge variant="outline" className="text-xs flex-shrink-0">
              {user.plan === 'basic' ? '기본' : 
               user.plan === 'standard' ? '표준' : 
               user.plan === 'premium' ? '프리미엄' : 
               user.plan === 'custom' ? '맞춤형' : user.plan}
            </Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* 사용량 & 크레딧 모니터링 패널 (FHD/WFHD 최적화: 4-5 컬럼) */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">이번 달 생성</span>
                  <Badge variant="outline">{usageStats.callsThisMonth}회</Badge>
                </div>
                <div className="text-2xl font-bold">{Math.round(usageStats.durationThisMonth / 60)}분</div>
                <div className="text-xs text-muted-foreground">전체: {usageStats.totalCalls}회 / {Math.round(usageStats.totalDuration / 3600)}시간</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <span className="text-sm font-medium text-muted-foreground">회원 요금제</span>
                <div className="flex items-center gap-2">
                  <div className={`text-2xl font-bold ${user?.plan === "premium" ? "text-purple-600" : user?.plan === "standard" ? "text-primary" : user?.plan === "basic" ? "text-blue-600" : "text-green-600"}`}>
                    {getPlanInfo(user?.plan || "standard").name}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {getPlanInfo(user?.plan || "standard").description}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  크레딧: ₩{creditBalance.balance.toLocaleString()}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">최근 로그</span>
                  <Button size="sm" variant="ghost" onClick={() => setIsMonitoringPanelOpen(!isMonitoringPanelOpen)}>자세히</Button>
                </div>
                <div className="text-xs space-y-1">
                  {operationLogs.slice(0, 3).map((log) => (
                    <div key={log.id} className={`text-[11px] ${log.type === "error" ? "text-red-600" : log.type === "warning" ? "text-orange-600" : log.type === "success" ? "text-green-600" : "text-muted-foreground"}`}>
                      • {log.message}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats Overview (FHD/WFHD 최적화: 4-6 컬럼) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">총 방송 수</p>
                  <p className="text-2xl font-bold">{stats.totalBroadcasts}</p>
                </div>
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Radio className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">활성 방송</p>
                  <p className="text-2xl font-bold">{stats.activeBroadcasts}</p>
                </div>
                <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                  <Play className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">총 방송 시간</p>
                  <p className="text-2xl font-bold">{stats.totalDuration}</p>
                </div>
                <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">성공률</p>
                  <p className="text-2xl font-bold">{stats.successRate}%</p>
                </div>
                <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 작업큐 통계 (FHD/WFHD 최적화: 4-6 컬럼) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">대기중</p>
                  <p className="text-2xl font-bold">{stats.pendingJobs}</p>
                </div>
                <div className="w-12 h-12 bg-yellow-50 dark:bg-yellow-500/10 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-yellow-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">송출중</p>
                  <p className="text-2xl font-bold">{stats.processingJobs}</p>
                </div>
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Radio className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">완료</p>
                  <p className="text-2xl font-bold">{stats.completedJobs}</p>
                </div>
                <div className="w-12 h-12 bg-green-50 dark:bg-green-500/10 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">실패</p>
                  <p className="text-2xl font-bold">{stats.failedJobs}</p>
                </div>
                <div className="w-12 h-12 bg-red-50 dark:bg-red-500/10 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Recent Broadcasts (FHD/WFHD 최적화: 2-3 컬럼) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="lg:col-span-1 xl:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic2 className="w-5 h-5" />
                  빠른 작업
                </CardTitle>
                <CardDescription>
                  자주 사용하는 기능에 빠르게 접근하세요
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {quickActions.map((action, idx) => (
                  <Button
                    key={idx}
                    variant={idx === 0 ? "default" : "outline"}
                    className={`w-full justify-start h-auto p-4 ${idx === 0 ? "bg-gradient-to-r from-primary to-accent text-white hover:opacity-90" : ""}`}
                    onClick={action.onClick}
                  >
                    <div className={`w-10 h-10 ${idx === 0 ? "bg-white/20" : action.bgColor} rounded-lg flex items-center justify-center mr-3`}>
                      <action.icon className={`w-5 h-5 ${idx === 0 ? "text-white" : action.color}`} />
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{action.title}</p>
                      <p className={`text-sm ${idx === 0 ? "text-white/80" : "text-muted-foreground"}`}>{action.description}</p>
                    </div>
                  </Button>
                ))}
                
                <div className="pt-2 border-t">
                  {/* 클로닝 기능은 현재 제공하지 않습니다 */}
                  {/* <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => navigate("/audio/cloning")}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    보이스 클로닝
                  </Button> */}
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => navigate("/send/schedule")}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    스케줄 관리
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => navigate("/audio/history")}
                  >
                    <FileSearch className="w-4 h-4 mr-2" />
                    생성 내역
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Broadcasts */}
          <div className="lg:col-span-1 xl:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Radio className="w-5 h-5" />
                  최근 방송
                </CardTitle>
                <CardDescription>
                  최근 생성된 방송 목록입니다
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : recentBroadcasts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Radio className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>예약된 방송이 없습니다.</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => navigate("/send/schedule")}
                    >
                      방송 예약하기
                    </Button>
                  </div>
                ) : (
                  <>
                <div className="space-y-4">
                  {recentBroadcasts.map((broadcast) => (
                    <div
                      key={broadcast.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                          <Volume2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-medium">{broadcast.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {broadcast.voice} • {broadcast.duration}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={
                            broadcast.status === "active"
                              ? "default"
                              : broadcast.status === "scheduled"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {broadcast.status === "active" && (
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                          )}
                          {broadcast.status === "scheduled" && (
                            <Clock className="w-3 h-3 mr-1" />
                          )}
                          {broadcast.status === "completed" && (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          )}
                          {broadcast.status === "active"
                            ? "방송 중"
                            : broadcast.status === "scheduled"
                            ? "예약됨"
                            : "완료"}
                        </Badge>
                        <div className="text-right">
                          <p className="text-sm font-medium">{broadcast.nextRun}</p>
                          <p className="text-xs text-muted-foreground">
                            {broadcast.status === "active" ? "다음 실행" : "실행 시간"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6">
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => navigate("/send/schedule")}
                      >
                    모든 방송 보기
                  </Button>
                </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Usage Statistics */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                사용량 통계
              </CardTitle>
              <CardDescription>
                현재 요금제 사용량을 확인하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>월간 방송 시간</span>
                    <span>{Math.round(usageStats.durationThisMonth / 3600)}시간 / 무제한</span>
                  </div>
                  <Progress value={Math.min((usageStats.durationThisMonth / 3600 / 200) * 100, 100)} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {Math.round((usageStats.durationThisMonth / 3600 / 200) * 100)}% 사용 (예시)
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>음성 생성 횟수</span>
                    <span>{usageStats.callsThisMonth}회 / 무제한</span>
                  </div>
                  <Progress value={Math.min((usageStats.callsThisMonth / 100) * 100, 100)} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {Math.min(usageStats.callsThisMonth, 100)}% 사용 (예시)
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>스토리지 사용량</span>
                    <span>계산 중...</span>
                  </div>
                  <Progress value={25} className="h-2" />
                  <p className="text-xs text-muted-foreground">25% 사용 (예시)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
};

export default Dashboard;
