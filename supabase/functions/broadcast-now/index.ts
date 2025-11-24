import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

interface BroadcastRequest {
  generationId: string;
  channelId: string;
  scheduleType: "immediate" | "delayed" | "scheduled";
  delayMinutes?: number;
  scheduledTime?: string; // ISO string
  scheduleName?: string;
  deviceIds?: string[];
  customerInfo?: {
    customerId: string;
    customerName: string;
    categoryCode: string;
    memo?: string;
  };
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
  config?: Record<string, any>;
}

interface RegisteredDevice {
  id: string;
  name: string;
  token: string;
}

const normalizeChannelCode = (value: any, fallback: string) => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
};

const normalizeDeviceList = (config: any): RegisteredDevice[] => {
  if (!Array.isArray(config?.devices)) return [];
  return config.devices
    .map((device: any) => ({
      id: typeof device?.id === "string" ? device.id : "",
      name: typeof device?.name === "string" ? device.name : "출력 장치",
      token: typeof device?.token === "string" ? device.token : "",
    }))
    .filter((device: RegisteredDevice) => device.id.length > 0 && device.token.length > 0);
};

serve(async (req) => {
  // CORS preflight 처리
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 인증 확인
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // Supabase 클라이언트 생성 (anon key로 사용자 인증용)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    // 사용자 인증 확인
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    const userId = user.id;

    // 서비스 롤 키를 사용하는 클라이언트 생성 (데이터 조회용)
    const supabaseServiceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // 요청 본문 파싱
    let requestData: BroadcastRequest;
    try {
      // req.json()을 직접 사용 (Supabase Functions invoke는 자동으로 JSON 직렬화)
      requestData = await req.json();
      
      console.log("[broadcast-now] Parsed request data:", JSON.stringify(requestData, null, 2));
    } catch (parseError) {
      console.error("[broadcast-now] JSON parse error:", parseError);
      console.error("[broadcast-now] Error type:", parseError instanceof Error ? parseError.constructor.name : typeof parseError);
      console.error("[broadcast-now] Error message:", parseError instanceof Error ? parseError.message : String(parseError));
      if (parseError instanceof Error && parseError.stack) {
        console.error("[broadcast-now] Error stack:", parseError.stack);
      }
      return new Response(
        JSON.stringify({
          error: "Invalid JSON in request body",
          details: parseError instanceof Error ? parseError.message : String(parseError),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }
    
    // requestData가 null이거나 undefined인지 확인
    if (!requestData) {
      return new Response(
        JSON.stringify({ error: "Request body is empty or invalid" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const {
      generationId,
      channelId,
      scheduleType,
      delayMinutes,
      scheduledTime,
      scheduleName,
      customerInfo,
    } = requestData;

    // 필수 필드 검증 (더 상세한 오류 메시지)
    if (!generationId || !channelId || !scheduleType) {
      const missingFields: string[] = [];
      if (!generationId) missingFields.push("generationId");
      if (!channelId) missingFields.push("channelId");
      if (!scheduleType) missingFields.push("scheduleType");
      
      console.error(`[broadcast-now] Missing required fields: ${missingFields.join(", ")}`);
      console.error(`[broadcast-now] Received data:`, JSON.stringify(requestData, null, 2));
      
      return new Response(
        JSON.stringify({
          error: `Missing required fields: ${missingFields.join(", ")}`,
          received: {
            generationId: generationId || null,
            channelId: channelId || null,
            scheduleType: scheduleType || null,
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }
    
    console.log(`[broadcast-now] User: ${userId}, Schedule type: ${scheduleType}`);
    console.log(`[broadcast-now] Generation ID: ${generationId}, Channel ID: ${channelId}`);

    // 지연 송출 또는 스케줄 송출인 경우 스케줄 생성 후 즉시 실행하지 않음
    if (scheduleType === "delayed" || scheduleType === "scheduled") {
      let targetTime: Date;

      if (scheduleType === "delayed" && delayMinutes !== undefined) {
        // 지연 송출: 현재 시간(UTC) + 지연 시간
        // Date.now()는 UTC 밀리초를 반환하므로 정확하게 계산됨
        const currentTimeUTC = Date.now();
        targetTime = new Date(currentTimeUTC + delayMinutes * 60 * 1000);
        console.log(`[broadcast-now] Delayed broadcast calculation:`);
        console.log(`  - Current time (UTC): ${new Date(currentTimeUTC).toISOString()}`);
        console.log(`  - Delay minutes: ${delayMinutes}`);
        console.log(`  - Target time (UTC): ${targetTime.toISOString()}`);
        console.log(`  - Target time (KST): ${targetTime.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
      } else if (scheduleType === "scheduled" && scheduledTime) {
        // 스케줄 송출: 지정된 시간
        targetTime = new Date(scheduledTime);
      } else {
        return new Response(
          JSON.stringify({
            error: "Missing delayMinutes or scheduledTime",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        );
      }

      // 스케줄 생성
      const hasDeviceTargets = Array.isArray(requestData.deviceIds) && requestData.deviceIds.length > 0;
      const scheduleData: any = {
        user_id: userId,
        generation_id: generationId,
        target_channel: channelId,
        scheduled_time: targetTime.toISOString(),
        status: "scheduled",
        schedule_name: scheduleName || "Broadcast",
        schedule_type: scheduleType,
        is_player_broadcast: hasDeviceTargets,
        target_devices: hasDeviceTargets ? requestData.deviceIds : null,
      };

      // 고객 정보가 있으면 컬럼에 저장
      if (customerInfo) {
        scheduleData.customer_id = customerInfo.customerId || null;
        scheduleData.customer_name = customerInfo.customerName || null;
        scheduleData.category_code = customerInfo.categoryCode || null;
        scheduleData.memo = customerInfo.memo || null;
      }

      const { data: schedule, error: scheduleError } = await supabaseServiceClient
        .from("tts_schedule_requests")
        .insert(scheduleData)
        .select()
        .single();

      if (scheduleError) {
        console.error("[broadcast-now] Error creating schedule:", scheduleError);
        console.error("[broadcast-now] ScheduleError details:", JSON.stringify(scheduleError, null, 2));
        console.error("[broadcast-now] Attempted scheduleData:", JSON.stringify(scheduleData, null, 2));
        
        // 데이터베이스 스키마 오류인 경우 400으로 반환
        const isSchemaError = scheduleError.code === "42703" || // column does not exist
                             scheduleError.message?.includes("column") ||
                             scheduleError.message?.includes("does not exist");
        
        return new Response(
          JSON.stringify({
            error: "Failed to create schedule",
            details: scheduleError.message,
            code: scheduleError.code,
            hint: scheduleError.hint || (isSchemaError ? "데이터베이스 마이그레이션이 필요합니다. schedule_name, schedule_type 등의 컬럼을 추가해주세요." : null),
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: isSchemaError ? 400 : 500,
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Schedule created",
          scheduleId: schedule.id,
          scheduledTime: targetTime.toISOString(),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // 즉시 송출: 작업 큐에 기록 생성 후 바로 실행
    console.log(`[broadcast-now] Executing immediate broadcast for generation ${generationId}`);
    
    // 즉시 송출도 작업 큐에 기록 생성 (상태 추적을 위해)
    const now = new Date();
    const hasDeviceTargets = Array.isArray(requestData.deviceIds) && requestData.deviceIds.length > 0;
    const scheduleData: any = {
      user_id: userId,
      generation_id: generationId,
      target_channel: channelId,
      scheduled_time: now.toISOString(), // 현재 시간으로 설정
      status: "processing", // 처리 중 상태
      schedule_name: scheduleName || "즉시 송출",
      schedule_type: "immediate",
      is_player_broadcast: hasDeviceTargets,
      target_devices: hasDeviceTargets ? requestData.deviceIds : null,
    };

    // 고객 정보가 있으면 컬럼에 저장
    if (customerInfo) {
      scheduleData.customer_id = customerInfo.customerId || null;
      scheduleData.customer_name = customerInfo.customerName || null;
      scheduleData.category_code = customerInfo.categoryCode || null;
      scheduleData.memo = customerInfo.memo || null;
    }

    // 작업 큐에 기록 생성
    const { data: schedule, error: scheduleError } = await supabaseServiceClient
      .from("tts_schedule_requests")
      .insert(scheduleData)
      .select()
      .single();

    let scheduleId: string | null = null;
    if (scheduleError) {
      console.warn("[broadcast-now] Failed to create schedule record, continuing anyway:", scheduleError);
      // 작업 큐 기록 실패해도 송출은 계속 진행
    } else {
      scheduleId = schedule.id;
      console.log(`[broadcast-now] Created schedule record: ${scheduleId}`);
    }

    // 음원 데이터 조회
    const { data: generation, error: genError } = await supabaseServiceClient
      .from("tts_generations")
      .select("id, audio_url, cache_key, mime_type")
      .eq("id", generationId)
      .single();

    if (genError || !generation) {
      console.error(`[broadcast-now] Error fetching generation:`, genError);
      return new Response(
        JSON.stringify({
          error: "Generation not found",
          details: genError?.message,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    // 채널 정보 조회
    let channel: any = null;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(channelId);

    if (isUUID) {
      const { data, error } = await supabaseServiceClient
        .from("tts_channels")
        .select("id, endpoint, enabled, type, name, config")
        .eq("id", channelId)
        .eq("user_id", userId)
        .single();
      channel = data;
    } else {
      const { data, error } = await supabaseServiceClient
        .from("tts_channels")
        .select("id, endpoint, enabled, type, name, config")
        .eq("type", channelId)
        .eq("user_id", userId)
        .eq("enabled", true)
        .single();
      channel = data;
    }

    if (!channel || !channel.enabled || !channel.endpoint) {
      return new Response(
        JSON.stringify({
          error: "Channel not found or not configured",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    const channelConfig = (channel.config as Record<string, any>) || {};
    const registeredDevices = normalizeDeviceList(channelConfig);
    const requestedDeviceIds = Array.isArray(requestData.deviceIds) ? requestData.deviceIds : [];
    let resolvedDevices: RegisteredDevice[] = [];
    if (requestedDeviceIds.length > 0) {
      resolvedDevices = registeredDevices.filter((device) => requestedDeviceIds.includes(device.id));
      const missingDevices = requestedDeviceIds.filter(
        (deviceId) => !resolvedDevices.some((device) => device.id === deviceId)
      );
      if (missingDevices.length > 0) {
        return new Response(
          JSON.stringify({
            error: "Device not registered for this channel",
            details: missingDevices,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        );
      }
    }
    const sanitizedChannelCode = normalizeChannelCode(channelConfig.channelCode, channel.id);

    // 음원 데이터 로드 (execute-schedules와 동일한 로직)
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

    // 1. cache_key가 있으면 Supabase Storage에서 다운로드
    if (!audioData && generation.cache_key) {
      try {
        const { data: blobData, error: blobError } = await supabaseServiceClient.storage
          .from("tts-audio")
          .download(generation.cache_key);

        if (!blobError && blobData) {
          audioData = await blobData.arrayBuffer();
          mimeType = blobData.type || mimeType;
          console.log(`[broadcast-now] Loaded audio from storage cache_key: ${generation.cache_key}`);
        }
      } catch (err) {
        console.warn(`[broadcast-now] Failed to load from storage cache_key:`, err);
      }
    }

    // 2. audio_url이 data URL인 경우
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
          console.warn(`[broadcast-now] Failed to decode data URL:`, err);
        }
      }
    }

    // 3. audio_url이 Supabase Storage 경로인 경우 service role로 다운로드
    if (!audioData && generation.audio_url) {
      const storagePath = parseStoragePathFromUrl(generation.audio_url);
      if (storagePath) {
        try {
          const { data: blobData, error: blobError } = await supabaseServiceClient.storage
            .from(storagePath.bucket)
            .download(storagePath.path);

          if (!blobError && blobData) {
            audioData = await blobData.arrayBuffer();
            mimeType = blobData.type || mimeType;
            console.log(
              `[broadcast-now] Loaded audio from storage path: ${storagePath.bucket}/${storagePath.path}`
            );
          } else if (blobError) {
            console.warn(
              `[broadcast-now] Failed to download storage path ${storagePath.bucket}/${storagePath.path}:`,
              blobError
            );
          }
        } catch (err) {
          console.warn(`[broadcast-now] Storage download error:`, err);
        }
      }
    }

    // 4. audio_url이 HTTP/HTTPS URL인 경우 다운로드
    if (
      !audioData &&
      generation.audio_url &&
      !generation.audio_url.startsWith("data:")
    ) {
      try {
        const audioResponse = await fetch(generation.audio_url);
        if (audioResponse.ok) {
          const audioBlob = await audioResponse.blob();
          audioData = await audioBlob.arrayBuffer();
          mimeType = audioBlob.type || mimeType;
        }
      } catch (err) {
        console.warn(`[broadcast-now] Failed to download from URL:`, err);
      }
    }

    // 5. DB에서 직접 blob 로드 시도 (bytea 컬럼)
    if (!audioData) {
      try {
        const { data: blobRow, error: blobError } = await supabaseServiceClient
          .from("tts_generations")
          .select("audio_blob")
          .eq("id", generation.id)
          .single();

        if (!blobError && blobRow?.audio_blob) {
          const blobValue = blobRow.audio_blob;
          if (typeof blobValue === "string") {
            if (blobValue.startsWith("\\x")) {
              const hexString = blobValue.slice(2);
              const bytes = new Uint8Array(hexString.length / 2);
              for (let i = 0; i < hexString.length; i += 2) {
                bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
              }
              audioData = bytes.buffer;
            } else {
              try {
                const binaryString = atob(blobValue);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                audioData = bytes.buffer;
              } catch (e) {
                try {
                  const parsedArray = JSON.parse(blobValue);
                  if (Array.isArray(parsedArray)) {
                    audioData = new Uint8Array(parsedArray).buffer;
                  }
                } catch (parseError) {
                  const encoder = new TextEncoder();
                  audioData = encoder.encode(blobValue).buffer;
                }
              }
            }
          } else if (blobValue instanceof ArrayBuffer) {
            audioData = blobValue;
          } else if (Array.isArray(blobValue)) {
            audioData = new Uint8Array(blobValue).buffer;
          }
        }
      } catch (err) {
        console.warn(`[broadcast-now] Failed to load from DB:`, err);
      }
    }

    if (!audioData || audioData.byteLength < 100) {
      return new Response(
        JSON.stringify({
          error: "Audio data not available or too small",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // 채널 endpoint로 오디오 전송
    const sanitizeHeaderValue = (value: any): string => {
      if (value === null || value === undefined) {
        return "";
      }
      let str = String(value);
      if (str.length === 0) {
        return str;
      }
      try {
        const isASCII = /^[\x00-\x7F]*$/.test(str);
        if (isASCII) {
          return str;
        } else {
          return encodeURIComponent(str);
        }
      } catch (e) {
        console.warn(`[broadcast-now] Failed to sanitize header value: ${e}`);
        return "";
      }
    };

    const createBaseHeaders = (): Record<string, string> => {
      const headers: Record<string, string> = {
        "Content-Type": mimeType,
        "Content-Length": String(audioData.byteLength),
      };
      if (scheduleName) {
        headers["X-Schedule-Name"] = sanitizeHeaderValue(scheduleName);
      }
      if (resolvedDevices.length === 0 && customerInfo) {
        headers["X-Customer-Id"] = sanitizeHeaderValue(customerInfo.customerId);
        headers["X-Customer-Name"] = sanitizeHeaderValue(customerInfo.customerName);
        headers["X-Category-Code"] = sanitizeHeaderValue(customerInfo.categoryCode);
        if (customerInfo.memo) {
          headers["X-Customer-Memo"] = sanitizeHeaderValue(customerInfo.memo);
        }
      }
      if (channelConfig.authHeader) {
        headers["Authorization"] = sanitizeHeaderValue(channelConfig.authHeader);
      }
      if (channelConfig.apiKey) {
        headers["X-API-Key"] = sanitizeHeaderValue(channelConfig.apiKey);
      }
      if (channelConfig.customHeaders && typeof channelConfig.customHeaders === "object") {
        for (const [key, value] of Object.entries(channelConfig.customHeaders)) {
          headers[key] = sanitizeHeaderValue(value);
        }
      }
      return headers;
    };

    const sendToDevice = async (device?: RegisteredDevice) => {
      const headers = createBaseHeaders();
      if (device) {
        headers["X-Customer-Id"] = sanitizeHeaderValue(sanitizedChannelCode);
        headers["X-Channel-Code"] = sanitizeHeaderValue(sanitizedChannelCode);
        headers["X-Device-Id"] = sanitizeHeaderValue(device.id);
        headers["X-Device-Name"] = sanitizeHeaderValue(device.name);
        headers["X-Device-Token"] = sanitizeHeaderValue(device.token);
      }

      console.log(
        `[broadcast-now] Sending audio to endpoint: ${channel.endpoint}`,
        device ? ` (device ${device.name})` : ""
      );
      console.log(`[broadcast-now] Headers:`, JSON.stringify(headers, null, 2));

      const response = await fetch(channel.endpoint, {
        method: "POST",
        headers,
        body: audioData,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      console.log(
        `[broadcast-now] Successfully sent to ${channel.endpoint}`,
        device ? ` (device ${device.name})` : ""
      );
    };

    try {
      if (resolvedDevices.length > 0) {
        for (const device of resolvedDevices) {
          await sendToDevice(device);
        }
      } else {
        await sendToDevice();
      }

      // 작업 큐 상태 업데이트: 송출 성공
      if (scheduleId) {
        const { error: updateError } = await supabaseServiceClient
          .from("tts_schedule_requests")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", scheduleId);

        if (updateError) {
          console.warn(`[broadcast-now] Failed to update schedule status:`, updateError);
        } else {
          console.log(`[broadcast-now] Updated schedule ${scheduleId} status to 'sent'`);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Broadcast sent successfully",
          endpoint: channel.endpoint,
          audioSize: audioData.byteLength,
          scheduleId: scheduleId || null,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    } catch (sendError) {
      console.error(`[broadcast-now] Failed to send:`, sendError);
      
      // 작업 큐 상태 업데이트: 송출 실패
      if (scheduleId) {
        const { error: updateError } = await supabaseServiceClient
          .from("tts_schedule_requests")
          .update({
            status: "failed",
            fail_reason: sendError instanceof Error ? sendError.message : String(sendError),
          })
          .eq("id", scheduleId);

        if (updateError) {
          console.warn(`[broadcast-now] Failed to update schedule status:`, updateError);
        } else {
          console.log(`[broadcast-now] Updated schedule ${scheduleId} status to 'failed'`);
        }
      }

      return new Response(
        JSON.stringify({
          error: "Failed to send broadcast",
          details: sendError instanceof Error ? sendError.message : String(sendError),
          scheduleId: scheduleId || null,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }
  } catch (error) {
    console.error("[broadcast-now] Fatal error:", error);
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
const parseStoragePathFromUrl = (url: string):
  | { bucket: string; path: string }
  | null => {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/");
    const storageIndex = segments.findIndex((segment) => segment === "object");
    if (storageIndex === -1 || storageIndex + 2 >= segments.length) {
      return null;
    }
    const bucket = segments[storageIndex + 2];
    const pathSegments = segments.slice(storageIndex + 3);
    if (!bucket || pathSegments.length === 0) {
      return null;
    }
    const path = pathSegments.join("/");
    return {
      bucket,
      path: decodeURIComponent(path),
    };
  } catch (_error) {
    return null;
  }
};
