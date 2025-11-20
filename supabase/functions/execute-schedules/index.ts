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
    
    // 시간 범위 확대: 과거 10분 ~ 현재 5분
    // 과거 스케줄도 처리하여 놓친 스케줄이 있으면 실행
    // 넓은 범위를 사용하여 시간 정확도 문제나 네트워크 지연을 고려
    const timeWindowStart = new Date(now.getTime() - 10 * 60 * 1000).toISOString(); // 과거 10분
    const timeWindowEnd = new Date(now.getTime() + 5 * 60 * 1000).toISOString(); // 미래 5분

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

    console.log(`[execute-schedules] Current time (UTC): ${nowISO}`);
    console.log(`[execute-schedules] Current time (KST): ${kstTimeString}`);
    console.log(`[execute-schedules] Checking schedules between ${timeWindowStart} and ${timeWindowEnd} (UTC)`);

    // 실행해야 할 스케줄 조회
    // 상태가 'scheduled'이고 시간 범위 내의 스케줄 조회
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
        .select("id, scheduled_time, status, schedule_name, target_channel")
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
        console.log(`[execute-schedules] Processing schedule ${schedule.id}`);
        console.log(`  Scheduled time: ${schedule.scheduled_time}`);
        console.log(`  Current time: ${nowISO}`);
        console.log(`  Time difference: ${timeDiff > 0 ? `${Math.abs(timeDiff)}초 지남` : `${Math.abs(timeDiff)}초 남음`}`);
        console.log(`  Target channel: ${schedule.target_channel}`);

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
        let mimeType: string = generation.mime_type || "audio/mpeg";

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
          const headers: Record<string, string> = {
            "Content-Type": mimeType,
            "Content-Length": String(audioData.byteLength),
          };

          // config에 인증 헤더가 있으면 추가
          if (config.authHeader) {
            headers["Authorization"] = config.authHeader;
          }
          if (config.apiKey) {
            headers["X-API-Key"] = config.apiKey;
          }
          // 스케줄 이름을 헤더로 전송 (파일명에 포함하기 위해)
          if (schedule.schedule_name) {
            headers["X-Schedule-Name"] = schedule.schedule_name;
          }
          // 스케줄 ID도 헤더로 전송 (추적용)
          headers["X-Schedule-Id"] = schedule.id;
          // config의 customHeaders 병합
          if (config.customHeaders && typeof config.customHeaders === "object") {
            Object.assign(headers, config.customHeaders);
          }

          console.log(`[execute-schedules] ────────────────────────────────────────`);
          console.log(`[execute-schedules] Sending audio to endpoint: ${channel.endpoint}`);
          console.log(`[execute-schedules] Audio size: ${audioData.byteLength} bytes`);
          console.log(`[execute-schedules] MIME type: ${mimeType}`);
          console.log(`[execute-schedules] Headers:`, JSON.stringify(headers, null, 2));
          console.log(`[execute-schedules] ────────────────────────────────────────`);

          // ArrayBuffer를 직접 전송 (바이너리 데이터)
          // fetch API는 ArrayBuffer를 자동으로 바이너리로 전송합니다
          const fetchStartTime = Date.now();
          const response = await fetch(channel.endpoint, {
            method: "POST",
            headers,
            body: audioData, // ArrayBuffer를 직접 전송 (바이너리)
          });
          const fetchDuration = Date.now() - fetchStartTime;

          console.log(`[execute-schedules] Response received in ${fetchDuration}ms`);
          console.log(`[execute-schedules] Response status: ${response.status} ${response.statusText}`);

          if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText);
            console.error(`[execute-schedules] HTTP Error Response:`, errorText);
            throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
          }

          const responseText = await response.text().catch(() => "");
          console.log(`[execute-schedules] ✅ Successfully sent to ${channel.endpoint}`);
          console.log(`[execute-schedules] Response body (first 200 chars): ${responseText.substring(0, 200)}`);
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

        console.log(
          `[execute-schedules] ✅ Successfully executed schedule ${schedule.id} (${schedule.schedule_name || "Unnamed"})`
        );
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

    return new Response(
      JSON.stringify({
        message: "Schedule execution completed",
        executed: results.filter((r) => r.status === "sent").length,
        failed: results.filter((r) => r.status === "failed").length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("[execute-schedules] Fatal error:", error);
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

