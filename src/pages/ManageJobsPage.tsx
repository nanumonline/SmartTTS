import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import * as dbService from "@/services/dbService";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";

interface JobEntry {
  id: string;
  type: "generation" | "mixing" | "cloning" | "schedule";
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export default function ManageJobsPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    if (user?.id) {
      loadJobs();
    }
  }, [user?.id]);

  const loadJobs = async () => {
    if (!user?.id) return;
    try {
      // TODO: 실제 작업 큐 API 구현
      // 현재는 생성 내역 및 스케줄을 기반으로 작업 목록 생성
      const [generations, schedules] = await Promise.all([
        dbService.loadGenerations(user.id, 100),
        dbService.loadScheduleRequests(user.id),
      ]);

      const jobList: JobEntry[] = [];

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

      // 스케줄 작업
      schedules.forEach((schedule) => {
        if (schedule.status === "scheduled") {
          jobList.push({
            id: `schedule_${schedule.id}`,
            type: "schedule",
            status: "pending",
            createdAt: schedule.createdAt || schedule.scheduledTime,
          });
        }
      });

      setJobs(jobList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error("작업 로드 실패:", error);
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
                    <div className="min-w-0 space-y-2">
                      <p className="font-medium truncate">{getJobTypeLabel(job.type)}</p>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(job.createdAt).toLocaleString("ko-KR")}</span>
                        </div>
                        {job.completedAt && (
                          <p className="flex flex-wrap items-center gap-2 text-xs">
                            <CheckCircle className="w-3 h-3" />
                            <span>완료: {new Date(job.completedAt).toLocaleString("ko-KR")}</span>
                          </p>
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
                    <div className="flex-shrink-0 self-start sm:self-auto" aria-label={`상태: ${job.status}`}>
                      {getStatusBadge(job.status)}
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
    </div>
  );
}
