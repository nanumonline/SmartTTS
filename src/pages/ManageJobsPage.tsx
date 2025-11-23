import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, CheckCircle, AlertCircle, Trash2, RefreshCw, Radio, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import * as dbService from "@/services/dbService";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { useToast } from "@/components/ui/use-toast";
import { purposeOptions, formatDateTime } from "@/lib/pageUtils";
import { getPurposeColor } from "@/lib/categoryColors";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface JobEntry {
  id: string;
  type: "generation" | "mixing" | "cloning" | "schedule";
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  createdAt: string;
  completedAt?: string;
  scheduledTime?: string; // 전송시간 (스케줄의 경우)
  broadcastStatus?: "sending" | "completed" | "failed"; // 송출중 | 완료 | 실패
  error?: string;
  // 스케줄 정보
  scheduleId?: string;
  scheduleName?: string;
  generationName?: string;
  generationPurpose?: string;
  generationPurposeLabel?: string;
  channelName?: string;
}

export default function ManageJobsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [schedules, setSchedules] = useState<dbService.ScheduleRequestEntry[]>([]);
  const [generations, setGenerations] = useState<dbService.GenerationEntry[]>([]);
  const [channels, setChannels] = useState<dbService.ChannelEntry[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; scheduleId: string | null }>({ open: false, scheduleId: null });
  const [deleteDuplicatesDialog, setDeleteDuplicatesDialog] = useState<{ open: boolean; duplicateIds: string[] }>({ open: false, duplicateIds: [] });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true); // 자동 새로고침 기본값: 활성화

  useEffect(() => {
    if (user?.id) {
      loadJobs();
    }
  }, [user?.id]);

  // 실시간 자동 새로고침 (5초마다)
  useEffect(() => {
    if (!user?.id || !autoRefresh) return;

    const interval = setInterval(() => {
      loadJobs();
    }, 5000); // 5초마다 새로고침

    return () => clearInterval(interval);
  }, [user?.id, autoRefresh]);

  const loadJobs = async () => {
    if (!user?.id) return;
    try {
      setIsRefreshing(true);
      // TODO: 실제 작업 큐 API 구현
      // 현재는 생성 내역 및 스케줄을 기반으로 작업 목록 생성
      const [generationsData, schedulesData, channelsData] = await Promise.all([
        dbService.loadGenerations(user.id, 100),
        dbService.loadScheduleRequests(user.id),
        dbService.loadChannels(user.id),
      ]);

      setSchedules(schedulesData);
      setGenerations(generationsData);
      setChannels(channelsData.filter(ch => ch.enabled !== false));

      const jobList: JobEntry[] = [];
      const now = new Date();

      // 채널 정보 가져오기 헬퍼 함수
      const getChannelName = (targetChannel: string): string => {
        // UUID인지 확인
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetChannel);
        if (isUUID) {
          const channel = channelsData.find(ch => ch.id === targetChannel);
          return channel?.name || targetChannel;
        } else {
          // 타입으로 찾기
          const channel = channelsData.find(ch => ch.type === targetChannel);
          return channel?.name || targetChannel;
        }
      };

      // 생성 작업
      generations.forEach((gen) => {
        if (gen.status === "processing") {
          jobList.push({
            id: `gen_${gen.id}`,
            type: "generation",
            status: "processing",
            createdAt: gen.createdAt || new Date().toISOString(),
          });
        }
      });

      // 스케줄 작업 (scheduled, processing 상태 모두 표시)
      schedulesData.forEach((schedule) => {
        const scheduleStatus = schedule.status || "scheduled";
        const createdAt = new Date(schedule.createdAt || schedule.scheduledTime);
        const minutesSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60);
        
        // processing 상태가 5분 이상이면 failed로 처리
        if (scheduleStatus === "processing" && minutesSinceCreated > 5) {
          // 자동으로 failed로 업데이트
          dbService.updateScheduleRequest(user.id, schedule.id!, {
            status: "failed",
            failReason: "처리 시간 초과 (5분 이상 대기)",
          }).catch(err => console.error("Failed to update stale processing schedule:", err));
        }
        
        // 스케줄 정보 가져오기
        const scheduleName = (schedule as any).scheduleName || schedule.targetName || "스케줄";
        const gen = generationsData.find(g => g.id === schedule.generationId);
        const generationName = gen?.savedName || gen?.purposeLabel || "알 수 없음";
        const generationPurpose = gen?.purpose || "";
        const generationPurposeLabel = gen?.purposeLabel || (gen?.purpose ? purposeOptions.find(p => p.id === gen.purpose)?.label : "") || "";
        const channelName = getChannelName(schedule.targetChannel);

        // 모든 스케줄 상태 표시
        // processing은 "송출중", scheduled는 "대기중", sent는 "완료", failed는 "실패"
        let jobStatus: "pending" | "processing" | "completed" | "failed";
        let broadcastStatus: "sending" | "completed" | "failed" | undefined;
        
        if (scheduleStatus === "processing") {
          jobStatus = "processing";
          broadcastStatus = "sending";
        } else if (scheduleStatus === "scheduled") {
          jobStatus = "pending";
          broadcastStatus = undefined; // 아직 송출 전
        } else if (scheduleStatus === "sent") {
          jobStatus = "completed";
          broadcastStatus = "completed";
        } else if (scheduleStatus === "failed") {
          jobStatus = "failed";
          broadcastStatus = "failed";
        } else {
          jobStatus = "pending";
        }

        jobList.push({
          id: `schedule_${schedule.id}`,
          type: "schedule",
          status: jobStatus,
          createdAt: schedule.createdAt || schedule.scheduledTime,
          scheduledTime: schedule.scheduledTime, // 전송시간
          completedAt: schedule.sentAt || undefined, // 완료시간 (송출 완료 시)
          broadcastStatus: broadcastStatus,
          error: schedule.failReason || undefined,
          scheduleId: schedule.id,
          scheduleName,
          generationName,
          generationPurpose,
          generationPurposeLabel,
          channelName,
        });
      });

      setJobs(jobList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error("작업 로드 실패:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 중복 스케줄 감지 (같은 generationId, targetChannel, scheduleName, createdAt이 1분 이내)
  const findDuplicateSchedules = (): string[] => {
    const duplicateIds: string[] = [];
    const groups = new Map<string, dbService.ScheduleRequestEntry[]>();

    // 스케줄들을 그룹화 (같은 generationId, targetChannel, scheduleName)
    schedules.forEach((schedule) => {
      const scheduleName = (schedule as any).scheduleName || "스케줄";
      const key = `${schedule.generationId}_${schedule.targetChannel}_${scheduleName}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key)!.push(schedule);
    });

    // 각 그룹에서 시간이 1분 이내인 중복 찾기
    groups.forEach((group) => {
      if (group.length <= 1) return; // 1개 이하면 중복 없음

      // 시간순 정렬
      group.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.scheduledTime).getTime();
        const timeB = new Date(b.createdAt || b.scheduledTime).getTime();
        return timeA - timeB;
      });

      // 첫 번째 스케줄을 기준으로, 1분 이내의 다른 스케줄들을 중복으로 표시
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const timeA = new Date(group[i].createdAt || group[i].scheduledTime).getTime();
          const timeB = new Date(group[j].createdAt || group[j].scheduledTime).getTime();
          const timeDiff = Math.abs(timeB - timeA) / 1000; // 초 단위

          if (timeDiff < 60) { // 1분(60초) 이내
            // j번째 스케줄을 중복으로 표시 (더 늦게 생성된 것)
            if (group[j].id && !duplicateIds.includes(group[j].id)) {
              duplicateIds.push(group[j].id);
            }
          } else {
            // 시간 차이가 1분 이상이면 중복 그룹이 끝남
            break;
          }
        }
      }
    });

    return duplicateIds;
  };

  const handleDeleteSchedule = async () => {
    if (!user?.id || !deleteDialog.scheduleId) return;
    
    try {
      const scheduleId = deleteDialog.scheduleId.replace("schedule_", "");
      const success = await dbService.deleteScheduleRequest(user.id, scheduleId);
      
      if (success) {
        toast({
          title: "삭제 완료",
          description: "스케줄이 삭제되었습니다.",
        });
        await loadJobs();
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
      setDeleteDialog({ open: false, scheduleId: null });
    }
  };

  const handleDeleteDuplicates = async () => {
    if (!user?.id || deleteDuplicatesDialog.duplicateIds.length === 0) return;
    
    try {
      let deletedCount = 0;
      let failedCount = 0;

      for (const scheduleId of deleteDuplicatesDialog.duplicateIds) {
        const success = await dbService.deleteScheduleRequest(user.id, scheduleId);
        if (success) {
          deletedCount++;
        } else {
          failedCount++;
        }
      }

      if (deletedCount > 0) {
        toast({
          title: "중복 삭제 완료",
          description: `${deletedCount}개의 중복 스케줄이 삭제되었습니다.${failedCount > 0 ? ` (${failedCount}개 실패)` : ""}`,
        });
        await loadJobs();
      } else {
        toast({
          title: "삭제 실패",
          description: "중복 스케줄 삭제 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("중복 스케줄 삭제 실패:", error);
      toast({
        title: "삭제 실패",
        description: "중복 스케줄 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setDeleteDuplicatesDialog({ open: false, duplicateIds: [] });
    }
  };

  const filteredJobs = jobs.filter((job) => {
    if (filterStatus === "all") return true;
    return job.status === filterStatus;
  });

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

  // 필터 변경 시 첫 페이지로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">대기 중</Badge>;
      case "processing":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500">처리 중</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-500/10 text-green-500">완료</Badge>;
      case "failed":
        return <Badge variant="outline" className="bg-red-500/10 text-red-500">실패</Badge>;
      default:
        return <Badge variant="outline">알 수 없음</Badge>;
    }
  };

  const getJobTypeLabel = (type: string) => {
    switch (type) {
      case "generation":
        return "음성 생성";
      case "mixing":
        return "믹싱";
      case "cloning":
        return "클로닝";
      case "schedule":
        return "스케줄";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">작업 큐</h1>
          <p className="text-muted-foreground mt-1">
            실행 중인 작업을 관리합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {findDuplicateSchedules().length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteDuplicatesDialog({ open: true, duplicateIds: findDuplicateSchedules() })}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              중복 삭제 ({findDuplicateSchedules().length}개)
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadJobs()}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
            새로고침
          </Button>
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                자동 새로고침
              </>
            ) : (
              <>
                <Clock className="w-4 h-4 mr-2" />
                수동 모드
              </>
            )}
          </Button>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px] sm:w-[180px]">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 상태</SelectItem>
              <SelectItem value="pending">대기 중</SelectItem>
              <SelectItem value="processing">처리 중</SelectItem>
              <SelectItem value="completed">완료</SelectItem>
              <SelectItem value="failed">실패</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(itemsPerPage)} onValueChange={(v) => {
            setItemsPerPage(Number(v));
            setCurrentPage(1);
          }}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5개씩</SelectItem>
              <SelectItem value="10">10개씩</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 작업 목록 */}
      {filteredJobs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">실행 중인 작업이 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="space-y-2 p-4" role="list" aria-label="작업 목록">
                {paginatedJobs.map((job) => (
                <div
                  key={job.id}
                  role="listitem"
                  tabIndex={0}
                  className="rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="min-w-0 space-y-2 flex-1">
                      <p className="font-medium text-base truncate">
                        {job.type === "schedule" && job.scheduleName
                          ? job.scheduleName
                          : getJobTypeLabel(job.type)}
                      </p>
                      {job.type === "schedule" && (
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          {job.generationName && (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>음원: {job.generationName}</span>
                              {job.generationPurposeLabel && job.generationPurpose && (
                                <Badge 
                                  variant="outline" 
                                  className={cn("text-[10px] px-1.5 py-0", getPurposeColor(job.generationPurpose))}
                                >
                                  {job.generationPurposeLabel}
                                </Badge>
                              )}
                            </div>
                          )}
                          {job.channelName && (
                            <div>채널: {job.channelName}</div>
                          )}
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            생성: {formatDateTime(job.createdAt)}
                          </span>
                          {job.type === "schedule" && job.scheduledTime && (
                            <>
                              <span className="text-muted-foreground/50">•</span>
                              <span className="flex items-center gap-1">
                                <Radio className="w-3 h-3" />
                                전송: {formatDateTime(job.scheduledTime)}
                              </span>
                            </>
                          )}
                        </div>
                        {job.type === "schedule" && job.broadcastStatus && (
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0 h-4",
                                job.broadcastStatus === "sending" && "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
                                job.broadcastStatus === "completed" && "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
                                job.broadcastStatus === "failed" && "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                              )}
                            >
                              {job.broadcastStatus === "sending" ? "송출중" : 
                               job.broadcastStatus === "completed" ? "완료" : "실패"}
                            </Badge>
                            {job.completedAt && (
                              <span className="flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                송출 완료: {formatDateTime(job.completedAt)}
                              </span>
                            )}
                          </div>
                        )}
                        {job.type !== "schedule" && job.completedAt && (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            완료: {formatDateTime(job.completedAt)}
                          </div>
                        )}
                      </div>
                      {job.progress !== undefined && (
                        <div className="mt-1">
                          <div className="w-full bg-muted rounded-full h-2">
                            <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${job.progress}%` }} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 text-center">{job.progress}%</p>
                        </div>
                      )}
                      {job.error && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {job.error}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-auto">
                      <div aria-label={`상태: ${job.status}`}>
                        {getStatusBadge(job.status)}
                      </div>
                      {job.type === "schedule" && (job.status === "pending" || job.status === "processing" || job.status === "failed") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteDialog({ open: true, scheduleId: job.id })}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </CardContent>
          </Card>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      이전
                    </Button>
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <PaginationItem key={page}>
                      <Button
                        variant={currentPage === page ? "outline" : "ghost"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="min-w-[2.5rem]"
                      >
                        {page}
                      </Button>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      다음
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}

      {/* 삭제 확인 대화상자 */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, scheduleId: deleteDialog.scheduleId })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>작업 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말 이 작업을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSchedule}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 중복 삭제 확인 대화상자 */}
      <AlertDialog open={deleteDuplicatesDialog.open} onOpenChange={(open) => setDeleteDuplicatesDialog({ open, duplicateIds: deleteDuplicatesDialog.duplicateIds })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>중복 작업 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDuplicatesDialog.duplicateIds.length}개의 중복된 스케줄을 삭제하시겠습니까?
              <br />
              같은 음원, 채널, 스케줄 이름을 가진 1분 이내에 생성된 중복 작업입니다.
              <br />
              이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDuplicates}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제 ({deleteDuplicatesDialog.duplicateIds.length}개)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
