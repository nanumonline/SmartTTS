/**
 * 데이터베이스 서비스
 * 모든 TTS 관련 데이터를 Supabase에 저장/조회
 */

import { supabase } from "@/integrations/supabase/client";


// 공통: 네트워크 오류 감지 및 간단 재시도
function isTransientNetworkError(err: any): boolean {
  const msg = (err?.message || "") + " " + (err?.details || "");
  return (
    msg.includes("Failed to fetch") ||
    msg.includes("ERR_FAILED") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("NetworkError") ||
    msg.includes("502") ||
    msg.includes("504") ||
    msg.includes("522") ||
    msg.includes("524") ||
    err?.code === "ECONNREFUSED" ||
    err?.code === "ETIMEDOUT"
  );
}

async function withRetry<T>(fn: () => Promise<T>, retries: number = 1, delayMs: number = 300): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (retries > 0 && isTransientNetworkError(err)) {
      await new Promise((r) => setTimeout(r, delayMs));
      return withRetry(fn, retries - 1, delayMs * 2);
    }
    throw err;
  }
}

// CORS/엣지(522) 오류 감지 및 완화
function isCorsOrEdgeError(err: any): boolean {
  const msg = ((err?.message || "") + " " + (err?.details || "")).toLowerCase();
  // CORS 에러, 엣지 에러(522, 524), 게이트웨이 타임아웃(504), 네트워크 에러 감지
  return msg.includes("cors") || 
         msg.includes("access-control-allow-origin") || 
         msg.includes("522") || 
         msg.includes("524") || 
         msg.includes("504") ||
         msg.includes("failed to fetch") ||
         msg.includes("network") ||
         err?.code === "ECONNREFUSED" ||
         err?.code === "ETIMEDOUT";
}

// ==================== 음원 생성 이력 ====================

export interface GenerationEntry {
  id?: string;
  purpose: string;
  purposeLabel?: string;
  voiceId: string;
  voiceName?: string;
  savedName?: string;
  textPreview?: string;
  textLength?: number;
  duration?: number | null;
  language?: string;
  model?: string;
  style?: string;
  speed?: number;
  pitchShift?: number;
  audioBlob?: ArrayBuffer | null; // Blob을 ArrayBuffer로 변환하여 저장
  audioUrl?: string | null;
  cacheKey?: string;
  storagePath?: string | null;
  format?: string | null;
  paramHash?: string | null;
  mimeType?: string; // 오디오 MIME 타입 (예: "audio/mpeg", "audio/wav")
  status?: string;
  hasAudio?: boolean;
  isFavorite?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Blob을 ArrayBuffer로 변환
export async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return await blob.arrayBuffer();
}

// ArrayBuffer를 Blob으로 변환
export function arrayBufferToBlob(buffer: ArrayBuffer, mimeType: string = "audio/mpeg"): Blob {
  return new Blob([buffer], { type: mimeType });
}

// 생성 이력 저장
export async function saveGeneration(userId: string, entry: GenerationEntry, audioBlob?: Blob): Promise<string | null> {
  try {
    let audioBuffer: ArrayBuffer | null = null;
    if (audioBlob) {
      audioBuffer = await blobToArrayBuffer(audioBlob);
    }

    // VARCHAR(255) 제한을 위해 문자열 자르기
    const truncateString = (str: string | null | undefined, maxLength: number = 255): string | null => {
      if (!str) return null;
      if (str.length <= maxLength) return str;
      return str.substring(0, maxLength);
    };

    const audioArray = audioBuffer ? Array.from(new Uint8Array(audioBuffer)) : null;

    const baseData: any = {
      user_id: userId,
      purpose: entry.purpose,
      purpose_label: truncateString(entry.purposeLabel, 100),
      voice_id: truncateString(entry.voiceId, 255),
      voice_name: truncateString(entry.voiceName, 255),
      saved_name: truncateString(entry.savedName, 255),
      text_preview: entry.textPreview, // TEXT 타입이므로 길이 제한 없음
      text_length: entry.textLength ?? (entry.textPreview ? entry.textPreview.length : 0),
      duration: entry.duration,
      language: entry.language || "ko",
      model: truncateString(entry.model, 100),
      style: truncateString(entry.style, 100),
      speed: entry.speed ?? 1.0,
      pitch_shift: entry.pitchShift ?? 0,
      audio_blob: audioArray,
      audio_url: entry.audioUrl, // TEXT 타입이므로 길이 제한 없음
      cache_key: truncateString(entry.cacheKey, 255),
      mime_type: entry.mimeType || (audioBlob?.type || "audio/mpeg"), // MIME 타입 저장
      status: entry.status || "ready",
      has_audio: entry.hasAudio !== false,
      is_favorite: entry.isFavorite === true,
    };

    // 1) 우선 기본 필드만 insert 하여 400을 방지
    const { data, error } = await supabase
      .from("tts_generations")
      .insert(baseData)
      .select("id")
      .single();

    let insertData = data;
    let insertError = error;

    if (insertError) {
      const missingFavoriteColumn =
        insertError.code === "42703" ||
        insertError.message?.includes("is_favorite") ||
        insertError.message?.includes("column is_favorite");

      if (missingFavoriteColumn) {
        console.warn("'is_favorite' 컬럼을 찾을 수 없습니다. Supabase 마이그레이션 전까지 즐겨찾기 값 없이 저장합니다.");
        const fallbackData = { ...baseData } as any;
        delete fallbackData.is_favorite;
        const fallbackResult = await supabase
          .from("tts_generations")
          .insert(fallbackData)
          .select("id")
          .single();
        insertData = fallbackResult.data;
        insertError = fallbackResult.error;
      }
    }

    if (insertError) {
      if (insertError.code === "PGRST205" || insertError.message?.includes("schema cache")) {
        console.warn("DB 테이블이 아직 생성되지 않았습니다. 마이그레이션을 적용해주세요.");
        return null;
      }
      if (insertError.message?.includes("400")) {
        console.warn("DB 저장 실패 (400): 마이그레이션을 적용해주세요:", insertError.message);
        return null;
      }
      throw insertError;
    }
    const newId = insertData?.id || null;

    // 2) 확장 필드는 업데이트로 시도하되, 컬럼 부재/권한 에러는 조용히 무시
    if (newId) {
      try {
        const extendedUpdate: any = {};
        if (entry.storagePath) extendedUpdate.storage_path = truncateString(entry.storagePath, 500);
        if (entry.format) extendedUpdate.format = truncateString(entry.format, 50);
        if (entry.paramHash) extendedUpdate.param_hash = truncateString(entry.paramHash, 128);
        if (Object.keys(extendedUpdate).length > 0) {
          const { error: extErr } = await supabase
            .from("tts_generations")
            .update(extendedUpdate)
            .eq("user_id", userId)
            .eq("id", newId);
          if (extErr) {
            // 컬럼 없음(42703)/권한/PGRST 계열 에러는 무시
            // 400 에러도 조용히 처리 (컬럼이 없거나 마이그레이션 미적용 상태)
            if (
              extErr.code === "42703" ||
              extErr.code === "PGRST205" ||
              extErr.message?.includes("schema cache") ||
              extErr.code === "42501" ||
              extErr.message?.includes("401") ||
              extErr.message?.includes("403") ||
              extErr.message?.includes("406") ||
              extErr.message?.includes("400") ||
              extErr.code === "PGRST116" // PostgREST 400 에러 코드
            ) {
              // no-op (조용히 무시)
            } else {
              console.warn("확장 필드 업데이트 실패:", extErr.message);
            }
          }
        }
      } catch (_) {
        // 조용히 무시
      }
    }

    return newId;
  } catch (error: any) {
    // 네트워크 에러 또는 서버 에러 (502, CORS 등) 처리
    if (error.message?.includes("Failed to fetch") || 
        error.message?.includes("ERR_FAILED") ||
        error.code === "ECONNREFUSED" ||
        error.message?.includes("502") ||
        error.message?.includes("CORS")) {
      // 네트워크 문제는 조용히 처리 (폴백으로 localStorage 사용)
      console.warn("DB 저장 실패 (네트워크 문제):", error.message || "연결 실패");
      return null;
    }
    // 테이블이 없으면 조용히 실패 (마이그레이션 미적용 상태)
    if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
      console.warn("DB 테이블이 아직 생성되지 않았습니다. 마이그레이션을 적용해주세요.");
      return null;
    }
    // 기타 에러는 로그만 남기고 null 반환 (폴백)
    console.error("생성 이력 저장 실패:", error);
    return null;
  }
}

