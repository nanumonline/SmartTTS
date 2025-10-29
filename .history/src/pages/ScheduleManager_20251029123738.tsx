import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import HomeButton from "@/components/HomeButton";
import { 
  Calendar as CalendarIcon,
  Clock,
  Play,
  Pause,
  Edit,
  Trash2,
  Plus,
  Radio,
  Volume2,
  Settings,
  CheckCircle,
  AlertCircle,
  XCircle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const ScheduleManager = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("schedule");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isCreating, setIsCreating] = useState(false);

  // 스케줄 데이터
  const schedules = [
    {
      id: 1,
      title: "신년 인사말",
      description: "도지사 신년 인사말 방송",
      voice: "앵커 스타일 남성 1",
      scheduledTime: "2024-01-20 10:00",
      duration: "2:34",
      status: "scheduled",
      repeatType: "once",
      audioUrl: "#"
    },
    {
      id: 2,
      title: "월간 정책 브리핑",
      description: "월간 주요 정책 브리핑",
      voice: "아나운서 스타일 여성 1",
      scheduledTime: "2024-01-22 14:00",
      duration: "3:12",
      status: "scheduled",
      repeatType: "monthly",
      audioUrl: "#"
    },
    {
      id: 3,
      title: "긴급 안내방송",
      description: "비상상황 시 긴급 안내",
      voice: "친근한 여성 1",
      scheduledTime: "2024-01-25 09:00",
      duration: "1:45",
      status: "draft",
      repeatType: "once",
      audioUrl: "#"
    }
  ];

  // 새 스케줄 생성 폼 상태
  const [newSchedule, setNewSchedule] = useState({
    title: "",
    description: "",
    voice: "",
    scheduledTime: "",
    repeatType: "once",
    audioFile: null as File | null
  });

  const handleCreateSchedule = () => {
    if (!newSchedule.title || !newSchedule.voice || !newSchedule.scheduledTime) {
      alert("필수 항목을 모두 입력해주세요.");
      return;
    }

    // 실제로는 API 호출
    console.log("새 스케줄 생성:", newSchedule);
    
    // 폼 초기화
    setNewSchedule({
      title: "",
      description: "",
      voice: "",
      scheduledTime: "",
      repeatType: "once",
      audioFile: null
    });
    setIsCreating(false);
  };

  const handleEditSchedule = (scheduleId: number) => {
    console.log("스케줄 편집:", scheduleId);
  };

  const handleDeleteSchedule = (scheduleId: number) => {
    if (confirm("정말로 이 스케줄을 삭제하시겠습니까?")) {
      console.log("스케줄 삭제:", scheduleId);
    }
  };

  const handlePlaySchedule = (scheduleId: number) => {
    console.log("스케줄 재생:", scheduleId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled": return "text-blue-500";
      case "active": return "text-green-500";
      case "completed": return "text-gray-500";
      case "draft": return "text-yellow-500";
      case "cancelled": return "text-red-500";
      default: return "text-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "scheduled": return <Clock className="w-4 h-4 text-blue-500" />;
      case "active": return <Play className="w-4 h-4 text-green-500" />;
      case "completed": return <CheckCircle className="w-4 h-4 text-gray-500" />;
      case "draft": return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case "cancelled": return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold gradient-text">스케줄 관리</h1>
              <p className="text-muted-foreground mt-1">방송 일정을 관리하고 자동화하세요</p>
              {user && (
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarIcon className="w-4 h-4" />
                  <span>{user.organization}</span>
                  {user.department && <span>• {user.department}</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <HomeButton />
              <Badge variant="outline" className="px-3 py-1">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                자동화 활성
              </Badge>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="w-4 h-4 mr-2" />
                새 스케줄
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="schedule">스케줄 목록</TabsTrigger>
            <TabsTrigger value="calendar">달력 보기</TabsTrigger>
            <TabsTrigger value="settings">설정</TabsTrigger>
          </TabsList>

          {/* 스케줄 목록 */}
          <TabsContent value="schedule" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 스케줄 목록 */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Radio className="w-5 h-5" />
                      방송 스케줄
                    </CardTitle>
                    <CardDescription>
                      예정된 방송 일정을 관리하세요
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {schedules.map((schedule) => (
                        <Card key={schedule.id} className="border-l-4 border-l-primary/20">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                  <Volume2 className="w-5 h-5 text-primary" />
                                </div>
                                <div className="flex-1">
                                  <h3 className="font-medium">{schedule.title}</h3>
                                  <p className="text-sm text-muted-foreground">{schedule.description}</p>
                                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                    <span>{schedule.voice}</span>
                                    <span>{schedule.scheduledTime}</span>
                                    <span>{schedule.duration}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {schedule.repeatType === 'once' ? '일회성' : 
                                       schedule.repeatType === 'daily' ? '매일' :
                                       schedule.repeatType === 'weekly' ? '매주' : '매월'}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  {getStatusIcon(schedule.status)}
                                  <span className={`text-sm ${getStatusColor(schedule.status)}`}>
                                    {schedule.status === 'scheduled' ? '예정' :
                                     schedule.status === 'active' ? '활성' :
                                     schedule.status === 'completed' ? '완료' :
                                     schedule.status === 'draft' ? '초안' : '취소'}
                                  </span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handlePlaySchedule(schedule.id)}
                                >
                                  <Play className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditSchedule(schedule.id)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteSchedule(schedule.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 새 스케줄 생성 */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="w-5 h-5" />
                      새 스케줄 생성
                    </CardTitle>
                    <CardDescription>
                      새로운 방송 일정을 추가하세요
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">제목 *</Label>
                      <Input
                        id="title"
                        placeholder="방송 제목을 입력하세요"
                        value={newSchedule.title}
                        onChange={(e) => setNewSchedule(prev => ({ ...prev, title: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">설명</Label>
                      <Textarea
                        id="description"
                        placeholder="방송 내용 설명"
                        value={newSchedule.description}
                        onChange={(e) => setNewSchedule(prev => ({ ...prev, description: e.target.value }))}
                        className="min-h-20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="voice">화자 *</Label>
                      <Select value={newSchedule.voice} onValueChange={(value) => setNewSchedule(prev => ({ ...prev, voice: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="화자를 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male_anchor_1">앵커 스타일 남성 1</SelectItem>
                          <SelectItem value="female_anchor_1">아나운서 스타일 여성 1</SelectItem>
                          <SelectItem value="male_expert_1">전문가 스타일 남성 1</SelectItem>
                          <SelectItem value="female_guide_1">친근한 여성 1</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="scheduledTime">방송 시간 *</Label>
                      <Input
                        id="scheduledTime"
                        type="datetime-local"
                        value={newSchedule.scheduledTime}
                        onChange={(e) => setNewSchedule(prev => ({ ...prev, scheduledTime: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="repeatType">반복 설정</Label>
                      <Select value={newSchedule.repeatType} onValueChange={(value) => setNewSchedule(prev => ({ ...prev, repeatType: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="once">일회성</SelectItem>
                          <SelectItem value="daily">매일</SelectItem>
                          <SelectItem value="weekly">매주</SelectItem>
                          <SelectItem value="monthly">매월</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button 
                      onClick={handleCreateSchedule}
                      className="w-full"
                      variant="gradient"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      스케줄 생성
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* 달력 보기 */}
          <TabsContent value="calendar" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5" />
                      방송 일정 달력
                    </CardTitle>
                    <CardDescription>
                      달력에서 방송 일정을 확인하세요
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      className="rounded-md border"
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle>선택된 날짜 일정</CardTitle>
                    <CardDescription>
                      {selectedDate?.toLocaleDateString('ko-KR')} 일정
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {schedules
                        .filter(schedule => schedule.scheduledTime.startsWith(selectedDate?.toISOString().split('T')[0] || ''))
                        .map((schedule) => (
                          <div key={schedule.id} className="p-3 border rounded-lg">
                            <h4 className="font-medium">{schedule.title}</h4>
                            <p className="text-sm text-muted-foreground">{schedule.scheduledTime}</p>
                            <Badge variant="outline" className="mt-1">
                              {schedule.voice}
                            </Badge>
                          </div>
                        ))}
                      {schedules.filter(schedule => schedule.scheduledTime.startsWith(selectedDate?.toISOString().split('T')[0] || '')).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          선택된 날짜에 예정된 방송이 없습니다.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* 설정 */}
          <TabsContent value="settings" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  스케줄 설정
                </CardTitle>
                <CardDescription>
                  방송 스케줄 관련 설정을 관리하세요
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>자동 방송 활성화</Label>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" defaultChecked className="rounded" />
                      <span className="text-sm text-muted-foreground">
                        예정된 시간에 자동으로 방송을 시작합니다
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>방송 전 알림</Label>
                    <Select defaultValue="5">
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5분 전</SelectItem>
                        <SelectItem value="10">10분 전</SelectItem>
                        <SelectItem value="15">15분 전</SelectItem>
                        <SelectItem value="30">30분 전</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>방송 실패 시 재시도</Label>
                    <Select defaultValue="3">
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1회</SelectItem>
                        <SelectItem value="3">3회</SelectItem>
                        <SelectItem value="5">5회</SelectItem>
                        <SelectItem value="0">재시도 안함</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button className="w-full">
                  설정 저장
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ScheduleManager;
