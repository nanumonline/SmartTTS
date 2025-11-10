/**
 * 데이터베이스 서비스
 * 모든 TTS 관련 데이터를 Supabase에 저장/조회
 */

import { supabase } from "@/integrations/supabase/client";

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
    };

    const extendedData = { ...baseData } as any;
    if (entry.storagePath) {
      extendedData.storage_path = truncateString(entry.storagePath, 500);
    }
    if (entry.format) {
      extendedData.format = truncateString(entry.format, 50);
    }
    if (entry.paramHash) {
      extendedData.param_hash = truncateString(entry.paramHash, 128);
    }

    const attemptInsert = async (payload: any) => {
      return await supabase
        .from("tts_generations")
        .insert(payload)
        .select("id")
        .single();
    };

    let insertResult = await attemptInsert(extendedData);
    // 400, 42703 에러는 컬럼이 없을 가능성이 높으므로 기본 데이터로 재시도
    if (
      insertResult.error &&
      (insertResult.error.code === "42703" || 
       insertResult.error.message?.includes("column") ||
       insertResult.error.message?.includes("does not exist") ||
       insertResult.error.message?.includes("400"))
    ) {
      console.warn(
        "tts_generations 컬럼이 누락되어 확장 필드를 제외하고 재시도합니다:",
        insertResult.error.message
      );
      const fallbackData = { ...baseData };
      insertResult = await attemptInsert(fallbackData);
    }

    const { data, error } = insertResult;

    if (error) {
      // 테이블이 없으면 조용히 실패 (마이그레이션 미적용 상태)
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        console.warn("DB 테이블이 아직 생성되지 않았습니다. 마이그레이션을 적용해주세요.");
        return null;
      }
      // 400 에러도 조용히 처리 (마이그레이션 미적용 상태)
      if (error.message?.includes("400")) {
        console.warn("DB 저장 실패 (400): 마이그레이션을 적용해주세요:", error.message);
        return null;
      }
      throw error;
    }
    return data?.id || null;
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
    const extendedColumns = baseColumns + ", storage_path, format, param_hash";

    const buildQuery = (columns: string) =>
      supabase
        .from("tts_generations")
        .select(columns)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(Math.max(1, Math.min(500, limit)));

    // 기본 컬럼만으로 조회 (안정성 우선)
    // 마이그레이션이 적용되면 extendedColumns가 자동으로 사용됨
    // 지금은 기본 컬럼만 사용하여 400 에러 방지
    let { data, error } = await buildQuery(baseColumns);
    
    // extendedColumns 쿼리는 실행하지 않음 (마이그레이션 미적용 시 400 에러 방지)
    // 마이그레이션 적용 후에는 별도로 extendedColumns를 조회할 필요 없음
    // (기본 컬럼만으로도 충분하며, 나중에 마이그레이션 적용 시 자동으로 컬럼이 추가됨)

    // 에러가 있으면 조용히 처리
    if (error) {
      // 테이블이 없으면 빈 배열 반환
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return [];
      }
      // 400 에러는 컬럼이 없을 가능성이 높음 (이미 기본 컬럼으로 시도했으므로 조용히 처리)
      if (error.message?.includes("400") || error.code === "42703" || error.message?.includes("column")) {
        console.warn("DB 조회 실패 (컬럼 누락): 마이그레이션을 적용해주세요:", error.message);
        return [];
      }
      console.error("생성 이력 조회 실패:", error);
      return [];
    }

    return (data || []).map((row: any) => {
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
        audioBlob: null,
        audioUrl: row.audio_url,
        mimeType: row.mime_type || "audio/mpeg", // MIME 타입 로드
        cacheKey: derivedCacheKey || undefined,
        storagePath: row.storage_path || null,
        format: row.format || null,
        paramHash: row.param_hash || null,
        status: row.status,
        hasAudio: row.has_audio,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  } catch (error: any) {
    // 테이블이 없으면 조용히 빈 배열 반환
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
    
    const buf = data?.audio_blob ? new Uint8Array(data.audio_blob as any).buffer : null;
    return { audioBlob: buf, mimeType: data?.mime_type };
  } catch (error: any) {
    // 500 에러는 서버 문제로 조용히 처리
    if (error.message?.includes("500")) {
      console.warn("loadGenerationBlob 500 에러 (서버 문제):", error.message);
      return null;
    }
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

    const { error } = await supabase
      .from("tts_generations")
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

    const { data, error } = await supabase
      .from("tts_favorites")
      .select("voice_id")
      .eq("user_id", userId);

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return [];
      }
      if (error.code === "22P02") {
        // UUID 형식 오류
        console.warn("유효하지 않은 userId 형식:", userId);
        return [];
      }
      throw error;
    }
    return (data || []).map((row: any) => row.voice_id);
  } catch (error: any) {
    if (error.code !== "PGRST205" && error.code !== "22P02") {
      console.error("즐겨찾기 조회 실패:", error);
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
    const { data, error } = await supabase
      .from("tts_mixing_states")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
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
      console.error("믹싱 상태 조회 실패:", error);
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
    const { data, error } = await supabase
      .from("tts_schedule_requests")
      .insert({
        user_id: userId,
        generation_id: request.generationId,
        target_channel: request.targetChannel,
        target_name: request.targetName,
        scheduled_time: request.scheduledTime,
        repeat_option: request.repeatOption || "once",
        status: request.status || "scheduled",
        sent_at: request.sentAt,
        fail_reason: request.failReason,
        mixing_state: request.mixingState,
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
      console.error("예약 요청 저장 실패:", error);
    }
    return null;
  }
}

// 예약 요청 조회
export async function loadScheduleRequests(userId: string): Promise<ScheduleRequestEntry[]> {
  try {
    const { data, error } = await supabase
      .from("tts_schedule_requests")
      .select("*")
      .eq("user_id", userId)
      .order("scheduled_time", { ascending: false });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
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
    }));
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      console.error("예약 요청 조회 실패:", error);
    }
    return [];
  }
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
    const { data, error } = await supabase
      .from("tts_review_states")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
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
      console.error("검수 상태 조회 실패:", error);
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
    let query = supabase
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
    // is_template 컬럼이 없을 수 있으므로, 먼저 모든 데이터를 가져온 후 필터링
    const { data, error } = await supabase
      .from("tts_message_history")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      // 컬럼이 존재하지 않는 경우 (42703) 또는 테이블이 없는 경우 (PGRST205)
      if (error.code === "PGRST205" || error.code === "42703" || error.message?.includes("schema cache") || error.message?.includes("does not exist")) {
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
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  } catch (error: any) {
    // 컬럼이 존재하지 않는 경우 (42703) 또는 테이블이 없는 경우 (PGRST205)
    if (error.code !== "PGRST205" && error.code !== "42703") {
      console.error("메시지 조회 실패:", error);
    }
    return [];
  }
}