// 생성 이력 조회
export async function loadGenerations(userId: string, limit: number = 200): Promise<GenerationEntry[]> {
  try {
    const baseColumns = "id, purpose, purpose_label, voice_id, voice_name, saved_name, text_preview, text_length, duration, language, model, style, speed, pitch_shift, audio_url, cache_key, mime_type, status, has_audio, created_at, updated_at";
    const favoriteColumns = baseColumns + ", is_favorite";

    const buildQuery = (columns: string) =>
      supabase
        .from("tts_generations")
        .select(columns)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(Math.max(1, Math.min(500, limit)));

    let favoriteAvailable = true;

    let { data, error } = await buildQuery(favoriteColumns);

    if (error) {
      const missingFavoriteColumn =
        error.code === "42703" ||
        error.message?.includes("is_favorite") ||
        error.message?.includes("column is_favorite");

      if (missingFavoriteColumn) {
        favoriteAvailable = false;
        console.warn("'is_favorite' 컬럼을 찾을 수 없습니다. Supabase 마이그레이션이 필요합니다.");
        ({ data, error } = await buildQuery(baseColumns));
      }

      if (error) {
        if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
          return [];
        }
        if (error.message?.includes("400") || error.code === "42703" || error.message?.includes("column")) {
          console.warn("DB 조회 실패 (컬럼 누락): 마이그레이션을 적용해주세요:", error.message);
          return [];
        }
        if (isCorsOrEdgeError(error)) {
          console.warn("생성 이력 조회 실패 (CORS/엣지): 오프라인 모드로 계속합니다.");
          return [];
        }
        console.error("생성 이력 조회 실패:", error);
        return [];
      }
    }

    // voice_id별 name_ko 매핑 생성 (성능 최적화)
    const voiceIdSet = new Set((data || []).map((row: any) => row.voice_id).filter(Boolean));
    const nameKoMap = new Map<string, string>();
    
    if (voiceIdSet.size > 0) {
      try {
        const { data: catalogData } = await supabase
          .from("tts_voice_catalog")
          .select("voice_id, name_ko")
          .in("voice_id", Array.from(voiceIdSet));
        
        if (catalogData) {
          catalogData.forEach((item: any) => {
            if (item.voice_id && item.name_ko) {
              nameKoMap.set(item.voice_id, item.name_ko);
            }
          });
        }
      } catch (error) {
        // name_ko 조회 실패는 조용히 무시 (선택사항이므로)
        console.warn("음성 한글 이름 조회 실패 (무시됨):", error);
      }
    }

    return (data || []).map((row: any) => {
      const derivedCacheKey = row.cache_key || (row.param_hash ? `hash_${row.param_hash}` : null);

      let audioUrl = row.audio_url;
      if (audioUrl && audioUrl.startsWith("blob:")) {
        audioUrl = null;
      }

      const favoriteValue = favoriteAvailable
        ? row.is_favorite === true || row.is_favorite === 1
        : false;

      const entry: any = {
        id: row.id,
        purpose: row.purpose,
        purposeLabel: row.purpose_label,
        voiceId: row.voice_id,
        voiceName: row.voice_name,
        savedName: row.saved_name,
        textPreview: row.text_preview,
        textLength: row.text_length,
        duration: row.duration,
        language: row.language,
        model: row.model,
        style: row.style,
        speed: row.speed,
        pitchShift: row.pitch_shift,
        audioBlob: null,
        audioUrl,
        mimeType: row.mime_type || "audio/mpeg",
        cacheKey: derivedCacheKey || undefined,
        storagePath: row.storage_path || null,
        format: row.format || null,
        paramHash: row.param_hash || null,
        status: row.status,
        hasAudio: row.has_audio,
        isFavorite: favoriteValue,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
      
      // DB에서 가져온 name_ko 병합 (voice_id가 있을 때만)
      if (row.voice_id && nameKoMap.has(row.voice_id)) {
        entry.name_ko = nameKoMap.get(row.voice_id);
      }
      
      return entry;
    });
  } catch (error: any) {
    if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
      return [];
    }
    console.error("생성 이력 조회 실패:", error);
    return [];
  }
}

// 파라미터 해시로 생성 이력 조회
export async function findGenerationByHash(userId: string, paramHash: string): Promise<GenerationEntry | null> {
  try {
    // 기본 컬럼만 사용 (안정성 우선)
    const baseColumns = "id, purpose, purpose_label, voice_id, voice_name, saved_name, text_preview, text_length, duration, language, model, style, speed, pitch_shift, audio_url, cache_key, mime_type, status, has_audio, created_at, updated_at";
    
    // param_hash 컬럼이 있으면 필터링 시도, 없으면 전체 조회 후 클라이언트 측 필터링
    let { data, error } = await supabase
      .from("tts_generations")
      .select(baseColumns)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    
    if (error) {
      // 400 에러는 조용히 처리 (컬럼이 없거나 쿼리 형식 문제)
      if (error.code === "42703" || error.code === "400" || error.message?.includes("column") || error.message?.includes("400")) {
        return null;
      }
      return null;
    }
    
    // 클라이언트 측에서 param_hash 매칭
    const matched = (data || []).find((row: any) => {
      // param_hash 컬럼이 있으면 직접 비교
      if (row.param_hash && row.param_hash === paramHash) {
        return true;
      }
      // cache_key에서 hash 추출하여 비교
      if (row.cache_key && row.cache_key.includes('hash_')) {
        const derivedHash = row.cache_key.replace('hash_', '');
        return derivedHash === paramHash;
      }
      return false;
    });
    
    if (!matched) return null;
    
    const row: any = matched;
    const derivedCacheKey = row.cache_key || (row.param_hash ? `hash_${row.param_hash}` : null);
    return {
      id: row.id,
      purpose: row.purpose,
      purposeLabel: row.purpose_label,
      voiceId: row.voice_id,
      voiceName: row.voice_name,
      savedName: row.saved_name,
      textPreview: row.text_preview,
      textLength: row.text_length,
      duration: row.duration,
      language: row.language,
      model: row.model,
      style: row.style,
      speed: row.speed,
      pitchShift: row.pitch_shift,
      audioUrl: row.audio_url,
      cacheKey: derivedCacheKey || undefined,
      mimeType: row.mime_type || "audio/mpeg",
      storagePath: row.storage_path || null,
      format: row.format || null,
      paramHash: row.param_hash || null,
      status: row.status,
      hasAudio: row.has_audio,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    console.warn("findGenerationByHash 실패:", error);
    return null;
  }
}

// 단건 blob 데이터 로드(복원 전용)
export async function loadGenerationBlob(userId: string, id: string): Promise<{ audioBlob: ArrayBuffer | null; mimeType?: string } | null> {
  try {
    const { data, error } = await supabase
      .from("tts_generations")
      .select("audio_blob, mime_type")
      .eq("user_id", userId)
      .eq("id", id)
      .single();

    if (error) {
      // 500 에러는 서버 문제로 조용히 처리
      if (error.message?.includes("500")) {
        console.warn("loadGenerationBlob 500 에러 (서버 문제):", error.message);
        return null;
      }
      return null;
    }
    
    if (!data?.audio_blob) {
      console.warn(`[loadGenerationBlob] audio_blob 없음: ${id}`);
      return null;
    }

    let buf: ArrayBuffer | null = null;
    const rawBlob: any = data.audio_blob;

    // PostgreSQL bytea는 hex 문자열 형식("\\x5b37...") 또는 배열로 반환됨
    if (typeof rawBlob === 'string') {
      // hex 문자열 형식: "\\x5b37332c..."
      if (rawBlob.startsWith('\\x')) {
        const hexString = rawBlob.slice(2); // "\\x" 제거
        const bytes = new Uint8Array(hexString.length / 2);
        for (let i = 0; i < hexString.length; i += 2) {
          bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
        }
        buf = bytes.buffer;
        console.log(`[loadGenerationBlob] hex 디코딩 완료: ${bytes.length} bytes`);
      } else {
        console.warn(`[loadGenerationBlob] 알 수 없는 문자열 형식: ${rawBlob.substring(0, 20)}...`);
        return null;
      }
    } else if (Array.isArray(rawBlob)) {
      // 배열 형식: [91, 55, 51, ...]
      buf = new Uint8Array(rawBlob as number[]).buffer;
      console.log(`[loadGenerationBlob] 배열 디코딩 완료: ${(rawBlob as number[]).length} bytes`);
    } else {
      // 이미 ArrayBuffer나 TypedArray인 경우
      buf = new Uint8Array(rawBlob).buffer;
      console.log(`[loadGenerationBlob] 직접 변환 완료`);
    }

    if (!buf || buf.byteLength === 0) {
      console.warn(`[loadGenerationBlob] 빈 buffer: ${id}`);
      return null;
    }

    // 일부 레거시 데이터는 "[73,68,...]" 형태의 문자열로 저장되어 있음
    // 첫 바이트가 '['(91)인 경우 JSON 배열로 파싱 후 Uint8Array로 변환
    const firstByte = new Uint8Array(buf)[0];
    if (firstByte === 91 /* '[' */) {
      try {
        const text = new TextDecoder().decode(buf);
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          const bytes = new Uint8Array(parsed as number[]);
          buf = bytes.buffer;
          console.log(`[loadGenerationBlob] JSON 배열 디코딩 완료: ${bytes.length} bytes`);
        }
      } catch (error) {
        console.warn("[loadGenerationBlob] JSON 배열 파싱 실패:", error);
      }
    }

    return { audioBlob: buf, mimeType: data?.mime_type };
  } catch (error: any) {
    // 500 에러는 서버 문제로 조용히 처리
    if (error.message?.includes("500")) {
      console.warn("loadGenerationBlob 500 에러 (서버 문제):", error.message);
      return null;
    }
    console.error("[loadGenerationBlob] 예외:", error);
    return null;
  }
}

// 생성 이력 업데이트
export async function updateGeneration(userId: string, id: string, updates: Partial<GenerationEntry>): Promise<boolean> {
  try {
    const truncateString = (str: string | null | undefined, maxLength: number = 255): string | null => {
      if (!str) return null;
      if (str.length <= maxLength) return str;
      return str.substring(0, maxLength);
    };

    const updateData: any = {};
    if (updates.savedName !== undefined) updateData.saved_name = truncateString(updates.savedName, 255);
    if (updates.textPreview !== undefined) updateData.text_preview = updates.textPreview; // TEXT 타입
    if (updates.audioUrl !== undefined) updateData.audio_url = updates.audioUrl; // TEXT 타입
    if (updates.isFavorite !== undefined) updateData.is_favorite = updates.isFavorite === true;

    // 업데이트할 데이터가 없으면 조기 반환
    if (Object.keys(updateData).length === 0) {
      return true;
    }

    const { error } = await supabase
      .from("tts_generations")
      .update(updateData)
      .eq("user_id", userId)
      .eq("id", id);

    if (error) {
      // 400 에러도 조용히 처리 (컬럼이 없거나 마이그레이션 미적용 상태, RLS 정책 문제 등)
      const errorMessage = error.message || "";
      const errorCode = error.code || "";
      const isIgnorableError = 
        errorCode === "PGRST205" || 
        errorCode === "PGRST116" || // PostgREST 400 에러 코드
        errorCode === "42703" || // 컬럼 없음
        errorCode === "23505" || // Unique constraint violation
        errorMessage.includes("schema cache") ||
        errorMessage.includes("400") ||
        errorMessage.includes("Bad Request");
      
      if (isIgnorableError) {
        // 조용히 실패 처리 (콘솔 에러 없음)
        return false;
      }
      throw error;
    }
    return true;
  } catch (error: any) {
    // 400 에러는 조용히 처리
    const errorMessage = error?.message || "";
    const errorCode = error?.code || "";
    const isIgnorableError = 
      errorCode === "PGRST205" || 
      errorCode === "PGRST116" ||
      errorCode === "42703" ||
      errorCode === "23505" ||
      errorMessage.includes("schema cache") ||
      errorMessage.includes("400") ||
      errorMessage.includes("Bad Request");
    
    if (isIgnorableError) {
      // 조용히 실패 처리 (콘솔 에러 없음)
      return false;
    }
    // 심각한 에러만 로깅
    if (error.code !== "PGRST205") {
      console.error("생성 이력 업데이트 실패:", error);
    }
    return false;
  }
}

