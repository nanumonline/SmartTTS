import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import AudioPlayer from "@/components/AudioPlayer";
import WaveformCanvas from "@/components/WaveformCanvas";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import * as dbService from "@/services/dbService";
import { formatDateTime } from "@/lib/pageUtils";
import { decodeUrlToBuffer } from "@/lib/audioMixer";
import { 
  Mic2, 
  Play, 
  Upload, 
  Settings,
  Star,
  X,
  Youtube,
  BarChart3,
  Plus,
  RefreshCw,
} from "lucide-react";

// 타입 정의
type CloneFormState = {
  targetName: string;
  baseVoiceId: string;
  language: string;
  memo: string;
  sampleFile: File | null;
  sampleName?: string;
  youtubeUrl?: string;
  sampleType?: "file" | "youtube";
};

type CloneRequest = {
  id: number;
  targetName: string;
  baseVoiceId: string;
  baseVoiceName: string;
  language: string;
  status: "processing" | "completed" | "failed";
  createdAt: string;
  completedAt?: string;
  memo?: string;
  sampleName?: string;
  voiceId: string;
  voiceName: string;
  gender?: string;
};

// 유틸리티 함수
const languageCodeToFlag = (code: string): string => {
  const map: Record<string, string> = {
    ko: "🇰🇷", en: "🇺🇸", ja: "🇯🇵", zh: "🇨🇳", es: "🇪🇸", fr: "🇫🇷", de: "🇩🇪"
  };
  return map[code?.toLowerCase()] || "";
};

const languageCodeToKo = (code: string): string => {
  const map: Record<string, string> = {
    ko: "한국어", en: "영어", ja: "일본어", zh: "중국어", es: "스페인어", fr: "프랑스어", de: "독일어"
  };
  return map[code?.toLowerCase()] || code || "";
};

const genderCodeToKo = (gender?: string): string => {
  const map: Record<string, string> = {
    female: "여성", male: "남성", neutral: "중성", child_male: "남아", child_female: "여아"
  };
  return gender ? (map[gender] || gender) : "-";
};

const styleCodeToKo = (style: string): string => {
  const map: Record<string, string> = {
    neutral: "중립", happy: "밝음", sad: "슬픔", angry: "분노", calm: "차분",
    friendly: "친근", professional: "전문", excited: "흥분", serious: "진지"
  };
  return map[style] || style;
};

const normalizeLanguage = (lang: string): string => {
  if (!lang) return "";
  const normalized = lang.toLowerCase().trim();
  if (normalized.startsWith("ko") || normalized === "kr") return "ko";
  if (normalized.startsWith("en")) return "en";
  if (normalized.startsWith("ja") || normalized === "jp") return "ja";
  return normalized.split("-")[0];
};

const base64ToBlob = (base64: string, mimeType = "audio/mpeg"): Blob => {
  const cleanBase64 = base64.includes(",") ? base64.split(",").pop() || "" : base64;
  const decoded = atob(cleanBase64);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
};

const SUPABASE_PROXY_BASE_URL = "https://gxxralruivyhdxyftsrg.supabase.co/functions/v1/supertone-proxy";

