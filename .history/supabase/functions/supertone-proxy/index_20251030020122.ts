import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Supertone API 프록시 Edge Function
// CORS 문제를 해결하기 위해 서버 사이드에서 API를 호출합니다

Deno.serve(async (req: Request) => {
  // CORS 헤더 설정
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-sup-api-key",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };

  // OPTIONS 요청 처리 (Preflight)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace("/supertone-proxy", "");
    
    // Supertone API base URL
    const supetoneBaseUrl = "https://api.supertoneapi.com/v1";
    const targetUrl = `${supetoneBaseUrl}${path}${url.search}`;

    // 요청 본문 가져오기
    const body = req.method === "POST" ? await req.text() : undefined;

    // 요청 헤더 구성
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-sup-api-key": req.headers.get("x-sup-api-key") || "",
    };

    // Supertone API 호출
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    // 응답 데이터 가져오기
    const contentType = response.headers.get("content-type") || "";
    let responseData;

    if (contentType.includes("application/json")) {
      responseData = await response.json();
    } else {
      // 오디오 파일인 경우
      responseData = await response.blob();
    }

    // 응답 헤더 구성
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": contentType,
    };

    // X-Audio-Length 헤더 전달
    const audioLength = response.headers.get("X-Audio-Length");
    if (audioLength) {
      responseHeaders["X-Audio-Length"] = audioLength;
    }

    // JSON 응답인 경우
    if (contentType.includes("application/json")) {
      return new Response(JSON.stringify(responseData), {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Blob 응답인 경우 (오디오 파일)
    return new Response(responseData, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error("Supertone Proxy Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "프록시 오류가 발생했습니다." }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});

