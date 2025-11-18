// OpenAI 텍스트 생성 Edge Function
// 공공기관 방송 문구 생성 및 편집을 처리합니다

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // CORS preflight 처리
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 인증 확인 (Defense in Depth)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("인증 헤더 누락");
      return new Response(
        JSON.stringify({ error: "인증이 필요합니다." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Supabase 클라이언트로 사용자 확인
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("인증 실패:", authError?.message);
      return new Response(
        JSON.stringify({ error: "유효하지 않은 인증입니다." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`요청 사용자: ${user.id}`);

    const { type, prompt, original, instruction, organization, department, purposeLabel } = await req.json();
    
    // OpenAI API 키 확인
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY가 설정되지 않았습니다." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 시스템 프롬프트 최적화 (토큰 절약)
    const systemPrompt = "공공기관 방송문 전문가. 격식 있고 간결한 문장. TTS 친화적 숫자/단위 표기.";

    let userPrompt = "";
    
    if (type === "generate") {
      // 텍스트 생성 - 최적화된 프롬프트
      const purpose = purposeLabel || "안내방송";
      userPrompt = `${purpose}: ${prompt}`;
    } else if (type === "edit") {
      // 텍스트 편집 - 최적화된 프롬프트
      userPrompt = `[원문]\n${original}\n\n[지침]\n${instruction}\n\n수정: 방송용 격식, 명확한 발음, 간결한 문장.`;
    } else {
      return new Response(
        JSON.stringify({ error: "type은 'generate' 또는 'edit'이어야 합니다." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // OpenAI API 호출
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAIApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API 오류:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `OpenAI API 오류: ${errorText}` }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    let generatedText = data.choices?.[0]?.message?.content || "";

    if (!generatedText) {
      return new Response(
        JSON.stringify({ error: "OpenAI 응답을 해석할 수 없습니다." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // 방송문 표현 개선: "~하는 방송문입니다" → "안내방송입니다. ~방송입니다"
    const purpose = purposeLabel || "안내방송";
    // "방송문입니다" 패턴을 찾아서 "방송입니다"로 변경하고 앞에 목적 추가
    generatedText = generatedText
      .replace(/(.+?)(하는|하는 )방송문입니다/g, `${purpose}입니다. $1방송입니다`)
      .replace(/(.+?)(하는|하는 )방송문이에요/g, `${purpose}입니다. $1방송입니다`)
      .replace(/(.+?)(하는|하는 )방송문이야/g, `${purpose}입니다. $1방송입니다`)
      .replace(/방송문입니다/g, `${purpose}입니다`)
      .replace(/방송문이에요/g, `${purpose}입니다`)
      .replace(/방송문이야/g, `${purpose}입니다`);

    return new Response(
      JSON.stringify({ text: generatedText }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("OpenAI 텍스트 생성 오류:", error);
    return new Response(
      JSON.stringify({ error: error.message || "서버 오류가 발생했습니다." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
