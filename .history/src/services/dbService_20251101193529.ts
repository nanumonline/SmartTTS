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

    const { data, error } = await supabase
      .from("tts_generations")
      .insert({
        user_id: userId,
        purpose: entry.purpose,
        purpose_label: entry.purposeLabel,
        voice_id: entry.voiceId,
        voice_name: entry.voiceName,
        saved_name: entry.savedName,
        text_preview: entry.textPreview,
        text_length: entry.textLength || 0,
        duration: entry.duration,
        language: entry.language || "ko",
        model: entry.model,
        style: entry.style,
        speed: entry.speed || 1.0,
        pitch_shift: entry.pitchShift || 0,
        audio_blob: audioBuffer ? Array.from(new Uint8Array(audioBuffer)) : null,
        audio_url: entry.audioUrl,
        cache_key: entry.cacheKey,
        status: entry.status || "ready",
        has_audio: entry.hasAudio !== false,
      })
      .select("id")
      .single();

    if (error) {
      // 테이블이 없으면 조용히 실패 (마이그레이션 미적용 상태)
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        console.warn("DB 테이블이 아직 생성되지 않았습니다. 마이그레이션을 적용해주세요.");
        return null;
      }
      throw error;
    }
    return data?.id || null;
  } catch (error: any) {
    // 에러를 조용히 처리 (폴백으로 localStorage 사용)
    if (error.code !== "PGRST205") {
      console.error("생성 이력 저장 실패:", error);
    }
    return null;
  }
}

// 생성 이력 조회
export async function loadGenerations(userId: string, limit: number = 100): Promise<GenerationEntry[]> {
  try {
    const { data, error } = await supabase
      .from("tts_generations")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      // 테이블이 없으면 빈 배열 반환
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return [];
      }
      throw error;
    }

    return (data || []).map((row: any) => ({
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
      audioBlob: row.audio_blob ? new Uint8Array(row.audio_blob).buffer : null,
      audioUrl: row.audio_url,
      cacheKey: row.cache_key,
      status: row.status,
      hasAudio: row.has_audio,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error: any) {
    // 테이블이 없으면 조용히 빈 배열 반환
    if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
      return [];
    }
    console.error("생성 이력 조회 실패:", error);
    return [];
  }
}

// 생성 이력 업데이트
export async function updateGeneration(userId: string, id: string, updates: Partial<GenerationEntry>): Promise<boolean> {
  try {
    const updateData: any = {};
    if (updates.savedName !== undefined) updateData.saved_name = updates.savedName;
    if (updates.textPreview !== undefined) updateData.text_preview = updates.textPreview;
    if (updates.audioUrl !== undefined) updateData.audio_url = updates.audioUrl;

    const { error } = await supabase
      .from("tts_generations")
      .update(updateData)
      .eq("user_id", userId)
      .eq("id", id);

    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error("생성 이력 업데이트 실패:", error);
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

    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error("생성 이력 삭제 실패:", error);
    return false;
  }
}

// ==================== 즐겨찾기 ====================

// 즐겨찾기 추가
export async function addFavorite(userId: string, voiceId: string): Promise<boolean> {
  try {
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
      throw error;
    }
    return true;
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      console.error("즐겨찾기 추가 실패:", error);
    }
    return false;
  }
}

// 즐겨찾기 제거
export async function removeFavorite(userId: string, voiceId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("tts_favorites")
      .delete()
      .eq("user_id", userId)
      .eq("voice_id", voiceId);

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return false;
      }
      throw error;
    }
    return true;
  } catch (error: any) {
    if (error.code !== "PGRST205") {
      console.error("즐겨찾기 제거 실패:", error);
    }
    return false;
  }
}