// 생성 이력 삭제
export async function deleteGeneration(userId: string, id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("tts_generations")
      .delete()
      .eq("user_id", userId)
      .eq("id", id);

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return false;
      }
      throw error;
    }
    return true;
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      console.error("생성 이력 삭제 실패:", error);
    }
    return false;
  }
}

export async function setGenerationFavorite(userId: string, id: string, isFavorite: boolean): Promise<boolean> {
  return updateGeneration(userId, id, { isFavorite });
}

// ==================== 즐겨찾기 ====================

// 즐겨찾기 추가
export async function addFavorite(userId: string, voiceId: string): Promise<boolean> {
  try {
    if (!userId || userId === "undefined") {
      console.warn("유효하지 않은 userId로 즐겨찾기를 추가할 수 없습니다.");
      return false;
    }

    const { error } = await supabase
      .from("tts_favorites")
      .insert({ user_id: userId, voice_id: voiceId })
      .select();

    // 이미 존재하면 에러 무시 (UNIQUE 제약)
    if (error && !error.message.includes("duplicate")) {
      // 테이블이 없으면 조용히 실패
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return false;
      }
      if (error.code === "22P02") {
        console.warn("유효하지 않은 userId 형식:", userId);
        return false;
      }
      throw error;
    }
    return true;
  } catch (error: any) {
    if (error.code !== "PGRST205" && error.code !== "22P02") {
      console.error("즐겨찾기 추가 실패:", error);
    }
    return false;
  }
}

// 즐겨찾기 제거
export async function removeFavorite(userId: string, voiceId: string): Promise<boolean> {
  try {
    if (!userId || userId === "undefined") {
      console.warn("유효하지 않은 userId로 즐겨찾기를 제거할 수 없습니다.");
      return false;
    }

    const { error } = await supabase
      .from("tts_favorites")
      .delete()
      .eq("user_id", userId)
      .eq("voice_id", voiceId);

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return false;
      }
      if (error.code === "22P02") {
        console.warn("유효하지 않은 userId 형식:", userId);
        return false;
      }
      throw error;
    }
    return true;
  } catch (error: any) {
    if (error.code !== "PGRST205" && error.code !== "22P02") {
      console.error("즐겨찾기 제거 실패:", error);
    }
    return false;
  }
}

// 즐겨찾기 목록 조회
export async function loadFavorites(userId: string): Promise<string[]> {
  try {
    if (!userId || userId === "undefined") {
      console.warn("유효하지 않은 userId로 즐겨찾기를 로드할 수 없습니다.");
      return [];
    }

    const { data, error } = await withRetry(async () => {
      const result = await supabase
        .from("tts_favorites")
        .select("voice_id")
        .eq("user_id", userId);
      
      // 네트워크 에러 감지
      if (result.error) {
        const errorMsg = (result.error?.message || "").toLowerCase();
        if (errorMsg.includes("failed to fetch") || 
            errorMsg.includes("522") || 
            errorMsg.includes("524") || 
            errorMsg.includes("504")) {
          throw result.error;
        }
      }
      
      return result;
    });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return [];
      }
      if (error.code === "22P02") {
        // UUID 형식 오류
        console.warn("유효하지 않은 userId 형식:", userId);
        return [];
      }
      // CORS/네트워크 에러인 경우 빈 배열 반환 (오프라인 모드)
      if (isCorsOrEdgeError(error)) {
        console.warn("즐겨찾기 조회 실패 (CORS/엣지): 오프라인 모드로 계속합니다.");
        return [];
      }
      throw error;
    }
    return (data || []).map((row: any) => row.voice_id);
  } catch (error: any) {
    if (error.code !== "PGRST205" && error.code !== "22P02") {
      // CORS/네트워크 에러는 조용히 처리
      if (!isCorsOrEdgeError(error)) {
        console.error("즐겨찾기 조회 실패:", error);
      }
    }
    return [];
  }
}

// ==================== 사용자 설정 ====================

export interface UserSettings {
  selectedPurpose?: string;
  voiceSettings?: any;
  preferences?: any;
  storagePath?: string; // 로컬 저장 경로
}

// 설정 저장
export async function saveUserSettings(userId: string, settings: UserSettings): Promise<boolean> {
  try {
    const updateData: any = {
      user_id: userId,
      selected_purpose: settings.selectedPurpose,
      voice_settings: settings.voiceSettings || {},
      preferences: settings.preferences || {},
      updated_at: new Date().toISOString(),
    };
    
    // storage_path 필드 추가 (컬럼이 있을 경우에만)
    if (settings.storagePath !== undefined) {
      updateData.storage_path = settings.storagePath;
    }
    
    const { error } = await supabase
      .from("tts_user_settings")
      .upsert(updateData, {
        onConflict: "user_id"
      });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return false;
      }
      // RLS 정책 위반이나 권한 에러는 조용히 처리 (localStorage 폴백)
      if (error.code === "42501" || error.message?.includes("401") || error.message?.includes("406")) {
        console.warn("설정 저장 실패 (RLS/권한):", error);
        return false;
      }
      throw error;
    }
    return true;
  } catch (error: any) {
    if (error.code !== "PGRST205" && error.code !== "42501" && !error.message?.includes("401") && !error.message?.includes("406")) {
      console.error("설정 저장 실패:", error);
    }
    return false;
  }
}

// 설정 조회
export async function loadUserSettings(userId: string): Promise<UserSettings | null> {
  try {
    const { data, error } = await supabase
      .from("tts_user_settings")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // 없음
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return null; // 테이블 없음 (조용히 처리)
      }
      // CORS/엣지(522) 오류는 조용히 null 반환
      if (isCorsOrEdgeError(error)) {
        console.warn("설정 조회 실패 (CORS/엣지): 오프라인 모드로 계속합니다.");
        return null;
      }
      // RLS 정책 위반이나 권한 에러는 조용히 처리
      if (error.code === "42501" || error.message?.includes("401") || error.message?.includes("406")) {
        console.warn("설정 조회 실패 (RLS/권한):", error);
        return null;
      }
      throw error;
    }

    return {
      selectedPurpose: data.selected_purpose,
      voiceSettings: data.voice_settings,
      preferences: data.preferences,
      storagePath: data.storage_path || undefined,
    };
  } catch (error: any) {
    if (error.code !== "PGRST205" && error.code !== "42501" && error.status !== 401 && error.status !== 406) {
      console.error("설정 조회 실패:", error);
    }
    return null;
  }
}

// ==================== 클론 요청 ====================

export interface CloneRequestEntry {
  id?: string;
  targetName: string;
  baseVoiceId: string;
  baseVoiceName?: string;
  language: string;
  memo?: string;
  sampleFile?: Blob | null;
  sampleName?: string;
  youtubeUrl?: string;
  sampleType?: string;
  voiceId?: string;
  voiceName?: string;
  gender?: string;
  status?: string;
  createdAt?: string;
  completedAt?: string;
}

// 클론 요청 저장
export async function saveCloneRequest(userId: string, request: CloneRequestEntry): Promise<string | null> {
  try {
    let sampleBuffer: ArrayBuffer | null = null;
    if (request.sampleFile) {
      sampleBuffer = await blobToArrayBuffer(request.sampleFile);
    }

    const { data, error } = await supabase
      .from("tts_clone_requests")
      .insert({
        user_id: userId,
        target_name: request.targetName,
        base_voice_id: request.baseVoiceId,
        base_voice_name: request.baseVoiceName,
        language: request.language || "ko",
        memo: request.memo,
        sample_file: sampleBuffer ? Array.from(new Uint8Array(sampleBuffer)) : null,
        sample_name: request.sampleName,
        youtube_url: request.youtubeUrl,
        sample_type: request.sampleType || "file",
        voice_id: request.voiceId,
        voice_name: request.voiceName,
        gender: request.gender,
        status: request.status || "processing",
        completed_at: request.completedAt,
      } as any)
      .select("id")
      .single();

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return null;
      }
      throw error;
    }
    return data?.id || null;
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      console.error("클론 요청 저장 실패:", error);
    }
    return null;
  }
}

// 클론 요청 조회
export async function loadCloneRequests(userId: string): Promise<CloneRequestEntry[]> {
  try {
    const { data, error } = await supabase
      .from("tts_clone_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return [];
      }
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      targetName: row.target_name,
      baseVoiceId: row.base_voice_id,
      baseVoiceName: row.base_voice_name,
      language: row.language,
      memo: row.memo,
      sampleFile: row.sample_file ? arrayBufferToBlob(new Uint8Array(row.sample_file).buffer) : null,
      sampleName: row.sample_name,
      youtubeUrl: row.youtube_url,
      sampleType: row.sample_type,
      voiceId: row.voice_id,
      voiceName: row.voice_name,
      gender: row.gender,
      status: row.status,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    }));
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      console.error("클론 요청 조회 실패:", error);
    }
    return [];
  }
}

// ==================== 믹싱 상태 ====================

export interface MixingStateEntry {
  generationId: string;
  settings: any; // MixingState JSON
  mixedAudioBlob?: Blob | null;
  mixedAudioUrl?: string;
}

// 믹싱 상태 저장
export async function saveMixingState(userId: string, state: MixingStateEntry, audioBlob?: Blob): Promise<boolean> {
  try {
    let audioBuffer: ArrayBuffer | null = null;
    if (audioBlob) {
      audioBuffer = await blobToArrayBuffer(audioBlob);
    }

    const { error } = await supabase
      .from("tts_mixing_states")
      .upsert({
        user_id: userId,
        generation_id: state.generationId,
        settings: state.settings as any,
        mixed_audio_blob: audioBuffer ? Array.from(new Uint8Array(audioBuffer)) : null,
        mixed_audio_url: state.mixedAudioUrl,
        updated_at: new Date().toISOString(),
      } as any, {
        onConflict: "user_id,generation_id"
      });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return false;
      }
      throw error;
    }
    return true;
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      console.error("믹싱 상태 저장 실패:", error);
    }
    return false;
  }
}

