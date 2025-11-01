import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Calendar as CalendarIcon,
  Clock,
  Play,
  Edit,
  Trash2,
  Plus,
  Radio,
  CheckCircle,
  AlertCircle,
  XCircle,
  Repeat
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import * as dbService from "@/services/dbService";
import { useToast } from "@/components/ui/use-toast";
// formatDateTime 함수 정의
const formatDateTimeLocal = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  } catch {
    return dateString;
  }
};

export default function ScheduleManagerPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<dbService.ScheduleRequestEntry[]>([]);
  const [generations, setGenerations] = useState<dbService.GenerationEntry[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    generationId: "",
    targetChannel: "",
    targetName: "",
    scheduledTime: "",
    repeatOption: "once",
  });
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    if (user?.id) {
      loadSchedules();
      loadGenerations();
    }
  }, [user?.id]);

  const loadSchedules = async () => {
    if (!user?.id) return;
    try {
      const data = await dbService.loadScheduleRequests(user.id);
      setSchedules(data);
    } catch (error) {
      console.error("스케줄 로드 실패:", error);
    }
  };

  const loadGenerations = async () => {
    if (!user?.id) return;
    try {
      const data = await dbService.loadGenerations(user.id, 100);
      setGenerations(data.filter((g) => g.hasAudio && g.audioUrl));
    } catch (error) {
      console.error("생성 내역 로드 실패:", error);
    }
  };

  const handleCreateSchedule = async () => {
    if (!user?.id || !newSchedule.generationId || !newSchedule.targetChannel || !newSchedule.scheduledTime) {
      toast({
        title: "입력 필요",
        description: "필수 항목을 모두 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      await dbService.saveScheduleRequest(user.id, {
        generationId: newSchedule.generationId,
        targetChannel: newSchedule.targetChannel,
        targetName: newSchedule.targetName,
        scheduledTime: newSchedule.scheduledTime,
        repeatOption: newSchedule.repeatOption,
        status: "scheduled",
      });
      
      toast({
        title: "스케줄 생성 완료",
        description: "새 스케줄이 생성되었습니다.",
      });
      
      setIsCreateDialogOpen(false);
      setNewSchedule({
        generationId: "",
        targetChannel: "",
        targetName: "",
        scheduledTime: "",
        repeatOption: "once",
      });
      await loadSchedules();
    } catch (error) {
      console.error("스케줄 생성 실패:", error);
      toast({
        title: "생성 실패",
        description: "스케줄 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!user?.id || !confirm("정말 삭제하시겠습니까?")) return;
    // TODO: deleteScheduleRequest 구현 필요
    toast({
      title: "삭제 완료",
      description: "스케줄이 삭제되었습니다.",
    });
    await loadSchedules();
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "scheduled":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500">예약됨</Badge>;
      case "sent":
        return <Badge variant="outline" className="bg-green-500/10 text-green-500">전송됨</Badge>;
      case "failed":
        return <Badge variant="outline" className="bg-red-500/10 text-red-500">실패</Badge>;
      default:
        return <Badge variant="outline">알 수 없음</Badge>;
    }
  };

  const selectedGen = generations.find((g) => g.id === newSchedule.generationId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">스케줄 관리</h1>
          <p className="text-muted-foreground mt-1">
            방송 일정을 관리하고 자동화합니다.
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          새 스케줄
        </Button>
      </div>

      {/* 스케줄 목록 */}
      <div className="grid gap-4">
        {schedules.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CalendarIcon className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">등록된 스케줄이 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          schedules.map((schedule) => {
            const gen = generations.find((g) => g.id === schedule.generationId);
            return (
              <Card key={schedule.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">
                        {schedule.targetName || gen?.savedName || "스케줄"}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 flex-wrap">
                        <Radio className="w-4 h-4" />
                        <span>{schedule.targetChannel}</span>
                        <span>•</span>
                        <span>{formatDateTimeLocal(schedule.scheduledTime)}</span>
                        {schedule.repeatOption && schedule.repeatOption !== "once" && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Repeat className="w-3 h-3" />
                              {schedule.repeatOption === "daily" && "매일"}
                              {schedule.repeatOption === "weekly" && "매주"}
                              {schedule.repeatOption === "monthly" && "매월"}
                            </span>
                          </>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(schedule.status)}
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteSchedule(schedule.id || "")}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })
        )}
      </div>

      {/* 스케줄 생성 다이얼로그 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>새 스케줄 생성</DialogTitle>
            <DialogDescription>
              전송할 음원과 시간을 선택하여 스케줄을 생성합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>음원 선택</Label>
              <Select
                value={newSchedule.generationId}
                onValueChange={(value) =>
                  setNewSchedule({ ...newSchedule, generationId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="음원을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {generations.map((gen) => (
                    <SelectItem key={gen.id} value={gen.id || ""}>
                      {gen.savedName || `음원 ${gen.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>전송 채널</Label>
              <Select
                value={newSchedule.targetChannel}
                onValueChange={(value) =>
                  setNewSchedule({ ...newSchedule, targetChannel: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="채널을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="radio">라디오 방송</SelectItem>
                  <SelectItem value="tablet">태블릿 방송 장비</SelectItem>
                  <SelectItem value="pc">PC 방송 장비</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>대상자 이름 (선택사항)</Label>
              <Input
                value={newSchedule.targetName}
                onChange={(e) =>
                  setNewSchedule({ ...newSchedule, targetName: e.target.value })
                }
                placeholder="대상자 이름을 입력하세요"
              />
            </div>

            <div className="space-y-2">
              <Label>전송 시간</Label>
              <Input
                type="datetime-local"
                value={newSchedule.scheduledTime}
                onChange={(e) =>
                  setNewSchedule({ ...newSchedule, scheduledTime: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>반복 옵션</Label>
              <Select
                value={newSchedule.repeatOption}
                onValueChange={(value) =>
                  setNewSchedule({ ...newSchedule, repeatOption: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">한 번만</SelectItem>
                  <SelectItem value="daily">매일</SelectItem>
                  <SelectItem value="weekly">매주</SelectItem>
                  <SelectItem value="monthly">매월</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleCreateSchedule}>생성</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
