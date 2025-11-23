import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Send, CheckCircle, XCircle, Clock, Music2, Radio } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import * as dbService from "@/services/dbService";
import { formatDateTime, purposeOptions } from "@/lib/pageUtils";
import { getPurposeColor } from "@/lib/categoryColors";
import { cn } from "@/lib/utils";

interface EnhancedSchedule extends dbService.ScheduleRequestEntry {
  generationName?: string;
  generationPurpose?: string;
  generationPurposeLabel?: string;
  channelName?: string;
  scheduleName?: string;
}

export default function ReportsSendsPage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<EnhancedSchedule[]>([]);
  const [timeRange, setTimeRange] = useState<string>("30days");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    if (user?.id) {
      loadSchedules();
    }
  }, [user?.id, timeRange]);

  const loadSchedules = async () => {
    if (!user?.id) return;
    try {
      const [schedulesData, generationsData, channelsData] = await Promise.all([
        dbService.loadScheduleRequests(user.id),
        dbService.loadGenerations(user.id, 1000),
        dbService.loadChannels(user.id),
      ]);

      // 채널 이름 가져오기 헬퍼 함수
      const getChannelName = (targetChannel: string): string => {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetChannel);
        if (isUUID) {
          const channel = channelsData.find(ch => ch.id === targetChannel);
          return channel?.name || targetChannel;
        } else {
          const channel = channelsData.find(ch => ch.type === targetChannel);
          return channel?.name || targetChannel;
        }
      };

      // 스케줄 데이터에 generation 정보와 channel 정보 추가
      const enhancedSchedules: EnhancedSchedule[] = schedulesData.map((schedule) => {
        const generation = generationsData.find(gen => gen.id === schedule.generationId);
        const channelName = getChannelName(schedule.targetChannel);
        const purposeOption = generation?.purpose ? purposeOptions.find(p => p.id === generation.purpose) : null;
        
        return {
          ...schedule,
          generationName: generation?.savedName || generation?.purposeLabel || generation?.purpose || "음원",
          generationPurpose: generation?.purpose || "",
          generationPurposeLabel: generation?.purposeLabel || purposeOption?.label || generation?.purpose || "",
          channelName: channelName,
          scheduleName: (schedule as any).scheduleName || schedule.targetName || "전송",
        };
      });

      // 시간 범위 필터링
      const filteredSchedules = enhancedSchedules.filter((schedule) => {
        if (timeRange === "all") return true;
        
        const scheduleTime = new Date(schedule.scheduledTime || schedule.createdAt || Date.now());
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - scheduleTime.getTime()) / (1000 * 60 * 60 * 24));
        
        switch (timeRange) {
          case "7days":
            return diffDays <= 7;
          case "30days":
            return diffDays <= 30;
          case "90days":
            return diffDays <= 90;
          default:
            return true;
        }
      });

      // 시간 역순 정렬 (최신순)
      filteredSchedules.sort((a, b) => {
        const timeA = new Date(a.scheduledTime || a.createdAt || 0).getTime();
        const timeB = new Date(b.scheduledTime || b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      setSchedules(filteredSchedules);
      setCurrentPage(1); // 필터 변경 시 첫 페이지로
    } catch (error) {
      console.error("스케줄 로드 실패:", error);
    }
  };

  const stats = {
    total: schedules.length,
    sent: schedules.filter((s) => s.status === "sent").length,
    failed: schedules.filter((s) => s.status === "failed").length,
    scheduled: schedules.filter((s) => s.status === "scheduled").length,
    processing: schedules.filter((s) => s.status === "processing").length,
  };

  const successRate = stats.total > 0 ? ((stats.sent / stats.total) * 100).toFixed(1) : "0";

  // 페이지네이션 계산
  const totalPages = Math.ceil(schedules.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSchedules = schedules.slice(startIndex, endIndex);

  // 필터 변경 시 첫 페이지로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [timeRange]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">전송 리포트</h1>
          <p className="text-muted-foreground mt-1">
            전송 통계 및 내역을 확인합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
              <SelectItem value="20">20개씩</SelectItem>
              <SelectItem value="50">50개씩</SelectItem>
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">최근 7일</SelectItem>
              <SelectItem value="30days">최근 30일</SelectItem>
              <SelectItem value="90days">최근 90일</SelectItem>
              <SelectItem value="all">전체</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              총 전송 수
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">전체 전송 요청</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              성공
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.sent}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total > 0 ? ((stats.sent / stats.total) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500" />
              실패
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.failed}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total > 0 ? ((stats.failed / stats.total) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              예약됨
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.scheduled}</div>
            <p className="text-xs text-muted-foreground mt-1">대기 중</p>
          </CardContent>
        </Card>
      </div>

      {/* 전송 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>전송 내역</CardTitle>
          <CardDescription>전송 이력을 확인합니다. (총 {schedules.length}개)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Send className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">전송 내역이 없습니다.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 p-4" role="list" aria-label="전송 내역 목록">
                {paginatedSchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    role="listitem"
                    className="rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div className="min-w-0 space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-base truncate">
                            {schedule.scheduleName || schedule.targetName || "전송"}
                          </p>
                          {schedule.status === "sent" && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-500 text-xs">
                              성공
                            </Badge>
                          )}
                          {schedule.status === "failed" && (
                            <Badge variant="outline" className="bg-red-500/10 text-red-500 text-xs">
                              실패
                            </Badge>
                          )}
                          {schedule.status === "scheduled" && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-500 text-xs">
                              예약됨
                            </Badge>
                          )}
                          {schedule.status === "processing" && (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 text-xs">
                              진행 중
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1.5">
                              <Music2 className="w-3.5 h-3.5" />
                              <span className="text-xs">음원: {schedule.generationName || "알 수 없음"}</span>
                              {schedule.generationPurposeLabel && schedule.generationPurpose && (
                                <Badge 
                                  variant="outline" 
                                  className={cn("text-[10px] px-1.5 py-0", getPurposeColor(schedule.generationPurpose))}
                                >
                                  {schedule.generationPurposeLabel}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Radio className="w-3.5 h-3.5" />
                              <span className="text-xs">채널: {schedule.channelName || schedule.targetChannel || "알 수 없음"}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />
                              <span>
                                {schedule.scheduledTime 
                                  ? formatDateTime(schedule.scheduledTime) 
                                  : schedule.createdAt 
                                  ? formatDateTime(schedule.createdAt) 
                                  : "-"}
                              </span>
                            </div>
                            {schedule.sentAt && schedule.status === "sent" && (
                              <>
                                <span className="text-muted-foreground/70">•</span>
                                <span className="text-green-600 dark:text-green-400">
                                  전송: {formatDateTime(schedule.sentAt)}
                                </span>
                              </>
                            )}
                            {schedule.failReason && schedule.status === "failed" && (
                              <>
                                <span className="text-muted-foreground/70">•</span>
                                <span className="text-red-600 dark:text-red-400 text-xs line-clamp-1">
                                  실패: {schedule.failReason}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center p-4 border-t">
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
        </CardContent>
      </Card>
    </div>
  );
}