// 믹싱 상태 조회
export async function loadMixingStates(userId: string): Promise<Map<string, MixingStateEntry>> {
  try {
    const { data, error } = await withRetry(async () => {
      const result = await supabase
        .from("tts_mixing_states")
        .select("*")
        .eq("user_id", userId);
      
      // 네트워크 에러 감지
      if (result.error) {
        const errorMsg = (result.error?.message || "").toLowerCase();
        if (errorMsg.includes("failed to fetch") || 
            errorMsg.includes("522") || 
            errorMsg.includes("524") || 
            errorMsg.includes("504")) {
          throw result.error;
        }
      }
      
      return result;
    });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return new Map();
      }
      // CORS/네트워크 에러인 경우 빈 Map 반환 (오프라인 모드)
      if (isCorsOrEdgeError(error)) {
        console.warn("믹싱 상태 조회 실패 (CORS/엣지): 오프라인 모드로 계속합니다.");
        return new Map();
      }
      throw error;
    }

    const map = new Map<string, MixingStateEntry>();
    (data || []).forEach((row: any) => {
      map.set(row.generation_id, {
        generationId: row.generation_id,
        settings: row.settings,
        mixedAudioBlob: row.mixed_audio_blob ? arrayBufferToBlob(new Uint8Array(row.mixed_audio_blob).buffer) : null,
        mixedAudioUrl: row.mixed_audio_url,
      });
    });
    return map;
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      // CORS/네트워크 에러는 조용히 처리
      if (!isCorsOrEdgeError(error)) {
        console.error("믹싱 상태 조회 실패:", error);
      }
    }
    return new Map();
  }
}

// ==================== 예약 요청 ====================

export interface ScheduleRequestEntry {
  id?: string;
  generationId: string;
  targetChannel: string;
  targetName?: string;
  scheduledTime: string;
  repeatOption?: string;
  status?: string;
  sentAt?: string;
  failReason?: string;
  mixingState?: any;
  createdAt?: string;
}

// 예약 요청 저장
export async function saveScheduleRequest(userId: string, request: ScheduleRequestEntry): Promise<string | null> {
  try {
    // 기본 데이터 구성
    const baseData: any = {
      user_id: userId,
      generation_id: request.generationId,
      target_channel: request.targetChannel,
      scheduled_time: request.scheduledTime,
      repeat_option: request.repeatOption || "once",
      status: request.status || "scheduled",
    };

    // 선택적 필드 추가 (컬럼이 있을 수 있으므로)
    if (request.targetName) {
      baseData.target_name = request.targetName;
    }
    if (request.sentAt) {
      baseData.sent_at = request.sentAt;
    }
    if (request.failReason) {
      baseData.fail_reason = request.failReason;
    }
    if (request.mixingState) {
      baseData.mixing_state = request.mixingState;
    }
    if ((request as any).scheduleName) {
      baseData.schedule_name = (request as any).scheduleName;
    }
    if ((request as any).scheduleType) {
      baseData.schedule_type = (request as any).scheduleType;
    }

    const { data, error } = await supabase
      .from("tts_schedule_requests")
      .insert(baseData)
      .select("id")
      .single();

    if (error) {
      // 컬럼이 없는 경우 (42703) 또는 테이블이 없는 경우 (PGRST205)는 조용히 처리
      if (error.code === "PGRST205" || error.code === "42703" || error.message?.includes("schema cache") || error.message?.includes("does not exist")) {
        // schedule_name이나 schedule_type 컬럼이 없으면 기본 필드만으로 재시도
        if (error.message?.includes("schedule_name") || error.message?.includes("schedule_type")) {
          const fallbackData: any = {
            user_id: userId,
            generation_id: request.generationId,
            target_channel: request.targetChannel,
            scheduled_time: request.scheduledTime,
            repeat_option: request.repeatOption || "once",
            status: request.status || "scheduled",
          };
          if (request.targetName) fallbackData.target_name = request.targetName;
          if (request.sentAt) fallbackData.sent_at = request.sentAt;
          if (request.failReason) fallbackData.fail_reason = request.failReason;
          if (request.mixingState) fallbackData.mixing_state = request.mixingState;

          const { data: fallbackResult, error: fallbackError } = await supabase
            .from("tts_schedule_requests")
            .insert(fallbackData)
            .select("id")
            .single();

          if (fallbackError) {
            if (fallbackError.code === "PGRST205" || fallbackError.code === "42703") {
              return null;
            }
            throw fallbackError;
          }
          return fallbackResult?.id || null;
        }
        return null;
      }
      throw error;
    }
    return data?.id || null;
  } catch (error: any) {
    if (error.code !== "PGRST205" && error.code !== "42703") {
      console.error("예약 요청 저장 실패:", error);
    }
    return null;
  }
}

// 예약 요청 조회
export async function loadScheduleRequests(userId: string): Promise<ScheduleRequestEntry[]> {
  try {
    const { data, error } = await withRetry(async () => {
      const result = await supabase
        .from("tts_schedule_requests")
        .select("*")
        .eq("user_id", userId)
        .order("scheduled_time", { ascending: false });
      
      // 네트워크 에러 감지
      if (result.error) {
        const errorMsg = (result.error?.message || "").toLowerCase();
        if (errorMsg.includes("failed to fetch") || 
            errorMsg.includes("522") || 
            errorMsg.includes("524") || 
            errorMsg.includes("504")) {
          throw result.error;
        }
      }
      
      return result;
    });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return [];
      }
      // CORS/네트워크 에러인 경우 빈 배열 반환 (오프라인 모드)
      if (isCorsOrEdgeError(error)) {
        console.warn("예약 요청 조회 실패 (CORS/엣지): 오프라인 모드로 계속합니다.");
        return [];
      }
      throw error;
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      generationId: row.generation_id,
      targetChannel: row.target_channel,
      targetName: row.target_name,
      scheduledTime: row.scheduled_time,
      repeatOption: row.repeat_option,
      status: row.status,
      sentAt: row.sent_at,
      failReason: row.fail_reason,
      mixingState: row.mixing_state,
      createdAt: row.created_at,
      scheduleName: row.schedule_name,
      scheduleType: row.schedule_type || "routine",
    }));
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      // CORS/네트워크 에러는 조용히 처리
      if (!isCorsOrEdgeError(error)) {
        console.error("예약 요청 조회 실패:", error);
      }
    }
    return [];
  }
}

// 예약 요청 수정
export async function updateScheduleRequest(
  userId: string,
  id: string,
  updates: Partial<ScheduleRequestEntry>
): Promise<boolean> {
  try {
    const updateData: any = {};

    if (updates.generationId !== undefined) {
      updateData.generation_id = updates.generationId;
    }
    if (updates.targetChannel !== undefined) {
      updateData.target_channel = updates.targetChannel;
    }
    if (updates.targetName !== undefined) {
      updateData.target_name = updates.targetName;
    }
    if (updates.scheduledTime !== undefined) {
      updateData.scheduled_time = updates.scheduledTime;
    }
    if (updates.repeatOption !== undefined) {
      updateData.repeat_option = updates.repeatOption;
    }
    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }
    if (updates.sentAt !== undefined) {
      updateData.sent_at = updates.sentAt;
    }
    if (updates.failReason !== undefined) {
      updateData.fail_reason = updates.failReason;
    }
    if (updates.mixingState !== undefined) {
      updateData.mixing_state = updates.mixingState;
    }
    if ((updates as any).scheduleName !== undefined) {
      updateData.schedule_name = (updates as any).scheduleName;
    }
    if ((updates as any).scheduleType !== undefined) {
      updateData.schedule_type = (updates as any).scheduleType;
    }

    const { error } = await supabase
      .from("tts_schedule_requests")
      .update(updateData)
      .eq("user_id", userId)
      .eq("id", id);

    if (error) {
      if (error.code === "PGRST205" || error.code === "42703" || error.message?.includes("schema cache")) {
        return false;
      }
      throw error;
    }
    return true;
  } catch (error: any) {
    if (error.code !== "PGRST205" && error.code !== "42703") {
      console.error("예약 요청 수정 실패:", error);
    }
    return false;
  }
}

// 예약 요청 삭제
export async function deleteScheduleRequest(userId: string, id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("tts_schedule_requests")
      .delete()
      .eq("user_id", userId)
      .eq("id", id);

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return false;
      }
      throw error;
    }
    return true;
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      console.error("예약 요청 삭제 실패:", error);
    }
    return false;
  }
}

// ==================== 송출 기능 ====================

export interface CustomerInfo {
  customerId: string;
  customerName: string;
  categoryCode: string;
  memo?: string;
}

export interface BroadcastOptions {
  generationId: string;
  channelId: string;
  scheduleName?: string;
  customerInfo?: CustomerInfo; // 플레이어 송출 옵션 선택 시
}

