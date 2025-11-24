import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import {
  performHealthCheck,
  startHealthCheckScheduler,
  type HealthCheckResult,
  DAILY_HEALTH_CHECK_INTERVAL,
} from "@/services/healthCheckService";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Activity,
  Database,
  Zap,
  Clock,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/pageUtils";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import type { TooltipProps } from "recharts";

const HISTORY_STORAGE_KEY = "voicecraft:health-history";
const LAST_RUN_STORAGE_KEY = "voicecraft:health-last-run";
const HISTORY_LIMIT = 30;

interface HealthChartPoint {
  label: string;
  supabase: number;
  database: number;
  edgeFunctions: number;
  statusScore: number;
  fullTimestamp: string;
}

const statusScoreMap: Record<HealthCheckResult["status"], number> = {
  healthy: 100,
  degraded: 50,
  unhealthy: 0,
};

const getStoredHistory = (): HealthCheckResult[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (error) {
    console.warn("[HealthCheck] 저장된 이력을 불러오지 못했습니다:", error);
    return [];
  }
};

const persistLastRunTimestamp = (timestamp: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_RUN_STORAGE_KEY, timestamp);
  } catch (error) {
    console.warn("[HealthCheck] 마지막 실행 시간을 저장하지 못했습니다:", error);
  }
};

const persistHistory = (history: HealthCheckResult[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    if (history[0]) {
      persistLastRunTimestamp(history[0].timestamp);
    }
  } catch (error) {
    console.warn("[HealthCheck] 이력을 저장하지 못했습니다:", error);
  }
};

const getLastRunTimestamp = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LAST_RUN_STORAGE_KEY);
};

const isDailyCheckDue = () => {
  const lastRun = getLastRunTimestamp();
  if (!lastRun) return true;
  const lastRunTime = new Date(lastRun).getTime();
  if (Number.isNaN(lastRunTime)) return true;
  return Date.now() - lastRunTime >= DAILY_HEALTH_CHECK_INTERVAL;
};

const statusToScore = (status: HealthCheckResult["status"]) => statusScoreMap[status];

const formatChartLabel = (timestamp: string) => {
  const date = new Date(timestamp);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  return `${month}/${day} ${hours}h`;
};

const HealthChartTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload as HealthChartPoint | undefined;
  if (!data) return null;

  return (
    <div className="rounded-md border bg-background p-3 text-xs shadow-md">
      <p className="font-medium">{data.fullTimestamp}</p>
      <div className="mt-2 space-y-1">
        <p className="text-blue-500">Supabase: {data.supabase}ms</p>
        <p className="text-purple-500">Database: {data.database}ms</p>
        <p className="text-orange-500">Edge Functions: {data.edgeFunctions}ms</p>
        <p className="text-muted-foreground">
          상태 지표: {data.statusScore === 100 ? "정상" : data.statusScore === 50 ? "주의" : "오류"}
        </p>
      </div>
    </div>
  );
};

