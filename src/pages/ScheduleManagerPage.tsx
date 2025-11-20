import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
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
  Repeat,
  Music2,
  Search,
  Star,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";
import * as dbService from "@/services/dbService";
import { useToast } from "@/components/ui/use-toast";
import { formatDateTime, purposeOptions, localTimeToISOString, isoToLocalDateTimeString, localDateTimeStringToISO } from "@/lib/pageUtils";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";
import AudioPlayer from "@/components/AudioPlayer";
import { ScrollArea } from "@/components/ui/scroll-area";

// 카테고리별 색상 매핑
const getPurposeColor = (purposeId: string): string => {
  const colorMap: Record<string, string> = {
    announcement: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30",
    emergency: "bg-red-500/10 text-red-600 border-red-500/20 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30",
    greeting: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30",
    policy: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/30",
    event: "bg-pink-500/10 text-pink-600 border-pink-500/20 dark:bg-pink-500/20 dark:text-pink-400 dark:border-pink-500/30",
    promotion: "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30",
    service: "bg-green-500/10 text-green-600 border-green-500/20 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30",
    welfare: "bg-teal-500/10 text-teal-600 border-teal-500/20 dark:bg-teal-500/20 dark:text-teal-400 dark:border-teal-500/30",
    traffic: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30",
    mixed: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20 dark:bg-fuchsia-500/20 dark:text-fuchsia-400 dark:border-fuchsia-500/30",
  };
  return colorMap[purposeId] || "bg-gray-500/10 text-gray-600 border-gray-500/20 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/30";
};