// Edge Function 호출 래퍼
async function invokeBroadcastNow(
  options: BroadcastOptions & {
    scheduleType: "immediate" | "delayed" | "scheduled";
    delayMinutes?: number;
    scheduledTime?: string;
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // 전송 전 유효성 검사
    if (!options.generationId || options.generationId.trim() === "") {
      console.error("[broadcast] generationId is missing or empty");
      return {
        success: false,
        error: "음원 ID가 없습니다. 음원을 선택해주세요.",
      };
    }
    
    if (!options.channelId || options.channelId.trim() === "") {
      console.error("[broadcast] channelId is missing or empty");
      return {
        success: false,
        error: "채널 ID가 없습니다. 채널을 선택해주세요.",
      };
    }
    
    if (!options.scheduleType) {
      console.error("[broadcast] scheduleType is missing");
      return {
        success: false,
        error: "송출 타입이 지정되지 않았습니다.",
      };
    }
    
    console.log("[dbService] invokeBroadcastNow called with options:", JSON.stringify(options, null, 2));
    
    // 사용자 세션 토큰 가져오기
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !sessionData?.session?.access_token) {
      console.error("[dbService] Failed to get session:", sessionError);
      return {
        success: false,
        error: "인증이 필요합니다. 다시 로그인해주세요.",
      };
    }
    
    const accessToken = sessionData.session.access_token;
    
    // fetch API를 직접 사용하여 응답 본문을 확실하게 확인
    const SUPABASE_URL = "https://gxxralruivyhdxyftsrg.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4eHJhbHJ1aXZ5aGR4eWZ0c3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NDM0MzQsImV4cCI6MjA3NzIxOTQzNH0.6lJjJq15spXWrktl-8d5qXI3L5FHkyaEArWiH2R5AjA";
    
    let responseData: any = null;
    let responseError: any = null;
    let responseStatus: number = 0;
    
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/broadcast-now`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`, // 사용자 세션 토큰 사용
          "apikey": SUPABASE_ANON_KEY, // Supabase Edge Functions는 apikey도 필요
        },
        body: JSON.stringify(options),
      });
      
      responseStatus = response.status;
      const responseText = await response.text();
      
      console.log("[dbService] Raw response status:", responseStatus);
      console.log("[dbService] Raw response text:", responseText);
      
      // 응답 본문 파싱 시도
      try {
        responseData = JSON.parse(responseText);
        console.log("[dbService] Parsed response data:", responseData);
      } catch (e) {
        // JSON이 아닌 경우 텍스트로 저장
        responseData = responseText;
        console.log("[dbService] Response is not JSON, using as text:", responseText);
      }
      
      // 400 이상의 상태 코드는 오류로 처리
      if (!response.ok) {
        responseError = {
          name: "FunctionsHttpError",
          message: `Edge Function returned a non-2xx status code: ${response.status}`,
          status: response.status,
          context: {},
        };
      }
    } catch (fetchError: any) {
      console.error("[dbService] Fetch error:", fetchError);
      responseError = fetchError;
    }
    
    // Supabase invoke와 호환되는 형태로 변환
    const data = responseData;
    const error = responseError;
    
    console.log("[dbService] Final response:", { 
      status: responseStatus,
      hasData: !!data, 
      hasError: !!error,
      dataType: typeof data,
      dataValue: data,
      errorType: error ? typeof error : null,
      errorName: error?.name,
      errorMessage: error?.message,
    });
    
    // 상세한 로깅 (data와 error 모두 확인)
    console.log("[dbService] Edge Function response:", { 
      hasData: !!data, 
      hasError: !!error,
      dataType: typeof data,
      dataValue: data,
      dataKeys: data && typeof data === 'object' && data !== null ? Object.keys(data) : null,
      errorType: error ? typeof error : null,
      errorName: error?.name,
      errorMessage: error?.message,
      errorContext: error?.context,
      errorContextKeys: error?.context && typeof error?.context === 'object' ? Object.keys(error.context) : null,
    });
    
    // data를 문자열로 직렬화하여 로그 출력 (실제 응답 본문 확인)
    if (data !== null && data !== undefined) {
      try {
        console.log("[dbService] Response data (stringified):", JSON.stringify(data, null, 2));
      } catch (e) {
        console.log("[dbService] Response data (could not stringify):", data);
      }
    }
    
    // error 객체 전체를 문자열로 직렬화하여 로그 출력
    if (error !== null && error !== undefined) {
      try {
        console.log("[dbService] Error object (stringified):", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      } catch (e) {
        console.log("[dbService] Error object (could not stringify):", error);
      }
    }
    

    // 오류 메시지 추출 함수
    const extractErrorMessage = (errorObj: any, responseData: any): string => {
      let errorMessage = "송출 중 오류가 발생했습니다.";
      
      console.log("[broadcast] Extracting error message from:", {
        hasErrorObj: !!errorObj,
        hasResponseData: !!responseData,
        errorObjType: typeof errorObj,
        responseDataType: typeof responseData,
      });
      
      // 1. responseData에서 오류 메시지 확인 (가장 확실한 방법 - 우선순위 1)
      if (responseData) {
        if (typeof responseData === 'string') {
          try {
            const parsed = JSON.parse(responseData);
            if (parsed?.error) {
              errorMessage = parsed.error;
              if (parsed.details) {
                errorMessage += `: ${parsed.details}`;
              }
              if (parsed.received) {
                console.error("[broadcast] Received data from Edge Function:", parsed.received);
                const missingFields = Object.entries(parsed.received)
                  .filter(([_, value]) => !value || value === null)
                  .map(([key, _]) => key);
                if (missingFields.length > 0) {
                  errorMessage += ` (누락된 필드: ${missingFields.join(", ")})`;
                }
              }
              return errorMessage;
            }
          } catch (e) {
            // 파싱 실패 시 문자열 자체를 메시지로 사용
            if (responseData.trim().length > 0) {
              errorMessage = responseData;
            }
          }
        } else if (typeof responseData === 'object' && responseData !== null) {
          console.log("[broadcast] responseData is object, keys:", Object.keys(responseData));
          if ('error' in responseData) {
            errorMessage = (responseData as any).error || errorMessage;
            if ((responseData as any).details) {
              errorMessage += `: ${(responseData as any).details}`;
            }
            if ((responseData as any).hint) {
              errorMessage += ` (${(responseData as any).hint})`;
            }
            if ((responseData as any).code) {
              console.log("[broadcast] Error code:", (responseData as any).code);
            }
            if ((responseData as any).received) {
              console.error("[broadcast] Received data from Edge Function:", (responseData as any).received);
              const received = (responseData as any).received;
              const missingFields = Object.entries(received)
                .filter(([_, value]) => !value || value === null || value === "")
                .map(([key, _]) => key);
              if (missingFields.length > 0) {
                errorMessage += ` [누락된 필드: ${missingFields.join(", ")}]`;
              }
            }
            console.log("[broadcast] Extracted error message from responseData (object):", errorMessage);
            return errorMessage;
          } else {
            console.log("[broadcast] responseData has no 'error' field, checking all keys");
            // error 필드가 없어도 다른 오류 정보가 있을 수 있음
            console.log("[broadcast] responseData full content:", JSON.stringify(responseData, null, 2));
          }
        }
      }
      
      // 2. error.context에서 응답 본문 확인 (우선순위 2)
      if (errorObj?.context) {
        console.log("[broadcast] Error context:", JSON.stringify(errorObj.context, null, 2));
        console.log("[broadcast] Error context keys:", Object.keys(errorObj.context));
        
        if (errorObj.context.body) {
          try {
            const contextBody = typeof errorObj.context.body === 'string' 
              ? JSON.parse(errorObj.context.body) 
              : errorObj.context.body;
            if (contextBody?.error) {
              errorMessage = contextBody.error;
              if (contextBody.details) {
                errorMessage += `: ${contextBody.details}`;
              }
              console.log("[broadcast] Extracted error message from context.body:", errorMessage);
              return errorMessage;
            }
          } catch (e) {
            console.warn("[broadcast] Failed to parse context.body:", e);
          }
        }
        
        if (errorObj.context.response) {
          try {
            const contextResponse = typeof errorObj.context.response === 'string'
              ? JSON.parse(errorObj.context.response)
              : errorObj.context.response;
            if (contextResponse?.error) {
              errorMessage = contextResponse.error;
              if (contextResponse.details) {
                errorMessage += `: ${contextResponse.details}`;
              }
              console.log("[broadcast] Extracted error message from context.response:", errorMessage);
              return errorMessage;
            }
          } catch (e) {
            console.warn("[broadcast] Failed to parse context.response:", e);
          }
        }
      }
      
      // 3. error.message 확인 (우선순위 3)
      if (errorObj?.message) {
        if (errorObj.message !== "Edge Function returned a non-2xx status code") {
          errorMessage = errorObj.message;
          console.log("[broadcast] Using error.message:", errorMessage);
        }
      }
      
      return errorMessage;
    };

    // 중요: error가 있어도 data를 먼저 확인 (data에 실제 오류 정보가 있을 수 있음)
    if (data && typeof data === 'object' && data !== null && 'error' in data) {
      console.error("[broadcast] Error in response data:", data);
      const errorMessage = extractErrorMessage(error, data);
      return {
        success: false,
        error: errorMessage,
      };
    }
    
    // error가 있으면 실패 처리
    if (error) {
      console.error("[broadcast] Edge Function error:", error);
      console.error("[broadcast] Error details:", JSON.stringify(error, null, 2));
      
      // data도 함께 전달 (Supabase Functions는 error가 있어도 data에 응답 본문이 있을 수 있음)
      const errorMessage = extractErrorMessage(error, data);
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error("[broadcast] Failed to invoke broadcast function:", error);
    console.error("[broadcast] Exception details:", JSON.stringify(error, null, 2));
    return {
      success: false,
      error: error.message || "송출 중 오류가 발생했습니다.",
    };
  }
}

// 즉시 송출
export async function broadcastImmediately(
  options: BroadcastOptions
): Promise<{ success: boolean; data?: any; error?: string }> {
  return invokeBroadcastNow({
    ...options,
    scheduleType: "immediate",
  });
}

// 지연 송출
export async function broadcastDelayed(
  options: BroadcastOptions,
  delayMinutes: number
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (delayMinutes <= 0) {
    return {
      success: false,
      error: "Delay minutes must be greater than 0",
    };
  }

  return invokeBroadcastNow({
    ...options,
    scheduleType: "delayed",
    delayMinutes,
  });
}

// 스케줄 송출 (프론트에서 직접 호출)
export async function broadcastScheduled(
  options: BroadcastOptions,
  scheduledTime: string // ISO string
): Promise<{ success: boolean; data?: any; error?: string }> {
  return invokeBroadcastNow({
    ...options,
    scheduleType: "scheduled",
    scheduledTime,
  });
}

// ==================== 검수 상태 ====================

export interface ReviewStateEntry {
  generationId: string;
  status: string;
  comments?: string;
  updatedAt?: string;
}

// 검수 상태 저장
export async function saveReviewState(userId: string, state: ReviewStateEntry): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("tts_review_states")
      .upsert({
        user_id: userId,
        generation_id: state.generationId,
        status: state.status,
        comments: state.comments,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,generation_id"
      });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return false;
      }
      throw error;
    }
    return true;
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      console.error("검수 상태 저장 실패:", error);
    }
    return false;
  }
}

// 검수 상태 조회
export async function loadReviewStates(userId: string): Promise<Map<string, ReviewStateEntry>> {
  try {
    const { data, error } = await withRetry(async () => {
      const result = await supabase
        .from("tts_review_states")
        .select("*")
        .eq("user_id", userId);
      
      // 네트워크 에러 감지
      if (result.error) {
        const errorMsg = (result.error?.message || "").toLowerCase();
        if (errorMsg.includes("failed to fetch") || 
            errorMsg.includes("522") || 
            errorMsg.includes("524") || 
            errorMsg.includes("504")) {
          throw result.error;
        }
      }
      
      return result;
    });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return new Map();
      }
      // CORS/네트워크 에러인 경우 빈 Map 반환 (오프라인 모드)
      if (isCorsOrEdgeError(error)) {
        console.warn("검수 상태 조회 실패 (CORS/엣지): 오프라인 모드로 계속합니다.");
        return new Map();
      }
      throw error;
    }

    const map = new Map<string, ReviewStateEntry>();
    (data || []).forEach((row: any) => {
      map.set(row.generation_id, {
        generationId: row.generation_id,
        status: row.status,
        comments: row.comments,
        updatedAt: row.updated_at,
      });
    });
    return map;
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      // CORS/네트워크 에러는 조용히 처리
      if (!isCorsOrEdgeError(error)) {
        console.error("검수 상태 조회 실패:", error);
      }
    }
    return new Map();
  }
}