// ==================== 음성 카탈로그 ====================

// 음성 카탈로그 일별 동기화 (forceSync=true이면 일별 체크 무시)
export async function syncVoiceCatalog(voices: any[], forceSync: boolean = false): Promise<boolean> {
  try {
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

    for (const voice of voices) {
      if (!voice || !voice.voice_id) {
        console.warn("voice_id가 없는 음성 데이터 스킵:", voice);
        continue;
      }

      const { error } = await supabase
        .from("tts_voice_catalog")
        .upsert({
          voice_id: voice.voice_id,
          voice_data: voice, // 전체 음성 데이터 저장 (샘플 음원 포함)
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
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

    console.log(`✅ 음성 카탈로그 동기화 완료: 성공 ${successCount}개, 실패 ${failCount}개`);
    return successCount > 0;
  } catch (error: any) {
    if (error.code !== "PGRST205" && error.status !== 401) {
      console.error("음성 카탈로그 동기화 실패:", error);
    }
    return false;
  }
}

// 음성 카탈로그 조회
export async function loadVoiceCatalog(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from("tts_voice_catalog")
      .select("voice_data")
      .order("synced_at", { ascending: false });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return [];
      }
      throw error;
    }
    return (data || []).map((row: any) => row.voice_data);
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      console.error("음성 카탈로그 조회 실패:", error);
    }
    return [];
  }
}

// 음성 카탈로그 개수 조회
export async function getVoiceCatalogCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("tts_voice_catalog")
      .select("*", { count: "exact", head: true });

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return 0;
      }
      throw error;
    }
    return count || 0;
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      console.error("음성 카탈로그 개수 조회 실패:", error);
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

