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
    
    // 경로에서 voice_id 추출: /functions/v1/supertone-proxy/text-to-speech/{voice_id}
    let voiceId = "";
    const pathMatch = url.pathname.match(/\/text-to-speech\/([^/?]+)/);
    if (pathMatch) {
      voiceId = pathMatch[1];
    }
    
    // voice_id가 없으면 query parameter에서 시도
    if (!voiceId) {
      voiceId = url.searchParams.get("voice_id") || "";
    }
    
    if (!voiceId) {
      return new Response(
        JSON.stringify({ error: "voice_id가 필요합니다." }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    
    // 요청 본문 가져오기
    let requestBody: any = {};
    if (req.method === "POST") {
      const bodyText = await req.text();
      if (bodyText) {
        try {
          requestBody = JSON.parse(bodyText);
        } catch (e) {
          return new Response(
            JSON.stringify({ error: "잘못된 JSON 형식입니다." }),
            {
              status: 400,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            }
          );
        }
      }
    }
    
    // Supertone API 호출 URL
    const supetoneBaseUrl = "https://api.supertoneapi.com/v1";
    const outputFormat = url.searchParams.get("output_format") || "mp3";
    const targetUrl = `${supetoneBaseUrl}/text-to-speech/${voiceId}?output_format=${outputFormat}`;
    
    // 요청 본문 구성
    const body = req.method === "POST" ? JSON.stringify(requestBody) : undefined;

    // Supertone API 키를 환경 변수에서 가져오기
    const supertoneApiKey = Deno.env.get("SUPERTONE_API_KEY");
    if (!supertoneApiKey) {
      return new Response(
        JSON.stringify({ error: "SUPERTONE_API_KEY가 설정되지 않았습니다." }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // 요청 헤더 구성
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-sup-api-key": supertoneApiKey,
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