// 즐겨찾기 목록 조회
export async function loadFavorites(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from("tts_favorites")
      .select("voice_id")
      .eq("user_id", userId);

    if (error) {
      if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
        return [];
      }
      throw error;
    }
    return (data || []).map((row: any) => row.voice_id);
  } catch (error: any) {
    if (error.code !== "PGRST205") {
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
}

// 설정 저장
export async function saveUserSettings(userId: string, settings: UserSettings): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("tts_user_settings")
      .upsert({
        user_id: userId,
        selected_purpose: settings.selectedPurpose,
        voice_settings: settings.voiceSettings || {},
        preferences: settings.preferences || {},
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id"
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
      throw error;
    }

    return {
      selectedPurpose: data.selected_purpose,
      voiceSettings: data.voice_settings,
      preferences: data.preferences,
    };
  } catch (error: any) {
    console.error("설정 조회 실패:", error);
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
      })
      .select("id")
      .single();

    if (error) throw error;
    return data?.id || null;
  } catch (error: any) {
    console.error("클론 요청 저장 실패:", error);
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

    if (error) throw error;

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
    console.error("클론 요청 조회 실패:", error);
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
        settings: state.settings,
        mixed_audio_blob: audioBuffer ? Array.from(new Uint8Array(audioBuffer)) : null,
        mixed_audio_url: state.mixedAudioUrl,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,generation_id"
      });

    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error("믹싱 상태 저장 실패:", error);
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

    if (error) throw error;

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
    console.error("믹싱 상태 조회 실패:", error);
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

    if (error) throw error;
    return data?.id || null;
  } catch (error: any) {
    console.error("예약 요청 저장 실패:", error);
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

    if (error) throw error;

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
    console.error("예약 요청 조회 실패:", error);
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

    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error("검수 상태 저장 실패:", error);
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

    if (error) throw error;

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
    console.error("검수 상태 조회 실패:", error);
    return new Map();
  }
}

// ==================== 메시지 이력 ====================

export interface MessageHistoryEntry {
  id?: string;
  text: string;
  purpose: string;
  createdAt?: string;
  updatedAt?: string;
}

// 메시지 저장
export async function saveMessage(userId: string, message: MessageHistoryEntry): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("tts_message_history")
      .insert({
        user_id: userId,
        text: message.text,
        purpose: message.purpose,
      })
      .select("id")
      .single();

    if (error) throw error;
    return data?.id || null;
  } catch (error: any) {
    console.error("메시지 저장 실패:", error);
    return null;
  }
}

// 메시지 업데이트
export async function updateMessage(userId: string, id: string, text: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("tts_message_history")
      .update({ text, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("id", id);

    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error("메시지 업데이트 실패:", error);
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

    if (error) throw error;
    return true;
  } catch (error: any) {
    console.error("메시지 삭제 실패:", error);
    return false;
  }
}

// 메시지 목록 조회
export async function loadMessages(userId: string): Promise<MessageHistoryEntry[]> {
  try {
    const { data, error } = await supabase
      .from("tts_message_history")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      text: row.text,
      purpose: row.purpose,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error: any) {
    console.error("메시지 조회 실패:", error);
    return [];
  }
}

// ==================== 음성 카탈로그 ====================

// 음성 카탈로그 일별 동기화
export async function syncVoiceCatalog(voices: any[]): Promise<boolean> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    // 오늘 이미 동기화했는지 확인
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

    // 음성 데이터 업데이트/삽입
    for (const voice of voices) {
      const { error } = await supabase
        .from("tts_voice_catalog")
        .upsert({
          voice_id: voice.voice_id,
          voice_data: voice,
          synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "voice_id"
        });

      if (error) {
        console.warn(`음성 ${voice.voice_id} 동기화 실패:`, error);
      }
    }

    return true;
  } catch (error: any) {
    console.error("음성 카탈로그 동기화 실패:", error);
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

    if (error) throw error;
    return (data || []).map((row: any) => row.voice_data);
  } catch (error: any) {
    console.error("음성 카탈로그 조회 실패:", error);
    return [];
  }
}

