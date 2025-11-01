import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, CheckCircle, XCircle, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import * as dbService from "@/services/dbService";

export default function ReportsSendsPage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<dbService.ScheduleRequestEntry[]>([]);
  const [timeRange, setTimeRange] = useState<string>("30days");

  useEffect(() => {
    if (user?.id) {
      loadSchedules();
    }
  }, [user?.id, timeRange]);

  const loadSchedules = async () => {
    if (!user?.id) return;
    try {
      const data = await dbService.loadScheduleRequests(user.id);
      setSchedules(data);
    } catch (error) {
      console.error("스케줄 로드 실패:", error);
    }
  };

  const stats = {
    total: schedules.length,
    sent: schedules.filter((s) => s.status === "sent").length,
    failed: schedules.filter((s) => s.status === "failed").length,
    scheduled: schedules.filter((s) => s.status === "scheduled").length,
  };

  const successRate = stats.total > 0 ? ((stats.sent / stats.total) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">전송 리포트</h1>
          <p className="text-muted-foreground mt-1">
            전송 통계를 확인합니다.
          </p>
        </div>
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
          <CardDescription>전송 이력을 확인합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {schedules.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                전송 내역이 없습니다.
              </p>
            ) : (
              schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3">
                    <Send className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{schedule.targetName || "전송"}</p>
                      <p className="text-sm text-muted-foreground">
                        {schedule.targetChannel} • {new Date(schedule.scheduledTime).toLocaleString("ko-KR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {schedule.status === "sent" && (
                      <Badge variant="outline" className="bg-green-500/10 text-green-500">
                        성공
                      </Badge>
                    )}
                    {schedule.status === "failed" && (
                      <Badge variant="outline" className="bg-red-500/10 text-red-500">
                        실패
                      </Badge>
                    )}
                    {schedule.status === "scheduled" && (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-500">
                        예약됨
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