// ==================== 메시지 이력 ====================

export interface MessageHistoryEntry {
  id?: string;
  text: string;
  purpose: string;
  tags?: string[];
  isTemplate?: boolean;
  templateName?: string;
  templateCategory?: string;
  isFavorite?: boolean; // 즐겨찾기 여부
  createdAt?: string;
  updatedAt?: string;
}

export interface TemplateEntry extends MessageHistoryEntry {
  isTemplate: true;
  templateName: string;
  templateCategory: string;
  variables?: string[]; // 변수 목록 (계산 필드)
}

// 메시지 저장
export async function saveMessage(userId: string, message: MessageHistoryEntry): Promise<string | null> {
  try {
    // 컬럼이 존재하지 않을 수 있으므로, 존재하는 컬럼만 포함
    const insertData: any = {
      user_id: userId,
      text: message.text,
      purpose: message.purpose,
      is_template: false, // 메시지는 항상 false
    };

    // tags 컬럼이 있으면 추가 (컬럼이 없으면 에러 발생 방지)
    if (message.tags && message.tags.length > 0) {
      insertData.tags = JSON.stringify(message.tags);
    }

    // template 관련 컬럼은 메시지 저장 시 null로 설정
    // (템플릿이 아닌 일반 메시지이므로)

    const { data, error } = await supabase
      .from("tts_message_history")
      .insert(insertData)
      .select("id")
      .single();

    if (error) {
      // 컬럼이 존재하지 않는 경우 (42703) - tags, is_template 등이 없을 수 있음
      if (error.code === "42703" || error.message?.includes("column") || error.message?.includes("does not exist")) {
        console.warn("일부 컬럼이 존재하지 않습니다. 마이그레이션을 실행해주세요:", error.message);
        // 필수 컬럼만으로 재시도
        const { data: retryData, error: retryError } = await supabase
          .from("tts_message_history")
          .insert({
            user_id: userId,
            text: message.text,
            purpose: message.purpose,
          })
          .select("id")
          .single();
        
        if (retryError) {
          console.error("메시지 저장 실패 (재시도 후):", retryError);
          throw retryError;
        }
        return retryData?.id || null;
      }
      
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return null;
      }
      
      console.error("메시지 저장 실패:", error);
      throw error;
    }
    return data?.id || null;
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      console.error("메시지 저장 실패:", error);
    }
    throw error; // 에러를 다시 throw하여 호출자가 처리할 수 있도록
  }
}

// 템플릿 저장
export async function saveTemplate(userId: string, template: TemplateEntry): Promise<string | null> {
  try {
    const variables = (template.text.match(/\{([^}]+)\}/g) || []).map((v) =>
      v.replace(/[{}]/g, "")
    );
    
    const { data, error } = await supabase
      .from("tts_message_history")
      .insert({
        user_id: userId,
        text: template.text,
        purpose: template.purpose,
        is_template: true,
        template_name: template.templateName,
        template_category: template.templateCategory,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return null;
      }
      throw error;
    }
    return data?.id || null;
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      console.error("템플릿 저장 실패:", error);
    }
    return null;
  }
}

// 템플릿 업데이트
export async function updateTemplate(userId: string, id: string, template: Partial<TemplateEntry>): Promise<boolean> {
  try {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    if (template.text !== undefined) updateData.text = template.text;
    if (template.purpose !== undefined) updateData.purpose = template.purpose;
    if (template.templateName !== undefined) updateData.template_name = template.templateName;
    if (template.templateCategory !== undefined) updateData.template_category = template.templateCategory;

    let query = supabase
      .from("tts_message_history")
      .update(updateData)
      .eq("user_id", userId)
      .eq("id", id);

    // is_template 컬럼이 있는 경우에만 필터링 (에러 발생하면 컬럼 없음으로 간주)
    try {
      const { error: checkError } = await supabase
        .from("tts_message_history")
        .select("is_template")
        .eq("user_id", userId)
        .eq("id", id)
        .limit(1);
      
      if (!checkError) {
        query = query.eq("is_template", true);
      }
    } catch {
      // 컬럼이 없으면 필터링 없이 업데이트
    }

    const { error } = await query;

    if (error) {
      // 컬럼이 존재하지 않는 경우 (42703) 또는 테이블이 없는 경우 (PGRST205)
      if (error.code === "PGRST205" || error.code === "42703" || error.message?.includes("schema cache") || error.message?.includes("does not exist")) {
        return false;
      }
      throw error;
    }
    return true;
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      console.error("템플릿 업데이트 실패:", error);
    }
    return false;
  }
}

// 템플릿 삭제
export async function deleteTemplate(userId: string, id: string): Promise<boolean> {
  try {
    let query = supabase
      .from("tts_message_history")
      .delete()
      .eq("user_id", userId)
      .eq("id", id);

    // is_template 컬럼이 있는 경우에만 필터링 (에러 발생하면 컬럼 없음으로 간주)
    try {
      const { error: checkError } = await supabase
        .from("tts_message_history")
        .select("is_template")
        .eq("user_id", userId)
        .eq("id", id)
        .limit(1);
      
      if (!checkError) {
        query = query.eq("is_template", true);
      }
    } catch {
      // 컬럼이 없으면 필터링 없이 삭제
    }

    const { error } = await query;

    if (error) {
      // 컬럼이 존재하지 않는 경우 (42703) 또는 테이블이 없는 경우 (PGRST205)
      if (error.code === "PGRST205" || error.code === "42703" || error.message?.includes("schema cache") || error.message?.includes("does not exist")) {
        return false;
      }
      throw error;
    }
    return true;
  } catch (error: any) {
    // 컬럼이 존재하지 않는 경우 (42703) 또는 테이블이 없는 경우 (PGRST205)
    if (error.code !== "PGRST205" && error.code !== "42703") {
      console.error("템플릿 삭제 실패:", error);
    }
    return false;
  }
}

// 템플릿 목록 조회
export async function loadTemplates(userId: string, category?: string): Promise<TemplateEntry[]> {
  try {
    // is_template 컬럼이 없을 수 있으므로, 먼저 모든 데이터를 가져온 후 필터링
    const query = supabase
      .from("tts_message_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      // 컬럼이 존재하지 않는 경우 (42703) 또는 테이블이 없는 경우 (PGRST205)
      if (error.code === "PGRST205" || error.code === "42703" || error.message?.includes("schema cache") || error.message?.includes("does not exist")) {
        return [];
      }
      throw error;
    }

    // is_template 컬럼이 있으면 필터링, 없으면 빈 배열 반환 (템플릿 없음)
    const filtered = (data || []).filter((row: any) => {
      // is_template 컬럼이 없으면 템플릿이 없음
      if (row.is_template === undefined) return false;
      const isTemplate = row.is_template === true;
      // category 필터링
      if (category && row.template_category !== category) return false;
      return isTemplate;
    });

    return filtered.map((row: any) => {
      const variables = (row.text.match(/\{([^}]+)\}/g) || []).map((v: string) =>
        v.replace(/[{}]/g, "")
      );
      return {
        id: row.id,
        text: row.text,
        purpose: row.purpose,
        isTemplate: true,
        templateName: row.template_name || undefined,
        templateCategory: row.template_category || undefined,
        variables,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  } catch (error: any) {
    // 컬럼이 존재하지 않는 경우 (42703) 또는 테이블이 없는 경우 (PGRST205)
    if (error.code !== "PGRST205" && error.code !== "42703") {
      console.error("템플릿 조회 실패:", error);
    }
    return [];
  }
}

// 메시지 업데이트
export async function updateMessage(userId: string, id: string, text: string, tags?: string[]): Promise<boolean> {
  try {
    const updateData: any = {
      text,
      updated_at: new Date().toISOString(),
    };
    
    // tags가 제공되면 포함
    if (tags !== undefined) {
      updateData.tags = tags.length > 0 ? JSON.stringify(tags) : null;
    }
    
    const { error } = await supabase
      .from("tts_message_history")
      .update(updateData)
      .eq("user_id", userId)
      .eq("id", id);

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return false;
      }
      throw error;
    }
    return true;
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      console.error("메시지 업데이트 실패:", error);
    }
    return false;
  }
}

// 메시지 삭제
export async function deleteMessage(userId: string, id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("tts_message_history")
      .delete()
      .eq("user_id", userId)
      .eq("id", id);

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return false;
      }
      throw error;
    }
    return true;
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      console.error("메시지 삭제 실패:", error);
    }
    return false;
  }
}

