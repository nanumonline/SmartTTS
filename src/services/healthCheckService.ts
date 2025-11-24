/**
 * 시스템 헬스체크 서비스
 * Supabase 무료 버전의 sleep 모드를 방지하기 위해 주기적으로 헬스체크를 실행합니다.
 */

import { supabase } from "@/integrations/supabase/client";

export interface HealthCheckResult {
  timestamp: string;
  status: "healthy" | "degraded" | "unhealthy";
  services: {
    supabase: ServiceHealth;
    database: ServiceHealth;
    edgeFunctions: ServiceHealth;
  };
  responseTime: {
    supabase: number; // ms
    database: number; // ms
    edgeFunctions: number; // ms
  };
  errors?: string[];
}

export interface ServiceHealth {
  status: "up" | "down" | "slow";
  message: string;
  responseTime?: number;
}

export const DAILY_HEALTH_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24시간

interface HealthCheckSchedulerOptions {
  /**
   * Whether the scheduler should trigger an immediate run.
   * Useful when the caller wants to control when the first run happens.
   */
  runOnStart?: boolean;
}

/**
 * Supabase 연결 상태 확인
 */
async function checkSupabaseConnection(): Promise<ServiceHealth> {
  const startTime = Date.now();
  try {
    const { data, error } = await supabase.auth.getSession();
    const responseTime = Date.now() - startTime;

    if (error) {
      return {
        status: "down",
        message: `연결 실패: ${error.message}`,
        responseTime,
      };
    }

    if (responseTime > 3000) {
      return {
        status: "slow",
        message: `응답 지연 (${responseTime}ms)`,
        responseTime,
      };
    }

    return {
      status: "up",
      message: "정상 연결",
      responseTime,
    };
  } catch (error: any) {
    return {
      status: "down",
      message: `오류: ${error?.message || "알 수 없는 오류"}`,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * 데이터베이스 응답 시간 측정
 */
async function checkDatabase(): Promise<ServiceHealth> {
  const startTime = Date.now();
  try {
    // 간단한 쿼리로 DB 응답 시간 측정
    const { data, error } = await supabase
      .from("tts_generations")
      .select("id")
      .limit(1);

    const responseTime = Date.now() - startTime;

    if (error) {
      // RLS 정책으로 인한 접근 거부는 정상 (DB는 작동 중)
      if (error.code === "PGRST116" || error.message.includes("permission")) {
        return {
          status: "up",
          message: "정상 (접근 권한 확인됨)",
          responseTime,
        };
      }

      return {
        status: "down",
        message: `DB 오류: ${error.message}`,
        responseTime,
      };
    }

    if (responseTime > 2000) {
      return {
        status: "slow",
        message: `응답 지연 (${responseTime}ms)`,
        responseTime,
      };
    }

    return {
      status: "up",
      message: `정상 (${responseTime}ms)`,
      responseTime,
    };
  } catch (error: any) {
    return {
      status: "down",
      message: `오류: ${error?.message || "알 수 없는 오류"}`,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * Edge Functions 상태 확인
 */
async function checkEdgeFunctions(): Promise<ServiceHealth> {
  const startTime = Date.now();
  try {
    // Supabase URL 직접 호출로 헬스체크 (간단한 ping)
    // Edge Functions는 verify_jwt=false인 경우에도 헬스체크 가능
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://gxxralruivyhdxyftsrg.supabase.co";
    const functionUrl = `${supabaseUrl}/functions/v1/execute-schedules?healthCheck=true`;
    
    // 헬스체크용 요청 (타임아웃 5초)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      const response = await fetch(functionUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        // 404는 함수가 없거나 sleep 상태일 수 있음
        if (response.status === 404) {
          return {
            status: "slow",
            message: "함수 응답 지연 (sleep 모드일 수 있음)",
            responseTime,
          };
        }

        return {
          status: "down",
          message: `함수 오류: HTTP ${response.status}`,
          responseTime,
        };
      }

      if (responseTime > 5000) {
        return {
          status: "slow",
          message: `응답 지연 (${responseTime}ms)`,
          responseTime,
        };
      }

      return {
        status: "up",
        message: `정상 (${responseTime}ms)`,
        responseTime,
      };
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      if (fetchError.name === "AbortError") {
        return {
          status: "slow",
          message: "타임아웃 (5초 초과)",
          responseTime,
        };
      }

      return {
        status: "down",
        message: `연결 실패: ${fetchError?.message || "알 수 없는 오류"}`,
        responseTime,
      };
    }
  } catch (error: any) {
    // 네트워크 오류나 타임아웃
    return {
      status: "down",
      message: `오류: ${error?.message || "알 수 없는 오류"}`,
      responseTime: Date.now() - startTime,
    };
  }
}

/**
 * 전체 시스템 헬스체크 실행
 */
export async function performHealthCheck(): Promise<HealthCheckResult> {
  const errors: string[] = [];
  const timestamp = new Date().toISOString();

  // 병렬로 모든 체크 실행
  const [supabaseHealth, dbHealth, edgeFunctionsHealth] = await Promise.all([
    checkSupabaseConnection(),
    checkDatabase(),
    checkEdgeFunctions(),
  ]);

  // 오류 수집
  if (supabaseHealth.status === "down") {
    errors.push(`Supabase: ${supabaseHealth.message}`);
  }
  if (dbHealth.status === "down") {
    errors.push(`Database: ${dbHealth.message}`);
  }
  if (edgeFunctionsHealth.status === "down") {
    errors.push(`Edge Functions: ${edgeFunctionsHealth.message}`);
  }

  // 전체 상태 결정
  let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
  if (errors.length > 0) {
    overallStatus = "unhealthy";
  } else if (
    supabaseHealth.status === "slow" ||
    dbHealth.status === "slow" ||
    edgeFunctionsHealth.status === "slow"
  ) {
    overallStatus = "degraded";
  }

  return {
    timestamp,
    status: overallStatus,
    services: {
      supabase: supabaseHealth,
      database: dbHealth,
      edgeFunctions: edgeFunctionsHealth,
    },
    responseTime: {
      supabase: supabaseHealth.responseTime || 0,
      database: dbHealth.responseTime || 0,
      edgeFunctions: edgeFunctionsHealth.responseTime || 0,
    },
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * 주기적인 헬스체크 실행 (Supabase를 깨어있게 유지)
 * @param intervalMs 체크 간격 (밀리초, 기본값: 24시간)
 * @param onResult 헬스체크 결과 콜백
 * @returns 정리 함수
 */
export function startHealthCheckScheduler(
  intervalMs: number = DAILY_HEALTH_CHECK_INTERVAL,
  onResult?: (result: HealthCheckResult) => void,
  options: HealthCheckSchedulerOptions = {}
): () => void {
  let intervalId: number | null = null;
  let isRunning = false;

  const runCheck = async () => {
    if (isRunning) return;
    isRunning = true;

    try {
      const result = await performHealthCheck();
      if (onResult) {
        onResult(result);
      }
    } catch (error) {
      console.error("[HealthCheck] 헬스체크 실행 실패:", error);
    } finally {
      isRunning = false;
    }
  };

  if (options.runOnStart ?? true) {
    runCheck();
  }

  // 주기적으로 실행
  intervalId = window.setInterval(runCheck, intervalMs);

  // 정리 함수 반환
  return () => {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  };
}
