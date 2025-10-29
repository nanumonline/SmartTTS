import { useState } from "react";
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
  RefreshCw
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Analytics = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [timeRange, setTimeRange] = useState("30days");

  // 통계 데이터
  const overviewStats = {
    totalBroadcasts: 156,
    totalDuration: 1240, // 분
    averageDuration: 7.9, // 분
    successRate: 98.5,
    monthlyGrowth: 12.3,
    weeklyGrowth: 2.1
  };

  // 화자별 사용 통계
  const voiceStats = [
    { voice: "앵커 스타일 남성 1", usage: 45, percentage: 28.8, trend: "up" },
    { voice: "아나운서 스타일 여성 1", usage: 38, percentage: 24.4, trend: "up" },
    { voice: "전문가 스타일 남성 1", usage: 28, percentage: 17.9, trend: "down" },
    { voice: "친근한 여성 1", usage: 25, percentage: 16.0, trend: "up" },
    { voice: "기상 아나운서 스타일", usage: 20, percentage: 12.8, trend: "stable" }
  ];

  // 시간대별 사용 통계
  const hourlyStats = [
    { hour: "09:00", broadcasts: 12 },
    { hour: "10:00", broadcasts: 18 },
    { hour: "11:00", broadcasts: 15 },
    { hour: "12:00", broadcasts: 8 },
    { hour: "13:00", broadcasts: 6 },
    { hour: "14:00", broadcasts: 22 },
    { hour: "15:00", broadcasts: 19 },
    { hour: "16:00", broadcasts: 16 },
    { hour: "17:00", broadcasts: 10 },
    { hour: "18:00", broadcasts: 5 }
  ];

  // 요일별 사용 통계
  const weeklyStats = [
    { day: "월", broadcasts: 25 },
    { day: "화", broadcasts: 28 },
    { day: "수", broadcasts: 22 },
    { day: "목", broadcasts: 30 },
    { day: "금", broadcasts: 26 },
    { day: "토", broadcasts: 8 },
    { day: "일", broadcasts: 5 }
  ];

  // 최근 활동
  const recentActivities = [
    {
      id: 1,
      type: "broadcast",
      title: "신년 인사말 방송 완료",
      time: "2024-01-15 10:00",
      duration: "2:34",
      status: "success"
    },
    {
      id: 2,
      type: "generation",
      title: "긴급 안내방송 음성 생성",
      time: "2024-01-15 08:15",
      duration: "1:45",
      status: "success"
    },
    {
      id: 3,
      type: "schedule",
      title: "월간 정책 브리핑 스케줄 추가",
      time: "2024-01-14 16:20",
      duration: "3:12",
      status: "scheduled"
    },
    {
      id: 4,
      type: "error",
      title: "방송 연결 실패",
      time: "2024-01-14 14:30",
      duration: "0:00",
      status: "error"
    }
  ];

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
              <Button variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                새로고침
              </Button>
              <Button variant="outline" size="sm">
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

          {/* 개요 */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* 주요 지표 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">총 방송 수</p>
                      <p className="text-2xl font-bold">{overviewStats.totalBroadcasts}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-500">+{overviewStats.monthlyGrowth}%</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
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
                      <div className="flex items-center gap-1 mt-1">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-500">+{overviewStats.weeklyGrowth}%</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
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
                      <div className="flex items-center gap-1 mt-1">
                        <TrendingDown className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-red-500">-0.5분</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
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
                      <div className="flex items-center gap-1 mt-1">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-500">+1.2%</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center">
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
                  <div className="space-y-3">
                    {hourlyStats.map((stat) => (
                      <div key={stat.hour} className="flex items-center gap-3">
                        <div className="w-16 text-sm text-muted-foreground">{stat.hour}</div>
                        <div className="flex-1">
                          <Progress value={(stat.broadcasts / 22) * 100} className="h-2" />
                        </div>
                        <div className="w-8 text-sm font-medium">{stat.broadcasts}</div>
                      </div>
                    ))}
                  </div>
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
                  <div className="space-y-3">
                    {weeklyStats.map((stat) => (
                      <div key={stat.day} className="flex items-center gap-3">
                        <div className="w-8 text-sm text-muted-foreground">{stat.day}</div>
                        <div className="flex-1">
                          <Progress value={(stat.broadcasts / 30) * 100} className="h-2" />
                        </div>
                        <div className="w-8 text-sm font-medium">{stat.broadcasts}</div>
                      </div>
                    ))}
                  </div>
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
                    사용량 예측
                  </CardTitle>
                  <CardDescription>
                    AI 기반 사용량 예측 결과입니다
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-900">다음 달 예상 사용량</h4>
                      <p className="text-2xl font-bold text-blue-900 mt-1">180회</p>
                      <p className="text-sm text-blue-700">현재 대비 +15% 증가 예상</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-medium text-green-900">권장 사용량</h4>
                      <p className="text-2xl font-bold text-green-900 mt-1">150회</p>
                      <p className="text-sm text-green-700">최적의 성능을 위한 권장량</p>
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
                <div className="space-y-3">
                  {recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                        <span className="text-sm font-medium">{getStatusIcon(activity.status)}</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium">{activity.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {activity.time} • {activity.duration}
                        </p>
                      </div>
                      <Badge variant={
                        activity.status === 'success' ? 'default' :
                        activity.status === 'scheduled' ? 'secondary' :
                        'destructive'
                      }>
                        {activity.status === 'success' ? '성공' :
                         activity.status === 'scheduled' ? '예정' : '오류'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Analytics;
