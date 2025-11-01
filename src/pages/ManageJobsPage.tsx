import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Play, Pause, X, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import * as dbService from "@/services/dbService";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">작업 큐</h1>
          <p className="text-muted-foreground mt-1">
            실행 중인 작업을 관리합니다.
          </p>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="pending">대기 중</SelectItem>
            <SelectItem value="processing">처리 중</SelectItem>
            <SelectItem value="completed">완료</SelectItem>
            <SelectItem value="failed">실패</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 작업 목록 */}
      <div className="grid gap-4">
        {filteredJobs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Clock className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">실행 중인 작업이 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          filteredJobs.map((job) => (
            <Card key={job.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">
                      {getJobTypeLabel(job.type)}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(job.createdAt).toLocaleString("ko-KR")}</span>
                      {job.completedAt && (
                        <>
                          <span>•</span>
                          <span>완료: {new Date(job.completedAt).toLocaleString("ko-KR")}</span>
                        </>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(job.status)}
                  </div>
                </div>
              </CardHeader>
              {job.progress !== undefined && (
                <CardContent>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {job.progress}%
                  </p>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
