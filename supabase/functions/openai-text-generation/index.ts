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

    const { type, prompt, original, instruction, organization, department } = await req.json();
    
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

    // 시스템 프롬프트
    const systemPrompt = [
      "당신은 대한민국 공공기관 방송 문구 작성 전문가입니다.",
      "격식 있고 신뢰감 있는 톤으로 작성하며, 간결하고 명확한 문장을 사용합니다.",
      "방송용으로 호흡이 자연스럽고 발음이 명확하도록 문장을 구성하세요.",
      "TTS 친화적으로 숫자, 단위를 명확히 표기하세요.",
    ].join(" ");

    let userPrompt = "";
    
    if (type === "generate") {
      // 텍스트 생성
      const org = organization || "귀 기관";
      const dept = department || "관계 부서";
      userPrompt = `${org} ${dept} 방송문: ${prompt}`;
    } else if (type === "edit") {
      // 텍스트 편집
      userPrompt = `다음 방송 원문을 지침에 맞춰 자연스럽게 수정해 주세요.\n\n[원문]\n${original}\n\n[지침]\n${instruction}\n\n요구사항: 방송용 격식, 명확한 발음, 간결한 문장, 숫자/단위 명확화.`;
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
    const generatedText = data.choices?.[0]?.message?.content || "";

    if (!generatedText) {
      return new Response(
        JSON.stringify({ error: "OpenAI 응답을 해석할 수 없습니다." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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
