import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import HomeButton from "@/components/HomeButton";
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
  Eye
} from "lucide-react";

const Dashboard = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [recentGenerations, setRecentGenerations] = useState([]);
  const [scheduledBroadcasts, setScheduledBroadcasts] = useState([]);
  const { user } = useAuth();

  // 실제 통계 데이터
  const stats = {
    totalBroadcasts: 156,
    activeBroadcasts: 12,
    totalDuration: "24시간 30분",
    successRate: 98.5,
    monthlyUsage: 89 // 퍼센트
  };

  // 최근 생성된 음성 목록
  const recentVoices = [
    {
      id: 1,
      title: "신년 인사말",
      voice: "앵커 스타일 남성 1",
      duration: "2:34",
      createdAt: "2024-01-15 09:30",
      status: "completed",
      downloadUrl: "#"
    },
    {
      id: 2,
      title: "긴급 안내방송",
      voice: "아나운서 스타일 여성 1",
      duration: "1:45",
      createdAt: "2024-01-15 08:15",
      status: "completed",
      downloadUrl: "#"
    },
    {
      id: 3,
      title: "정책 발표",
      voice: "전문가 스타일 남성 1",
      duration: "3:12",
      createdAt: "2024-01-14 16:20",
      status: "processing",
      downloadUrl: "#"
    }
  ];

  // 예정된 방송 목록
  const upcomingBroadcasts = [
    {
      id: 1,
      title: "월간 정책 브리핑",
      scheduledTime: "2024-01-20 10:00",
      status: "scheduled",
      voice: "앵커 스타일 남성 1"
    },
    {
      id: 2,
      title: "지역 축제 안내",
      scheduledTime: "2024-01-22 14:00",
      status: "scheduled",
      voice: "친근한 여성 1"
    },
    {
      id: 3,
      title: "공공서비스 안내",
      scheduledTime: "2024-01-25 09:00",
      status: "draft",
      voice: "아나운서 스타일 여성 1"
    }
  ];

  const handlePlayVoice = (voiceId: number) => {
    setIsPlaying(!isPlaying);
    // 실제 오디오 재생 로직
  };

  const handleDownloadVoice = (voiceId: number) => {
    // 실제 다운로드 로직
    console.log("다운로드:", voiceId);
  };

  const handleCreateNewVoice = () => {
    // 음성 생성 페이지로 이동
    window.location.href = "/voice-generator";
  };

  const recentBroadcasts = [
    {
      id: 1,
      title: "오늘의 날씨 안내",
      status: "active",
      duration: "2분 30초",
      nextRun: "14:30",
      voice: "여성 1"
    },
    {
      id: 2,
      title: "점심시간 안내",
      status: "scheduled",
      duration: "1분 45초",
      nextRun: "12:00",
      voice: "남성 1"
    },
    {
      id: 3,
      title: "마감 안내",
      status: "completed",
      duration: "1분 20초",
      nextRun: "완료",
      voice: "여성 2"
    }
  ];

  const quickActions = [
    {
      title: "음성 생성",
      description: "새로운 방송 음성을 생성합니다",
      icon: Mic2,
      color: "text-blue-500",
      bgColor: "bg-blue-50",
      href: "/voice-generator"
    },
    {
      title: "스케줄 관리",
      description: "방송 스케줄을 관리합니다",
      icon: Calendar,
      color: "text-green-500",
      bgColor: "bg-green-50",
      href: "/schedule"
    },
    {
      title: "통계 보기",
      description: "방송 통계를 확인합니다",
      icon: BarChart3,
      color: "text-purple-500",
      bgColor: "bg-purple-50",
      href: "/analytics"
    },
    {
      title: "설정",
      description: "계정 및 서비스 설정",
      icon: Settings,
      color: "text-gray-500",
      bgColor: "bg-gray-50",
      href: "/settings"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold gradient-text">대시보드</h1>
              <p className="text-muted-foreground mt-1">AI 음성 방송 시스템 관리</p>
              {user && (
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="w-4 h-4" />
                  <span>{user.organization}</span>
                  {user.department && <span>• {user.department}</span>}
                  {user.position && <span>• {user.position}</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="px-3 py-1">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                서비스 정상
              </Badge>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                설정
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-1">
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
                <Button
                  variant="gradient"
                  className="w-full justify-start h-auto p-4"
                  onClick={handleCreateNewVoice}
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mr-3">
                    <Plus className="w-5 h-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">새 음성 생성</p>
                    <p className="text-sm text-primary-foreground/80">지금 바로 음성을 생성하세요</p>
                  </div>
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto p-4"
                  onClick={() => window.location.href = "/voice-cloning"}
                >
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mr-3">
                    <Users className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">보이스 클로닝</p>
                    <p className="text-sm text-muted-foreground">커스텀 화자 생성</p>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start h-auto p-4"
                  onClick={() => window.location.href = "/schedule"}
                >
                  <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center mr-3">
                    <Calendar className="w-5 h-5 text-green-500" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">스케줄 관리</p>
                    <p className="text-sm text-muted-foreground">방송 일정 관리</p>
                  </div>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Broadcasts */}
          <div className="lg:col-span-2">
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
                  <Button variant="outline" className="w-full">
                    모든 방송 보기
                  </Button>
                </div>
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
                    <span>120시간 / 200시간</span>
                  </div>
                  <Progress value={60} className="h-2" />
                  <p className="text-xs text-muted-foreground">60% 사용</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>음성 생성 횟수</span>
                    <span>45회 / 100회</span>
                  </div>
                  <Progress value={45} className="h-2" />
                  <p className="text-xs text-muted-foreground">45% 사용</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>스토리지 사용량</span>
                    <span>2.5GB / 10GB</span>
                  </div>
                  <Progress value={25} className="h-2" />
                  <p className="text-xs text-muted-foreground">25% 사용</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