export default function ScheduleManagerPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [schedules, setSchedules] = useState<dbService.ScheduleRequestEntry[]>([]);
  const [generations, setGenerations] = useState<dbService.GenerationEntry[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<dbService.ScheduleRequestEntry | null>(null);
  const [newSchedule, setNewSchedule] = useState({
    scheduleName: "",
    generationId: "",
    targetChannel: "",
    scheduledTime: "",
    startDate: "",
    endDate: "",
    timesPerDay: 1,
    repeatOption: "once",
    scheduleType: "routine" as "routine" | "event", // routine: 일상 방송, event: 기간 방송
  });
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [audioSearchQuery, setAudioSearchQuery] = useState("");
  const [selectedAudioPreviewId, setSelectedAudioPreviewId] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [loadingPreviewIds, setLoadingPreviewIds] = useState<Set<string>>(new Set());
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState<"name" | "type" | "channel" | "time" | "repeat" | "status" | "none">("time");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // 스케줄 타입 판별 함수 (useMemo보다 앞에 정의)
  const getScheduleType = (schedule: dbService.ScheduleRequestEntry): "routine" | "event" => {
    // DB에서 로드된 scheduleType 사용
    if ((schedule as any).scheduleType) {
      const type = (schedule as any).scheduleType;
      if (type === "event" || type === "routine") {
        return type;
      }
    }
    // scheduleType이 없으면 기본값은 routine
    return "routine";
  };

  // 정렬된 스케줄 목록 (useMemo로 최적화)
  const sortedSchedules = useMemo(() => {
    if (sortBy === "none") return schedules;

    return [...schedules].sort((a, b) => {
      const genA = generations.find((g) => g.id === a.generationId);
      const genB = generations.find((g) => g.id === b.generationId);
      const scheduleTypeA = getScheduleType(a);
      const scheduleTypeB = getScheduleType(b);
      const scheduleNameA = (a as any).scheduleName || a.targetName || genA?.savedName || "스케줄";
      const scheduleNameB = (b as any).scheduleName || b.targetName || genB?.savedName || "스케줄";

      let comparison = 0;

      switch (sortBy) {
        case "name":
          comparison = scheduleNameA.localeCompare(scheduleNameB, "ko");
          break;
        case "type":
          comparison = scheduleTypeA.localeCompare(scheduleTypeB);
          break;
        case "channel":
          comparison = (a.targetChannel || "").localeCompare(b.targetChannel || "", "ko");
          break;
        case "time":
          comparison = new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime();
          break;
        case "repeat":
          const repeatA = a.repeatOption || "once";
          const repeatB = b.repeatOption || "once";
          comparison = repeatA.localeCompare(repeatB, "ko");
          break;
        case "status":
          comparison = (a.status || "").localeCompare(b.status || "", "ko");
          break;
        default:
          return 0;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [schedules, generations, sortBy, sortOrder]);

  // 페이지네이션된 스케줄 목록
  const paginatedSchedules = useMemo(() => {
    return sortedSchedules.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [sortedSchedules, currentPage, itemsPerPage]);

  useEffect(() => {
    if (user?.id) {
      loadSchedules();
      loadGenerations();
      loadChannels(); // async 함수로 변경되었으므로 await 없이 호출
    }
  }, [user?.id]);

  // 스케줄 목록 자동 새로고침 (30초마다)
  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(() => {
      loadSchedules();
    }, 30000); // 30초마다 새로고침

    return () => clearInterval(interval);
  }, [user?.id]);

  const loadChannels = async () => {
    if (!user?.id) return;
    try {
      // DB에서 실제 채널 목록 로드
      const data = await dbService.loadChannels(user.id);
      // 활성화된 채널만 필터링
      setChannels(data.filter((ch: any) => ch.enabled !== false));
    } catch (error) {
      console.error("채널 목록 로드 실패:", error);
      // 에러 발생 시 빈 배열로 설정
      setChannels([]);
    }
  };

  // 음원 복원 함수 (AudioHistoryPage와 동일한 로직)
  const ensureGenerationAudio = useCallback(
    async (gen: dbService.GenerationEntry, options: { forceReload?: boolean } = {}) => {
      if (!gen?.id || !user?.id) return null;
      const idStr = String(gen.id);
      const forceReload = options.forceReload ?? false;

      // 이미 복원된 URL이 있고 forceReload가 아니면 반환
      if (!forceReload && previewUrls[idStr]) {
        return previewUrls[idStr];
      }

      // audioUrl이 있고 유효하면 사용
      if (gen.audioUrl && !forceReload) {
        if (gen.audioUrl.startsWith("blob:") || gen.audioUrl.startsWith("data:")) {
          setPreviewUrls((prev) => ({ ...prev, [idStr]: gen.audioUrl! }));
          return gen.audioUrl;
        }
      }

      // DB에서 blob 로드
      try {
        const result = await dbService.loadGenerationBlob(user.id, idStr);
        if (result?.audioBlob) {
          const mimeType = result.mimeType || gen.mimeType || "audio/mpeg";
          const blob = dbService.arrayBufferToBlob(result.audioBlob, mimeType);
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          setPreviewUrls((prev) => ({ ...prev, [idStr]: dataUrl }));
          return dataUrl;
        }
      } catch (error) {
        console.error("음원 복원 실패:", error);
      }

      return null;
    },
    [user?.id, previewUrls]
  );

  // URL 파라미터에서 generation ID 읽기
  useEffect(() => {
    const generationId = searchParams.get("generation");
    if (generationId && !newSchedule.generationId) {
      setNewSchedule((prev) => ({ ...prev, generationId }));
      setIsCreateDialogOpen(true);
    }
  }, [searchParams]);

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
      // hasAudio가 true인 항목만 필터링 (audioUrl이 없어도 포함)
      setGenerations(data.filter((g) => g.hasAudio !== false));
    } catch (error) {
      console.error("생성 내역 로드 실패:", error);
    }
  };

  const handleCreateSchedule = async () => {
    if (!user?.id || !newSchedule.generationId || !newSchedule.targetChannel) {
      toast({
        title: "입력 필요",
        description: "음원과 전송 채널을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (!newSchedule.scheduleName.trim()) {
      toast({
        title: "입력 필요",
        description: "스케줄명을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (!newSchedule.startDate || !newSchedule.endDate) {
      toast({
        title: "입력 필요",
        description: "시작일과 종료일을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (new Date(newSchedule.startDate) > new Date(newSchedule.endDate)) {
      toast({
        title: "입력 오류",
        description: "종료일은 시작일 이후여야 합니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      // 기간 내 각 날짜에 대해 스케줄 생성
      const startDate = new Date(newSchedule.startDate);
      const endDate = new Date(newSchedule.endDate);
      const schedulesToCreate: dbService.ScheduleRequestEntry[] = [];

      // 기본 전송 시간 파싱 (로컬 시간 기준)
      const baseTimeStr = newSchedule.scheduledTime 
        ? newSchedule.scheduledTime.split('T')[1]?.slice(0, 5) || '09:00'
        : '09:00';
      const [baseHours, baseMinutes] = baseTimeStr.split(':').map(Number);
      
      // 시작일부터 종료일까지 반복
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        // 하루에 여러 번 전송하는 경우
        if (newSchedule.timesPerDay === 1) {
          // 1회만 전송
          // 로컬 시간대로 날짜와 시간 설정
          const year = date.getFullYear();
          const month = date.getMonth();
          const day = date.getDate();
          
          // 로컬 시간을 UTC ISO 문자열로 변환
          const scheduleISO = localTimeToISOString(year, month, day, baseHours, baseMinutes);
          
          schedulesToCreate.push({
            generationId: newSchedule.generationId,
            targetChannel: newSchedule.targetChannel,
            scheduledTime: scheduleISO,
            repeatOption: newSchedule.repeatOption,
            status: "scheduled",
            scheduleName: newSchedule.scheduleName,
            scheduleType: newSchedule.scheduleType,
          } as any);
        } else {
          // 여러 번 전송: 하루를 균등하게 분할
          const intervalMinutes = Math.floor((24 * 60) / newSchedule.timesPerDay);
          for (let i = 0; i < newSchedule.timesPerDay; i++) {
            const year = date.getFullYear();
            const month = date.getMonth();
            const day = date.getDate();
            const totalMinutes = (baseHours * 60 + baseMinutes) + (i * intervalMinutes);
            const hours = Math.floor(totalMinutes / 60) % 24;
            const minutes = totalMinutes % 60;
            
            // 로컬 시간을 UTC ISO 문자열로 변환
            const scheduleISO = localTimeToISOString(year, month, day, hours, minutes);
            
            schedulesToCreate.push({
        generationId: newSchedule.generationId,
        targetChannel: newSchedule.targetChannel,
              scheduledTime: scheduleISO,
        repeatOption: newSchedule.repeatOption,
        status: "scheduled",
              scheduleName: newSchedule.scheduleName,
              scheduleType: newSchedule.scheduleType,
            } as any);
          }
        }
      }

      // 모든 스케줄 저장
      for (const schedule of schedulesToCreate) {
        await dbService.saveScheduleRequest(user.id, schedule);
      }
      
      toast({
        title: "스케줄 생성 완료",
        description: `${schedulesToCreate.length}개의 스케줄이 생성되었습니다.`,
      });
      
      setIsCreateDialogOpen(false);
      setNewSchedule({
        scheduleName: "",
        generationId: "",
        targetChannel: "",
        scheduledTime: "",
        startDate: "",
        endDate: "",
        timesPerDay: 1,
        repeatOption: "once",
        scheduleType: "routine",
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
    if (!user?.id) return;
    setDeleteDialog({ open: true, id });
  };

  const confirmDeleteSchedule = async () => {
    if (!user?.id || !deleteDialog.id) return;
    
    try {
      const success = await dbService.deleteScheduleRequest(user.id, deleteDialog.id);
      if (success) {
    toast({
      title: "삭제 완료",
      description: "스케줄이 삭제되었습니다.",
    });
    await loadSchedules();
      } else {
        toast({
          title: "삭제 실패",
          description: "스케줄 삭제 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("스케줄 삭제 실패:", error);
      toast({
        title: "삭제 실패",
        description: "스케줄 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialog({ open: false, id: null });
    }
  };

  const handleUpdateSchedule = async () => {
    if (!user?.id || !editingSchedule?.id) return;

    try {
      const updates: any = {
        generationId: editingSchedule.generationId,
        targetChannel: editingSchedule.targetChannel,
        scheduledTime: editingSchedule.scheduledTime,
        repeatOption: editingSchedule.repeatOption,
        scheduleName: (editingSchedule as any).scheduleName,
        scheduleType: (editingSchedule as any).scheduleType || "routine",
      };

      const success = await dbService.updateScheduleRequest(user.id, editingSchedule.id, updates);
      if (success) {
        toast({
          title: "수정 완료",
          description: "스케줄이 수정되었습니다.",
        });
        await loadSchedules();
        setIsEditDialogOpen(false);
        setEditingSchedule(null);
      } else {
        toast({
          title: "수정 실패",
          description: "스케줄 수정 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("스케줄 수정 실패:", error);
      toast({
        title: "수정 실패",
        description: "스케줄 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
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


  // 달력에 표시할 날짜들 (스케줄이 있는 날짜)
  const getScheduledDates = () => {
    return schedules.map((schedule) => {
      const date = new Date(schedule.scheduledTime);
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    });
  };

  // 일상 방송 날짜들
  const getRoutineDates = () => {
    return schedules
      .filter((schedule) => getScheduleType(schedule) === "routine")
      .map((schedule) => {
        const date = new Date(schedule.scheduledTime);
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
      });
  };

  // 기간 방송 날짜들
  const getEventDates = () => {
    return schedules
      .filter((schedule) => getScheduleType(schedule) === "event")
      .map((schedule) => {
        const date = new Date(schedule.scheduledTime);
        return new Date(date.getFullYear(), date.getMonth(), date.getDate());
      });
  };

  // 선택한 날짜의 스케줄 필터링 및 시간순 정렬
  const getSchedulesForDate = (date: Date | undefined) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    const filtered = schedules.filter((schedule) => {
      const scheduleDate = new Date(schedule.scheduledTime);
      const scheduleDateStr = scheduleDate.toISOString().split('T')[0];
      return scheduleDateStr === dateStr;
    });
    
    // 시간순 정렬 (오름차순: 오전부터 오후까지)
    return filtered.sort((a, b) => {
      const timeA = new Date(a.scheduledTime).getTime();
      const timeB = new Date(b.scheduledTime).getTime();
      return timeA - timeB;
    });
  };

  const selectedGen = generations.find((g) => g.id === newSchedule.generationId);
  const selectedDateSchedules = getSchedulesForDate(selectedDate);
  
  // 채널 정보 조회 헬퍼 함수
  const getChannelInfo = (targetChannel: string) => {
    if (!targetChannel) return null;
    
    // UUID 형식인지 확인
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetChannel);
    
    if (isUUID) {
      // UUID로 채널 찾기
      return channels.find((ch) => ch.id === targetChannel);
    } else {
      // 타입으로 채널 찾기 (첫 번째 일치하는 채널)
      return channels.find((ch) => ch.type === targetChannel);
    }
  };

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        title="스케줄 관리"
        description="방송 일정을 관리하고 자동화합니다"
        icon={CalendarIcon}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadSchedules();
                toast({
                  title: "새로고침 완료",
                  description: "스케줄 목록을 새로고침했습니다.",
                });
              }}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              새로고침
            </Button>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              새 스케줄
            </Button>
          </div>
        }
      />

      <div className="space-y-6">
        {/* 뷰 모드 전환 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "calendar" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("calendar")}
            >
              <CalendarIcon className="w-4 h-4 mr-2" />
              달력 보기
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <Clock className="w-4 h-4 mr-2" />
              목록 보기
            </Button>
          </div>
        </div>

        {viewMode === "calendar" ? (
          /* 달력 보기 - 크게 표시 */
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">방송 일정 달력</CardTitle>
                <CardDescription>날짜를 클릭하여 스케줄을 확인하세요</CardDescription>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border w-full"
                  classNames={{
                    months: "flex flex-col space-y-4",
                    month: "space-y-4",
                    caption: "flex justify-center pt-1 relative items-center text-lg font-semibold",
                    caption_label: "text-lg font-semibold",
                    nav: "space-x-1 flex items-center",
                    nav_button: cn(
                      "h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100 border rounded-md"
                    ),
                    nav_button_previous: "absolute left-1",
                    nav_button_next: "absolute right-1",
                    table: "w-full border-collapse space-y-1",
                    head_row: "flex",
                    head_cell: "text-muted-foreground rounded-md w-14 font-normal text-sm",
                    row: "flex w-full mt-2",
                    cell: "h-24 w-14 text-center text-sm p-0 relative border border-border/50 rounded-md hover:bg-muted/50 transition-colors",
                    day: cn(
                      "h-full w-full p-0 font-normal flex flex-col items-center justify-start pt-1 gap-1 overflow-hidden"
                    ),
                    day_selected:
                      "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                    day_today: "bg-accent text-accent-foreground font-semibold",
                    day_outside:
                      "day-outside text-muted-foreground opacity-50",
                    day_disabled: "text-muted-foreground opacity-50",
                    day_hidden: "invisible",
                  }}
                  components={{
                    Day: ({ date, displayMonth }) => {
                      const daySchedules = schedules.filter((schedule) => {
                        const scheduleDate = new Date(schedule.scheduledTime);
                        return (
                          scheduleDate.getFullYear() === date.getFullYear() &&
                          scheduleDate.getMonth() === date.getMonth() &&
                          scheduleDate.getDate() === date.getDate()
                        );
                      }).sort((a, b) => {
                        const timeA = new Date(a.scheduledTime).getTime();
                        const timeB = new Date(b.scheduledTime).getTime();
                        return timeA - timeB;
                      });

                      const isSelected = selectedDate && 
                        date.getFullYear() === selectedDate.getFullYear() &&
                        date.getMonth() === selectedDate.getMonth() &&
                        date.getDate() === selectedDate.getDate();
                      
                      const isToday = 
                        date.getFullYear() === new Date().getFullYear() &&
                        date.getMonth() === new Date().getMonth() &&
                        date.getDate() === new Date().getDate();

                      return (
                        <div
                          className={cn(
                            "h-full w-full p-0 font-normal flex flex-col items-center justify-start pt-1 gap-1 overflow-hidden rounded-md cursor-pointer hover:bg-muted/50 transition-colors",
                            isSelected && "bg-primary text-primary-foreground",
                            isToday && !isSelected && "bg-accent text-accent-foreground font-semibold"
                          )}
                          onClick={() => setSelectedDate(date)}
                        >
                          <span className={cn(
                            "text-sm font-medium",
                            isSelected && "text-primary-foreground",
                            isToday && !isSelected && "text-accent-foreground"
                          )}>
                            {date.getDate()}
                          </span>
                          <div className="flex flex-col gap-0.5 w-full px-0.5 overflow-y-auto max-h-[60px]">
                            {daySchedules.slice(0, 3).map((schedule) => {
                              const scheduleType = getScheduleType(schedule);
                              const scheduleName = (schedule as any).scheduleName || "스케줄";
                              const scheduleTime = new Date(schedule.scheduledTime);
                              const timeStr = scheduleTime.toLocaleTimeString("ko-KR", { 
                                hour: "2-digit", 
                                minute: "2-digit",
                                hour12: false
                              });
                              const status = schedule.status || "scheduled";
                              
                              // 색상 결정: 타입별 + 상태별
                              let bgColor = "";
                              let textColor = "";
                              let borderColor = "";
                              
                              if (scheduleType === "routine") {
                                if (status === "sent") {
                                  bgColor = "bg-green-500/20";
                                  textColor = "text-green-700 dark:text-green-300";
                                  borderColor = "border-green-500/50";
                                } else if (status === "failed") {
                                  bgColor = "bg-red-500/20";
                                  textColor = "text-red-700 dark:text-red-300";
                                  borderColor = "border-red-500/50";
                                } else {
                                  bgColor = "bg-blue-500/20";
                                  textColor = "text-blue-700 dark:text-blue-300";
                                  borderColor = "border-blue-500/50";
                                }
                              } else {
                                if (status === "sent") {
                                  bgColor = "bg-green-500/20";
                                  textColor = "text-green-700 dark:text-green-300";
                                  borderColor = "border-green-500/50";
                                } else if (status === "failed") {
                                  bgColor = "bg-red-500/20";
                                  textColor = "text-red-700 dark:text-red-300";
                                  borderColor = "border-red-500/50";
                                } else {
                                  bgColor = "bg-purple-500/20";
                                  textColor = "text-purple-700 dark:text-purple-300";
                                  borderColor = "border-purple-500/50";
                                }
                              }

                              return (
                                <button
                                  key={schedule.id}
                                  className={cn(
                                    "w-full text-[9px] px-1 py-0.5 rounded border text-left truncate hover:opacity-80 transition-opacity",
                                    bgColor,
                                    textColor,
                                    borderColor,
                                    isSelected && "opacity-90"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingSchedule(schedule);
                                    setIsEditDialogOpen(true);
                                  }}
                                  title={`${scheduleName} - ${timeStr}`}
                                >
                                  <div className="truncate font-medium">{scheduleName}</div>
                                  <div className="truncate opacity-80">{timeStr}</div>
                                </button>
                              );
                            })}
                            {daySchedules.length > 3 && (
                              <div className={cn(
                                "text-[9px] px-1 py-0.5 text-center font-medium",
                                isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
                              )}>
                                +{daySchedules.length - 3}개
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    },
                  }}
                />
                {/* 범례 */}
                <div className="mt-6 flex items-center gap-6 text-sm flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border-2 border-blue-500 bg-blue-500/20" />
                    <span className="text-muted-foreground">일상 방송</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border-2 border-purple-500 bg-purple-500/20" />
                    <span className="text-muted-foreground">기간 방송</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border-2 border-green-500 bg-green-500/20" />
                    <span className="text-muted-foreground">전송됨</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border-2 border-red-500 bg-red-500/20" />
                    <span className="text-muted-foreground">실패</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 선택된 날짜의 상세 스케줄 목록 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {selectedDate
                      ? `${selectedDate.getFullYear()}년 ${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일`
                      : "날짜 선택"}
                  </CardTitle>
                  <CardDescription>
                    {selectedDateSchedules.length > 0
                      ? `${selectedDateSchedules.length}개의 스케줄`
                      : "스케줄이 없습니다"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedDateSchedules.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      선택한 날짜에 스케줄이 없습니다.
                    </p>
                  ) : (
                    selectedDateSchedules.map((schedule) => {
                      const gen = generations.find((g) => g.id === schedule.generationId);
                      const scheduleType = getScheduleType(schedule);
                      const scheduleName = (schedule as any).scheduleName || schedule.targetName || gen?.savedName || "스케줄";
                      const channelInfo = getChannelInfo(schedule.targetChannel);
                      const scheduleTime = new Date(schedule.scheduledTime);
                      const timeStr = scheduleTime.toLocaleTimeString("ko-KR", { 
                        hour: "2-digit", 
                        minute: "2-digit",
                        hour12: true
                      });
                      
                      return (
                        <Card 
                          key={schedule.id} 
                          className={cn(
                            "p-3 hover:bg-muted/50 transition-colors cursor-pointer border-l-4",
                            scheduleType === "event" 
                              ? "border-l-purple-500 bg-purple-500/5 dark:bg-purple-500/10" 
                              : "border-l-blue-500 bg-blue-500/5 dark:bg-blue-500/10"
                          )}
                          onClick={() => {
                            // 스케줄 수정 모달 열기
                            setEditingSchedule(schedule);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <p className="font-medium text-sm truncate">
                                  {scheduleName}
                                </p>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${
                                    scheduleType === "event"
                                      ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
                                      : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                  }`}
                                >
                                  {scheduleType === "event" ? "기간" : "일상"}
                                </Badge>
                              </div>
                              <div className="space-y-1.5">
                                {/* 시간 표시 - 더 눈에 띄게 */}
                                <div className="flex items-center gap-1.5 text-xs font-semibold">
                                  <Clock className="w-3.5 h-3.5 text-primary" />
                                  <span className="text-foreground">{timeStr}</span>
                                </div>
                                {/* 채널 정보 - 더 명확하게 */}
                                <div className="flex items-start gap-1.5 text-xs">
                                  <Radio className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                  <div className="flex flex-col gap-1 min-w-0">
                                    {channelInfo ? (
                                      <>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-medium text-foreground">{channelInfo.name}</span>
                                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                            {channelInfo.type}
                                          </Badge>
                                        </div>
                                        {channelInfo.endpoint ? (
                                          <div className="flex items-center gap-1">
                                            <span className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded font-medium">
                                              ✓ endpoint 설정됨
                                            </span>
                                            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]" title={channelInfo.endpoint}>
                                              {channelInfo.endpoint}
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded font-medium">
                                            ⚠ endpoint 없음
                                          </span>
                                        )}
                                      </>
                                    ) : (
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-muted-foreground">{schedule.targetChannel}</span>
                                        <span className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-600 dark:text-red-400 rounded font-medium">
                                          ❌ 채널 없음
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {getStatusBadge(schedule.status)}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSchedule(schedule.id || "");
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* 목록 보기 - 표 형식 */
          <div className="space-y-4">
            {/* 페이지당 항목 수 선택 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">페이지당 항목:</Label>
                <Select
                  value={String(itemsPerPage)}
                  onValueChange={(value) => {
                    setItemsPerPage(Number(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-20 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                총 {sortedSchedules.length}개 중 {Math.min((currentPage - 1) * itemsPerPage + 1, sortedSchedules.length)}-{Math.min(currentPage * itemsPerPage, sortedSchedules.length)}개 표시
              </p>
            </div>

        {schedules.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CalendarIcon className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">등록된 스케줄이 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
              <>
                <div className="border rounded-lg overflow-hidden">
                  <ScrollArea className="h-[600px]">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0 z-10">
                        <tr>
                          <th 
                            className="px-3 py-2 text-left font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors"
                            onClick={() => {
                              if (sortBy === "name") {
                                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                              } else {
                                setSortBy("name");
                                setSortOrder("asc");
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              스케줄명
                              {sortBy === "name" && (
                                sortOrder === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                              )}
                              {sortBy !== "name" && <ArrowUpDown className="w-3 h-3 opacity-50" />}
                            </div>
                          </th>
                          <th 
                            className="px-3 py-2 text-left font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors"
                            onClick={() => {
                              if (sortBy === "type") {
                                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                              } else {
                                setSortBy("type");
                                setSortOrder("asc");
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              유형
                              {sortBy === "type" && (
                                sortOrder === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                              )}
                              {sortBy !== "type" && <ArrowUpDown className="w-3 h-3 opacity-50" />}
                            </div>
                          </th>
                          <th 
                            className="px-3 py-2 text-left font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors"
                            onClick={() => {
                              if (sortBy === "channel") {
                                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                              } else {
                                setSortBy("channel");
                                setSortOrder("asc");
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              채널
                              {sortBy === "channel" && (
                                sortOrder === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                              )}
                              {sortBy !== "channel" && <ArrowUpDown className="w-3 h-3 opacity-50" />}
                            </div>
                          </th>
                          <th 
                            className="px-3 py-2 text-left font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors"
                            onClick={() => {
                              if (sortBy === "time") {
                                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                              } else {
                                setSortBy("time");
                                setSortOrder("desc");
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              일시
                              {sortBy === "time" && (
                                sortOrder === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                              )}
                              {sortBy !== "time" && <ArrowUpDown className="w-3 h-3 opacity-50" />}
                            </div>
                          </th>
                          <th 
                            className="px-3 py-2 text-left font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors"
                            onClick={() => {
                              if (sortBy === "repeat") {
                                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                              } else {
                                setSortBy("repeat");
                                setSortOrder("asc");
                              }
                            }}
                          >
                            <div className="flex items-center gap-1">
                              반복
                              {sortBy === "repeat" && (
                                sortOrder === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                              )}
                              {sortBy !== "repeat" && <ArrowUpDown className="w-3 h-3 opacity-50" />}
                            </div>
                          </th>
                          <th 
                            className="px-3 py-2 text-center font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 transition-colors"
                            onClick={() => {
                              if (sortBy === "status") {
                                setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                              } else {
                                setSortBy("status");
                                setSortOrder("asc");
                              }
                            }}
                          >
                            <div className="flex items-center justify-center gap-1">
                              상태
                              {sortBy === "status" && (
                                sortOrder === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                              )}
                              {sortBy !== "status" && <ArrowUpDown className="w-3 h-3 opacity-50" />}
                            </div>
                          </th>
                          <th className="px-3 py-2 text-center font-medium text-muted-foreground">작업</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedSchedules.map((schedule) => {
            const gen = generations.find((g) => g.id === schedule.generationId);
                            const scheduleType = getScheduleType(schedule);
                            const scheduleName = (schedule as any).scheduleName || schedule.targetName || gen?.savedName || "스케줄";
            return (
                              <tr
                                key={schedule.id}
                                className={cn(
                                  "cursor-pointer transition-colors hover:bg-muted/50 border-b border-border border-l-4",
                                  scheduleType === "event"
                                    ? "border-l-purple-500 bg-purple-500/5 dark:bg-purple-500/10"
                                    : "border-l-blue-500 bg-blue-500/5 dark:bg-blue-500/10"
                                )}
                                onClick={() => {
                                  // 스케줄 수정 모달 열기
                                  setEditingSchedule(schedule);
                                  setIsEditDialogOpen(true);
                                }}
                              >
                                <td className="px-3 py-2">
                                  <span className="font-medium truncate block">{scheduleName}</span>
                                </td>
                                <td className="px-3 py-2">
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-[10px] px-1.5 py-0",
                                      scheduleType === "event"
                                        ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
                                        : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                    )}
                                  >
                                    {scheduleType === "event" ? "기간" : "일상"}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1">
                                    <Radio className="w-3 h-3 text-muted-foreground" />
                                    <span className="truncate">{schedule.targetChannel}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2">
                                  <span className="text-muted-foreground">{formatDateTime(schedule.scheduledTime)}</span>
                                </td>
                                <td className="px-3 py-2">
                                  {schedule.repeatOption && schedule.repeatOption !== "once" ? (
                                    <div className="flex items-center gap-1">
                                      <Repeat className="w-3 h-3 text-muted-foreground" />
                                      <span className="text-muted-foreground">
                              {schedule.repeatOption === "daily" && "매일"}
                              {schedule.repeatOption === "weekly" && "매주"}
                              {schedule.repeatOption === "monthly" && "매월"}
                                        {schedule.repeatOption === "yearly" && "매년"}
                                        {schedule.repeatOption === "weekday" && "평일"}
                                        {schedule.repeatOption === "weekend" && "주말"}
                                        {schedule.repeatOption === "holiday_exclude" && "휴일제외"}
                            </span>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                        )}
                                </td>
                                <td className="px-3 py-2 text-center">
                      {getStatusBadge(schedule.status)}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteSchedule(schedule.id || "");
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                      </Button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </ScrollArea>
                    </div>

                {/* 페이지네이션 */}
                {Math.ceil(sortedSchedules.length / itemsPerPage) > 1 && (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.ceil(sortedSchedules.length / itemsPerPage) }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage((prev) => Math.min(Math.ceil(sortedSchedules.length / itemsPerPage), prev + 1))}
                          className={currentPage === Math.ceil(sortedSchedules.length / itemsPerPage) ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </>
            )}
                  </div>
        )}

      {/* 스케줄 생성 다이얼로그 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>새 스케줄 생성</DialogTitle>
            <DialogDescription>
              전송할 음원, 기간, 횟수를 선택하여 스케줄을 생성합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* 스케줄명 */}
            <div className="space-y-2">
              <Label>스케줄명</Label>
              <Input
                value={newSchedule.scheduleName}
                onChange={(e) =>
                  setNewSchedule({ ...newSchedule, scheduleName: e.target.value })
                }
                placeholder="예: 아침 안내방송, 축제 홍보 등"
              />
              <p className="text-xs text-muted-foreground">
                스케줄을 구분하기 위한 이름을 입력하세요.
              </p>
            </div>

            {/* 스케줄 타입 */}
            <div className="space-y-2">
              <Label>스케줄 유형</Label>
              <Select
                value={newSchedule.scheduleType}
                onValueChange={(value: "routine" | "event") => {
                  // 타입 변경 시 종료일 초기화 (일상방송은 종료일 불필요)
                  setNewSchedule({ 
                    ...newSchedule, 
                    scheduleType: value,
                    endDate: value === "routine" ? "" : newSchedule.endDate
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">일상 방송 (시작일만 필요, 올해까지 반복)</SelectItem>
                  <SelectItem value="event">기간 방송 (시작일-종료일 필요, 기간 동안 반복)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {newSchedule.scheduleType === "routine" 
                  ? "일상 방송은 시작일만 설정하면 됩니다. 반복 옵션에 따라 올해(12월 31일)까지 자동으로 반복됩니다."
                  : "기간 방송은 시작일과 종료일을 모두 설정해야 합니다. 반복 옵션에 따라 설정한 기간 동안 반복됩니다."}
              </p>
            </div>

            {/* 음원 선택 */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Music2 className="w-4 h-4" />
                음원 선택
              </Label>
              
              {/* 검색 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="음원 검색..."
                  value={audioSearchQuery}
                  onChange={(e) => setAudioSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* 음원 리스트 - 표 형식 */}
              <div className="border rounded-lg overflow-hidden">
                <ScrollArea className="h-[300px]">
                  {generations.length === 0 ? (
                    <div className="p-4 text-xs text-center text-muted-foreground">
                      사용 가능한 음원이 없습니다
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground w-1/2">음원명</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground w-1/4">카테고리</th>
                          <th className="px-3 py-2 text-center font-medium text-muted-foreground w-1/4">미리듣기</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generations
                          .filter((gen) => {
                            if (!audioSearchQuery.trim()) return true;
                            const query = audioSearchQuery.toLowerCase();
                            return (
                              gen.savedName?.toLowerCase().includes(query) ||
                              gen.purposeLabel?.toLowerCase().includes(query) ||
                              gen.voiceName?.toLowerCase().includes(query) ||
                              gen.textPreview?.toLowerCase().includes(query)
                            );
                          })
                          .map((gen) => {
                            const isSelected = newSchedule.generationId === String(gen.id);
                            const isPreviewing = selectedAudioPreviewId === gen.id;
                            const isLoading = loadingPreviewIds.has(String(gen.id));
                            const previewUrl = previewUrls[String(gen.id)] || gen.audioUrl;
                            return (
                              <React.Fragment key={gen.id}>
                                <tr
                                  className={cn(
                                    "cursor-pointer transition-colors hover:bg-muted/50 border-b border-border",
                                    isSelected && "bg-primary/10"
                                  )}
                                  onClick={() => {
                                    setNewSchedule({ ...newSchedule, generationId: String(gen.id || "") });
                                    // 음원 선택 시 미리듣기 창 닫기
                                    setSelectedAudioPreviewId(null);
                                  }}
                                >
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className={cn("truncate", isSelected ? "text-primary font-semibold" : "text-foreground")}>
                                        {gen.savedName || `음원 ${gen.id}`}
                                      </span>
                                      {gen.isFavorite && (
                                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">
                                    {gen.purposeLabel && (
                                      <Badge 
                                        variant="outline" 
                                        className={cn("text-[10px] px-1.5 py-0", getPurposeColor(gen.purpose || ""))}
                                      >
                                        {gen.purposeLabel}
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (isPreviewing) {
                                          setSelectedAudioPreviewId(null);
                                        } else {
                                          setSelectedAudioPreviewId(gen.id || null);
                                          const idStr = String(gen.id);
                                          if (!previewUrl) {
                                            setLoadingPreviewIds((prev) => new Set([...prev, idStr]));
                                            try {
                                              await ensureGenerationAudio(gen);
                                            } catch (error) {
                                              console.error("음원 복원 실패:", error);
                                            } finally {
                                              setLoadingPreviewIds((prev) => {
                                                const next = new Set(prev);
                                                next.delete(idStr);
                                                return next;
                                              });
                                            }
                                          }
                                        }
                                      }}
                                    >
                                      {isLoading ? (
                                        <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                      ) : (
                                        <Play className={cn("w-3 h-3", isPreviewing && "text-primary")} />
                                      )}
                                    </Button>
                                  </td>
                                </tr>
                                {isPreviewing && previewUrl && (
                                  <tr>
                                    <td colSpan={3} className="px-3 py-2 bg-muted/30">
                                      <AudioPlayer
                                        audioUrl={previewUrl}
                                        cacheKey={gen.cacheKey}
                                        mimeType={gen.mimeType}
                                        className="w-full"
                                        onError={() => {
                                          setSelectedAudioPreviewId(null);
                                        }}
                                      />
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                      </tbody>
                    </table>
                  )}
                </ScrollArea>
              </div>
              
              {newSchedule.generationId && (
                <p className="text-xs text-muted-foreground">
                  선택된 음원: {generations.find(g => String(g.id) === newSchedule.generationId)?.savedName || newSchedule.generationId}
                </p>
              )}
            </div>

            {/* 전송 채널 */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Radio className="w-4 h-4" />
                전송 채널
              </Label>
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
                  {channels.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      활성화된 채널이 없습니다. 
                      <br />
                      <span className="text-xs">전송 설정 페이지에서 채널을 먼저 생성해주세요.</span>
                    </div>
                  ) : (
                    channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id || channel.type}>
                        {channel.name} {channel.endpoint ? `(${channel.type})` : `(${channel.type}) - endpoint 없음`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {newSchedule.targetChannel && !channels.find((ch) => (ch.id || ch.type) === newSchedule.targetChannel)?.endpoint && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ 선택한 채널에 endpoint가 설정되지 않았습니다. 전송 설정 페이지에서 설정해주세요.
                </p>
              )}
            </div>

            {/* 기간 선택 */}
            <div className="space-y-3">
              <div className={cn("grid gap-4", newSchedule.scheduleType === "event" ? "grid-cols-2" : "grid-cols-1")}>
                <div className="space-y-2">
                  <Label>시작일</Label>
                  <div className="space-y-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !newSchedule.startDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newSchedule.startDate ? (
                            new Date(newSchedule.startDate + 'T00:00:00').toLocaleDateString("ko-KR", { timeZone: 'Asia/Seoul' })
                          ) : (
                            <span>날짜 선택</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={newSchedule.startDate ? new Date(newSchedule.startDate + 'T00:00:00') : undefined}
                          onSelect={(date) => {
                            if (date) {
                              // KST 기준으로 날짜 문자열 생성 (YYYY-MM-DD)
                              const year = date.getFullYear();
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const day = String(date.getDate()).padStart(2, '0');
                              const dateString = `${year}-${month}-${day}`;
                              setNewSchedule({ ...newSchedule, startDate: dateString });
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {/* 시작일 빠른 선택 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          const today = new Date();
                          const year = today.getFullYear();
                          const month = String(today.getMonth() + 1).padStart(2, '0');
                          const day = String(today.getDate()).padStart(2, '0');
                          setNewSchedule({ ...newSchedule, startDate: `${year}-${month}-${day}` });
                        }}
                      >
                        오늘
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          const today = new Date();
                          const dayOfWeek = today.getDay();
                          const diff = today.getDate() - dayOfWeek; // 일요일로 이동
                          const startOfWeek = new Date(today.setDate(diff));
                          const year = startOfWeek.getFullYear();
                          const month = String(startOfWeek.getMonth() + 1).padStart(2, '0');
                          const day = String(startOfWeek.getDate()).padStart(2, '0');
                          setNewSchedule({ ...newSchedule, startDate: `${year}-${month}-${day}` });
                        }}
                      >
                        이번주
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          const today = new Date();
                          const year = today.getFullYear();
                          const month = String(today.getMonth() + 1).padStart(2, '0');
                          setNewSchedule({ ...newSchedule, startDate: `${year}-${month}-01` });
                        }}
                      >
                        이번달
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          const today = new Date();
                          const year = today.getFullYear();
                          setNewSchedule({ ...newSchedule, startDate: `${year}-01-01` });
                        }}
                      >
                        올해
                      </Button>
                    </div>
                  </div>
                </div>
                {/* 종료일 (기간방송만 표시) */}
                {newSchedule.scheduleType === "event" && (
                  <div className="space-y-2">
                    <Label>종료일</Label>
                    <div className="space-y-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !newSchedule.endDate && "text-muted-foreground"
                            )}
                            disabled={!newSchedule.startDate}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newSchedule.endDate ? (
                              new Date(newSchedule.endDate + 'T00:00:00').toLocaleDateString("ko-KR", { timeZone: 'Asia/Seoul' })
                            ) : (
                              <span>날짜 선택</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={newSchedule.endDate ? new Date(newSchedule.endDate + 'T00:00:00') : undefined}
                            onSelect={(date) => {
                              if (date) {
                                // KST 기준으로 날짜 문자열 생성 (YYYY-MM-DD)
                                const year = date.getFullYear();
                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                const day = String(date.getDate()).padStart(2, '0');
                                const dateString = `${year}-${month}-${day}`;
                                setNewSchedule({ ...newSchedule, endDate: dateString });
                              }
                            }}
                            disabled={(date) => {
                              if (!newSchedule.startDate) return true;
                              const startDate = new Date(newSchedule.startDate + 'T00:00:00');
                              return date < startDate;
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {/* 기간설정 빠른 선택 */}
                      {newSchedule.startDate && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              if (!newSchedule.startDate) return;
                              const start = new Date(newSchedule.startDate + 'T00:00:00');
                              const end = new Date(start);
                              end.setDate(end.getDate() + 6); // 7일 후 (한주)
                              const year = end.getFullYear();
                              const month = String(end.getMonth() + 1).padStart(2, '0');
                              const day = String(end.getDate()).padStart(2, '0');
                              setNewSchedule({ ...newSchedule, endDate: `${year}-${month}-${day}` });
                            }}
                          >
                            한주
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              if (!newSchedule.startDate) return;
                              const start = new Date(newSchedule.startDate + 'T00:00:00');
                              const end = new Date(start.getFullYear(), start.getMonth() + 1, 0); // 해당 월의 마지막 날
                              const year = end.getFullYear();
                              const month = String(end.getMonth() + 1).padStart(2, '0');
                              const day = String(end.getDate()).padStart(2, '0');
                              setNewSchedule({ ...newSchedule, endDate: `${year}-${month}-${day}` });
                            }}
                          >
                            한달
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              if (!newSchedule.startDate) return;
                              const start = new Date(newSchedule.startDate + 'T00:00:00');
                              const end = new Date(start.getFullYear(), 11, 31); // 해당 년도의 마지막 날
                              const year = end.getFullYear();
                              const month = String(end.getMonth() + 1).padStart(2, '0');
                              const day = String(end.getDate()).padStart(2, '0');
                              setNewSchedule({ ...newSchedule, endDate: `${year}-${month}-${day}` });
                            }}
                          >
                            올해까지
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 전송 시간 및 횟수 */}
            <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>전송 시간</Label>
              <Input
                  type="time"
                  value={newSchedule.scheduledTime ? newSchedule.scheduledTime.split('T')[1]?.slice(0, 5) : ''}
                  onChange={(e) => {
                    const time = e.target.value;
                    const date = newSchedule.startDate || new Date().toISOString().split('T')[0];
                    setNewSchedule({ 
                      ...newSchedule, 
                      scheduledTime: `${date}T${time}:00` 
                    });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>하루 전송 횟수</Label>
                <Select
                  value={String(newSchedule.timesPerDay)}
                  onValueChange={(value) =>
                    setNewSchedule({ ...newSchedule, timesPerDay: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1회</SelectItem>
                    <SelectItem value="2">2회</SelectItem>
                    <SelectItem value="3">3회</SelectItem>
                    <SelectItem value="4">4회</SelectItem>
                    <SelectItem value="5">5회</SelectItem>
                    <SelectItem value="6">6회</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 반복 옵션 */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Repeat className="w-4 h-4" />
                반복 옵션
              </Label>
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
                  <SelectItem value="yearly">매년</SelectItem>
                  <SelectItem value="weekday">평일만 (월~금)</SelectItem>
                  <SelectItem value="weekend">주말만 (토~일)</SelectItem>
                  <SelectItem value="holiday_exclude">휴일 제외</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              setNewSchedule({
                scheduleName: "",
                generationId: "",
                targetChannel: "",
                scheduledTime: "",
                startDate: "",
                endDate: "",
                timesPerDay: 1,
                repeatOption: "once",
                scheduleType: "routine",
              });
            }}>
              취소
            </Button>
            <Button onClick={handleCreateSchedule}>생성</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 스케줄 수정 다이얼로그 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>스케줄 수정</DialogTitle>
            <DialogDescription>
              스케줄 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>
          {editingSchedule && (
            <div className="space-y-6">
              {/* 스케줄명 */}
              <div className="space-y-2">
                <Label>스케줄명</Label>
                <Input
                  value={(editingSchedule as any).scheduleName || ""}
                  onChange={(e) =>
                    setEditingSchedule({ ...editingSchedule, scheduleName: e.target.value } as any)
                  }
                  placeholder="예: 아침 안내방송, 축제 홍보 등"
                />
              </div>

              {/* 스케줄 타입 */}
              <div className="space-y-2">
                <Label>스케줄 유형</Label>
                <Select
                  value={(editingSchedule as any).scheduleType || "routine"}
                  onValueChange={(value: "routine" | "event") =>
                    setEditingSchedule({ ...editingSchedule, scheduleType: value } as any)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="routine">일상 방송</SelectItem>
                    <SelectItem value="event">기간 방송</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 음원 선택 */}
              <div className="space-y-2">
                <Label>음원</Label>
                <Select
                  value={String(editingSchedule.generationId || "")}
                  onValueChange={(value) =>
                    setEditingSchedule({ ...editingSchedule, generationId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {generations.map((gen) => (
                      <SelectItem key={gen.id} value={String(gen.id || "")}>
                        {gen.savedName || `음원 ${gen.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 전송 채널 */}
              <div className="space-y-2">
                <Label>전송 채널</Label>
                <Select
                  value={editingSchedule.targetChannel}
                  onValueChange={(value) =>
                    setEditingSchedule({ ...editingSchedule, targetChannel: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        활성화된 채널이 없습니다.
                        <br />
                        <span className="text-xs">전송 설정 페이지에서 채널을 먼저 생성해주세요.</span>
                      </div>
                    ) : (
                      channels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id || channel.type}>
                          {channel.name} {channel.endpoint ? `(${channel.type})` : `(${channel.type}) - endpoint 없음`}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {editingSchedule.targetChannel && !channels.find((ch) => (ch.id || ch.type) === editingSchedule.targetChannel)?.endpoint && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ 선택한 채널에 endpoint가 설정되지 않았습니다. 전송 설정 페이지에서 설정해주세요.
                  </p>
                )}
              </div>

              {/* 전송 시간 */}
              <div className="space-y-2">
                <Label>전송 시간</Label>
                <Input
                  type="datetime-local"
                  value={isoToLocalDateTimeString(editingSchedule.scheduledTime)}
                  onChange={(e) => {
                    const dateTime = e.target.value;
                    if (dateTime) {
                      // datetime-local input 값을 UTC ISO 문자열로 변환
                      const isoString = localDateTimeStringToISO(dateTime);
                      setEditingSchedule({
                        ...editingSchedule,
                        scheduledTime: isoString,
                      });
                    }
                  }}
                />
              </div>

              {/* 반복 옵션 */}
              <div className="space-y-2">
                <Label>반복 옵션</Label>
                <Select
                  value={editingSchedule.repeatOption || "once"}
                  onValueChange={(value) =>
                    setEditingSchedule({ ...editingSchedule, repeatOption: value })
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
                    <SelectItem value="yearly">매년</SelectItem>
                    <SelectItem value="weekday">평일만</SelectItem>
                    <SelectItem value="weekend">주말만</SelectItem>
                    <SelectItem value="holiday_exclude">휴일 제외</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false);
              setEditingSchedule(null);
            }}>
              취소
            </Button>
            <Button onClick={handleUpdateSchedule}>수정</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 대화상자 */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>스케줄 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말 이 스케줄을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSchedule}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </PageContainer>
  );
}
