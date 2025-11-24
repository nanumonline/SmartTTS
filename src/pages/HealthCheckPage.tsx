import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import {
  performHealthCheck,
  startHealthCheckScheduler,
  type HealthCheckResult,
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

export default function HealthCheckPage() {
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(true);
  const [checkHistory, setCheckHistory] = useState<HealthCheckResult[]>([]);

  // 헬스체크 실행
  const runHealthCheck = useCallback(async () => {
    setIsChecking(true);
    try {
      const result = await performHealthCheck();
      setHealthResult(result);
      setCheckHistory((prev) => [result, ...prev].slice(0, 20)); // 최근 20개만 유지
    } catch (error) {
      console.error("헬스체크 실패:", error);
    } finally {
      setIsChecking(false);
    }
  }, []);

  // 자동 헬스체크 설정
  useEffect(() => {
    if (!autoCheckEnabled) return;

    const cleanup = startHealthCheckScheduler(5 * 60 * 1000, (result) => {
      setHealthResult(result);
      setCheckHistory((prev) => [result, ...prev].slice(0, 20));
    });

    // 초기 체크
    runHealthCheck();

    return cleanup;
  }, [autoCheckEnabled, runHealthCheck]);

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
              {autoCheckEnabled ? "자동 체크 중지" : "자동 체크 시작"}
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

      {/* 체크 이력 */}
      {checkHistory.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>체크 이력</CardTitle>
            <CardDescription>최근 헬스체크 결과 (최대 20개)</CardDescription>
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

