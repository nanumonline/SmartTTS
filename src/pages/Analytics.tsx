import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Users,
  Clock,
  Volume2,
  Calendar,
  Download,
  Eye,
  Filter,
  RefreshCw,
  Loader2,
  Radio,
  CheckCircle2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import * as dbService from "@/services/dbService";
import { formatDateTime } from "@/lib/pageUtils";
import { getVoiceDisplayNameKo } from "@/lib/voiceNames";

interface OverviewStats {
  totalBroadcasts: number;
  totalDuration: number; // 분
  averageDuration: number; // 분
  successRate: number;
  monthlyGrowth: number;
  weeklyGrowth: number;
}

interface VoiceStat {
  voice: string;
  usage: number;
  percentage: number;
  trend: "up" | "down" | "stable";
}

interface ActivityLog {
  id: string;
  type: "broadcast" | "generation" | "schedule" | "error";
  title: string;
  time: string;
  duration: string;
  status: "success" | "scheduled" | "error";
  createdAt?: string; // 생성시간
  broadcastTime?: string; // 송출시간 (스케줄의 경우)
}

const Analytics = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [timeRange, setTimeRange] = useState("30days");
  const [isLoading, setIsLoading] = useState(true);
  const [generations, setGenerations] = useState<dbService.GenerationEntry[]>([]);
  const [schedules, setSchedules] = useState<dbService.ScheduleRequestEntry[]>([]);

  // 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return;
      
      setIsLoading(true);
      try {
        const [gens, scheds] = await Promise.all([
          dbService.loadGenerations(user.id, 1000),
          dbService.loadScheduleRequests(user.id),
        ]);
        
        setGenerations(gens);
        setSchedules(scheds);
      } catch (error) {
        console.error("데이터 로드 실패:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user?.id, timeRange]);

  // 시간 범위 필터
  const getDateRange = () => {
    const now = new Date();
    const days = timeRange === "7days" ? 7 : 
                 timeRange === "30days" ? 30 : 
                 timeRange === "90days" ? 90 : 365;
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - days);
    return { startDate, endDate: now };
  };

  // 필터링된 데이터
  const filteredData = useMemo(() => {
    const { startDate, endDate } = getDateRange();
    
    const filteredGens = generations.filter(gen => {
      if (!gen.createdAt) return false;
      const genDate = new Date(gen.createdAt);
      return genDate >= startDate && genDate <= endDate;
    });

    const filteredScheds = schedules.filter(sched => {
      if (!sched.scheduledTime) return false;
      const schedDate = new Date(sched.scheduledTime);
      return schedDate >= startDate && schedDate <= endDate;
    });

    return { generations: filteredGens, schedules: filteredScheds };
  }, [generations, schedules, timeRange]);

  // 개요 통계 계산
  const overviewStats = useMemo<OverviewStats>(() => {
    const { schedules: filteredScheds, generations: filteredGens } = filteredData;
    
    // 총 방송 수 (sent 상태)
    const totalBroadcasts = filteredScheds.filter(s => s.status === "sent").length;
    
    // 총 방송 시간 (초 단위) 및 평균
    const totalDurationSeconds = filteredGens.reduce((sum, gen) => sum + (gen.duration || 0), 0);
    const totalDuration = Math.round(totalDurationSeconds / 60); // 분으로 변환
    const averageDuration = filteredGens.length > 0 
      ? Math.round((totalDurationSeconds / filteredGens.length) / 60 * 10) / 10 
      : 0;

    // 성공률 (sent / total)
    const totalScheduled = filteredScheds.length;
    const successRate = totalScheduled > 0 
      ? Math.round((totalBroadcasts / totalScheduled) * 100 * 10) / 10 
      : 0;

    // 이전 기간과 비교하여 성장률 계산 (간단한 추정)
    const monthlyGrowth = 0; // TODO: 실제 비교 로직 구현
    const weeklyGrowth = 0; // TODO: 실제 비교 로직 구현

    return {
      totalBroadcasts,
      totalDuration,
      averageDuration,
      successRate,
      monthlyGrowth,
      weeklyGrowth,
    };
  }, [filteredData]);

  // 화자별 통계 계산
  const voiceStats = useMemo<VoiceStat[]>(() => {
    const { generations: filteredGens } = filteredData;
    
    // 화자별 사용 횟수 계산
    const voiceMap = new Map<string, number>();
    filteredGens.forEach(gen => {
      const voiceNameKo = getVoiceDisplayNameKo(gen.voiceName, gen.voiceId, (gen as any).name_ko);
      voiceMap.set(voiceNameKo, (voiceMap.get(voiceNameKo) || 0) + 1);
    });

    // 배열로 변환 및 정렬
    const voiceArray = Array.from(voiceMap.entries())
      .map(([voice, usage]) => ({
        voice,
        usage,
        percentage: 0, // 아래에서 계산
        trend: "stable" as const,
      }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 10); // 상위 10개만

    // 전체 사용량으로 백분율 계산
    const totalUsage = filteredGens.length;
    if (totalUsage > 0) {
      voiceArray.forEach(stat => {
        stat.percentage = Math.round((stat.usage / totalUsage) * 100 * 10) / 10;
      });
    }

    return voiceArray;
  }, [filteredData]);

  // 시간대별 통계 계산
  const hourlyStats = useMemo(() => {
    const { schedules: filteredScheds } = filteredData;
    const hourlyMap = new Map<number, number>();

    filteredScheds.forEach(sched => {
      if (!sched.scheduledTime) return;
      const date = new Date(sched.scheduledTime);
      const hour = date.getHours();
      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
    });

    // 0-23시까지 모든 시간대 포함
    const stats = Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, '0')}:00`,
      broadcasts: hourlyMap.get(i) || 0,
    }));

    // 방송이 있는 시간대만 필터링하고 정렬
    return stats
      .filter(stat => stat.broadcasts > 0)
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
  }, [filteredData]);

  // 요일별 통계 계산
  const weeklyStats = useMemo(() => {
    const { schedules: filteredScheds } = filteredData;
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
    const dayMap = new Map<number, number>();

    filteredScheds.forEach(sched => {
      if (!sched.scheduledTime) return;
      const date = new Date(sched.scheduledTime);
      const day = date.getDay();
      dayMap.set(day, (dayMap.get(day) || 0) + 1);
    });

    return dayNames.map((day, index) => ({
      day,
      broadcasts: dayMap.get(index) || 0,
    }));
  }, [filteredData]);

  // 활동 로그 생성
  const recentActivities = useMemo<ActivityLog[]>(() => {
    const { generations: filteredGens, schedules: filteredScheds } = filteredData;
    const activities: ActivityLog[] = [];

    // 스케줄 기반 활동
    filteredScheds.slice(0, 50).forEach(sched => {
      const scheduleName = (sched as any).scheduleName || "스케줄";
      const status = sched.status || "scheduled";
      
      let type: ActivityLog["type"] = "broadcast";
      let title = scheduleName;
      
      if (status === "sent") {
        type = "broadcast";
        title = `${scheduleName} 방송 완료`;
      } else if (status === "scheduled") {
        type = "schedule";
        title = `${scheduleName} 스케줄 추가`;
      } else if (status === "failed") {
        type = "error";
        title = `${scheduleName} 방송 실패`;
      }

      const gen = generations.find(g => g.id === sched.generationId);
      const duration = gen?.duration 
        ? `${Math.floor(gen.duration / 60)}:${String(Math.floor(gen.duration % 60)).padStart(2, '0')}`
        : "-";

      activities.push({
        id: sched.id || `sched-${Date.now()}`,
        type,
        title,
        time: sched.scheduledTime || sched.createdAt || new Date().toISOString(),
        duration,
        status: status === "sent" ? "success" : 
                status === "scheduled" || status === "processing" ? "scheduled" : 
                "error",
        createdAt: sched.createdAt || undefined,
        broadcastTime: sched.scheduledTime || undefined,
      });
    });

    // 생성 기반 활동
    filteredGens.slice(0, 30).forEach(gen => {
      const savedName = gen.savedName || gen.purposeLabel || "음원 생성";
      const duration = gen.duration 
        ? `${Math.floor(gen.duration / 60)}:${String(Math.floor(gen.duration % 60)).padStart(2, '0')}`
        : "-";

      activities.push({
        id: gen.id || `gen-${Date.now()}`,
        type: "generation",
        title: `${savedName} 음성 생성`,
        time: gen.createdAt || new Date().toISOString(),
        duration,
        status: gen.status === "ready" && gen.hasAudio !== false ? "success" : "error",
        createdAt: gen.createdAt || undefined,
        broadcastTime: undefined,
      });
    });

    // 시간순 정렬 (최신순)
    return activities
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 50);
  }, [filteredData, generations]);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up": return <TrendingUp className="w-4 h-4 text-green-500" />;
      case "down": return <TrendingDown className="w-4 h-4 text-red-500" />;
      default: return <div className="w-4 h-4 bg-gray-300 rounded-full" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success": return "text-green-500";
      case "scheduled": return "text-blue-500";
      case "error": return "text-red-500";
      default: return "text-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success": return "✓";
      case "scheduled": return "⏰";
      case "error": return "✗";
      default: return "•";
    }
  };

  const handleRefresh = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const [gens, scheds] = await Promise.all([
        dbService.loadGenerations(user.id, 1000),
        dbService.loadScheduleRequests(user.id),
      ]);
      
      setGenerations(gens);
      setSchedules(scheds);
    } catch (error) {
      console.error("데이터 새로고침 실패:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && generations.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold gradient-text">통계 및 분석</h1>
              <p className="text-muted-foreground mt-1">방송 사용량과 성과를 분석하세요</p>
              {user && (
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <BarChart3 className="w-4 h-4" />
                  <span>{user.organization}</span>
                  {user.department && <span>• {user.department}</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7days">최근 7일</SelectItem>
                  <SelectItem value="30days">최근 30일</SelectItem>
                  <SelectItem value="90days">최근 90일</SelectItem>
                  <SelectItem value="1year">최근 1년</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
                <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
                새로고침
              </Button>
              <Button variant="outline" size="sm" disabled>
                <Download className="w-4 h-4 mr-2" />
                내보내기
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">개요</TabsTrigger>
            <TabsTrigger value="voices">화자 분석</TabsTrigger>
            <TabsTrigger value="usage">사용량 분석</TabsTrigger>
            <TabsTrigger value="activity">활동 로그</TabsTrigger>
          </TabsList>

          {/* 개요 (FHD/WFHD 최적화) */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* 주요 지표 (4-6 컬럼) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">총 방송 수</p>
                      <p className="text-2xl font-bold">{overviewStats.totalBroadcasts}</p>
                      {overviewStats.monthlyGrowth > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <TrendingUp className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-green-500">+{overviewStats.monthlyGrowth}%</span>
                        </div>
                      )}
                    </div>
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-lg flex items-center justify-center">
                      <Volume2 className="w-6 h-6 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">총 방송 시간</p>
                      <p className="text-2xl font-bold">{overviewStats.totalDuration}분</p>
                      {overviewStats.weeklyGrowth > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <TrendingUp className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-green-500">+{overviewStats.weeklyGrowth}%</span>
                        </div>
                      )}
                    </div>
                    <div className="w-12 h-12 bg-green-50 dark:bg-green-500/10 rounded-lg flex items-center justify-center">
                      <Clock className="w-6 h-6 text-green-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">평균 방송 시간</p>
                      <p className="text-2xl font-bold">{overviewStats.averageDuration}분</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-50 dark:bg-purple-500/10 rounded-lg flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">성공률</p>
                      <p className="text-2xl font-bold">{overviewStats.successRate}%</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-50 dark:bg-orange-500/10 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-orange-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 시간대별 사용량 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    시간대별 방송 수
                  </CardTitle>
                  <CardDescription>
                    시간대별 방송 사용량을 확인하세요
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {hourlyStats.length > 0 ? (
                    <div className="space-y-3">
                      {hourlyStats.map((stat) => {
                        const maxBroadcasts = Math.max(...hourlyStats.map(s => s.broadcasts));
                        return (
                          <div key={stat.hour} className="flex items-center gap-3">
                            <div className="w-16 text-sm text-muted-foreground">{stat.hour}</div>
                            <div className="flex-1">
                              <Progress value={(stat.broadcasts / maxBroadcasts) * 100} className="h-2" />
                            </div>
                            <div className="w-8 text-sm font-medium">{stat.broadcasts}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      시간대별 데이터가 없습니다
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    요일별 방송 수
                  </CardTitle>
                  <CardDescription>
                    요일별 방송 사용량을 확인하세요
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {weeklyStats.some(s => s.broadcasts > 0) ? (
                    <div className="space-y-3">
                      {weeklyStats.map((stat) => {
                        const maxBroadcasts = Math.max(...weeklyStats.map(s => s.broadcasts));
                        return (
                          <div key={stat.day} className="flex items-center gap-3">
                            <div className="w-8 text-sm text-muted-foreground">{stat.day}</div>
                            <div className="flex-1">
                              <Progress value={maxBroadcasts > 0 ? (stat.broadcasts / maxBroadcasts) * 100 : 0} className="h-2" />
                            </div>
                            <div className="w-8 text-sm font-medium">{stat.broadcasts}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      요일별 데이터가 없습니다
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 화자 분석 */}
          <TabsContent value="voices" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  화자별 사용 통계
                </CardTitle>
                <CardDescription>
                  각 화자의 사용량과 트렌드를 분석하세요
                </CardDescription>
              </CardHeader>
              <CardContent>
                {voiceStats.length > 0 ? (
                  <div className="space-y-4">
                    {voiceStats.map((stat) => (
                      <div key={stat.voice} className="flex items-center gap-4 p-4 border rounded-lg">
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Volume2 className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium">{stat.voice}</h3>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="text-sm text-muted-foreground">{stat.usage}회 사용</span>
                            <span className="text-sm text-muted-foreground">{stat.percentage}%</span>
                            <div className="flex items-center gap-1">
                              {getTrendIcon(stat.trend)}
                              <span className="text-sm text-muted-foreground">
                                {stat.trend === 'up' ? '증가' : stat.trend === 'down' ? '감소' : '안정'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="w-32">
                          <Progress value={stat.percentage} className="h-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    화자 사용 데이터가 없습니다
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 사용량 분석 */}
          <TabsContent value="usage" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    월간 사용량 트렌드
                  </CardTitle>
                  <CardDescription>
                    최근 6개월간의 사용량 변화를 확인하세요
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>차트 데이터 준비 중...</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    사용량 요약
                  </CardTitle>
                  <CardDescription>
                    현재 기간 사용량 통계입니다
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
                      <h4 className="font-medium text-blue-900 dark:text-blue-100">총 생성 횟수</h4>
                      <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">{filteredData.generations.length}회</p>
                    </div>
                    <div className="p-4 bg-green-50 dark:bg-green-500/10 rounded-lg">
                      <h4 className="font-medium text-green-900 dark:text-green-100">총 스케줄 수</h4>
                      <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">{filteredData.schedules.length}회</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 활동 로그 */}
          <TabsContent value="activity" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  최근 활동
                </CardTitle>
                <CardDescription>
                  최근 시스템 활동 내역을 확인하세요
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentActivities.length > 0 ? (
                  <div className="space-y-2">
                    {recentActivities.map((activity) => (
                      <div key={activity.id} className="flex items-center gap-2 p-2 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className={cn(
                            "text-xs font-medium",
                            activity.status === 'success' ? 'text-green-600' :
                            activity.status === 'scheduled' ? 'text-blue-600' :
                            'text-red-600'
                          )}>
                            {getStatusIcon(activity.status)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-xs font-medium truncate">{activity.title}</h4>
                            <Badge 
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0 h-4",
                                activity.status === 'success' 
                                  ? 'bg-green-500/10 text-green-600 border-green-500/20' 
                                  : activity.status === 'scheduled'
                                  ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                  : 'bg-red-500/10 text-red-600 border-red-500/20'
                              )}
                            >
                              {activity.status === 'success' ? '성공' :
                               activity.status === 'scheduled' ? '예정' : '실패'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            {activity.type === 'generation' ? (
                              <>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  생성: {activity.createdAt ? formatDateTime(activity.createdAt) : '-'}
                                </span>
                                {activity.duration && activity.duration !== '-' && (
                                  <span>재생: {activity.duration}</span>
                                )}
                              </>
                            ) : (
                              <>
                                {activity.createdAt && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    생성: {formatDateTime(activity.createdAt)}
                                  </span>
                                )}
                                {activity.broadcastTime && (
                                  <span className="flex items-center gap-1">
                                    <Radio className="w-3 h-3" />
                                    송출: {formatDateTime(activity.broadcastTime)}
                                  </span>
                                )}
                                {activity.duration && activity.duration !== '-' && (
                                  <span>재생: {activity.duration}</span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    활동 로그가 없습니다
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export default Analytics;
