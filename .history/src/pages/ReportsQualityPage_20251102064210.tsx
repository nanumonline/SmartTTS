import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, TrendingUp, BarChart3, Volume2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import * as dbService from "@/services/dbService";

export default function ReportsQualityPage() {
  const { user } = useAuth();
  const [generations, setGenerations] = useState<dbService.GenerationEntry[]>([]);
  const [timeRange, setTimeRange] = useState<string>("30days");

  useEffect(() => {
    if (user?.id) {
      loadGenerations();
    }
  }, [user?.id, timeRange]);

  const loadGenerations = async () => {
    if (!user?.id) return;
    try {
      const data = await dbService.loadGenerations(user.id, 1000);
      setGenerations(data);
    } catch (error) {
      console.error("생성 내역 로드 실패:", error);
    }
  };

  // 통계 계산
  const stats = {
    total: generations.length,
    withAudio: generations.filter((g) => g.hasAudio && g.audioUrl).length,
    averageDuration: generations.reduce((sum, g) => sum + (g.duration || 0), 0) / (generations.length || 1),
    totalDuration: generations.reduce((sum, g) => sum + (g.duration || 0), 0),
  };

  // 음성별 통계
  const voiceStats = generations.reduce((acc, gen) => {
    const voiceName = gen.voiceName || "알 수 없음";
    if (!acc[voiceName]) {
      acc[voiceName] = { count: 0, totalDuration: 0 };
    }
    acc[voiceName].count++;
    acc[voiceName].totalDuration += gen.duration || 0;
    return acc;
  }, {} as Record<string, { count: number; totalDuration: number }>);

  const voiceStatsArray = Object.entries(voiceStats)
    .map(([voice, data]) => ({
      voice,
      count: data.count,
      totalDuration: data.totalDuration,
      percentage: (data.count / stats.total) * 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const qualityRate = stats.total > 0 ? ((stats.withAudio / stats.total) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">품질 리포트</h1>
          <p className="text-muted-foreground mt-1">
            음원 품질 통계를 확인합니다.
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
              총 생성 수
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">전체 음원</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              품질 보장률
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{qualityRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.withAudio}/{stats.total} 음원
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-blue-500" />
              평균 길이
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {Math.floor(stats.averageDuration)}초
            </div>
            <p className="text-xs text-muted-foreground mt-1">음원당 평균</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-500" />
              총 재생 시간
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-500">
              {Math.floor(stats.totalDuration / 60)}분
            </div>
            <p className="text-xs text-muted-foreground mt-1">전체 누적</p>
          </CardContent>
        </Card>
      </div>

      {/* 음성별 통계 */}
      <Card>
        <CardHeader>
          <CardTitle>음성별 사용 통계</CardTitle>
          <CardDescription>
            가장 많이 사용된 음성 TOP 10
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {voiceStatsArray.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                통계 데이터가 없습니다.
              </p>
            ) : (
              voiceStatsArray.map((stat, index) => (
                <div key={stat.voice} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{index + 1}</Badge>
                      <span className="font-medium">{stat.voice}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">{stat.count}회</span>
                      <span className="text-muted-foreground">
                        {Math.floor(stat.totalDuration / 60)}분
                      </span>
                      <Badge variant="outline">{stat.percentage.toFixed(1)}%</Badge>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${stat.percentage}%` }}
                    />
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
