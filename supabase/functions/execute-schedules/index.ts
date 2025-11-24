import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ScheduleRequest {
  id: string;
  user_id: string;
  generation_id: string;
  target_channel: string;
  scheduled_time: string;
  status: string;
  schedule_name?: string;
}

interface Generation {
  id: string;
  audio_url: string;
  cache_key?: string;
  mime_type?: string;
}

interface Channel {
  id: string;
  name: string;
  endpoint?: string;
  enabled: boolean;
}

serve(async (req) => {
  // CORS preflight 처리
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 헬스체크 모드: healthCheck 파라미터가 있으면 간단히 응답만 반환
    const url = new URL(req.url);
    if (url.searchParams.get("healthCheck") === "true") {
      return new Response(
        JSON.stringify({ status: "ok", message: "Edge Function is healthy" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Supabase 클라이언트 생성
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 현재 시간 (UTC)
    const now = new Date();
    const nowISO = now.toISOString();
    
    // 시간 범위 확대: 과거 30분 ~ 현재 30분
    // 과거 스케줄도 처리하여 놓친 스케줄이 있으면 실행
    // 넓은 범위를 사용하여 시간 정확도 문제나 네트워크 지연을 고려
    // 놓친 스케줄 처리를 위해 과거 범위 확대
    const timeWindowStart = new Date(now.getTime() - 30 * 60 * 1000).toISOString(); // 과거 30분
    const timeWindowEnd = new Date(now.getTime() + 30 * 60 * 1000).toISOString(); // 미래 30분

    // KST(Asia/Seoul, UTC+9) 시간 계산
    const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const kstTimeString = kstNow.toLocaleString('ko-KR', { 
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    console.log(`[execute-schedules] ========================================`);
    console.log(`[execute-schedules] Execution started at ${nowISO} (UTC)`);
    console.log(`[execute-schedules] Current time (KST): ${kstTimeString}`);
    console.log(`[execute-schedules] Time window: ${timeWindowStart} ~ ${timeWindowEnd} (UTC)`);
    console.log(`[execute-schedules] Time window: ${new Date(timeWindowStart).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} ~ ${new Date(timeWindowEnd).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (KST)`);
    console.log(`[execute-schedules] ========================================`);

    // 실행해야 할 스케줄 조회
    // 상태가 'scheduled'이고 시간 범위 내의 스케줄 조회
    // 주의: 시간 범위는 넓게 잡되, 실제 실행 시에는 스케줄 시간을 정확히 확인함
    const { data: schedules, error: scheduleError } = await supabaseClient
      .from("tts_schedule_requests")
      .select("*")
      .eq("status", "scheduled")
      .gte("scheduled_time", timeWindowStart)
      .lte("scheduled_time", timeWindowEnd)
      .order("scheduled_time", { ascending: true }); // 시간 순서대로 정렬

    if (scheduleError) {
      console.error("[execute-schedules] Error fetching schedules:", scheduleError);
      throw scheduleError;
    }

    if (!schedules || schedules.length === 0) {
      console.log("[execute-schedules] No schedules to execute in the time window");
      
      // 디버깅: 모든 상태의 스케줄 확인
      const { data: allSchedules } = await supabaseClient
        .from("tts_schedule_requests")
        .select("id, scheduled_time, status, schedule_name, target_channel, customer_id, customer_name, category_code, memo, is_player_broadcast, target_devices")
        .order("scheduled_time", { ascending: false })
        .limit(10);
      
      if (allSchedules && allSchedules.length > 0) {
        console.log(`[execute-schedules] Recent schedules (all statuses, latest 10):`);
        allSchedules.forEach((s: any) => {
          const scheduleTime = new Date(s.scheduled_time);
          const timeDiff = (now.getTime() - scheduleTime.getTime()) / 1000; // 초 단위
          const hoursDiff = timeDiff / 3600; // 시간 단위
          const localTime = scheduleTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
          const statusEmoji = s.status === 'scheduled' ? '⏰' : s.status === 'sent' ? '✅' : s.status === 'failed' ? '❌' : '❓';
          console.log(`  ${statusEmoji} Schedule ${s.id}:`);
          console.log(`    - Name: ${s.schedule_name || 'Unnamed'}`);
          console.log(`    - Time (UTC): ${s.scheduled_time}`);
          console.log(`    - Time (Local): ${localTime}`);
          console.log(`    - Status: ${s.status}`);
          console.log(`    - Channel: ${s.target_channel}`);
          if (timeDiff > 0) {
            console.log(`    - ${Math.abs(hoursDiff) > 1 ? `${Math.abs(hoursDiff).toFixed(1)}시간 전` : `${Math.abs(timeDiff / 60).toFixed(1)}분 전`}`);
          } else {
            console.log(`    - ${Math.abs(hoursDiff) > 1 ? `${Math.abs(hoursDiff).toFixed(1)}시간 후` : `${Math.abs(timeDiff / 60).toFixed(1)}분 후`}`);
          }
        });
        
        // scheduled 상태인 스케줄 확인
        const scheduledOnly = allSchedules.filter((s: any) => s.status === 'scheduled');
        if (scheduledOnly.length > 0) {
          console.log(`[execute-schedules] Found ${scheduledOnly.length} scheduled status schedule(s) (but outside time window):`);
          scheduledOnly.forEach((s: any) => {
            const scheduleTime = new Date(s.scheduled_time);
            const timeDiff = (now.getTime() - scheduleTime.getTime()) / 1000 / 60; // 분 단위
            console.log(`  - Schedule ${s.id}: ${s.scheduled_time} (${timeDiff > 0 ? `${Math.abs(timeDiff).toFixed(1)}분 전` : `${Math.abs(timeDiff).toFixed(1)}분 후`})`);
          });
        } else {
          console.log(`[execute-schedules] No schedules with 'scheduled' status found`);
        }
      } else {
        console.log(`[execute-schedules] No schedules found in database at all`);
      }
      
      return new Response(
        JSON.stringify({ 
          message: "No schedules to execute", 
          count: 0,
          currentTime: nowISO,
          timeWindow: { start: timeWindowStart, end: timeWindowEnd }
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log(`[execute-schedules] Found ${schedules.length} schedule(s) to execute:`);
    schedules.forEach((s: any) => {
      const scheduleTime = new Date(s.scheduled_time);
      const timeDiff = (now.getTime() - scheduleTime.getTime()) / 1000; // 초 단위
      const kstTime = scheduleTime.toLocaleString('ko-KR', { 
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      console.log(`  - Schedule ${s.id}:`);
      console.log(`    - UTC: ${s.scheduled_time}`);
      console.log(`    - KST: ${kstTime}`);
      console.log(`    - Time diff: ${timeDiff > 0 ? `${Math.abs(timeDiff)}초 전` : `${Math.abs(timeDiff)}초 후`}`);
    });

    const results: Array<{
      scheduleId: string;
      status: string;
      reason?: string;
      scheduledTime?: string;
    }> = [];

    // 각 스케줄 처리
    for (const schedule of schedules as ScheduleRequest[]) {
      try {
        const scheduleTime = new Date(schedule.scheduled_time);
        const timeDiff = (now.getTime() - scheduleTime.getTime()) / 1000; // 초 단위
        console.log(`[execute-schedules] ========================================`);
        console.log(`[execute-schedules] Processing schedule ${schedule.id}`);
        console.log(`[execute-schedules] Schedule name: ${schedule.schedule_name || "Unnamed"}`);
        console.log(`[execute-schedules] Scheduled time: ${schedule.scheduled_time} (UTC)`);
        console.log(`[execute-schedules] Current time: ${nowISO} (UTC)`);
        console.log(`[execute-schedules] Time difference: ${timeDiff > 0 ? `${Math.abs(timeDiff)}초 지남` : `${Math.abs(timeDiff)}초 남음`}`);
        console.log(`[execute-schedules] Target channel: ${schedule.target_channel}`);
        console.log(`[execute-schedules] Generation ID: ${schedule.generation_id}`);
        console.log(`[execute-schedules] User ID: ${schedule.user_id}`);
        console.log(`[execute-schedules] ========================================`);

        // 스케줄 실행 시간 확인: 현재 시간이 스케줄 시간 이후여야 함
        // 5초 여유를 두어 네트워크 지연 등을 고려 (과거 스케줄만 실행)
        // 중요: 스케줄 시간이 아직 되지 않았으면 절대 실행하지 않음
        const executionBuffer = 5 * 1000; // 5초 버퍼 (너무 일찍 실행 방지)
        const timeUntilExecution = scheduleTime.getTime() - now.getTime();
        
        if (timeUntilExecution > executionBuffer) {
          // 아직 실행 시간이 되지 않음
          const remainingSeconds = timeUntilExecution / 1000;
          const remainingMinutes = Math.floor(remainingSeconds / 60);
          const remainingSecs = Math.floor(remainingSeconds % 60);
          console.log(`[execute-schedules] ⏰ Schedule ${schedule.id} is not ready yet.`);
          console.log(`[execute-schedules]   Scheduled: ${schedule.scheduled_time} (UTC)`);
          console.log(`[execute-schedules]   Current: ${nowISO} (UTC)`);
          console.log(`[execute-schedules]   Remaining: ${remainingMinutes}분 ${remainingSecs}초`);
          console.log(`[execute-schedules]   SKIPPING - Will execute later`);
          continue; // 아직 실행 시간이 되지 않았으므로 스킵
        }
        
        // 스케줄 시간이 지났거나 5초 이내인 경우에만 실행
        console.log(`[execute-schedules] ✅ Schedule ${schedule.id} is ready to execute`);
        console.log(`[execute-schedules]   Time difference: ${timeUntilExecution <= 0 ? `${Math.abs(timeUntilExecution / 1000)}초 지남` : `${timeUntilExecution / 1000}초 남음`}`);

        // 음원 데이터 조회
        const { data: generation, error: genError } = await supabaseClient
          .from("tts_generations")
          .select("id, audio_url, cache_key, mime_type")
          .eq("id", schedule.generation_id)
          .single();

        if (genError || !generation) {
          console.error(
            `[execute-schedules] Error fetching generation ${schedule.generation_id}:`,
            genError
          );
          // 상태를 failed로 업데이트
          await supabaseClient
            .from("tts_schedule_requests")
            .update({
              status: "failed",
              fail_reason: `Generation not found: ${genError?.message || "Unknown error"}`,
            })
            .eq("id", schedule.id);

          results.push({
            scheduleId: schedule.id,
            status: "failed",
            reason: "Generation not found",
          });
          continue;
        }

        // 채널 정보 조회 (채널 설정은 사용자별로 저장되어 있을 수 있음)
        // 여기서는 간단히 채널 ID를 endpoint로 사용하거나, 별도 채널 테이블에서 조회
        // 일단 채널 ID를 그대로 사용하고, 실제 endpoint는 채널 설정에서 가져와야 함
        
        // 음원 데이터 로드
        let audioData: ArrayBuffer | null = null;
        // MIME 타입 결정: 믹싱 음원은 WAV 형식이므로 우선순위 확인
        // generation.mime_type이 있으면 우선 사용, 없으면 audio_url에서 추론, 마지막으로 기본값
        let mimeType: string = generation.mime_type || "audio/mpeg";
        
        // 믹싱 음원인 경우 WAV 형식으로 가정 (믹싱 보드에서 생성된 음원)
        // purpose가 'mixed'이거나 mime_type이 'audio/wav'인 경우 WAV로 처리
        if (!generation.mime_type || generation.mime_type === "audio/mpeg") {
          // audio_url에서 형식 추론 시도
          if (generation.audio_url && generation.audio_url.includes(".wav")) {
            mimeType = "audio/wav";
          } else if (generation.audio_url && generation.audio_url.startsWith("data:")) {
            // data URL에서 MIME 타입 추출
            const mimeMatch = generation.audio_url.match(/data:([^;]+)/);
            if (mimeMatch) {
              mimeType = mimeMatch[1];
            }
          }
        }

        // 1. audio_url이 data URL인 경우
        if (generation.audio_url && generation.audio_url.startsWith("data:")) {
          const [mimePart, base64Data] = generation.audio_url.split(",");
          mimeType = mimePart.match(/data:([^;]+)/)?.[1] || mimeType;
          if (base64Data) {
            try {
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              audioData = bytes.buffer;
            } catch (err) {
              console.warn(`[execute-schedules] Failed to decode data URL:`, err);
            }
          }
        }

        // 2. audio_url이 HTTP/HTTPS URL인 경우 다운로드
        if (!audioData && generation.audio_url && !generation.audio_url.startsWith("data:")) {
          try {
            console.log(`[execute-schedules] Downloading audio from URL: ${generation.audio_url}`);
            const audioResponse = await fetch(generation.audio_url);
            
            if (!audioResponse.ok) {
              throw new Error(`HTTP ${audioResponse.status}: ${audioResponse.statusText}`);
            }
            
            const audioBlob = await audioResponse.blob();
            audioData = await audioBlob.arrayBuffer();
            mimeType = audioBlob.type || audioResponse.headers.get("content-type") || mimeType;
            
            console.log(`[execute-schedules] Successfully downloaded audio from URL: ${audioData.byteLength} bytes`);
          } catch (err) {
            console.warn(`[execute-schedules] Failed to download from URL:`, err);
          }
        }

        // 3. 캐시 키가 있으면 Supabase Storage에서 조회
        if (!audioData && generation.cache_key) {
          try {
            console.log(`[execute-schedules] Loading audio from storage: ${generation.cache_key}`);
            const { data: blobData, error: blobError } = await supabaseClient.storage
              .from("tts-audio")
              .download(generation.cache_key);

            if (!blobError && blobData) {
              audioData = await blobData.arrayBuffer();
              mimeType = blobData.type || mimeType;
              console.log(`[execute-schedules] Successfully loaded audio from storage: ${audioData.byteLength} bytes`);
            } else {
              console.warn(`[execute-schedules] Storage error:`, blobError);
            }
          } catch (err) {
            console.warn(`[execute-schedules] Failed to load from storage:`, err);
          }
        }

        // 4. DB에서 직접 blob 로드 시도 (bytea 컬럼)
        if (!audioData) {
          try {
            const { data: blobRow, error: blobError } = await supabaseClient
              .from("tts_generations")
              .select("audio_blob")
              .eq("id", generation.id)
              .single();

            if (!blobError && blobRow?.audio_blob) {
              // PostgreSQL bytea를 ArrayBuffer로 변환
              const blobValue = blobRow.audio_blob;
              if (typeof blobValue === "string") {
                // hex 형식인 경우
                if (blobValue.startsWith("\\x")) {
                  const hexString = blobValue.slice(2);
                  const bytes = new Uint8Array(hexString.length / 2);
                  for (let i = 0; i < hexString.length; i += 2) {
                    bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
                  }
                  audioData = bytes.buffer;
                } else {
                  // base64 형식인 경우
                  try {
                    const binaryString = atob(blobValue);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                      bytes[i] = binaryString.charCodeAt(i);
                    }
                    audioData = bytes.buffer;
                  } catch (e) {
                    // base64가 아닌 경우, JSON 배열 문자열인지 확인
                    try {
                      // JSON 배열 문자열인 경우 파싱 (예: "[82,73,70,70]")
                      const parsedArray = JSON.parse(blobValue);
                      if (Array.isArray(parsedArray)) {
                        audioData = new Uint8Array(parsedArray).buffer;
                        console.log(`[execute-schedules] Converted JSON array string to ArrayBuffer: ${audioData.byteLength} bytes`);
                      } else {
                        throw new Error("Not an array");
                      }
                    } catch (parseError) {
                      // JSON 배열도 아닌 경우 그대로 사용 (텍스트로 인코딩)
                      console.warn(`[execute-schedules] Failed to parse blob as base64 or JSON array, using as text:`, parseError);
                      const encoder = new TextEncoder();
                      audioData = encoder.encode(blobValue).buffer;
                    }
                  }
                }
              } else if (blobValue instanceof ArrayBuffer) {
                audioData = blobValue;
              } else if (Array.isArray(blobValue)) {
                // JSON 배열 형식
                audioData = new Uint8Array(blobValue).buffer;
              }
            }
          } catch (err) {
            console.warn(`[execute-schedules] Failed to load from DB:`, err);
          }
        }

        if (!audioData) {
          console.error(
            `[execute-schedules] No audio data available for generation ${generation.id}`
          );
          console.error(`[execute-schedules] Generation info:`, {
            id: generation.id,
            audio_url: generation.audio_url,
            cache_key: generation.cache_key,
            mime_type: generation.mime_type
          });
          await supabaseClient
            .from("tts_schedule_requests")
            .update({
              status: "failed",
              fail_reason: "Audio data not available",
            })
            .eq("id", schedule.id);

          results.push({
            scheduleId: schedule.id,
            status: "failed",
            reason: "Audio data not available",
          });
          continue;
        }

        // 오디오 데이터 크기 검증 (최소 100 bytes)
        if (audioData.byteLength < 100) {
          console.error(
            `[execute-schedules] Audio data too small: ${audioData.byteLength} bytes for generation ${generation.id}`
          );
          await supabaseClient
            .from("tts_schedule_requests")
            .update({
              status: "failed",
              fail_reason: `Audio data too small: ${audioData.byteLength} bytes`,
            })
            .eq("id", schedule.id);

          results.push({
            scheduleId: schedule.id,
            status: "failed",
            reason: `Audio data too small: ${audioData.byteLength} bytes`,
          });
          continue;
        }

        console.log(`[execute-schedules] Audio data loaded: ${audioData.byteLength} bytes, type: ${mimeType}`);

        // 전송 채널로 방송 송출
        console.log(
          `[execute-schedules] Sending broadcast for schedule ${schedule.id} to channel ${schedule.target_channel}`
        );

        // 채널 endpoint 조회
        // target_channel은 채널 타입(radio, tablet, pc) 또는 UUID일 수 있습니다
        // 먼저 UUID로 조회 시도, 실패하면 타입으로 조회
        console.log(`[execute-schedules] Looking up channel: ${schedule.target_channel} for user: ${schedule.user_id}`);
        
        let channel: any = null;
        let channelError: any = null;

        // UUID 형식인지 확인 (UUID는 36자 문자열이고 하이픈 포함)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          schedule.target_channel
        );

        if (isUUID) {
          // UUID로 조회
          console.log(`[execute-schedules] Searching channel by UUID: ${schedule.target_channel}`);
          const { data, error } = await supabaseClient
            .from("tts_channels")
            .select("id, endpoint, enabled, type, name, config")
            .eq("id", schedule.target_channel)
            .eq("user_id", schedule.user_id)
            .single();
          channel = data;
          channelError = error;
        } else {
          // 타입으로 조회 (하위 호환성을 위해)
          console.log(`[execute-schedules] Searching channel by type: ${schedule.target_channel}`);
          const { data, error } = await supabaseClient
            .from("tts_channels")
            .select("id, endpoint, enabled, type, name, config")
            .eq("type", schedule.target_channel)
            .eq("user_id", schedule.user_id)
            .eq("enabled", true)
            .single();
          channel = data;
          channelError = error;
        }

        if (channelError || !channel || !channel.enabled) {
          console.error(
            `[execute-schedules] Channel ${schedule.target_channel} not found or disabled:`,
            channelError?.message || "Channel not found"
          );
          if (channelError) {
            console.error(`[execute-schedules] Channel error details:`, JSON.stringify(channelError));
          }
          
          // 사용 가능한 채널 목록 확인 (디버깅용)
          const { data: allChannels } = await supabaseClient
            .from("tts_channels")
            .select("id, type, name, enabled, user_id")
            .eq("user_id", schedule.user_id);
          
          if (allChannels && allChannels.length > 0) {
            console.log(`[execute-schedules] Available channels for user ${schedule.user_id}:`);
            allChannels.forEach((ch: any) => {
              console.log(`  - ${ch.type} (${ch.name}): enabled=${ch.enabled}, id=${ch.id}`);
            });
          } else {
            console.warn(`[execute-schedules] No channels found for user ${schedule.user_id}`);
          }
          
          await supabaseClient
            .from("tts_schedule_requests")
            .update({
              status: "failed",
              fail_reason: `Channel not configured or disabled: ${channelError?.message || "Unknown"}`,
            })
            .eq("id", schedule.id);
          results.push({
            scheduleId: schedule.id,
            status: "failed",
            reason: "Channel not configured",
          });
          continue;
        }

        console.log(`[execute-schedules] Found channel: ${channel.name || channel.type} (endpoint: ${channel.endpoint || "NOT SET"})`);

        if (!channel.endpoint) {
          console.error(
            `[execute-schedules] Channel ${schedule.target_channel} (${channel.name || channel.type}) has no endpoint`
          );
          await supabaseClient
            .from("tts_schedule_requests")
            .update({
              status: "failed",
              fail_reason: "Channel endpoint not configured",
            })
            .eq("id", schedule.id);
          results.push({
            scheduleId: schedule.id,
            status: "failed",
            reason: "Channel endpoint not configured",
          });
          continue;
        }

        // 채널 endpoint로 오디오 전송
        try {
          // config에서 추가 헤더나 인증 정보 가져오기
          const config = (channel.config as Record<string, any>) || {};
          
          // 헤더 값 검증 및 인코딩 함수 (한글/특수 문자를 안전한 형식으로 변환)
          const sanitizeHeaderValue = (value: any): string => {
            if (value === null || value === undefined) {
              return "";
            }
            // 항상 문자열로 변환
            let str = String(value);
            
            // 빈 문자열이면 그대로 반환
            if (str.length === 0) {
              return str;
            }
            
            // Deno의 fetch는 헤더 값이 유효한 ByteString이어야 함
            // 한글이나 특수 문자가 있으면 안전하게 처리
            try {
              // ASCII 문자만 포함되어 있는지 확인
              const isASCII = /^[\x00-\x7F]*$/.test(str);
              if (isASCII) {
                // ASCII 문자만 포함된 경우 그대로 사용
                return str;
              } else {
                // 한글/특수 문자가 포함된 경우 URL 인코딩
                return encodeURIComponent(str);
              }
            } catch (e) {
              // 인코딩 실패 시 빈 문자열 반환
              console.warn(`[execute-schedules] Failed to sanitize header value: ${e}`);
              return "";
            }
          };

          // 채널 코드 정규화
          const normalizeChannelCode = (value: any, fallback: string): string => {
            if (typeof value === "string" && value.trim().length > 0) {
              return value.trim();
            }
            return fallback;
          };
          const sanitizedChannelCode = normalizeChannelCode(config.channelCode, channel.id);

          // 디바이스 목록 정규화
          const normalizeDeviceList = (config: any): Array<{ id: string; name: string; token: string }> => {
            if (!Array.isArray(config?.devices)) return [];
            return config.devices
              .map((device: any) => ({
                id: typeof device?.id === "string" ? device.id : "",
                name: typeof device?.name === "string" ? device.name : "출력 장치",
                token: typeof device?.token === "string" ? device.token : "",
              }))
              .filter((device: { id: string; name: string; token: string }) => device.id.length > 0 && device.token.length > 0);
          };
          const registeredDevices = normalizeDeviceList(config);

          // 스케줄에서 송출 타입 확인
          const isPlayerBroadcast = (schedule as any).is_player_broadcast === true;
          const targetDeviceIds = Array.isArray((schedule as any).target_devices) ? (schedule as any).target_devices : [];
          
          // 디바이스 송출인 경우 디바이스 목록 확인
          let resolvedDevices: Array<{ id: string; name: string; token: string }> = [];
          if (isPlayerBroadcast && targetDeviceIds.length > 0) {
            resolvedDevices = registeredDevices.filter((device) => targetDeviceIds.includes(device.id));
            const missingDevices = targetDeviceIds.filter(
              (deviceId) => !resolvedDevices.some((device) => device.id === deviceId)
            );
            if (missingDevices.length > 0) {
              console.warn(`[execute-schedules] Some devices not found: ${missingDevices.join(", ")}`);
            }
          }

          // 엔드포인트 구분: public 송출 vs 디바이스ID/채널ID 송출
          // 주의: API 엔드포인트는 동일하며, 헤더로 구분합니다
          const getBroadcastEndpoint = (device?: { id: string; name: string; token: string }): string => {
            const baseEndpoint = channel.endpoint || "";
            
            // 모든 송출 타입에서 기본 엔드포인트 사용
            // 디바이스ID/채널ID 송출은 헤더(X-Device-Id, X-Channel-Code 등)로 구분
            return baseEndpoint;
          };

          // 기본 헤더 생성 함수
          const createBaseHeaders = (): Record<string, string> => {
            const headers: Record<string, string> = {
              "Content-Type": mimeType,
              "Content-Length": String(audioData.byteLength),
            };
            
            if (schedule.schedule_name) {
              headers["X-Schedule-Name"] = sanitizeHeaderValue(schedule.schedule_name);
            }
            headers["X-Schedule-Id"] = sanitizeHeaderValue(schedule.id);
            
            if (config.authHeader) {
              headers["Authorization"] = sanitizeHeaderValue(config.authHeader);
            }
            if (config.apiKey) {
              headers["X-API-Key"] = sanitizeHeaderValue(config.apiKey);
            }
            if (config.customHeaders && typeof config.customHeaders === "object") {
              for (const [key, value] of Object.entries(config.customHeaders)) {
                headers[key] = sanitizeHeaderValue(value);
              }
            }
            
            return headers;
          };

          // 디바이스별 또는 Public 송출 함수
          const sendToDevice = async (device?: { id: string; name: string; token: string }) => {
            const headers = createBaseHeaders();
            const broadcastType = device ? "디바이스ID/채널ID 송출" : "Public 송출";
            
            if (device) {
              // 디바이스ID/채널ID 송출 헤더
              headers["X-Customer-Id"] = sanitizeHeaderValue(sanitizedChannelCode);
              headers["X-Channel-Code"] = sanitizeHeaderValue(sanitizedChannelCode);
              headers["X-Device-Id"] = sanitizeHeaderValue(device.id);
              headers["X-Device-Name"] = sanitizeHeaderValue(device.name);
              headers["X-Device-Token"] = sanitizeHeaderValue(device.token);
              headers["X-Broadcast-Type"] = "device-channel";
            } else {
              // Public 송출 헤더
              // Public 송출 모드에서도 채널 코드를 포함하여 플레이어가 올바른 파일을 찾을 수 있도록 함
              headers["X-Channel-Code"] = sanitizeHeaderValue(sanitizedChannelCode);
              headers["X-Broadcast-Type"] = "public";
              // 고객 정보 헤더 (Public 송출 시)
              if ((schedule as any).customer_id) {
                headers["X-Customer-Id"] = sanitizeHeaderValue((schedule as any).customer_id);
              }
              if ((schedule as any).customer_name) {
                headers["X-Customer-Name"] = sanitizeHeaderValue((schedule as any).customer_name);
              }
              if ((schedule as any).category_code) {
                headers["X-Category-Code"] = sanitizeHeaderValue((schedule as any).category_code);
              }
              if ((schedule as any).memo) {
                headers["X-Customer-Memo"] = sanitizeHeaderValue((schedule as any).memo);
              }
            }

            const targetEndpoint = getBroadcastEndpoint(device);
            
            console.log(`[execute-schedules] ────────────────────────────────────────`);
            console.log(`[execute-schedules] [${broadcastType}] Sending audio to endpoint: ${targetEndpoint}`);
            console.log(`[execute-schedules] [${broadcastType}] Audio size: ${audioData.byteLength} bytes`);
            console.log(`[execute-schedules] [${broadcastType}] MIME type: ${mimeType}`);
            if (device) {
              console.log(`[execute-schedules] [${broadcastType}] Device: ${device.name} (ID: ${device.id}, Channel: ${sanitizedChannelCode})`);
            }
            console.log(`[execute-schedules] [${broadcastType}] Headers:`, JSON.stringify(headers, null, 2));
            console.log(`[execute-schedules] ────────────────────────────────────────`);

            const fetchStartTime = Date.now();
            const response = await fetch(targetEndpoint, {
              method: "POST",
              headers,
              body: audioData,
            });
            const fetchDuration = Date.now() - fetchStartTime;

            console.log(`[execute-schedules] [${broadcastType}] Response received in ${fetchDuration}ms`);
            console.log(`[execute-schedules] [${broadcastType}] Response status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
              const errorText = await response.text().catch(() => response.statusText);
              console.error(`[execute-schedules] [${broadcastType}] HTTP Error Response:`, {
                status: response.status,
                statusText: response.statusText,
                errorText: errorText
              });
              throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
            }

            // 응답 본문 확인 (저장된 파일 정보 등)
            let responseData: any = null;
            try {
              const responseText = await response.text();
              if (responseText) {
                try {
                  responseData = JSON.parse(responseText);
                } catch (e) {
                  // JSON이 아닌 경우 텍스트로 처리
                  responseData = { raw: responseText };
                }
              }
            } catch (e) {
              console.warn(`[execute-schedules] [${broadcastType}] Failed to read response body:`, e);
            }

            console.log(`[execute-schedules] [${broadcastType}] ✅ Successfully sent to ${targetEndpoint}`);
            if (device) {
              console.log(`[execute-schedules] [${broadcastType}] Device: ${device.name}`);
            }
            
            if (responseData) {
              console.log(`[execute-schedules] [${broadcastType}] API Response:`, JSON.stringify(responseData, null, 2));
              if (responseData.saved_file) {
                console.log(`[execute-schedules] [${broadcastType}] Audio file saved: ${responseData.saved_file}`);
              }
              if (responseData.channel_id) {
                console.log(`[execute-schedules] [${broadcastType}] Channel ID: ${responseData.channel_id}`);
              }
            }
          };

          // 송출 실행
          if (resolvedDevices.length > 0) {
            // 디바이스 송출: 각 디바이스별로 전송
            for (const device of resolvedDevices) {
              await sendToDevice(device);
            }
          } else {
            // Public 송출
            await sendToDevice();
          }
        } catch (sendError) {
          console.error(`[execute-schedules] ❌ Failed to send to channel ${channel.endpoint}`);
          console.error(`[execute-schedules] Error type: ${sendError instanceof Error ? sendError.constructor.name : typeof sendError}`);
          console.error(`[execute-schedules] Error message:`, sendError instanceof Error ? sendError.message : String(sendError));
          if (sendError instanceof Error && sendError.stack) {
            console.error(`[execute-schedules] Error stack:`, sendError.stack);
          }
          if (sendError instanceof TypeError && sendError.message.includes('fetch')) {
            console.error(`[execute-schedules] Network error: Unable to connect to ${channel.endpoint}`);
            console.error(`[execute-schedules] Check if the endpoint URL is correct and accessible`);
          }
          
          // 실패 시 상태 업데이트
          await supabaseClient
            .from("tts_schedule_requests")
            .update({
              status: "failed",
              fail_reason: sendError instanceof Error ? sendError.message : String(sendError),
            })
            .eq("id", schedule.id);

          results.push({
            scheduleId: schedule.id,
            status: "failed",
            reason: sendError instanceof Error ? sendError.message : String(sendError),
          });
          continue;
        }

        // 상태 업데이트: sent
        console.log(`[execute-schedules] Updating schedule ${schedule.id} status to 'sent'`);
        const { data: updateData, error: updateError } = await supabaseClient
          .from("tts_schedule_requests")
          .update({
            status: "sent",
            sent_at: nowISO,
          })
          .eq("id", schedule.id)
          .select()
          .single();

        if (updateError) {
          console.error(
            `[execute-schedules] Error updating schedule ${schedule.id}:`,
            updateError
          );
          console.error(`[execute-schedules] Update error details:`, JSON.stringify(updateError));
          // 상태 업데이트 실패해도 이미 전송은 완료되었으므로 결과에 포함
          results.push({
            scheduleId: schedule.id,
            status: "sent",
            scheduledTime: schedule.scheduled_time,
          });
          console.warn(
            `[execute-schedules] ⚠️ Schedule ${schedule.id} sent successfully but status update failed`
          );
          continue;
        }

        if (updateData) {
          console.log(`[execute-schedules] Status updated successfully:`, JSON.stringify({
            id: updateData.id,
            status: updateData.status,
            sent_at: updateData.sent_at
          }));
        }

        results.push({
          scheduleId: schedule.id,
          status: "sent",
          scheduledTime: schedule.scheduled_time,
        });

        const kstSentTime = new Date(nowISO).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
        console.log(`[execute-schedules] ========================================`);
        console.log(`[execute-schedules] ✅ Successfully executed schedule ${schedule.id}`);
        console.log(`[execute-schedules] Schedule name: ${schedule.schedule_name || "Unnamed"}`);
        console.log(`[execute-schedules] Scheduled time: ${schedule.scheduled_time} (UTC)`);
        console.log(`[execute-schedules] Sent at: ${nowISO} (UTC) / ${kstSentTime} (KST)`);
        console.log(`[execute-schedules] Channel: ${channel.name || channel.type} (${channel.endpoint})`);
        console.log(`[execute-schedules] Audio size: ${audioData.byteLength} bytes`);
        console.log(`[execute-schedules] ========================================`);
      } catch (error) {
        console.error(
          `[execute-schedules] Error processing schedule ${schedule.id}:`,
          error
        );

        // 실패 상태로 업데이트
        try {
          await supabaseClient
            .from("tts_schedule_requests")
            .update({
              status: "failed",
              fail_reason: error instanceof Error ? error.message : String(error),
            })
            .eq("id", schedule.id);
        } catch (updateErr) {
          console.error(
            `[execute-schedules] Failed to update error status:`,
            updateErr
          );
        }

        results.push({
          scheduleId: schedule.id,
          status: "failed",
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const executedCount = results.filter((r) => r.status === "sent").length;
    const failedCount = results.filter((r) => r.status === "failed").length;
    
    console.log(`[execute-schedules] ========================================`);
    console.log(`[execute-schedules] Execution completed`);
    console.log(`[execute-schedules] Total schedules: ${schedules.length}`);
    console.log(`[execute-schedules] Successfully executed: ${executedCount}`);
    console.log(`[execute-schedules] Failed: ${failedCount}`);
    console.log(`[execute-schedules] ========================================`);

    return new Response(
      JSON.stringify({
        message: "Schedule execution completed",
        executed: executedCount,
        failed: failedCount,
        total: schedules.length,
        results,
        timestamp: nowISO,
        timeWindow: {
          start: timeWindowStart,
          end: timeWindowEnd,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[execute-schedules] ========================================");
    console.error("[execute-schedules] Fatal error:", error);
    console.error("[execute-schedules] ========================================");
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