const VoiceCloning = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // 상태 관리
  const [allVoices, setAllVoices] = useState<any[]>([]);
  const [cloneRequests, setCloneRequests] = useState<CloneRequest[]>([]);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [favoriteVoiceIds, setFavoriteVoiceIds] = useState<Set<string>>(new Set());
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  // 클론 생성 폼
  const createCloneForm = useCallback((overrides?: Partial<CloneFormState>): CloneFormState => ({
    targetName: "",
    baseVoiceId: "",
    language: "ko",
    memo: "",
    sampleFile: null,
    sampleName: undefined,
    youtubeUrl: undefined,
    sampleType: "file",
    ...overrides,
  }), []);
  const [cloneForm, setCloneForm] = useState<CloneFormState>(() => createCloneForm());

  // 클론 미리듣기
  const [clonePreviewText, setClonePreviewText] = useState<Record<number, string>>({});
  const [clonePreviewAudio, setClonePreviewAudio] = useState<Record<number, string | null>>({});
  const [isGeneratingClonePreview, setIsGeneratingClonePreview] = useState<Record<number, boolean>>({});

  // 클론 튜닝
  const [selectedCloneForTuning, setSelectedCloneForTuning] = useState<number | null>(null);
  const [isCloneTuningModalOpen, setIsCloneTuningModalOpen] = useState(false);
  const [cloneTuningSettings, setCloneTuningSettings] = useState<Record<number, {
    speed: number;
    pitch: number;
    style: string;
    language: string;
    emotion?: string;
  }>>({});
  const [cloneTuningPreviewAudio, setCloneTuningPreviewAudio] = useState<Record<number, string | null>>({});
  const [isGeneratingCloneTuning, setIsGeneratingCloneTuning] = useState<Record<number, boolean>>({});

  // 파형 비교
  const [isWaveformComparisonOpen, setIsWaveformComparisonOpen] = useState(false);
  const [selectedCloneForWaveform, setSelectedCloneForWaveform] = useState<number | null>(null);
  const [waveformComparisonData, setWaveformComparisonData] = useState<Record<number, {
    original?: AudioBuffer;
    cloned?: AudioBuffer;
    originalUrl?: string;
    clonedUrl?: string;
  }>>({});

  // 정렬
  const [cloneBaseVoiceSortBy, setCloneBaseVoiceSortBy] = useState<"name" | "language" | "gender" | "none">("none");
  const [cloneBaseVoiceSortOrder, setCloneBaseVoiceSortOrder] = useState<"asc" | "desc">("asc");

  const cloneTimeoutsRef = useRef<number[]>([]);

  const languageOptions = [
    { value: "ko", label: "한국어 🇰🇷" },
    { value: "en", label: "영어 🇺🇸" },
    { value: "ja", label: "일본어 🇯🇵" },
  ];

  // 고유 ID 생성
  const generateUniqueId = (): number => {
    const base = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return base * 10000 + random;
  };

  // 음성 메타 정보 가져오기
  const getVoiceMeta = (voiceId: string) => {
    if (!voiceId) return null;
    return allVoices.find((v: any) => v.voice_id === voiceId) || null;
  };

  // 음성 목록 로드 (VoiceStylesPage 로직 참조)
  const fetchVoicesRef = useRef(false);
  const fetchVoices = useCallback(async (showToast = false) => {
    if (isLoadingVoices || fetchVoicesRef.current) return;
    fetchVoicesRef.current = true;
    setIsLoadingVoices(true);

    try {
      // DB에서 먼저 로드 시도
      const catalog = await dbService.loadVoiceCatalog();
      if (catalog.length > 0) {
        setAllVoices(catalog);
        if (showToast) {
          toast({ title: "음성 목록 로드 완료", description: `${catalog.length}개의 음성을 불러왔습니다.` });
        }
        setIsLoadingVoices(false);
        fetchVoicesRef.current = false;
        return;
      }

      // API에서 로드
      if (showToast) {
        toast({ title: "음성 목록 로드 중...", description: "모든 음성을 가져오는 중입니다." });
      }

      const response = await fetch(`${SUPABASE_PROXY_BASE_URL}/voices?limit=1000`);

      if (!response.ok) throw new Error(`음성 목록 로드 실패: ${response.status}`);

      const data = await response.json();
      const voices = Array.isArray(data.voices) ? data.voices : (Array.isArray(data.data) ? data.data : []);
      
      setAllVoices(voices);
      
      // DB에 저장
      await dbService.syncVoiceCatalog(voices, true);

      if (showToast) {
        toast({ title: "음성 목록 로드 완료", description: `${voices.length}개의 음성을 불러왔습니다.` });
      }
    } catch (error: any) {
      console.error("음성 목록 로드 오류:", error);
      if (showToast) {
        toast({ title: "음성 목록 로드 실패", description: error?.message || "음성을 불러올 수 없습니다.", variant: "destructive" });
      }
    } finally {
      setIsLoadingVoices(false);
      fetchVoicesRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 즐겨찾기 로드 (한 번만 실행)
  const loadFavoritesRef = useRef(false);
  useEffect(() => {
    if (!user?.id || loadFavoritesRef.current) return;
    loadFavoritesRef.current = true;
    const loadFavorites = async () => {
      try {
        const favorites = await dbService.loadFavorites(user.id);
        if (favorites && favorites.length > 0) {
          setFavoriteVoiceIds(new Set(favorites));
        }
      } catch (error) {
        console.warn("즐겨찾기 로드 실패:", error);
      } finally {
        loadFavoritesRef.current = false;
      }
    };
    loadFavorites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 클론 요청 로드
  const loadCloneRequestsRef = useRef(false);
  const loadCloneRequests = useCallback(async () => {
    if (!user?.id || loadCloneRequestsRef.current) return;
    loadCloneRequestsRef.current = true;
    try {
      const requests = await dbService.loadCloneRequests(user.id);
      if (requests && requests.length > 0) {
        const normalized: CloneRequest[] = requests.map((item: any, index: number) => ({
          id: item.id ? (typeof item.id === 'number' ? item.id : parseInt(String(item.id).replace(/-/g, "").substring(0, 10)) || generateUniqueId()) : generateUniqueId(),
          targetName: item.targetName || "",
          baseVoiceId: item.baseVoiceId || "",
          baseVoiceName: item.baseVoiceName || "",
          language: item.language || "ko",
          status: (item.status === "completed" ? "completed" : item.status === "failed" ? "failed" : "processing") as "processing" | "completed" | "failed",
          createdAt: item.createdAt || new Date().toISOString(),
          completedAt: item.completedAt,
          memo: item.memo,
          sampleName: item.sampleName,
          voiceId: item.voiceId || `clone_${item.id || generateUniqueId()}`,
          voiceName: item.voiceName || `${item.targetName || "클론"} (클론)`,
          gender: item.gender,
        }));
        setCloneRequests(normalized);
      }
    } catch (error) {
      console.error("클론 요청 로드 실패:", error);
    } finally {
      loadCloneRequestsRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 초기 데이터 로드 (한 번만 실행)
  const isInitialMountRef = useRef(true);
  useEffect(() => {
    if (!isInitialMountRef.current) return;
    isInitialMountRef.current = false;
    
    fetchVoices(false);
    loadCloneRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 클론 모달 열기
  const openCloneModal = (baseVoiceId?: string) => {
    const base = baseVoiceId ? getVoiceMeta(baseVoiceId) : null;
    const firstLanguage = base
      ? normalizeLanguage(Array.isArray(base.language) ? base.language[0] : base.language)
      : "ko";
    setCloneForm(createCloneForm({
      baseVoiceId: baseVoiceId || "",
      targetName: base?.name ? `${base.name} 클론` : "",
      language: firstLanguage || "ko",
    }));
    setIsCloneModalOpen(true);
  };

  // 클론 폼 검증
  const validateCloneForm = (): { valid: boolean; error?: string } => {
    if (!cloneForm.targetName.trim()) {
      return { valid: false, error: "클론 대상 이름을 입력해주세요 (2~100자)" };
    }
    if (cloneForm.targetName.length < 2 || cloneForm.targetName.length > 100) {
      return { valid: false, error: "이름은 2~100자 사이여야 합니다" };
    }
    if (!cloneForm.baseVoiceId) {
      return { valid: false, error: "기준 음성을 선택해주세요" };
    }
    if (cloneForm.sampleType === "youtube") {
      if (!cloneForm.youtubeUrl) {
        return { valid: false, error: "유튜브 링크를 입력해주세요" };
      }
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
      if (!youtubeRegex.test(cloneForm.youtubeUrl.trim())) {
        return { valid: false, error: "올바른 유튜브 링크를 입력해주세요" };
      }
    } else {
      if (!cloneForm.sampleFile && !cloneForm.sampleName) {
        return { valid: false, error: "샘플 음성 파일을 업로드해주세요" };
      }
      if (cloneForm.sampleFile) {
        if (cloneForm.sampleFile.size > 50 * 1024 * 1024) {
          return { valid: false, error: "파일 크기는 50MB 이하여야 합니다" };
        }
      }
    }
    return { valid: true };
  };

  // 클론 생성 제출
  const handleCloneSubmit = async () => {
    const validation = validateCloneForm();
    if (!validation.valid) {
      toast({ title: "입력 오류", description: validation.error, variant: "destructive" });
      return;
    }

    if (!user?.id) {
      toast({ title: "로그인 필요", description: "클론 음성을 생성하려면 로그인이 필요합니다.", variant: "destructive" });
      return;
    }

    const base = getVoiceMeta(cloneForm.baseVoiceId);
    const extractYoutubeVideoId = (url: string): string => {
      const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
        /youtube\.com\/watch\?.*v=([^&\n?#]+)/
      ];
      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) return match[1];
      }
      return 'video';
    };
    const sampleName = cloneForm.sampleType === "youtube" 
      ? `youtube_${cloneForm.youtubeUrl ? extractYoutubeVideoId(cloneForm.youtubeUrl) : 'video'}.mp3`
      : (cloneForm.sampleFile?.name || cloneForm.sampleName || "sample.wav");
    
    const id = generateUniqueId();
    const voiceId = `clone_${id}`;
    const voiceName = `${cloneForm.targetName.trim()} (클론)`;
    const newClone: CloneRequest = {
      id,
      targetName: cloneForm.targetName.trim(),
      baseVoiceId: cloneForm.baseVoiceId,
      baseVoiceName: base?.name || cloneForm.baseVoiceId,
      language: cloneForm.language || "ko",
      status: "processing",
      createdAt: new Date().toISOString(),
      memo: cloneForm.memo,
      sampleName,
      voiceId,
      voiceName,
      gender: (base as any)?.gender || "neutral",
    };

    // DB에 저장
    try {
      await dbService.saveCloneRequest(user.id, {
        targetName: newClone.targetName,
        baseVoiceId: newClone.baseVoiceId,
        baseVoiceName: newClone.baseVoiceName,
        language: newClone.language,
        memo: newClone.memo,
        sampleFile: cloneForm.sampleFile || null,
        sampleName: newClone.sampleName,
        youtubeUrl: cloneForm.youtubeUrl,
        sampleType: cloneForm.sampleType || "file",
        voiceId: newClone.voiceId,
        voiceName: newClone.voiceName,
        gender: newClone.gender,
        status: newClone.status,
      });
    } catch (error) {
      console.error("클론 요청 저장 실패:", error);
    }

    setCloneRequests((prev) => [newClone, ...prev]);
    setIsCloneModalOpen(false);
    setCloneForm(createCloneForm({ language: cloneForm.language }));

    toast({ title: "클로닝 요청 접수", description: `${voiceName}를 분석 중입니다.` });

    // 시뮬레이션: 1.5초 후 완료
    const timer = window.setTimeout(() => {
      const completionTime = new Date().toISOString();
      const completedClone: CloneRequest = { ...newClone, status: "completed", completedAt: completionTime };
      setCloneRequests((prev) => prev.map((cl) => (cl.id === newClone.id ? completedClone : cl)));
      
      // DB 업데이트
      if (user?.id) {
        dbService.saveCloneRequest(user.id, {
          id: String(completedClone.id),
          targetName: completedClone.targetName,
          baseVoiceId: completedClone.baseVoiceId,
          baseVoiceName: completedClone.baseVoiceName,
          language: completedClone.language,
          memo: completedClone.memo,
          sampleName: completedClone.sampleName,
          youtubeUrl: cloneForm.youtubeUrl,
          sampleType: cloneForm.sampleType || "file",
          voiceId: completedClone.voiceId,
          voiceName: completedClone.voiceName,
          gender: completedClone.gender,
          status: completedClone.status,
          completedAt: completedClone.completedAt,
        }).catch(console.error);
      }
      
      toast({ title: "클로닝 완료", description: `${completedClone.voiceName} 음성이 추가되었습니다.` });
    }, 1500);

    cloneTimeoutsRef.current.push(timer);
  };

  // 클론 미리듣기 생성
  const handleClonePreview = async (clone: CloneRequest) => {
    if (clone.status !== "completed") {
      toast({ title: "미리듣기 불가", description: "완료된 클론 음성만 미리듣기가 가능합니다.", variant: "destructive" });
      return;
    }

    const previewText = clonePreviewText[clone.id]?.trim();
    if (!previewText) {
      toast({ title: "텍스트 입력 필요", description: "미리듣기할 텍스트를 입력해주세요.", variant: "destructive" });
      return;
    }

    const baseVoiceId = clone.baseVoiceId;
    if (!baseVoiceId) {
      toast({ title: "기준 음성 없음", description: "기준 음성 정보가 없어 미리듣기를 생성할 수 없습니다.", variant: "destructive" });
      return;
    }

    setIsGeneratingClonePreview(prev => ({ ...prev, [clone.id]: true }));

    try {
      if (clonePreviewAudio[clone.id]) {
        URL.revokeObjectURL(clonePreviewAudio[clone.id]!);
      }

      const requestBody = {
        text: previewText,
        language: clone.language || "ko",
        style: "neutral",
        model: "sona_speech_1",
        voice_settings: {
          speed: 1.0,
          pitch_shift: 0,
          pitch_variance: 1,
        },
      };

      const fetchResponse = await fetch(`${SUPABASE_PROXY_BASE_URL}/text-to-speech/${baseVoiceId}?output_format=mp3`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...requestBody, voice_id: baseVoiceId }),
      });

      if (!fetchResponse.ok) {
        let errorMsg = `TTS 생성 실패 (${fetchResponse.status})`;
        try {
          const errorJson = await fetchResponse.clone().json();
          const detail = errorJson?.error?.message || errorJson?.error || errorJson?.message || errorJson?.detail;
          if (detail) errorMsg += `: ${detail}`;
        } catch {
          const text = await fetchResponse.text();
          if (text) errorMsg += `: ${text}`;
        }
        throw new Error(errorMsg);
      }

      const audioResult = await parseSupertoneResponse(fetchResponse);
      if (!audioResult?.blob) {
        throw new Error("오디오 데이터를 받을 수 없습니다.");
      }

      const audioUrl = URL.createObjectURL(audioResult.blob);
      setClonePreviewAudio(prev => ({ ...prev, [clone.id]: audioUrl }));

      toast({ title: "미리듣기 생성 완료", description: `${clone.voiceName} 음성으로 미리듣기가 생성되었습니다.` });
    } catch (error: any) {
      console.error("클론 음성 미리듣기 오류:", error);
      toast({ title: "미리듣기 생성 실패", description: error?.message || "미리듣기를 생성할 수 없습니다.", variant: "destructive" });
    } finally {
      setIsGeneratingClonePreview(prev => ({ ...prev, [clone.id]: false }));
    }
  };

  // Supertone 응답 파싱
  const parseSupertoneResponse = async (resp: Response): Promise<{ blob: Blob; duration?: number | null; mimeType?: string }> => {
    if (!resp) {
      throw new Error("응답이 존재하지 않습니다.");
    }

    const contentType = resp.headers?.get("content-type")?.toLowerCase() || "";
    let duration: number | null = null;

    if (contentType.includes("application/json")) {
      const json = await resp.json();
      const payload = json.data ?? json.result ?? json;
      const errorMessage = json.error || json.message || payload?.error || payload?.message || payload?.detail;
      let base64Audio = payload?.audio_base64 ?? payload?.audioBase64 ?? payload?.audio ?? payload?.audio_data ?? null;
      let remoteUrl = payload?.audio_url ?? payload?.audioUrl ?? payload?.url ?? payload?.file_url ?? payload?.fileUrl ?? null;
      duration = payload?.duration ?? payload?.audio_duration ?? payload?.length ?? payload?.meta?.duration ?? json.duration ?? null;
      const mimeType = payload?.mime_type ?? payload?.mimetype ?? payload?.content_type ?? "audio/mpeg";

      if (base64Audio) {
        const blob = base64ToBlob(base64Audio, mimeType);
        return { blob, duration, mimeType };
      }

      if (remoteUrl) {
        const remoteResponse = await fetch(remoteUrl);
        if (!remoteResponse.ok) {
          throw new Error(`오디오 다운로드 실패 (${remoteResponse.status})`);
        }
        const remoteBlob = await remoteResponse.blob();
        const remoteDurationHeader = remoteResponse.headers.get("X-Audio-Length") || remoteResponse.headers.get("x-audio-length");
        const remoteDuration = remoteDurationHeader ? parseFloat(remoteDurationHeader) : null;
        return { blob: remoteBlob, duration: duration ?? remoteDuration, mimeType: remoteBlob.type || mimeType };
      }

      if (errorMessage) {
        throw new Error(errorMessage);
      }

      throw new Error("오디오 데이터가 포함되어 있지 않습니다.");
    }

    const blob = await resp.blob();
    if (!blob || blob.size === 0) {
      throw new Error("오디오 데이터가 비어 있습니다.");
    }
    const durationHeader = resp.headers?.get("X-Audio-Length") || resp.headers?.get("x-audio-length");
    if (durationHeader) {
      const parsed = parseFloat(durationHeader);
      duration = Number.isNaN(parsed) ? null : parsed;
    }
    return { blob, duration, mimeType: blob.type || "audio/mpeg" };
  };

  // 클론 튜닝 미리듣기
  const handleCloneTuningPreview = async (cloneId: number) => {
    const clone = cloneRequests.find(c => c.id === cloneId);
    if (!clone || clone.status !== "completed") {
      toast({ title: "튜닝 불가", description: "완료된 클론 음성만 튜닝이 가능합니다.", variant: "destructive" });
      return;
    }

    const tuning = cloneTuningSettings[cloneId];
    if (!tuning) {
      toast({ title: "튜닝 설정 없음", description: "튜닝 설정을 먼저 조정해주세요.", variant: "destructive" });
      return;
    }

    const previewText = clonePreviewText[clone.id]?.trim();
    if (!previewText) {
      toast({ title: "텍스트 입력 필요", description: "미리듣기할 텍스트를 입력해주세요.", variant: "destructive" });
      return;
    }

    setIsGeneratingCloneTuning(prev => ({ ...prev, [cloneId]: true }));

    try {
      if (cloneTuningPreviewAudio[cloneId]) {
        URL.revokeObjectURL(cloneTuningPreviewAudio[cloneId]!);
      }

      const requestBody = {
        text: previewText,
        language: tuning.language || clone.language || "ko",
        style: tuning.style || "neutral",
        model: "sona_speech_1",
        voice_settings: {
          speed: tuning.speed || 1.0,
          pitch_shift: tuning.pitch || 0,
          pitch_variance: 1,
        },
      };

      const fetchResponse = await fetch(`${SUPABASE_PROXY_BASE_URL}/text-to-speech/${clone.baseVoiceId}?output_format=mp3`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...requestBody, voice_id: clone.baseVoiceId }),
      });

      if (!fetchResponse.ok) {
        let errorMsg = `TTS 생성 실패 (${fetchResponse.status})`;
        try {
          const errorJson = await fetchResponse.clone().json();
          const detail = errorJson?.error?.message || errorJson?.error || errorJson?.message || errorJson?.detail;
          if (detail) errorMsg += `: ${detail}`;
        } catch {
          const text = await fetchResponse.text();
          if (text) errorMsg += `: ${text}`;
        }
        throw new Error(errorMsg);
      }

      const audioResult = await parseSupertoneResponse(fetchResponse);
      if (!audioResult?.blob) {
        throw new Error("오디오 데이터를 받을 수 없습니다.");
      }

      const audioUrl = URL.createObjectURL(audioResult.blob);
      setCloneTuningPreviewAudio(prev => ({ ...prev, [cloneId]: audioUrl }));

      toast({ title: "튜닝 미리듣기 생성 완료", description: `${clone.voiceName} 음성으로 튜닝된 미리듣기가 생성되었습니다.` });
    } catch (error: any) {
      console.error("클론 음성 튜닝 미리듣기 오류:", error);
      toast({ title: "튜닝 미리듣기 생성 실패", description: error?.message || "튜닝 미리듣기를 생성할 수 없습니다.", variant: "destructive" });
    } finally {
      setIsGeneratingCloneTuning(prev => ({ ...prev, [cloneId]: false }));
    }
  };

  // 즐겨찾기 토글
  const toggleFavorite = async (voiceId: string) => {
    if (!user?.id) {
      toast({ title: "로그인 필요", description: "즐겨찾기는 로그인이 필요합니다.", variant: "destructive" });
      return;
    }

    const isFavorite = favoriteVoiceIds.has(voiceId);
    try {
      if (isFavorite) {
        await dbService.removeFavorite(user.id, voiceId);
        setFavoriteVoiceIds(prev => {
          const next = new Set(prev);
          next.delete(voiceId);
          return next;
        });
        toast({ title: "즐겨찾기 해제", description: "즐겨찾기에서 제거되었습니다." });
      } else {
        const voice = getVoiceMeta(voiceId);
        const languageValue = Array.isArray(voice?.language) 
          ? (voice.language[0] || "")
          : (voice?.language || "");
        // addFavorite는 userId와 voiceId만 받음
        await dbService.addFavorite(user.id, voiceId);
        setFavoriteVoiceIds(prev => new Set([...prev, voiceId]));
        toast({ title: "즐겨찾기 추가", description: "즐겨찾기에 추가되었습니다." });
      }
    } catch (error) {
      console.error("즐겨찾기 토글 실패:", error);
      toast({ title: "오류", description: "즐겨찾기 처리 중 오류가 발생했습니다.", variant: "destructive" });
    }
  };

  // 정리
  useEffect(() => {
    return () => {
      cloneTimeoutsRef.current.forEach(timer => window.clearTimeout(timer));
      cloneTimeoutsRef.current = [];
    };
  }, []);

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        title="클론 음성 관리"
        description="기존 음성을 기반으로 클론 음성을 생성하고 관리합니다."
        icon={Mic2}
        action={{
          label: "새 클론 음성 생성",
          onClick: () => openCloneModal(),
          icon: Plus,
        }}
      />

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mic2 className="w-5 h-5" />
                클론 음성 목록
              </CardTitle>
              <CardDescription>생성된 클론 음성을 관리하고 미리듣기할 수 있습니다.</CardDescription>
                </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => fetchVoices(true)} disabled={isLoadingVoices}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingVoices ? 'animate-spin' : ''}`} />
                음성 목록 새로고침
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {cloneRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                아직 생성된 클론 음성이 없습니다. 기준 음성을 선택한 후 클론 생성 버튼을 눌러보세요.
              </p>
            ) : (
              <div className="space-y-3">
                {cloneRequests.map((clone) => {
                  const isFavorite = favoriteVoiceIds.has(clone.voiceId);
                  const languageLabel = languageCodeToKo(clone.language);
                  return (
                    <div key={clone.id} className="rounded-xl border border-border bg-muted/20 p-4 grid gap-4 md:grid-cols-[200px_1fr_250px] items-start transition-all hover:shadow-md" style={{ borderRadius: '12px' }}>
                      {/* 왼쪽: 상태 및 기본 정보 */}
                      <div className="space-y-2">
                        <Badge variant={clone.status === "completed" ? "default" : "outline"} className="w-fit">
                          {clone.status === "completed" ? "완료" : clone.status === "failed" ? "실패" : "진행중"}
              </Badge>
                        <div className="text-xs text-muted-foreground">{formatDateTime(clone.createdAt)}</div>
            </div>
                      
                      {/* 중앙: 음성 이름, 기준 음성, 언어, 미리듣기 입력 */}
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-foreground">{clone.voiceName}</div>
                          <div className="text-xs text-muted-foreground">기준 음성: {clone.baseVoiceName || "-"}</div>
                          <div className="text-xs text-muted-foreground">언어: {languageLabel}</div>
          </div>
                        
                        {/* 클론 음성 미리듣기 (완료된 경우에만) */}
                        {clone.status === "completed" && (
                          <div className="space-y-2">
                            <Input
                              type="text"
                              placeholder="미리듣기 텍스트 입력..."
                              value={clonePreviewText[clone.id] || ""}
                              onChange={(e) => setClonePreviewText(prev => ({ ...prev, [clone.id]: e.target.value }))}
                              className="h-10 text-sm"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleClonePreview(clone);
                                }
                              }}
                            />
                            {clonePreviewAudio[clone.id] && (
                              <AudioPlayer
                                audioUrl={clonePreviewAudio[clone.id]!}
                                title={`${clone.voiceName} 미리듣기`}
                                duration={0}
                              />
                            )}
        </div>
                        )}
      </div>

                      {/* 오른쪽: 샘플 정보 및 액션 버튼 */}
                      <div className="space-y-3">
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div>샘플: {clone.sampleName || "-"}</div>
                          <div>메모: {clone.memo || "-"}</div>
                          {clone.completedAt && (
                            <div>완료: {formatDateTime(clone.completedAt)}</div>
                          )}
                      </div>
                        
                        <div className="flex flex-col gap-2">
                          {/* 미리듣기 버튼 (완료된 경우에만) */}
                          {clone.status === "completed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full justify-start"
                              disabled={!clonePreviewText[clone.id]?.trim() || isGeneratingClonePreview[clone.id]}
                              onClick={() => handleClonePreview(clone)}
                            >
                              {isGeneratingClonePreview[clone.id] ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2"></div>
                                  생성 중...
                                </>
                              ) : (
                                <>
                                  <Play className="w-3 h-3 mr-2" />
                                  미리듣기
                                </>
                              )}
                                  </Button>
                          )}
                          
                          {/* 튜닝 및 파형 비교 버튼 (완료된 경우에만) */}
                          {clone.status === "completed" && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                  setSelectedCloneForTuning(clone.id);
                                  if (!cloneTuningSettings[clone.id]) {
                                    setCloneTuningSettings(prev => ({
                                      ...prev,
                                      [clone.id]: {
                                        speed: 1.0,
                                        pitch: 0,
                                        style: "neutral",
                                        language: clone.language || "ko",
                                        emotion: "neutral"
                                      }
                                    }));
                                  }
                                  setIsCloneTuningModalOpen(true);
                                }}
                              >
                                <Settings className="w-3 h-3 mr-1" />
                                튜닝
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={async () => {
                                  setSelectedCloneForWaveform(clone.id);
                                  setIsWaveformComparisonOpen(true);
                                  
                                  try {
                                    const ctx = audioContext || new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
                                    if (!audioContext) setAudioContext(ctx);
                                    
                                    const baseVoice = getVoiceMeta(clone.baseVoiceId);
                                    const sampleUrl = baseVoice?.samples?.[0]?.url;
                                    
                                    let clonedUrl = clonePreviewAudio[clone.id];
                                    if (!clonedUrl && clonePreviewText[clone.id]) {
                                      await handleClonePreview(clone);
                                      clonedUrl = clonePreviewAudio[clone.id] || null;
                                    }
                                    
                                    let originalBuffer: AudioBuffer | undefined;
                                    let clonedBuffer: AudioBuffer | undefined;
                                    
                                    if (sampleUrl) {
                                      try {
                                        originalBuffer = await decodeUrlToBuffer(ctx, sampleUrl);
                                      } catch (e) {
                                        console.warn("기준 음성 샘플 디코딩 실패:", e);
                                      }
                                    }
                                    
                                    if (clonedUrl) {
                                      try {
                                        clonedBuffer = await decodeUrlToBuffer(ctx, clonedUrl);
                                      } catch (e) {
                                        console.warn("클론 음성 디코딩 실패:", e);
                                      }
                                    }
                                    
                                    setWaveformComparisonData(prev => ({
                                      ...prev,
                                      [clone.id]: {
                                        original: originalBuffer,
                                        cloned: clonedBuffer,
                                        originalUrl: sampleUrl,
                                        clonedUrl: clonedUrl || undefined
                                      }
                                    }));
                                  } catch (error) {
                                    console.error("파형 데이터 로드 오류:", error);
                                    toast({
                                      title: "파형 로드 실패",
                                      description: "파형 데이터를 불러올 수 없습니다.",
                                      variant: "destructive"
                                    });
                                  }
                                }}
                              >
                                <BarChart3 className="w-3 h-3 mr-1" />
                                파형 비교
                              </Button>
                                  </div>
                          )}
                          
                          {/* 즐겨찾기 버튼 */}
                          <Button
                            size="sm"
                            variant={isFavorite ? "default" : "outline"}
                            className="w-full"
                            onClick={() => toggleFavorite(clone.voiceId)}
                          >
                            <Star className={`w-3 h-3 mr-2 ${isFavorite ? 'fill-current' : ''}`} />
                            {isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
                                  </Button>
                                </div>
                              </div>
                      </div>
                  );
                })}
                    </div>
            )}
                </CardContent>
              </Card>
            </div>

      {/* 클론 생성 모달 */}
      <Dialog open={isCloneModalOpen} onOpenChange={setIsCloneModalOpen}>
        <DialogContent className="sm:max-w-lg dark-dialog">
          <DialogHeader>
            <DialogTitle className="text-white font-bold text-lg">새 클론 음성 생성</DialogTitle>
            <DialogDescription className="text-gray-300">
              기준 음성과 샘플 음성을 업로드하면, 동일한 톤의 클론 음성을 만들어 음성 목록에 추가합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
                  <div className="space-y-2">
              <Label htmlFor="clone-target" className="text-gray-200">대상 이름 *</Label>
                    <Input
                id="clone-target"
                placeholder="예: 시장님 공식 음성"
                value={cloneForm.targetName}
                onChange={(e) => setCloneForm((prev) => ({ ...prev, targetName: e.target.value }))}
                className="bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-400"
                    />
                  </div>
                  <div className="space-y-2">
              <Label className="text-gray-200">기준 음성 *</Label>
              <Select
                value={cloneForm.baseVoiceId || undefined}
                onValueChange={(value) => {
                  const base = getVoiceMeta(value);
                  const firstLang = base
                    ? normalizeLanguage(Array.isArray(base.language) ? base.language[0] : base.language) || cloneForm.language
                    : cloneForm.language;
                  setCloneForm((prev) => ({ ...prev, baseVoiceId: value, language: firstLang }));
                }}
              >
                <SelectTrigger className="bg-gray-800/50 border-gray-600 text-white">
                  <SelectValue placeholder="기준 음성을 선택하세요" className="text-gray-400" />
                      </SelectTrigger>
                <SelectContent className="max-h-64 bg-gray-800 border-gray-600">
                  <div className="px-2 py-1.5 border-b border-gray-700 space-y-2 sticky top-0 bg-gray-800 z-10" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground">정렬:</span>
                      <Select 
                        value={cloneBaseVoiceSortBy} 
                        onValueChange={(v) => {
                          if (v === "none") {
                            setCloneBaseVoiceSortBy("none");
                          } else {
                            setCloneBaseVoiceSortBy(v as "name" | "language" | "gender");
                            if (cloneBaseVoiceSortBy !== v) setCloneBaseVoiceSortOrder("asc");
                          }
                        }}
                      >
                        <SelectTrigger className="h-6 w-24 text-[10px] border-gray-600" onClick={(e) => e.stopPropagation()}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent onClick={(e) => e.stopPropagation()}>
                          <SelectItem value="none">정렬 안함</SelectItem>
                          <SelectItem value="name">이름</SelectItem>
                          <SelectItem value="language">언어</SelectItem>
                          <SelectItem value="gender">성별</SelectItem>
                      </SelectContent>
                    </Select>
                      {cloneBaseVoiceSortBy !== "none" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCloneBaseVoiceSortOrder(cloneBaseVoiceSortOrder === "asc" ? "desc" : "asc");
                          }}
                        >
                          {cloneBaseVoiceSortOrder === "asc" ? "↑" : "↓"}
                        </Button>
                      )}
                  </div>
                  </div>
                  {(() => {
                    const sorted = [...allVoices].sort((a: any, b: any) => {
                      if (cloneBaseVoiceSortBy === "name") {
                        const nameA = (a.name || a.voice_id || "").toLowerCase();
                        const nameB = (b.name || b.voice_id || "").toLowerCase();
                        return cloneBaseVoiceSortOrder === "asc" 
                          ? nameA.localeCompare(nameB, "ko") 
                          : nameB.localeCompare(nameA, "ko");
                      } else if (cloneBaseVoiceSortBy === "language") {
                        const langA = Array.isArray(a.language) ? a.language[0] || "" : (a.language || "");
                        const langB = Array.isArray(b.language) ? b.language[0] || "" : (b.language || "");
                        const langRankA = langA === "ko" ? 0 : langA === "en" ? 1 : langA === "ja" ? 2 : 3;
                        const langRankB = langB === "ko" ? 0 : langB === "en" ? 1 : langB === "ja" ? 2 : 3;
                        return cloneBaseVoiceSortOrder === "asc" 
                          ? langRankA - langRankB 
                          : langRankB - langRankA;
                      } else if (cloneBaseVoiceSortBy === "gender") {
                        const genderA = (a.gender || "").toLowerCase();
                        const genderB = (b.gender || "").toLowerCase();
                        const genderOrder = { female: 0, male: 1, neutral: 2, "": 3 };
                        const rankA = genderOrder[genderA as keyof typeof genderOrder] ?? 3;
                        const rankB = genderOrder[genderB as keyof typeof genderOrder] ?? 3;
                        return cloneBaseVoiceSortOrder === "asc" ? rankA - rankB : rankB - rankA;
                      }
                      return 0;
                    });
                    return sorted.map((voice: any) => {
                      const flags = (() => {
                        const arr = Array.isArray(voice.language) ? voice.language : (voice.language ? [voice.language] : []);
                        return arr.map((c: string) => languageCodeToFlag(c)).filter(Boolean).join(" ") || "";
                      })();
                      const genderColor = voice.gender === "female" ? "bg-red-500" : voice.gender === "male" ? "bg-blue-500" : "bg-gray-400";
                      return (
                        <SelectItem key={voice.voice_id} value={voice.voice_id} className="text-white focus:bg-gray-700">
                            <div className="flex items-center gap-2">
                            <span className={`inline-block w-2 h-2 rounded-full ${genderColor}`}></span>
                            <span>{voice.name || voice.voice_id}</span>
                            {flags && <span className="text-xs">{flags}</span>}
                              </div>
                        </SelectItem>
                      );
                    });
                  })()}
                </SelectContent>
              </Select>
                            </div>
            <div className="space-y-2">
              <Label className="text-gray-200">주요 언어 *</Label>
              <Select
                value={cloneForm.language}
                onValueChange={(value) => setCloneForm((prev) => ({ ...prev, language: value }))}
              >
                <SelectTrigger className="bg-gray-800/50 border-gray-600 text-white">
                  <SelectValue placeholder="언어를 선택하세요" className="text-gray-400" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {languageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-white focus:bg-gray-700">
                      {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                      <div className="space-y-2">
              <Label htmlFor="clone-memo" className="text-gray-200">메모</Label>
                        <Textarea
                id="clone-memo"
                placeholder="예: 시장님 축사톤으로 30초 분량"
                value={cloneForm.memo}
                onChange={(e) => setCloneForm((prev) => ({ ...prev, memo: e.target.value }))}
                className="bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-400"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-200">샘플 업로드 *</Label>
              <Tabs 
                value={cloneForm.sampleType || "file"} 
                onValueChange={(value) => setCloneForm((prev) => ({ 
                  ...prev, 
                  sampleType: value as "file" | "youtube",
                  sampleFile: value === "file" ? prev.sampleFile : null,
                  youtubeUrl: value === "youtube" ? prev.youtubeUrl : undefined,
                  sampleName: value === "file" ? prev.sampleName : undefined,
                }))}
              >
                <TabsList className="grid w-full grid-cols-2 bg-gray-800/50">
                  <TabsTrigger value="file" className="flex items-center gap-2 text-gray-300 data-[state=active]:text-white data-[state=active]:bg-gray-700">
                    <Upload className="w-4 h-4" />
                    파일 업로드
                  </TabsTrigger>
                  <TabsTrigger value="youtube" className="flex items-center gap-2 text-gray-300 data-[state=active]:text-white data-[state=active]:bg-gray-700">
                    <Youtube className="w-4 h-4" />
                    유튜브 링크
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="file" className="space-y-2 mt-4">
                  <Input
                    id="clone-sample"
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setCloneForm((prev) => ({ ...prev, sampleFile: file, sampleName: file?.name }));
                    }}
                    className="bg-gray-800/50 border-gray-600 text-white file:text-white file:bg-gray-700 file:border-gray-600"
                  />
                  {cloneForm.sampleName && (
                    <p className="text-xs text-gray-400">선택된 파일: {cloneForm.sampleName}</p>
                  )}
                  <p className="text-xs text-gray-400">
                    지원 형식: WAV, MP3, OGG (최대 50MB)
                  </p>
                </TabsContent>
                <TabsContent value="youtube" className="space-y-2 mt-4">
                  <Input
                    id="clone-youtube"
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=... 또는 https://youtu.be/..."
                    value={cloneForm.youtubeUrl || ""}
                    onChange={(e) => setCloneForm((prev) => ({ ...prev, youtubeUrl: e.target.value }))}
                    className="bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-400"
                  />
                  {cloneForm.youtubeUrl && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Youtube className="w-3 h-3" />
                      <span>유튜브 링크가 입력되었습니다.</span>
                      </div>
                  )}
                  <p className="text-xs text-gray-400">
                    유튜브 영상에서 오디오가 자동으로 추출됩니다.
                  </p>
                </TabsContent>
              </Tabs>
            </div>
          </div>
          <DialogFooter>
                          <Button 
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
              onClick={() => {
                setIsCloneModalOpen(false);
                setCloneForm(createCloneForm({ language: cloneForm.language }));
              }}
            >
              취소
                          </Button>
                          <Button 
              onClick={handleCloneSubmit}
              className="bg-primary hover:bg-primary/90 text-white"
                          >
              클로닝 요청
                          </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 클론 튜닝 모달 */}
      <Dialog open={isCloneTuningModalOpen} onOpenChange={setIsCloneTuningModalOpen}>
        <DialogContent className="sm:max-w-2xl dark-dialog bg-gray-900/95 border-gray-700">
          <DialogHeader>
            <DialogTitle style={{ color: '#FFFFFF' }} className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              클론 음성 튜닝
            </DialogTitle>
            <DialogDescription style={{ color: '#E5E7EB' }}>
              {selectedCloneForTuning && (() => {
                const clone = cloneRequests.find(c => c.id === selectedCloneForTuning);
                return clone ? `${clone.voiceName} 음성의 속도, 피치, 감정 등을 조정하여 완성도를 높입니다.` : "";
              })()}
            </DialogDescription>
          </DialogHeader>
          {selectedCloneForTuning && (() => {
            const clone = cloneRequests.find(c => c.id === selectedCloneForTuning);
            if (!clone) return null;
            const tuning = cloneTuningSettings[clone.id] || {
              speed: 1.0,
              pitch: 0,
              style: "neutral",
              language: clone.language || "ko",
              emotion: "neutral"
            };

            return (
              <div className="space-y-6">
                      <div className="space-y-2">
                  <Label style={{ color: '#E5E7EB' }}>미리듣기 텍스트 *</Label>
                        <Input
                    placeholder="튜닝 효과를 확인할 텍스트를 입력하세요..."
                    value={clonePreviewText[clone.id] || ""}
                    onChange={(e) => setClonePreviewText(prev => ({ ...prev, [clone.id]: e.target.value }))}
                    className="bg-gray-800/50 border-gray-600 text-white"
                  />
                      </div>

                <div className="space-y-4">
                      <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label style={{ color: '#E5E7EB' }}>속도</Label>
                      <span className="text-sm text-gray-400">{(tuning.speed || 1.0).toFixed(2)}x</span>
                    </div>
                    <Slider
                      value={[tuning.speed || 1.0]}
                      onValueChange={(values) => {
                        setCloneTuningSettings(prev => ({
                          ...prev,
                          [clone.id]: { ...tuning, speed: values[0] }
                        }));
                      }}
                      min={0.5}
                      max={2.0}
                      step={0.05}
                      className="w-full"
                    />
                      </div>
                      
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label style={{ color: '#E5E7EB' }}>피치</Label>
                      <span className="text-sm text-gray-400">
                        {tuning.pitch && tuning.pitch > 0 ? '+' : ''}{tuning.pitch || 0}
                      </span>
                    </div>
                    <Slider
                      value={[tuning.pitch || 0]}
                      onValueChange={(values) => {
                        setCloneTuningSettings(prev => ({
                          ...prev,
                          [clone.id]: { ...tuning, pitch: values[0] }
                        }));
                      }}
                      min={-100}
                      max={100}
                      step={1}
                      className="w-full"
                    />
                </div>

                  <div className="space-y-2">
                    <Label style={{ color: '#E5E7EB' }}>스타일</Label>
                    <Select
                      value={tuning.style || "neutral"}
                      onValueChange={(value) => {
                        setCloneTuningSettings(prev => ({
                          ...prev,
                          [clone.id]: { ...tuning, style: value }
                        }));
                      }}
                    >
                      <SelectTrigger className="bg-gray-800/50 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        {[
                          { value: "neutral", label: "중립" },
                          { value: "happy", label: "밝음" },
                          { value: "sad", label: "슬픔" },
                          { value: "angry", label: "분노" },
                          { value: "calm", label: "차분" },
                          { value: "friendly", label: "친근" },
                          { value: "professional", label: "전문" },
                          { value: "excited", label: "흥분" },
                          { value: "serious", label: "진지" },
                        ].map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-white focus:bg-gray-700">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label style={{ color: '#E5E7EB' }}>언어</Label>
                    <Select
                      value={tuning.language || clone.language || "ko"}
                      onValueChange={(value) => {
                        setCloneTuningSettings(prev => ({
                          ...prev,
                          [clone.id]: { ...tuning, language: value }
                        }));
                      }}
                    >
                      <SelectTrigger className="bg-gray-800/50 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        {languageOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-white focus:bg-gray-700">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                <Button 
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={!clonePreviewText[clone.id]?.trim() || isGeneratingCloneTuning[clone.id]}
                    onClick={() => handleCloneTuningPreview(clone.id)}
                  >
                    {isGeneratingCloneTuning[clone.id] ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        생성 중...
                    </>
                  ) : (
                    <>
                        <Play className="w-4 h-4 mr-2" />
                        튜닝 미리듣기
                    </>
                  )}
                </Button>
                  
                  {cloneTuningPreviewAudio[clone.id] && (
                  <div className="space-y-2">
                      <AudioPlayer
                        audioUrl={cloneTuningPreviewAudio[clone.id]!}
                        title="튜닝된 음성 미리듣기"
                        duration={0}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          if (cloneTuningPreviewAudio[clone.id]) {
                            URL.revokeObjectURL(cloneTuningPreviewAudio[clone.id]!);
                            setCloneTuningPreviewAudio(prev => {
                              const newState = { ...prev };
                              delete newState[clone.id];
                              return newState;
                            });
                          }
                        }}
                      >
                        <X className="w-4 h-4 mr-2" />
                        미리듣기 제거
                      </Button>
                  </div>
                  )}
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button
              variant="outline"
              className="border-gray-600 hover:bg-gray-800 hover:text-white"
              style={{ color: '#E5E7EB' }}
              onClick={() => {
                setIsCloneTuningModalOpen(false);
                setSelectedCloneForTuning(null);
              }}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 파형 비교 모달 */}
      <Dialog open={isWaveformComparisonOpen} onOpenChange={setIsWaveformComparisonOpen}>
        <DialogContent className="sm:max-w-4xl dark-dialog bg-gray-900/95 border-gray-700 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ color: '#FFFFFF' }} className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              파형 비교
            </DialogTitle>
            <DialogDescription style={{ color: '#E5E7EB' }}>
              {selectedCloneForWaveform && (() => {
                const clone = cloneRequests.find(c => c.id === selectedCloneForWaveform);
                return clone ? `원본 음성과 ${clone.voiceName} 클론 음성의 파형을 비교합니다.` : "";
              })()}
            </DialogDescription>
          </DialogHeader>
          {selectedCloneForWaveform && (() => {
            const clone = cloneRequests.find(c => c.id === selectedCloneForWaveform);
            if (!clone) return null;
            const waveformData = waveformComparisonData[clone.id];

            return (
              <div className="space-y-6">
                  <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label style={{ color: '#E5E7EB' }} className="text-lg font-semibold">
                      원본 음성 (기준 음성)
                    </Label>
                    {waveformData?.originalUrl && (
                      <AudioPlayer
                        audioUrl={waveformData.originalUrl}
                        title="원본 음성"
                        duration={0}
                        className="flex-1 max-w-xs"
                      />
                    )}
                  </div>
                  {waveformData?.original ? (
                    <WaveformCanvas
                      audioBuffer={waveformData.original}
                      width={800}
                      height={150}
                      color="#3b82f6"
                      backgroundColor="#111827"
                      showGrid={true}
                    />
                  ) : (
                    <div className="h-32 bg-gray-800/50 rounded border border-gray-700 flex items-center justify-center text-gray-400">
                      {waveformData?.originalUrl ? "원본 음성 파형 데이터를 불러오는 중..." : "원본 음성 샘플을 찾을 수 없습니다."}
                        </div>
                      )}
                  </div>

                    <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label style={{ color: '#E5E7EB' }} className="text-lg font-semibold">
                      클론 음성 ({clone.voiceName})
                    </Label>
                    {waveformData?.clonedUrl && (
                      <AudioPlayer
                        audioUrl={waveformData.clonedUrl}
                        title="클론 음성"
                        duration={0}
                        className="flex-1 max-w-xs"
                      />
                    )}
                  </div>
                  {waveformData?.cloned ? (
                    <WaveformCanvas
                      audioBuffer={waveformData.cloned}
                      width={800}
                      height={150}
                      color="#10b981"
                      backgroundColor="#111827"
                      showGrid={true}
                    />
                  ) : (
                    <div className="h-32 bg-gray-800/50 rounded border border-gray-700 flex items-center justify-center text-gray-400">
                      {clonePreviewText[clone.id] ? (
                        <div className="text-center space-y-2">
                          <p>클론 음성 파형 데이터가 없습니다.</p>
                          <p className="text-xs">미리듣기를 먼저 생성해주세요.</p>
                  <Button 
                            size="sm"
                            variant="outline"
                            className="mt-2"
                            onClick={() => handleClonePreview(clone)}
                          >
                            <Play className="w-3 h-3 mr-1" />
                            미리듣기 생성
                          </Button>
                        </div>
                      ) : (
                        <p>클론 음성 파형 데이터를 불러오는 중...</p>
                      )}
                    </div>
                  )}
                </div>

                {waveformData?.original && waveformData?.cloned && (
                  <div className="p-4 bg-gray-800/50 rounded border border-gray-700 space-y-2">
                    <h4 className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>비교 정보</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span style={{ color: '#9CA3AF' }}>원본 길이: </span>
                        <span style={{ color: '#FFFFFF' }}>
                          {waveformData.original.duration.toFixed(2)}초
                        </span>
                </div>
                      <div>
                        <span style={{ color: '#9CA3AF' }}>클론 길이: </span>
                        <span style={{ color: '#FFFFFF' }}>
                          {waveformData.cloned.duration.toFixed(2)}초
                        </span>
      </div>
                      <div>
                        <span style={{ color: '#9CA3AF' }}>원본 샘플레이트: </span>
                        <span style={{ color: '#FFFFFF' }}>
                          {waveformData.original.sampleRate}Hz
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#9CA3AF' }}>클론 샘플레이트: </span>
                        <span style={{ color: '#FFFFFF' }}>
                          {waveformData.cloned.sampleRate}Hz
                        </span>
                      </div>
                    </div>
                  </div>
                )}
    </div>
            );
          })()}
          <DialogFooter>
            <Button
              variant="outline"
              className="border-gray-600 hover:bg-gray-800 hover:text-white"
              style={{ color: '#E5E7EB' }}
              onClick={() => {
                setIsWaveformComparisonOpen(false);
                setSelectedCloneForWaveform(null);
              }}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
};

export default VoiceCloning;