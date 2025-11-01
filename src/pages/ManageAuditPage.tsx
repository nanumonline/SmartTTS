import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, FileSearch, Calendar, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import * as dbService from "@/services/dbService";

interface AuditLog {
  id: string;
  action: string;
  type: "create" | "update" | "delete" | "approve" | "reject" | "send";
  resource: string;
  userId: string;
  timestamp: string;
  details?: any;
}

export default function ManageAuditPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    if (user?.id) {
      loadAuditLogs();
    }
  }, [user?.id]);

  const loadAuditLogs = async () => {
    if (!user?.id) return;
    try {
      // TODO: 실제 감사 로그 API 구현
      // 현재는 생성 내역, 스케줄, 검수 상태를 기반으로 로그 생성
      const [generations, schedules, reviewStates] = await Promise.all([
        dbService.loadGenerations(user.id, 100),
        dbService.loadScheduleRequests(user.id),
        dbService.loadReviewStates(user.id),
      ]);

      const auditLogs: AuditLog[] = [];

      // 생성 로그
      generations.forEach((gen) => {
        auditLogs.push({
          id: `log_gen_${gen.id}`,
          action: "음원 생성",
          type: "create",
          resource: `generation:${gen.id}`,
          userId: user.id,
          timestamp: gen.createdAt || new Date().toISOString(),
          details: { purpose: gen.purpose, voiceName: gen.voiceName },
        });
      });

      // 스케줄 로그
      schedules.forEach((schedule) => {
        auditLogs.push({
          id: `log_schedule_${schedule.id}`,
          action: "스케줄 생성",
          type: "create",
          resource: `schedule:${schedule.id}`,
          userId: user.id,
          timestamp: schedule.createdAt || schedule.scheduledTime,
          details: { targetChannel: schedule.targetChannel },
        });
      });

      // 검수 로그
      reviewStates.forEach((state, genId) => {
        auditLogs.push({
          id: `log_review_${genId}`,
          action: state.status === "approved" ? "승인" : "반려",
          type: state.status === "approved" ? "approve" : "reject",
          resource: `generation:${genId}`,
          userId: user.id,
          timestamp: state.updatedAt || new Date().toISOString(),
          details: { comments: state.comments },
        });
      });

      setLogs(auditLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (error) {
      console.error("감사 로그 로드 실패:", error);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || log.type === filterType;
    return matchesSearch && matchesType;
  });

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "create":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500">생성</Badge>;
      case "update":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">수정</Badge>;
      case "delete":
        return <Badge variant="outline" className="bg-red-500/10 text-red-500">삭제</Badge>;
      case "approve":
        return <Badge variant="outline" className="bg-green-500/10 text-green-500">승인</Badge>;
      case "reject":
        return <Badge variant="outline" className="bg-red-500/10 text-red-500">반려</Badge>;
      case "send":
        return <Badge variant="outline" className="bg-purple-500/10 text-purple-500">전송</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">감사로그</h1>
          <p className="text-muted-foreground mt-1">
            시스템 활동 로그를 확인합니다.
          </p>
        </div>
      </div>

      {/* 필터 및 검색 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="로그 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 유형</SelectItem>
            <SelectItem value="create">생성</SelectItem>
            <SelectItem value="update">수정</SelectItem>
            <SelectItem value="delete">삭제</SelectItem>
            <SelectItem value="approve">승인</SelectItem>
            <SelectItem value="reject">반려</SelectItem>
            <SelectItem value="send">전송</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 로그 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>활동 로그</CardTitle>
          <CardDescription>
            최근 시스템 활동 내역을 확인합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredLogs.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                로그가 없습니다.
              </p>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <FileSearch className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">{log.action}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {log.resource} • {new Date(log.timestamp).toLocaleString("ko-KR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getTypeBadge(log.type)}
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