// 메시지 목록 조회 (템플릿 제외)
export async function loadMessages(userId: string): Promise<MessageHistoryEntry[]> {
  try {
    // is_template 컬럼이 없을 수 있으므로, 먼저 모든 데이터를 가져온 후 필터링 (재시도 포함)
    const { data, error } = await withRetry(async () => {
      const result = await supabase
        .from("tts_message_history")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      
      // 네트워크 에러 감지 (response가 없거나 status가 522, 524, 504인 경우)
      if (result.error) {
        const errorMsg = (result.error?.message || "").toLowerCase();
        if (errorMsg.includes("failed to fetch") || 
            errorMsg.includes("522") || 
            errorMsg.includes("524") || 
            errorMsg.includes("504")) {
          // 원본 에러를 그대로 throw하여 isCorsOrEdgeError가 감지할 수 있도록 함
          throw result.error;
        }
      }
      
      return result;
    });

    if (error) {
      // 컬럼이 존재하지 않는 경우 (42703) 또는 테이블이 없는 경우 (PGRST205)
      if (error.code === "PGRST205" || error.code === "42703" || error.message?.includes("schema cache") || error.message?.includes("does not exist")) {
        return [];
      }
      // CORS/네트워크 에러인 경우 빈 배열 반환 (오프라인 모드)
      if (isCorsOrEdgeError(error)) {
        console.warn("메시지 조회 실패 (CORS/엣지): 오프라인 모드로 계속합니다.");
        return [];
      }
      throw error;
    }

    // is_template 컬럼이 있으면 필터링, 없으면 모든 데이터 반환
    const filtered = (data || []).filter((row: any) => {
      // is_template 컬럼이 없으면 모두 메시지로 간주 (템플릿 아님)
      if (row.is_template === undefined) return true;
      return row.is_template === false;
    });

    return filtered.map((row: any) => {
      let tags: string[] = [];
      if (row.tags) {
        try {
          tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
        } catch (e) {
          console.warn("태그 파싱 실패:", e);
        }
      }
      return {
        id: row.id,
        text: row.text,
        purpose: row.purpose,
        tags: tags.length > 0 ? tags : undefined,
        isTemplate: row.is_template || false,
        templateName: row.template_name || undefined,
        templateCategory: row.template_category || undefined,
        isFavorite: row.is_favorite === true || row.is_favorite === 1, // 즐겨찾기 여부
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  } catch (error: any) {
    // 컬럼이 존재하지 않는 경우 (42703) 또는 테이블이 없는 경우 (PGRST205)
    if (error.code !== "PGRST205" && error.code !== "42703") {
      // CORS/네트워크 에러는 조용히 처리
      if (!isCorsOrEdgeError(error)) {
        console.error("메시지 조회 실패:", error);
      }
    }
    return [];
  }
}

// ==================== 메시지 즐겨찾기 ====================
// tts_message_history 테이블의 is_favorite 컬럼을 사용하여 즐겨찾기 정보 저장

// 메시지 즐겨찾기 추가
export async function addMessageFavorite(userId: string, messageId: string): Promise<boolean> {
  try {
    if (!userId || userId === "undefined") {
      console.warn("유효하지 않은 userId로 메시지 즐겨찾기를 추가할 수 없습니다.");
      return false;
    }

    // tts_message_history 테이블의 is_favorite 컬럼 업데이트
    const { error } = await (supabase as any)
      .from("tts_message_history")
      .update({ is_favorite: true })
      .eq("user_id", userId)
      .eq("id", messageId);

    if (error) {
      // 컬럼이 없으면 조용히 실패
      if (error.code === "PGRST205" || error.code === "42703" || error.message?.includes("schema cache") || error.message?.includes("does not exist")) {
        console.warn("메시지 즐겨찾기 컬럼이 없습니다 (is_favorite). 테이블 마이그레이션이 필요할 수 있습니다:", error);
        return false;
      }
      if (error.code === "22P02") {
        console.warn("유효하지 않은 userId 형식:", userId);
        return false;
      }
      console.error("메시지 즐겨찾기 추가 에러:", error);
      throw error;
    }
    
    console.log("메시지 즐겨찾기 추가 성공:", messageId);
    return true;
  } catch (error: any) {
    if (error.code !== "PGRST205" && error.code !== "42703" && error.code !== "22P02") {
      console.error("메시지 즐겨찾기 추가 실패:", error);
    }
    return false;
  }
}

// 메시지 즐겨찾기 제거
export async function removeMessageFavorite(userId: string, messageId: string): Promise<boolean> {
  try {
    if (!userId || userId === "undefined") {
      console.warn("유효하지 않은 userId로 메시지 즐겨찾기를 제거할 수 없습니다.");
      return false;
    }

    // tts_message_history 테이블의 is_favorite 컬럼 업데이트
    const { error } = await (supabase as any)
      .from("tts_message_history")
      .update({ is_favorite: false })
      .eq("user_id", userId)
      .eq("id", messageId);

    if (error) {
      // 컬럼이 없으면 조용히 실패
      if (error.code === "PGRST205" || error.code === "42703" || error.message?.includes("schema cache") || error.message?.includes("does not exist")) {
        console.warn("메시지 즐겨찾기 컬럼이 없습니다 (is_favorite). 테이블 마이그레이션이 필요할 수 있습니다:", error);
        return false;
      }
      if (error.code === "22P02") {
        console.warn("유효하지 않은 userId 형식:", userId);
        return false;
      }
      throw error;
    }
    return true;
  } catch (error: any) {
    if (error.code !== "PGRST205" && error.code !== "42703" && error.code !== "22P02") {
      console.error("메시지 즐겨찾기 제거 실패:", error);
    }
    return false;
  }
}

// 메시지 즐겨찾기 목록 조회
export async function loadMessageFavorites(userId: string): Promise<string[]> {
  try {
    if (!userId || userId === "undefined") {
      console.warn("유효하지 않은 userId로 메시지 즐겨찾기를 로드할 수 없습니다.");
      return [];
    }

    // tts_message_history 테이블에서 is_favorite가 true인 메시지 조회 (재시도 포함)
    const { data, error } = await withRetry(async () => {
      const result = await (supabase as any)
        .from("tts_message_history")
        .select("id")
        .eq("user_id", userId)
        .eq("is_favorite", true);
      
      // 네트워크 에러 감지 (response가 없거나 status가 522, 524, 504인 경우)
      if (result.error) {
        const errorMsg = (result.error?.message || "").toLowerCase();
        if (errorMsg.includes("failed to fetch") || 
            errorMsg.includes("522") || 
            errorMsg.includes("524") || 
            errorMsg.includes("504")) {
          // 원본 에러를 그대로 throw하여 isCorsOrEdgeError가 감지할 수 있도록 함
          throw result.error;
        }
      }
      
      return result;
    });

    if (error) {
      // 컬럼이 없으면 빈 배열 반환
      if (error.code === "PGRST205" || error.code === "42703" || error.message?.includes("schema cache") || error.message?.includes("does not exist")) {
        console.warn("메시지 즐겨찾기 컬럼이 없습니다 (is_favorite). 테이블 마이그레이션이 필요할 수 있습니다:", error);
        return [];
      }
      if (error.code === "22P02") {
        console.warn("유효하지 않은 userId 형식:", userId);
        return [];
      }
      if (isCorsOrEdgeError(error)) {
        console.warn("메시지 즐겨찾기 조회 실패 (CORS/엣지): 오프라인 모드로 계속합니다.");
        return [];
      }
      console.error("메시지 즐겨찾기 조회 에러:", error);
      throw error;
    }
    
    const favoriteIds = (data || []).map((row: any) => String(row.id));
    console.log(`메시지 즐겨찾기 조회 성공: ${favoriteIds.length}개`, favoriteIds);
    return favoriteIds;
  } catch (error: any) {
    if (error.code !== "PGRST205" && error.code !== "42703" && error.code !== "22P02") {
      // CORS/네트워크 에러는 조용히 처리
      if (!isCorsOrEdgeError(error)) {
        console.error("메시지 즐겨찾기 조회 실패:", error);
      }
    }
    return [];
  }
}

// ==================== 음성 카탈로그 ====================

// 음성 카탈로그 일별 동기화 (forceSync=true이면 일별 체크 무시)
// 자동으로 한글 이름(name_ko)도 함께 업데이트
export async function syncVoiceCatalog(voices: any[], forceSync: boolean = false): Promise<boolean> {
  try {
    // voiceNames 유틸리티 함수 import
    const { getVoiceNameKo } = await import("@/lib/voiceNames");

    if (!forceSync) {
      // 일별 동기화 체크 (forceSync가 false일 때만)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();

      const { data: existing } = await supabase
        .from("tts_voice_catalog")
        .select("synced_at")
        .gte("synced_at", todayStr)
        .limit(1);

      // 오늘 이미 동기화했으면 스킵
      if (existing && existing.length > 0) {
        console.log("오늘 이미 음성 카탈로그를 동기화했습니다.");
        return true;
      }
    }

    // 음성 데이터 업데이트/삽입 (voice_id와 함께)
    console.log(`음성 카탈로그 동기화 시작: ${voices.length}개 (forceSync: ${forceSync})`);
    let successCount = 0;
    let failCount = 0;
    let nameKoUpdatedCount = 0;

    for (const voice of voices) {
      if (!voice || !voice.voice_id) {
        console.warn("voice_id가 없는 음성 데이터 스킵:", voice);
        continue;
      }

      // 한글 이름 자동 생성
      let nameKo: string | null = null;
      
      // 1순위: voice.name이 있고 한글이 포함되어 있으면 그대로 사용
      if (voice.name && /[가-힣]/.test(voice.name)) {
        nameKo = voice.name;
      }
      // 2순위: 로컬 매핑 사용 (voice_id 또는 voice.name)
      else {
        // voice_id로 매핑 시도
        const mappedName = getVoiceNameKo(voice.voice_id, null);
        if (mappedName && mappedName !== voice.voice_id) {
          nameKo = mappedName;
        }
        // voice.name으로 매핑 시도
        else if (voice.name) {
          const mappedNameFromVoice = getVoiceNameKo(voice.name, null);
          if (mappedNameFromVoice && mappedNameFromVoice !== voice.name) {
            nameKo = mappedNameFromVoice;
          }
          // 매핑이 없으면 voice.name 그대로 사용
          else if (voice.name.trim() !== '') {
            nameKo = voice.name;
          }
        }
      }
      
      const shouldUpdateNameKo = nameKo && nameKo !== voice.voice_id && nameKo.trim() !== '';

      const updateData: any = {
        voice_id: voice.voice_id,
        voice_data: voice, // 전체 음성 데이터 저장 (샘플 음원 포함)
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 한글 이름 업데이트 (매핑이 있으면 항상 업데이트하여 비어있는 name_ko를 채움)
      if (shouldUpdateNameKo) {
        updateData.name_ko = nameKo;
        nameKoUpdatedCount++;
      }

      const { error } = await supabase
        .from("tts_voice_catalog")
        .upsert(updateData as any, {
          onConflict: "voice_id"
        });

      if (error) {
        // 테이블 없거나 권한 에러면 조용히 스킵
        if (error.code === "PGRST205" || 
            error.message?.includes("schema cache") ||
            error.code === "42501" || // 권한 에러
            error.code === "PGRST301" || // 403 Forbidden
            error.message?.includes("401") || // Unauthorized
            error.message?.includes("403") || // Forbidden
            (error as any).status === 403) { // Forbidden
          // 조용히 스킵 (DB 테이블 미생성 또는 RLS 정책 문제)
          console.warn(`음성 카탈로그 동기화 스킵 (권한 문제):`, error.message);
          return false;
        }
        console.warn(`음성 ${voice.voice_id} 동기화 실패:`, error);
        failCount++;
      } else {
        successCount++;
      }
    }

    console.log(`✅ 음성 카탈로그 동기화 완료: 성공 ${successCount}개, 실패 ${failCount}개, 한글 이름 업데이트 ${nameKoUpdatedCount}개`);
    
    // 동기화 완료 후 모든 기존 음성의 name_ko도 업데이트 (백그라운드, 에러 무시)
    // 이렇게 하면 name_ko가 비어있는 기존 음성들도 자동으로 업데이트됨
    if (successCount > 0) {
      updateAllVoiceNamesKo().catch((err) => {
        // 조용히 무시 (선택사항이므로)
        console.warn("기존 음성 한글 이름 업데이트 실패 (무시됨):", err);
      });
    }
    
    return successCount > 0;
  } catch (error: any) {
    if (error.code !== "PGRST205" && error.status !== 401) {
      console.error("음성 카탈로그 동기화 실패:", error);
    }
    return false;
  }
}

// 모든 음성의 한글 이름 일괄 업데이트 (기존 음성용)
export async function updateAllVoiceNamesKo(): Promise<{ updated: number; skipped: number; errors: number }> {
  try {
    const { getVoiceNameKo } = await import("@/lib/voiceNames");

    // 모든 음성 조회
    const { data: voices, error: fetchError } = await supabase
      .from("tts_voice_catalog")
      .select("voice_id, name_ko");

    if (fetchError) {
      console.error("음성 목록 조회 실패:", fetchError);
      return { updated: 0, skipped: 0, errors: 0 };
    }

    if (!voices || voices.length === 0) {
      console.log("업데이트할 음성이 없습니다.");
      return { updated: 0, skipped: 0, errors: 0 };
    }

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    console.log(`한글 이름 일괄 업데이트 시작: ${voices.length}개`);

    for (const voice of voices) {
      const voiceId = (voice as any).voice_id;
      const existingNameKo = (voice as any).name_ko;

      // 이미 한글 이름이 있고, voice_id와 다르면 스킵 (이미 설정됨)
      if (existingNameKo && existingNameKo !== voiceId && existingNameKo.trim() !== "") {
        skipped++;
        continue;
      }

      // 한글 이름 생성
      const nameKo = getVoiceNameKo(voiceId, null);

      // 매핑이 없거나 voice_id와 같으면 스킵
      if (!nameKo || nameKo === voiceId) {
        skipped++;
        continue;
      }

      // 한글 이름 업데이트
      const { error: updateError } = await supabase
        .from("tts_voice_catalog")
        .update({ name_ko: nameKo } as any)
        .eq("voice_id", voiceId);

      if (updateError) {
        console.warn(`음성 ${voiceId} 한글 이름 업데이트 실패:`, updateError);
        errors++;
      } else {
        updated++;
      }
    }

    console.log(`✅ 한글 이름 일괄 업데이트 완료: 업데이트 ${updated}개, 스킵 ${skipped}개, 오류 ${errors}개`);
    return { updated, skipped, errors };
  } catch (error: any) {
    console.error("한글 이름 일괄 업데이트 실패:", error);
    return { updated: 0, skipped: 0, errors: 0 };
  }
}

// 특정 음성의 한글 이름 수동 업데이트
export async function updateVoiceNameKo(voiceId: string, nameKo: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("tts_voice_catalog")
      .update({ name_ko: nameKo } as any)
      .eq("voice_id", voiceId);

    if (error) {
      console.error(`음성 ${voiceId} 한글 이름 업데이트 실패:`, error);
      return false;
    }

    console.log(`✅ 음성 ${voiceId} 한글 이름 업데이트 완료: ${nameKo}`);
    return true;
  } catch (error: any) {
    console.error(`음성 ${voiceId} 한글 이름 업데이트 실패:`, error);
    return false;
  }
}

// 한글 이름이 없는 음성 목록 조회
export async function getVoicesWithoutNameKo(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from("tts_voice_catalog")
      .select("voice_id, voice_data, name_ko")
      .or("name_ko.is.null,name_ko.eq.");

    if (error) {
      console.error("한글 이름 없는 음성 조회 실패:", error);
      return [];
    }

    // name_ko가 없거나 voice_id와 같은 경우만 필터링
    return (data || []).filter((voice: any) => {
      const nameKo = (voice as any).name_ko;
      const voiceId = (voice as any).voice_id;
      return !nameKo || nameKo === voiceId;
    });
  } catch (error: any) {
    console.error("한글 이름 없는 음성 조회 실패:", error);
    return [];
  }
}

// 음성 카탈로그 조회
export async function loadVoiceCatalog(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from("tts_voice_catalog")
      .select("voice_data, name_ko, voice_id")
      .order("synced_at", { ascending: false });

    if (error) {
    // CORS/엣지 오류 시 조용히 오프라인 모드로 폴백
    if (isCorsOrEdgeError(error)) {
      console.warn("음성 카탈로그 조회 실패 (CORS/엣지): 오프라인 모드로 계속합니다.");
      return [];
    }
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return [];
      }
      throw error;
    }
    // voice_data에 name_ko와 voice_id 추가
    return (data || []).map((row: any) => {
      const voiceData = row.voice_data || {};
      // voice_id 추가 (DB에서 가져온 voice_id)
      if (row.voice_id) {
        voiceData.voice_id = row.voice_id;
      }
      // DB에 저장된 한글 이름이 있으면 추가
      if ((row as any).name_ko) {
        voiceData.name_ko = (row as any).name_ko;
      }
      // name_ko가 없고 voice_data.name이 있으면 name_ko로 사용
      else if (voiceData.name && !voiceData.name_ko) {
        voiceData.name_ko = voiceData.name;
      }
      return voiceData;
    });
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      console.error("음성 카탈로그 조회 실패:", error);
    }
    return [];
  }
}