export default function HealthCheckPage() {
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(true);
  const [checkHistory, setCheckHistory] = useState<HealthCheckResult[]>([]);

  // 저장된 이력 복원
  useEffect(() => {
    const storedHistory = getStoredHistory();
    if (storedHistory.length > 0) {
      setCheckHistory(storedHistory);
      setHealthResult(storedHistory[0]);
      persistLastRunTimestamp(storedHistory[0].timestamp);
    }
  }, []);

  const recordHealthResult = useCallback((result: HealthCheckResult) => {
    setHealthResult(result);
    setCheckHistory((prev) => {
      const deduped = prev.filter((item) => item.timestamp !== result.timestamp);
      const nextHistory = [result, ...deduped].slice(0, HISTORY_LIMIT);
      persistHistory(nextHistory);
      return nextHistory;
    });
  }, []);

  // 헬스체크 실행
  const runHealthCheck = useCallback(async () => {
    setIsChecking(true);
    try {
      const result = await performHealthCheck();
      recordHealthResult(result);
    } catch (error) {
      console.error("헬스체크 실패:", error);
    } finally {
      setIsChecking(false);
    }
  }, [recordHealthResult]);

  // 자동 헬스체크 설정
  useEffect(() => {
    if (!autoCheckEnabled) return;

    const cleanup = startHealthCheckScheduler(
      DAILY_HEALTH_CHECK_INTERVAL,
      (result) => {
        recordHealthResult(result);
      },
      { runOnStart: false }
    );

    if (isDailyCheckDue()) {
      runHealthCheck();
    }

    return cleanup;
  }, [autoCheckEnabled, recordHealthResult, runHealthCheck]);

  const chartData = useMemo<HealthChartPoint[]>(() => {
    if (checkHistory.length === 0) return [];
    return [...checkHistory]
      .reverse()
      .map((item) => ({
        label: formatChartLabel(item.timestamp),
        supabase: item.responseTime.supabase,
        database: item.responseTime.database,
        edgeFunctions: item.responseTime.edgeFunctions,
        statusScore: statusToScore(item.status),
        fullTimestamp: formatDateTime(item.timestamp),
      }));
  }, [checkHistory]);

  const getStatusIcon = (status: HealthCheckResult["status"]) => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "degraded":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "unhealthy":
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusBadge = (status: HealthCheckResult["status"]) => {
    switch (status) {
      case "healthy":
        return <Badge className="bg-green-500">정상</Badge>;
      case "degraded":
        return <Badge className="bg-yellow-500">성능 저하</Badge>;
      case "unhealthy":
        return <Badge className="bg-red-500">오류</Badge>;
    }
  };

  const getServiceStatusIcon = (serviceStatus: "up" | "down" | "slow") => {
    switch (serviceStatus) {
      case "up":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "slow":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "down":
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getServiceStatusBadge = (serviceStatus: "up" | "down" | "slow") => {
    switch (serviceStatus) {
      case "up":
        return <Badge variant="outline" className="border-green-500 text-green-500">정상</Badge>;
      case "slow":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500">지연</Badge>;
      case "down":
        return <Badge variant="outline" className="border-red-500 text-red-500">오류</Badge>;
    }
  };

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        title="시스템 헬스체크"
        description="Supabase 및 시스템 서비스 상태를 모니터링합니다."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoCheckEnabled(!autoCheckEnabled)}
            >
              {autoCheckEnabled ? "하루 1회 자동 체크 중지" : "하루 1회 자동 체크 시작"}
            </Button>
            <Button onClick={runHealthCheck} disabled={isChecking}>
              <RefreshCw className={cn("w-4 h-4 mr-2", isChecking && "animate-spin")} />
              수동 체크
            </Button>
          </div>
        }
      />

      {/* 전체 상태 */}
      {healthResult && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {getStatusIcon(healthResult.status)}
                <div>
                  <CardTitle>시스템 상태</CardTitle>
                  <CardDescription>
                    마지막 체크: {formatDateTime(healthResult.timestamp)}
                  </CardDescription>
                </div>
              </div>
              {getStatusBadge(healthResult.status)}
            </div>
          </CardHeader>
          <CardContent>
            {healthResult.errors && healthResult.errors.length > 0 && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>오류 발생</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside mt-2">
                    {healthResult.errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* 서비스별 상태 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              {/* Supabase */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-blue-500" />
                      <CardTitle className="text-base">Supabase</CardTitle>
                    </div>
                    {getServiceStatusIcon(healthResult.services.supabase.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {getServiceStatusBadge(healthResult.services.supabase.status)}
                    <p className="text-sm text-muted-foreground">
                      {healthResult.services.supabase.message}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {healthResult.responseTime.supabase}ms
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Database */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-purple-500" />
                      <CardTitle className="text-base">Database</CardTitle>
                    </div>
                    {getServiceStatusIcon(healthResult.services.database.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {getServiceStatusBadge(healthResult.services.database.status)}
                    <p className="text-sm text-muted-foreground">
                      {healthResult.services.database.message}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {healthResult.responseTime.database}ms
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Edge Functions */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-orange-500" />
                      <CardTitle className="text-base">Edge Functions</CardTitle>
                    </div>
                    {getServiceStatusIcon(healthResult.services.edgeFunctions.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {getServiceStatusBadge(healthResult.services.edgeFunctions.status)}
                    <p className="text-sm text-muted-foreground">
                      {healthResult.services.edgeFunctions.message}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {healthResult.responseTime.edgeFunctions}ms
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 히스토리 그래프 */}
      {chartData.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>헬스체크 추이</CardTitle>
            <CardDescription>최대 {HISTORY_LIMIT}개의 최근 이력을 기반으로 하루 1회의 응답 변동을 확인하세요.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis
                  yAxisId="time"
                  tickFormatter={(value) => `${value}ms`}
                  tick={{ fontSize: 12 }}
                  width={70}
                />
                <YAxis
                  yAxisId="status"
                  orientation="right"
                  domain={[0, 100]}
                  tickFormatter={(value) =>
                    value === 100 ? "정상" : value === 50 ? "주의" : value === 0 ? "오류" : ""
                  }
                  ticks={[0, 50, 100]}
                  width={60}
                />
                <Tooltip content={<HealthChartTooltip />} />
                <Legend />
                <Line
                  yAxisId="time"
                  type="monotone"
                  dataKey="supabase"
                  name="Supabase"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  yAxisId="time"
                  type="monotone"
                  dataKey="database"
                  name="Database"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  yAxisId="time"
                  type="monotone"
                  dataKey="edgeFunctions"
                  name="Edge Functions"
                  stroke="#fb923c"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  yAxisId="status"
                  type="stepAfter"
                  dataKey="statusScore"
                  name="상태 지표"
                  stroke="#22c55e"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* 체크 이력 */}
      {checkHistory.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>체크 이력</CardTitle>
            <CardDescription>최근 헬스체크 결과 (최대 {HISTORY_LIMIT}개)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {checkHistory.map((result, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <div>
                      <p className="text-sm font-medium">
                        {formatDateTime(result.timestamp)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Supabase: {result.responseTime.supabase}ms | DB:{" "}
                        {result.responseTime.database}ms | Functions:{" "}
                        {result.responseTime.edgeFunctions}ms
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(result.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 초기 로딩 */}
      {!healthResult && isChecking && (
        <Card className="mt-6">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">헬스체크 실행 중...</p>
            </div>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