// 음성 ID로 한글 이름 조회
export async function getVoiceNameKo(voiceId: string | null | undefined): Promise<string | null> {
  if (!voiceId) return null;
  
  try {
    const { data, error } = await supabase
      .from("tts_voice_catalog")
      .select("name_ko")
      .eq("voice_id", voiceId)
      .single();

    if (error) {
      // 테이블이 없거나 권한 문제면 조용히 null 반환
      if (error.code === "PGRST205" || 
          error.message?.includes("schema cache") ||
          error.code === "42501" ||
          error.code === "PGRST301" ||
          error.code === "PGRST116") { // No rows returned
        return null;
      }
      console.warn(`음성 한글 이름 조회 실패 (${voiceId}):`, error);
      return null;
    }

    return (data as any)?.name_ko || null;
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      console.warn(`음성 한글 이름 조회 실패 (${voiceId}):`, error);
    }
    return null;
  }
}

// 음성 카탈로그 개수 조회
export async function getVoiceCatalogCount(): Promise<number> {
  try {
    const { count, error } = await withRetry(async () => {
      const result = await supabase
        .from("tts_voice_catalog")
        .select("*", { count: "exact", head: true });
      
      // 네트워크 에러 감지
      if (result.error) {
        const errorMsg = (result.error?.message || "").toLowerCase();
        if (errorMsg.includes("failed to fetch") || 
            errorMsg.includes("522") || 
            errorMsg.includes("524") || 
            errorMsg.includes("504")) {
          throw result.error;
        }
      }
      
      return result;
    });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return 0;
      }
      // CORS/네트워크 에러인 경우 0 반환 (오프라인 모드)
      if (isCorsOrEdgeError(error)) {
        console.warn("음성 카탈로그 개수 조회 실패 (CORS/엣지): 오프라인 모드로 계속합니다.");
        return 0;
      }
      throw error;
    }
    return count || 0;
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      // CORS/네트워크 에러는 조용히 처리
      if (!isCorsOrEdgeError(error)) {
        console.error("음성 카탈로그 개수 조회 실패:", error);
      }
    }
    return 0;
  }
}

// 마지막 동기화 시간 확인 (오늘 00:00 이후인지)
export async function shouldUpdateCatalog(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("tts_voice_catalog")
      .select("synced_at")
      .order("synced_at", { ascending: false })
      .limit(1);

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return true; // 테이블이 없으면 업데이트 필요
      }
      return false;
    }

    if (!data || data.length === 0) {
      return true; // 데이터가 없으면 업데이트 필요
    }

    // 마지막 동기화 시간
    const lastSynced = new Date(data[0].synced_at);
    // 오늘 00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 마지막 동기화가 오늘 00:00 이후면 업데이트 불필요
    return lastSynced < today;
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      console.error("동기화 시간 확인 실패:", error);
    }
    return true; // 에러 발생 시 업데이트 필요로 간주
  }
}

// ==================== 채널 관리 ====================

export interface ChannelEntry {
  id?: string;
  name: string;
  type: string; // radio, tablet, pc 등
  endpoint?: string;
  enabled: boolean;
  config?: Record<string, any>; // 인증 헤더, API 키 등
  createdAt?: string;
  updatedAt?: string;
}

// 채널 저장
export async function saveChannel(userId: string, channel: ChannelEntry): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("tts_channels")
      .upsert({
        id: channel.id,
        user_id: userId,
        name: channel.name,
        type: channel.type,
        endpoint: channel.endpoint || null,
        enabled: channel.enabled !== false,
        config: channel.config || {},
        updated_at: new Date().toISOString(),
      } as any, {
        onConflict: channel.id ? "id" : "user_id,name"
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return null;
      }
      throw error;
    }
    return data?.id || null;
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      console.error("채널 저장 실패:", error);
    }
    return null;
  }
}

// 채널 목록 조회
export async function loadChannels(userId: string): Promise<ChannelEntry[]> {
  try {
    const { data, error } = await supabase
      .from("tts_channels")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return [];
      }
      throw error;
    }

    if (!data) return [];

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      endpoint: row.endpoint || undefined,
      enabled: row.enabled !== false,
      config: row.config || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      console.error("채널 목록 조회 실패:", error);
    }
    return [];
  }
}

// 채널 조회 (ID로)
export async function loadChannel(userId: string, channelId: string): Promise<ChannelEntry | null> {
  try {
    const { data, error } = await supabase
      .from("tts_channels")
      .select("*")
      .eq("user_id", userId)
      .eq("id", channelId)
      .single();

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return null;
      }
      if (error.code === "PGRST116") {
        // 데이터 없음
        return null;
      }
      throw error;
    }

    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      type: data.type,
      endpoint: data.endpoint || undefined,
      enabled: data.enabled !== false,
      config: (data.config as Record<string, any>) || {},
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error: any) {
    if (error.code !== "PGRST205" && error.code !== "PGRST116") {
      console.error("채널 조회 실패:", error);
    }
    return null;
  }
}

// 채널 삭제
export async function deleteChannel(userId: string, channelId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("tts_channels")
      .delete()
      .eq("user_id", userId)
      .eq("id", channelId);

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return false;
      }
      throw error;
    }
    return true;
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      console.error("채널 삭제 실패:", error);
    }
    return false;
  }
}

