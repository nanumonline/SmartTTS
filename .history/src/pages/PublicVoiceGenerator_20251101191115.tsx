import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import HomeButton from "@/components/HomeButton";
import MixingTimeline from "@/components/MixingTimeline";
import { 
  Mic2, 
  Play, 
  Pause, 
  Download, 
  Volume2, 
  Clock, 
  Calendar,
  Building2,
  Users,
  MessageSquare,
  Megaphone,
  FileText,
  Settings,
  Info,
  Plus,
  Lock,
  CheckCircle,
  Search,
  Star,
  Youtube,
  Upload,
  Trash2,
  Edit,
  History,
  X,
  Minus
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import AudioPlayer from "@/components/AudioPlayer";
import {
  exportMixToWav,
  decodeUrlToBuffer,
  downloadBlob,
  formatTime,
  type MixingSettings,
  DEFAULT_MIXING_SETTINGS,
} from "@/lib/audioMixer";

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

type MixingAsset = {
  id: string;
  name: string;
  type: "background" | "effect";
  url?: string;
  duration?: number;
};

type MixingState = {
  voiceTrackVolume: number;
  backgroundTrackVolume: number;
  effectTrackVolume: number;
  selectedVoiceTrack?: any; // 생성된 음원 선택
  selectedBackground?: MixingAsset;
  selectedEffect?: MixingAsset;
  mixedAudioUrl?: string; // 믹싱된 결과 음원 URL
  // 고급 설정
  masterGain?: number;
  fadeIn?: number;
  fadeOut?: number;
  lowShelf?: number;
  midPeaking?: number;
  highShelf?: number;
  duckingEnabled?: boolean;
  duckDb?: number;
  duckThreshold?: number;
  duckRelease?: number;
  bgmOffset?: number;
  ttsOffset?: number;
  trimEndSec?: number | null;
};

type ScheduleRequest = {
  id: number;
  generationId: number;
  targetChannel: string;
  targetName: string;
  scheduledTime: string;
  repeatOption: "once" | "daily" | "weekly";
  status: "scheduled" | "sent" | "failed";
  createdAt: string;
  sentAt?: string;
  failReason?: string;
  mixingState?: MixingState;
};

type ReviewState = {
  generationId: number;
  status: "draft" | "review" | "approved" | "rejected";
  comments: string;
  updatedAt: string;
};

type UsageStats = {
  totalCalls: number;
  totalDuration: number;
  callsThisMonth: number;
  durationThisMonth: number;
  lastUpdated: string;
};

type CreditBalance = {
  balance: number;
  currency: string;
  lastUpdated: string;
};

type OperationLog = {
  id: number;
  type: "error" | "warning" | "success" | "info";
  message: string;
  timestamp: string;
  context?: any;
  resolved?: boolean;
};

const PublicVoiceGenerator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [customText, setCustomText] = useState("");
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [selectedTemplateObj, setSelectedTemplateObj] = useState<any>(null);
  const [openAIPrompt, setOpenAIPrompt] = useState("");
  const [openAIInstruction, setOpenAIInstruction] = useState("");
  const [lastAIPrompt, setLastAIPrompt] = useState("");
  const [lastAIInstruction, setLastAIInstruction] = useState("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiMode, setAiMode] = useState<"generate" | "edit">("generate");
  const [messageHistory, setMessageHistory] = useState<Array<{ id: string; text: string; purpose: string; createdAt: string; updatedAt: string }>>([]);
  const [isMessageHistoryOpen, setIsMessageHistoryOpen] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("formal_male");
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [allVoices, setAllVoices] = useState<any[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [voiceLoadingProgress, setVoiceLoadingProgress] = useState(0); // 0-100
  const [voiceSearchLanguage, setVoiceSearchLanguage] = useState<string>("ko");
  const [voiceSearchStyle, setVoiceSearchStyle] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [generatedDuration, setGeneratedDuration] = useState<number>(0);
  const [predictedDuration, setPredictedDuration] = useState<number | null>(null);
  const [isPredictingDuration, setIsPredictingDuration] = useState(false);
  const [predictedCredit, setPredictedCredit] = useState<number | null>(null);
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number } | null>(null);
  const [selectedVoiceInfo, setSelectedVoiceInfo] = useState<any | null>(null);
  const [playingSample, setPlayingSample] = useState<string | null>(null);
  const audioSampleRef = useRef<HTMLAudioElement | null>(null);
  const [isVoiceFinderOpen, setIsVoiceFinderOpen] = useState(false);
  const [voiceFilters, setVoiceFilters] = useState({
    language: "ko",
    style: "",
    name: "",
    gender: "",
    useCase: ""
  });
  const [voiceSearchResults, setVoiceSearchResults] = useState<any[]>([]);
  const [isSearchingVoices, setIsSearchingVoices] = useState(false);
  const [voiceNextToken, setVoiceNextToken] = useState<string | null>(null);
  const [voiceTotalCount, setVoiceTotalCount] = useState<number | null>(null);
  const isAutoLoadingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  // cacheRef: blob 데이터를 저장하여 blob URL 만료 문제 해결
  const cacheRef = useRef<Map<string, { blob: Blob; duration: number | null; mimeType?: string; _audioUrl?: string }>>(new Map());
  const cloneTimeoutsRef = useRef<number[]>([]);
  const [generationHistory, setGenerationHistory] = useState<any[]>([]);
  const [metaOverrides, setMetaOverrides] = useState<{ language: string; style: string; model: string }>({ language: "", style: "", model: "" });
  const [favoriteVoiceIds, setFavoriteVoiceIds] = useState<Set<string>>(new Set());
  const [selectedPurpose, setSelectedPurpose] = useState<string>("announcement");
  const [cloneRequests, setCloneRequests] = useState<CloneRequest[]>([]);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [alertDialog, setAlertDialog] = useState<{ open: boolean; title: string; message: string; onConfirm?: () => void }>({ open: false, title: "", message: "" });
  const [templateVariableWarning, setTemplateVariableWarning] = useState<{ open: boolean; variables: string[]; text: string }>({ open: false, variables: [], text: "" });
  
  // 끊어읽기 구간 추가 다이얼로그
  const [isPauseSegmentDialogOpen, setIsPauseSegmentDialogOpen] = useState(false);
  const [newPauseSegment, setNewPauseSegment] = useState({ position: 0, duration: 0.5 });
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

  // Phase 3: 믹싱, 예약, 검수 상태 관리
  const [mixingStates, setMixingStates] = useState<Map<number, MixingState>>(new Map());
  const [scheduleRequests, setScheduleRequests] = useState<ScheduleRequest[]>([]);
  const [reviewStates, setReviewStates] = useState<Map<number, ReviewState>>(new Map());
  const [isMixingModalOpen, setIsMixingModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedGenerationForMixing, setSelectedGenerationForMixing] = useState<any>(null);
  const [previewMixedAudio, setPreviewMixedAudio] = useState<string | null>(null);
  const [isMixingAudio, setIsMixingAudio] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [selectedGenerationForSchedule, setSelectedGenerationForSchedule] = useState<any>(null);
  const [isSaveNameDialogOpen, setIsSaveNameDialogOpen] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState("");
  const [pendingGeneration, setPendingGeneration] = useState<any>(null);
  const [uploadedBgmFile, setUploadedBgmFile] = useState<File | null>(null);
  const [expandedGenerationId, setExpandedGenerationId] = useState<number | null>(null);
  const [editingGenerationId, setEditingGenerationId] = useState<number | null>(null);
  const [editNameInput, setEditNameInput] = useState("");
  const [mixingPreviewAudio, setMixingPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isMixingPreviewPlaying, setIsMixingPreviewPlaying] = useState(false);
  const [mixingPreviewProgress, setMixingPreviewProgress] = useState(0);

  // Phase 4: 사용량 및 크레딧 모니터링
  const [usageStats, setUsageStats] = useState<UsageStats>({
    totalCalls: 0,
    totalDuration: 0,
    callsThisMonth: 0,
    durationThisMonth: 0,
    lastUpdated: new Date().toISOString(),
  });
  const [creditBalance, setCreditBalance] = useState<CreditBalance>({
    balance: 0,
    currency: "KRW",
    lastUpdated: new Date().toISOString(),
  });
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
  const [isMonitoringPanelOpen, setIsMonitoringPanelOpen] = useState(false);
  const usagePollingRef = useRef<number | null>(null);

  // 믹싱 자산 라이브러리 (사전정의 - 비어있음, 사용자 업로드만 사용)
  const mixingAssetLibrary: MixingAsset[] = [];

  // 전송 채널 옵션
  const scheduleChannels = [
    { value: "pc_broadcast", label: "PC (방송장비)", description: "PC를 통해 송출(RJ35) 통해 방송장비의 AUX 단 연결" },
    { value: "tablet_broadcast", label: "태블릿 (방송장비)", description: "태블릿을 통해 송출(RJ35/USB) 통해 방송장비의 AUX 단 연결" },
    { value: "broadcast_screen", label: "공중파 방송 (화면/자막)" },
    { value: "radio", label: "라디오" },
    { value: "sns", label: "SNS (Facebook/Instagram)" },
    { value: "website", label: "웹사이트 배너/팝업" },
    { value: "email", label: "이메일 뉴스레터" },
  ];

  // 드롭다운 옵션 (한국어 라벨 적용, 언어는 한국어/영어/일본어만)
  const languageOptions = [
    { value: "ko", label: "한국어 🇰🇷" },
    { value: "en", label: "영어 🇺🇸" },
    { value: "ja", label: "일본어 🇯🇵" },
  ];
  const styleOptions = [
    { value: "neutral", label: "중립" },
    { value: "happy", label: "밝음" },
    { value: "sad", label: "슬픔" },
    { value: "angry", label: "분노" },
    { value: "calm", label: "차분" },
    { value: "friendly", label: "친근" },
    { value: "professional", label: "전문" },
    { value: "excited", label: "흥분" },
    { value: "serious", label: "진지" },
    { value: "whisper", label: "속삭임" },
    { value: "shout", label: "고성" },
    { value: "formal", label: "격식" },
    { value: "casual", label: "캐주얼" },
    { value: "narrative", label: "서술" },
  ];
  const genderOptions = [
    { value: "male", label: "남성" },
    { value: "female", label: "여성" },
    { value: "neutral", label: "중성" },
    { value: "child_male", label: "남아" },
    { value: "child_female", label: "여아" },
  ];
  const allUseCaseOptions = [
    { value: "announcement", label: "공지" },
    { value: "public-service", label: "공공서비스" },
    { value: "broadcast", label: "방송" },
    { value: "education", label: "교육" },
    { value: "marketing", label: "마케팅" },
    { value: "narration", label: "내레이션" },
    { value: "assistant", label: "어시스턴트" },
    { value: "news", label: "뉴스" },
    { value: "audiobook", label: "오디오북" },
    { value: "gaming", label: "게임" },
    { value: "advertisement", label: "광고" },
    { value: "telephone", label: "전화" },
  ];

  // 실제 음성 목록에서 사용되는 용도만 추출
  const getAvailableUseCases = useCallback(() => {
    if (allVoices.length === 0) return [];
    
    const normalizeUseCase = (val: string) => (val || "").toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
    const foundUseCases = new Set<string>();
    
    allVoices.forEach((v: any) => {
      const raw = v.use_case ?? v.useCase ?? v.usecases ?? v.useCases ?? "";
      if (Array.isArray(raw)) {
        raw.forEach((uc: any) => {
          const normalized = normalizeUseCase(String(uc));
          if (normalized) foundUseCases.add(normalized);
        });
      } else if (typeof raw === "string" && raw) {
        const normalized = normalizeUseCase(raw);
        if (normalized) foundUseCases.add(normalized);
      }
    });
    
    // 실제 존재하는 용도만 필터링
    return allUseCaseOptions.filter(opt => foundUseCases.has(opt.value));
  }, [allVoices]);

  // 스타일 그룹 정의
  const styleGroups = [
    {
      group: "감정",
      styles: ["neutral", "happy", "sad", "angry", "disgusted", "surprised", "fearful"]
    },
    {
      group: "톤",
      styles: ["calm", "energetic", "serious", "friendly", "professional", "casual"]
    },
    {
      group: "속도",
      styles: ["slow", "normal", "fast"]
    },
    {
      group: "강조",
      styles: ["whisper", "cheerful", "sarcastic", "emphatic"]
    }
  ];

  // 실제 음성 목록에서 사용되는 스타일만 추출하고 그룹화
  const getAvailableStyles = useCallback(() => {
    if (allVoices.length === 0) return { grouped: [], flat: [] };
    
    const foundStyles = new Set<string>();
    
    allVoices.forEach((v: any) => {
      const styles = Array.isArray(v.styles) ? v.styles : (v.styles ? [v.styles] : []);
      styles.forEach((s: string) => {
        if (s) foundStyles.add(s.toLowerCase());
      });
    });
    
    // 그룹별로 필터링
    const grouped: Array<{ group: string; styles: Array<{ value: string; label: string }> }> = [];
    
    styleGroups.forEach(group => {
      const availableStyles = group.styles.filter(s => foundStyles.has(s));
      if (availableStyles.length > 0) {
        grouped.push({
          group: group.group,
          styles: availableStyles.map(s => ({
            value: s,
            label: styleCodeToKo(s)
          }))
        });
      }
    });
    
    // 그룹에 포함되지 않은 스타일들
    const ungrouped = Array.from(foundStyles).filter(s => {
      return !styleGroups.some(g => g.styles.includes(s));
    }).map(s => ({
      value: s,
      label: styleCodeToKo(s)
    }));
    
    if (ungrouped.length > 0) {
      grouped.push({
        group: "기타",
        styles: ungrouped
      });
    }
    
    // 평면 리스트도 반환 (기존 호환성)
    const flat = Array.from(foundStyles).map(s => ({
      value: s,
      label: styleCodeToKo(s)
    }));
    
    return { grouped, flat };
  }, [allVoices]);

  // 실제 음성 목록에서 사용되는 언어만 추출
  const getAvailableLanguages = useCallback(() => {
    if (allVoices.length === 0) return [];
    
    const foundLanguages = new Set<string>();
    
    allVoices.forEach((v: any) => {
      const langs = Array.isArray(v.language) ? v.language : (v.language ? [v.language] : []);
      langs.forEach((l: string) => {
        if (l) foundLanguages.add(normalizeLanguage(l));
      });
    });
    
    return languageOptions.filter(opt => foundLanguages.has(opt.value));
  }, [allVoices]);

  // 실제 음성 목록에서 사용되는 성별만 추출
  const getAvailableGenders = useCallback(() => {
    if (allVoices.length === 0) return [];
    
    const foundGenders = new Set<string>();
    
    allVoices.forEach((v: any) => {
      const gender = v.gender || "";
      if (gender) foundGenders.add(gender);
    });
    
    return genderOptions.filter(opt => foundGenders.has(opt.value));
  }, [allVoices]);

  const purposeOptions = [
    {
      id: "announcement",
      label: "공지",
      description: "긴급 안내·재난 알림 등 즉시 전파가 필요한 방송",
      checklist: ["대상과 지역을 명확히 언급했는가?", "비상 연락처를 포함했는가?", "지시 사항이 명확한가?"],
      optimizedPrompt: "공지 목적에 맞는 방송문을 작성하세요. 대상과 지역을 명확히 언급하고, 비상 연락처를 포함하며, 지시 사항을 명확하게 전달해야 합니다.",
    },
    {
      id: "event",
      label: "행사 축사",
      description: "시장·도지사 등 주요 인사의 행사 축사",
      checklist: ["행사명/일시/장소를 포함했는가?", "감사 인사와 기대 메시지가 있는가?", "기관 identity가 드러나는가?"],
      optimizedPrompt: "행사 축사 목적에 맞는 방송문을 작성하세요. 행사명, 일시, 장소를 포함하고, 감사 인사와 기대 메시지를 담으며, 기관 identity가 드러나도록 작성해야 합니다.",
    },
    {
      id: "promotion",
      label: "홍보/광고",
      description: "관광·정책·캠페인 홍보 방송",
      checklist: ["핵심 메시지가 3문장 이내로 명확한가?", "콜 투 액션이 있는가?", "대상 채널에 맞는 톤인가?"],
      optimizedPrompt: "홍보/광고 목적에 맞는 방송문을 작성하세요. 핵심 메시지를 3문장 이내로 명확하게 전달하고, 콜 투 액션을 포함하며, 대상 채널에 맞는 톤으로 작성해야 합니다.",
    },
    {
      id: "service",
      label: "서비스 안내",
      description: "민원·공공서비스 이용 안내",
      checklist: ["접수 방법과 운영시간을 포함했는가?", "필수 서류/준비물을 안내했는가?", "문의 경로를 제시했는가?"],
      optimizedPrompt: "서비스 안내 목적에 맞는 방송문을 작성하세요. 접수 방법과 운영시간을 포함하고, 필수 서류/준비물을 안내하며, 문의 경로를 명확하게 제시해야 합니다.",
    },
  ];

  // Supertone API 엔드포인트 (공식 레퍼런스: https://docs.supertoneapi.com/en/api-reference/introduction)
  const SUPABASE_PROXY_BASE_URL = "https://gxxralruivyhdxyftsrg.supabase.co/functions/v1/supertone-proxy";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4eHJhbHJ1aXZ5aGR4eWZ0c3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NDM0MzQsImV4cCI6MjA3NzIxOTQzNH0.6lJjJq15spXWrktl-8d5qXI3L5FHkyaEArWiH2R5AjA";
  const SUPERTONE_API_BASE_URL = "https://supertoneapi.com/v1";
  const MOCK_AUDIO_BASE64 = "UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBzqO0fPTgjMGHm7A7+OZURE=";

  // 감정 프리셋 매핑 (A/B/C/D → 실제 스타일 값)
  const emotionPresetMap: Record<string, string> = {
    "A": "neutral",
    "B": "happy",
    "C": "sad",
    "D": "angry"
  };

  const getEmotionValue = (preset: string, customPrompt: string): string => {
    if (customPrompt.trim()) return customPrompt.trim();
    return emotionPresetMap[preset] || "neutral";
  };

  const getSpeedMultiplier = () => {
    // customTime이 있으면 숫자로 변환하여 사용, 없으면 preset 기반
    if (voiceSettings.readingSpeed.customTime) {
      const num = parseFloat(voiceSettings.readingSpeed.customTime);
      if (!isNaN(num) && num > 0) return num;
    }
    const preset = voiceSettings.readingSpeed.preset;
    if (preset === "빠름") return 1.3;
    if (preset === "느림") return 0.7;
    return 1.0;
  };

  // 속도 preset → 숫자 매핑
  const speedPresetMap: Record<string, string> = {
    "느림": "0.7",
    "보통": "1.0",
    "빠름": "1.3"
  };

  const getPurposeMeta = (purposeId: string) => purposeOptions.find((p) => p.id === purposeId) || purposeOptions[0];

  const getVoiceMeta = (voiceId: string) => {
    if (!voiceId) return null;
    return availableVoices.find((v: any) => v.voice_id === voiceId)
      || allVoices.find((v: any) => v.voice_id === voiceId)
      || null;
  };

  const getVoiceDisplayName = (voiceId: string) => {
    const meta = getVoiceMeta(voiceId);
    return meta?.name || voiceId || "-";
  };

  const registerCloneVoice = (clone: CloneRequest) => {
    if (!clone?.voiceId) return;
    const base = getVoiceMeta(clone.baseVoiceId);
    const baseLanguages = base?.language
      ? (Array.isArray(base.language) ? base.language : [base.language])
      : [clone.language || "ko"];
    const baseStyles = base?.styles
      ? (Array.isArray(base.styles) ? base.styles : [base.styles])
      : ["neutral"];
    const gender = clone.gender || (base as any)?.gender || "neutral";
    const samples = base?.samples || [];
    const newVoice = {
      voice_id: clone.voiceId,
      name: clone.voiceName,
      language: baseLanguages,
      styles: baseStyles,
      gender,
      samples,
      is_clone: true,
      clone_of: clone.baseVoiceId,
    };
    setAllVoices((prev) => (prev.some((v: any) => v.voice_id === clone.voiceId) ? prev : [...prev, newVoice]));
    setAvailableVoices((prev) => (prev.some((v: any) => v.voice_id === clone.voiceId) ? prev : [...prev, newVoice]));
  };

  const openCloneModal = (baseVoiceId?: string) => {
    const base = baseVoiceId ? getVoiceMeta(baseVoiceId) : getVoiceMeta(selectedVoice);
    const baseId = (base as any)?.voice_id || baseVoiceId || selectedVoice || "";
    const firstLanguage = base
      ? normalizeLanguage(Array.isArray(base.language) ? base.language[0] : base.language)
      : cloneForm.language;
    setCloneForm(createCloneForm({
      baseVoiceId: baseId,
      targetName: base?.name ? `${base.name} 클론` : "",
      language: firstLanguage || cloneForm.language,
      memo: "",
    }));
    setIsCloneModalOpen(true);
  };

  const openMixingModal = (generation: any) => {
    if (!generation?.id) {
      toast({ title: "생성 기록을 선택해주세요", variant: "destructive" });
      return;
    }
    setSelectedGenerationForMixing(generation);
    const existing = mixingStates.get(generation.id);
    if (!existing) {
      setMixingStates((prev) =>
        new Map(prev).set(generation.id, {
          voiceTrackVolume: 100,
          backgroundTrackVolume: 50,
          effectTrackVolume: 70,
          selectedVoiceTrack: generation, // 기본으로 현재 생성 기록 선택
          masterGain: DEFAULT_MIXING_SETTINGS.masterGain,
          fadeIn: DEFAULT_MIXING_SETTINGS.fadeIn,
          fadeOut: DEFAULT_MIXING_SETTINGS.fadeOut,
          lowShelf: DEFAULT_MIXING_SETTINGS.lowShelf,
          midPeaking: DEFAULT_MIXING_SETTINGS.midPeaking,
          highShelf: DEFAULT_MIXING_SETTINGS.highShelf,
          duckingEnabled: DEFAULT_MIXING_SETTINGS.duckingEnabled,
          duckDb: DEFAULT_MIXING_SETTINGS.duckDb,
          duckThreshold: DEFAULT_MIXING_SETTINGS.duckThreshold,
          duckRelease: DEFAULT_MIXING_SETTINGS.duckRelease,
          bgmOffset: DEFAULT_MIXING_SETTINGS.bgmOffset,
          ttsOffset: DEFAULT_MIXING_SETTINGS.ttsOffset,
        })
      );
    } else if (!existing.selectedVoiceTrack) {
      // 기존 상태에 선택된 음원이 없으면 현재 생성 기록을 기본값으로 설정
      setMixingStates((prev) =>
        new Map(prev).set(generation.id, {
          ...existing,
          selectedVoiceTrack: generation,
        })
      );
    }
    setPreviewMixedAudio(null);
    setIsMixingModalOpen(true);
  };

  const openScheduleModal = (generation: any) => {
    if (!generation?.id) {
      toast({ title: "생성 기록을 선택해주세요", variant: "destructive" });
      return;
    }
    setSelectedGenerationForSchedule(generation);
    setIsScheduleModalOpen(true);
  };

  // 실시간 미리듣기 시작
  const startRealtimePreview = async () => {
    const state = mixingStates.get(selectedGenerationForMixing?.id);
    if (!state?.selectedVoiceTrack?.audioUrl) {
      toast({
        title: "음원이 선택되지 않았습니다",
        description: "믹싱할 음원을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      // 기존 재생 중지
      stopRealtimePreview();

      // AudioContext 초기화 (라이브)
      const ctx = audioContext || new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
      if (!audioContext) setAudioContext(ctx);
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // 버퍼 디코딩
      const ttsBuffer = await decodeUrlToBuffer(ctx, state.selectedVoiceTrack.audioUrl);
      let bgmBuffer: AudioBuffer | null = null;
      if (state.selectedBackground?.url) {
        bgmBuffer = await decodeUrlToBuffer(ctx, state.selectedBackground.url);
      }

      // MixingSettings 구성
      const settings: MixingSettings = {
        ttsGain: (state.voiceTrackVolume || 100) / 100,
        bgmGain: (state.backgroundTrackVolume || 50) / 100,
        effectGain: 0,
        masterGain: (state.masterGain !== undefined ? state.masterGain : DEFAULT_MIXING_SETTINGS.masterGain),
        fadeIn: state.fadeIn !== undefined ? state.fadeIn : DEFAULT_MIXING_SETTINGS.fadeIn,
        fadeOut: state.fadeOut !== undefined ? state.fadeOut : DEFAULT_MIXING_SETTINGS.fadeOut,
        lowShelf: state.lowShelf !== undefined ? state.lowShelf : DEFAULT_MIXING_SETTINGS.lowShelf,
        midPeaking: state.midPeaking !== undefined ? state.midPeaking : DEFAULT_MIXING_SETTINGS.midPeaking,
        highShelf: state.highShelf !== undefined ? state.highShelf : DEFAULT_MIXING_SETTINGS.highShelf,
        duckingEnabled: state.duckingEnabled !== undefined ? state.duckingEnabled : DEFAULT_MIXING_SETTINGS.duckingEnabled,
        duckDb: state.duckDb !== undefined ? state.duckDb : DEFAULT_MIXING_SETTINGS.duckDb,
        duckThreshold: state.duckThreshold !== undefined ? state.duckThreshold : DEFAULT_MIXING_SETTINGS.duckThreshold,
        duckRelease: state.duckRelease !== undefined ? state.duckRelease : DEFAULT_MIXING_SETTINGS.duckRelease,
        bgmOffset: state.bgmOffset !== undefined ? state.bgmOffset : DEFAULT_MIXING_SETTINGS.bgmOffset,
        ttsOffset: state.ttsOffset !== undefined ? state.ttsOffset : DEFAULT_MIXING_SETTINGS.ttsOffset,
        trimEndSec: state.trimEndSec !== undefined ? state.trimEndSec : DEFAULT_MIXING_SETTINGS.trimEndSec,
      };

      // 라이브 믹싱 노드 생성
      const masterGain = ctx.createGain();
      masterGain.gain.value = settings.masterGain;

      // TTS 경로
      const ttsSource = ctx.createBufferSource();
      ttsSource.buffer = ttsBuffer;
      const ttsGainNode = ctx.createGain();
      ttsGainNode.gain.value = settings.ttsGain;
      ttsSource.connect(ttsGainNode);
      ttsGainNode.connect(masterGain);

      // BGM 경로 with EQ 및 페이드 (BGM 전용)
      if (bgmBuffer) {
        const lowShelf = ctx.createBiquadFilter();
        lowShelf.type = "lowshelf";
        lowShelf.frequency.value = 100;
        lowShelf.gain.value = settings.lowShelf;

        const midPeaking = ctx.createBiquadFilter();
        midPeaking.type = "peaking";
        midPeaking.frequency.value = 1000;
        midPeaking.Q.value = 1;
        midPeaking.gain.value = settings.midPeaking;

        const highShelf = ctx.createBiquadFilter();
        highShelf.type = "highshelf";
        highShelf.frequency.value = 8000;
        highShelf.gain.value = settings.highShelf;

        const bgmGainNode = ctx.createGain();
        bgmGainNode.gain.value = settings.bgmGain;

        // BGM 페이드인 (BGM이 먼저 시작될 때)
        const bgmStartTime = Math.max(0, -settings.bgmOffset);
        let bgmFadeInGain: GainNode | null = null;
        if (settings.fadeIn > 0 && bgmStartTime > 0) {
          bgmFadeInGain = ctx.createGain();
          bgmFadeInGain.gain.setValueAtTime(0.0001, ctx.currentTime + bgmStartTime);
          bgmFadeInGain.gain.exponentialRampToValueAtTime(settings.bgmGain, ctx.currentTime + bgmStartTime + Math.max(0.01, settings.fadeIn));
        }

        // BGM 페이드아웃 (TTS 종료 후)
        const ttsEndTime = ctx.currentTime + settings.ttsOffset + ttsBuffer.duration;
        const bgmEndTime = settings.trimEndSec ? 
          ctx.currentTime + settings.trimEndSec : 
          (ctx.currentTime + bgmStartTime + bgmBuffer.duration);
        let bgmFadeOutGain: GainNode | null = null;
        if (settings.fadeOut > 0) {
          bgmFadeOutGain = ctx.createGain();
          bgmFadeOutGain.gain.setValueAtTime(settings.bgmGain, bgmEndTime - Math.max(0.01, settings.fadeOut));
          bgmFadeOutGain.gain.exponentialRampToValueAtTime(0.0001, bgmEndTime);
        }

        // 연결: lowShelf -> midPeaking -> highShelf -> (fadeIn?) -> bgmGainNode -> (fadeOut?) -> master
        lowShelf.connect(midPeaking);
        midPeaking.connect(highShelf);
        if (bgmFadeInGain) {
          highShelf.connect(bgmFadeInGain);
          bgmFadeInGain.connect(bgmGainNode);
        } else {
          highShelf.connect(bgmGainNode);
        }
        if (bgmFadeOutGain) {
          bgmGainNode.connect(bgmFadeOutGain);
          bgmFadeOutGain.connect(masterGain);
        } else {
          bgmGainNode.connect(masterGain);
        }

        const bgmSource = ctx.createBufferSource();
        bgmSource.buffer = bgmBuffer;
        bgmSource.connect(lowShelf);
        // BGM이 먼저 시작되면 음수 offset 허용
        bgmSource.start(ctx.currentTime + bgmStartTime, Math.max(0, -settings.bgmOffset));
      }

      // TTS 시작 (페이드 없이 바로 연결)
      ttsSource.start(ctx.currentTime + Math.max(0, settings.ttsOffset), Math.max(0, -settings.ttsOffset));

      // 마스터 게인은 상수로 유지 (페이드 없음)
      masterGain.gain.value = settings.masterGain;
      masterGain.connect(ctx.destination);

      setIsMixingPreviewPlaying(true);

      // 재생 완료 시 정리 (TTS 종료 시간 또는 BGM 종료 시간 중 큰 값)
      const ttsEndTimeCalc = ctx.currentTime + settings.ttsOffset + ttsBuffer.duration;
      const bgmEndTimeCalc = settings.trimEndSec ? 
        ctx.currentTime + settings.trimEndSec : 
        (bgmBuffer ? (ctx.currentTime + Math.max(0, -settings.bgmOffset) + bgmBuffer.duration) : ttsEndTimeCalc);
      const totalEndTime = Math.max(ttsEndTimeCalc, bgmEndTimeCalc);
      const endTime = totalEndTime - ctx.currentTime;
      setTimeout(() => {
        setIsMixingPreviewPlaying(false);
        setMixingPreviewProgress(0);
      }, endTime * 1000);

      // 진행률 업데이트
      const startTime = ctx.currentTime;
      const progressInterval = window.setInterval(() => {
        const elapsed = ctx.currentTime - startTime;
        const progress = (elapsed / endTime) * 100;
        setMixingPreviewProgress(Math.min(100, Math.max(0, progress)));
        if (progress >= 100 || !isMixingPreviewPlaying) {
          clearInterval(progressInterval);
        }
      }, 50);

    } catch (error: any) {
      console.error("실시간 미리듣기 오류:", error);
      toast({
        title: "미리듣기 실패",
        description: error.message || "실시간 미리듣기 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      setIsMixingPreviewPlaying(false);
    }
  };

  // 실시간 미리듣기 중지
  const stopRealtimePreview = () => {
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.suspend();
    }
    setIsMixingPreviewPlaying(false);
    setMixingPreviewProgress(0);
  };

  // 실제 믹싱 수행 함수
  const performMixing = async (state: MixingState) => {
    if (!state.selectedVoiceTrack?.audioUrl) {
      toast({
        title: "음원이 선택되지 않았습니다",
        description: "믹싱할 음원을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsMixingAudio(true);
    try {
      // AudioContext 초기화
      const ctx = audioContext || new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
      if (!audioContext) setAudioContext(ctx);

      // 오디오 버퍼 디코딩
      const ttsBuffer = await decodeUrlToBuffer(ctx, state.selectedVoiceTrack.audioUrl);
      let bgmBuffer: AudioBuffer | null = null;
      let effectBuffer: AudioBuffer | null = null;

      // 배경음 디코딩 (URL이 있는 경우만)
      if (state.selectedBackground?.url) {
        bgmBuffer = await decodeUrlToBuffer(ctx, state.selectedBackground.url);
      }

      // MixingSettings 구성
      const settings: MixingSettings = {
        ttsGain: (state.voiceTrackVolume || 100) / 100,
        bgmGain: (state.backgroundTrackVolume || 50) / 100,
        effectGain: 0, // 효과음 제거
        masterGain: (state.masterGain !== undefined ? state.masterGain : DEFAULT_MIXING_SETTINGS.masterGain),
        fadeIn: state.fadeIn !== undefined ? state.fadeIn : DEFAULT_MIXING_SETTINGS.fadeIn,
        fadeOut: state.fadeOut !== undefined ? state.fadeOut : DEFAULT_MIXING_SETTINGS.fadeOut,
        lowShelf: state.lowShelf !== undefined ? state.lowShelf : DEFAULT_MIXING_SETTINGS.lowShelf,
        midPeaking: state.midPeaking !== undefined ? state.midPeaking : DEFAULT_MIXING_SETTINGS.midPeaking,
        highShelf: state.highShelf !== undefined ? state.highShelf : DEFAULT_MIXING_SETTINGS.highShelf,
        duckingEnabled: state.duckingEnabled !== undefined ? state.duckingEnabled : DEFAULT_MIXING_SETTINGS.duckingEnabled,
        duckDb: state.duckDb !== undefined ? state.duckDb : DEFAULT_MIXING_SETTINGS.duckDb,
        duckThreshold: state.duckThreshold !== undefined ? state.duckThreshold : DEFAULT_MIXING_SETTINGS.duckThreshold,
        duckRelease: state.duckRelease !== undefined ? state.duckRelease : DEFAULT_MIXING_SETTINGS.duckRelease,
        bgmOffset: state.bgmOffset !== undefined ? state.bgmOffset : DEFAULT_MIXING_SETTINGS.bgmOffset,
        ttsOffset: state.ttsOffset !== undefined ? state.ttsOffset : DEFAULT_MIXING_SETTINGS.ttsOffset,
        trimEndSec: state.trimEndSec !== undefined ? state.trimEndSec : DEFAULT_MIXING_SETTINGS.trimEndSec,
      };

      // WAV로 내보내기
      const wavBlob = await exportMixToWav(ttsBuffer, bgmBuffer, null, settings);
      const mixedUrl = URL.createObjectURL(wavBlob);
      
      setPreviewMixedAudio(mixedUrl);
      
      // 믹싱 상태 업데이트
      const genId = selectedGenerationForMixing.id;
      setMixingStates((prev) => {
        const current = prev.get(genId) || {
          voiceTrackVolume: 100,
          backgroundTrackVolume: 50,
          effectTrackVolume: 70,
        };
        return new Map(prev).set(genId, {
          ...current,
          mixedAudioUrl: mixedUrl,
        });
      });

      toast({
        title: "믹싱 완료",
        description: "믹싱된 음원이 생성되었습니다.",
      });
    } catch (error: any) {
      console.error("믹싱 오류:", error);
      toast({
        title: "믹싱 실패",
        description: error.message || "믹싱 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsMixingAudio(false);
    }
  };

  const handleMixingSubmit = (form: { background?: string }) => {
    if (!selectedGenerationForMixing?.id) return;
    const genId = selectedGenerationForMixing.id;
    const bg = form.background ? mixingAssetLibrary.find((x) => x.id === form.background) : undefined;
    const mixingState = mixingStates.get(genId) || {
      voiceTrackVolume: 100,
      backgroundTrackVolume: 50,
      effectTrackVolume: 70,
    };
    const selectedVoice = mixingState.selectedVoiceTrack || selectedGenerationForMixing;
    const updated = { 
      ...mixingState, 
      selectedVoiceTrack: selectedVoice,
      selectedBackground: bg || mixingStates.get(genId)?.selectedBackground,
      // 기본값 설정
      masterGain: mixingState.masterGain ?? DEFAULT_MIXING_SETTINGS.masterGain,
      fadeIn: mixingState.fadeIn ?? DEFAULT_MIXING_SETTINGS.fadeIn,
      fadeOut: mixingState.fadeOut ?? DEFAULT_MIXING_SETTINGS.fadeOut,
      lowShelf: mixingState.lowShelf ?? DEFAULT_MIXING_SETTINGS.lowShelf,
      midPeaking: mixingState.midPeaking ?? DEFAULT_MIXING_SETTINGS.midPeaking,
      highShelf: mixingState.highShelf ?? DEFAULT_MIXING_SETTINGS.highShelf,
      duckingEnabled: mixingState.duckingEnabled ?? DEFAULT_MIXING_SETTINGS.duckingEnabled,
      duckDb: mixingState.duckDb ?? DEFAULT_MIXING_SETTINGS.duckDb,
      duckThreshold: mixingState.duckThreshold ?? DEFAULT_MIXING_SETTINGS.duckThreshold,
      duckRelease: mixingState.duckRelease ?? DEFAULT_MIXING_SETTINGS.duckRelease,
      bgmOffset: mixingState.bgmOffset ?? DEFAULT_MIXING_SETTINGS.bgmOffset,
      ttsOffset: mixingState.ttsOffset ?? DEFAULT_MIXING_SETTINGS.ttsOffset,
    };
    setMixingStates((prev) => new Map(prev).set(genId, updated));
    setIsMixingModalOpen(false);
    setPreviewMixedAudio(null);
    toast({ title: "믹싱 설정 저장", description: "믹싱 설정이 저장되었습니다." });
  };

  // WAV 내보내기 함수
  const handleExportMix = async (format: "wav" | "mp3" = "wav") => {
    const state = mixingStates.get(selectedGenerationForMixing?.id);
    if (!state?.mixedAudioUrl) {
      toast({
        title: "내보낼 음원 없음",
        description: "먼저 믹싱된 음원을 생성해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(state.mixedAudioUrl);
      const blob = await response.blob();
      
      if (format === "wav") {
        downloadBlob(blob, `tts_bgm_mix_${Date.now()}.wav`);
      } else {
        // MP3 변환은 서버 API 필요 (현재는 WAV 다운로드)
        toast({
          title: "MP3 변환",
          description: "MP3 변환은 서버 API를 통해 처리됩니다. 현재는 WAV로 다운로드됩니다.",
        });
        downloadBlob(blob, `tts_bgm_mix_${Date.now()}.wav`);
      }

      toast({
        title: "다운로드 완료",
        description: `${format.toUpperCase()} 파일이 다운로드되었습니다.`,
      });
    } catch (error: any) {
      toast({
        title: "다운로드 실패",
        description: error.message || "파일 다운로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleScheduleSubmit = (form: { channel: string; scheduledTime: string; repeatOption: "once" | "daily" | "weekly" }) => {
    if (!selectedGenerationForSchedule?.id) return;
    const newSchedule: ScheduleRequest = {
      id: generateUniqueId(),
      generationId: selectedGenerationForSchedule.id,
      targetChannel: form.channel,
      targetName: scheduleChannels.find((c) => c.value === form.channel)?.label || form.channel,
      scheduledTime: form.scheduledTime,
      repeatOption: form.repeatOption,
      status: "scheduled",
      createdAt: new Date().toISOString(),
      mixingState: mixingStates.get(selectedGenerationForSchedule.id),
    };
    setScheduleRequests((prev) => [newSchedule, ...prev]);
    setIsScheduleModalOpen(false);
    toast({ title: "예약 등록", description: `${newSchedule.targetName}으로 ${form.scheduledTime}에 전송 예약되었습니다.` });
  };

  const getReviewStatus = (generationId: number): ReviewState => {
    return reviewStates.get(generationId) || {
      generationId,
      status: "draft",
      comments: "",
      updatedAt: new Date().toISOString(),
    };
  };

  const updateReviewStatus = (generationId: number, newStatus: ReviewState["status"], comments?: string) => {
    const updated: ReviewState = {
      generationId,
      status: newStatus,
      comments: comments || reviewStates.get(generationId)?.comments || "",
      updatedAt: new Date().toISOString(),
    };
    setReviewStates((prev) => new Map(prev).set(generationId, updated));
    toast({ title: "검수 상태 변경", description: `상태: ${newStatus}` });
  };

  const addOperationLog = (type: OperationLog["type"], message: string, context?: any) => {
    const log: OperationLog = {
      id: generateUniqueId(),
      type,
      message,
      timestamp: new Date().toISOString(),
      context,
      resolved: false,
    };
    setOperationLogs((prev) => [log, ...prev].slice(0, 50)); // 최대 50개 유지
  };

  const fetchUsageStats = async () => {
    try {
      // Mock 데이터 (실제로는 Supabase Edge Function 호출)
      const mockUsage: UsageStats = {
        totalCalls: 1250,
        totalDuration: 18750,
        callsThisMonth: 450,
        durationThisMonth: 6750,
        lastUpdated: new Date().toISOString(),
      };
      setUsageStats(mockUsage);
      addOperationLog("success", "사용량 데이터 업데이트 완료");
    } catch (error: any) {
      addOperationLog("error", `사용량 조회 실패: ${error.message}`);
    }
  };

  const fetchCreditBalance = async () => {
    try {
      // Mock 데이터 (실제로는 Supabase Edge Function 호출)
      const mockCredit: CreditBalance = {
        balance: 45000,
        currency: "KRW",
        lastUpdated: new Date().toISOString(),
      };
      setCreditBalance(mockCredit);
      // 임계치 체크
      if (mockCredit.balance < 10000) {
        addOperationLog("warning", "크레딧 잔액이 부족합니다. 충전이 필요합니다.");
      } else if (mockCredit.balance < 50000) {
        addOperationLog("info", "크레딧 잔액이 50% 이하입니다.");
      }
    } catch (error: any) {
      addOperationLog("error", `크레딧 조회 실패: ${error.message}`);
    }
  };

  const startUsagePolling = () => {
    if (usagePollingRef.current) return; // 이미 실행 중이면 중복 방지
    fetchUsageStats();
    fetchCreditBalance();
    // 30초마다 갱신
    usagePollingRef.current = window.setInterval(() => {
      fetchUsageStats();
      fetchCreditBalance();
    }, 30000);
  };

  const stopUsagePolling = () => {
    if (usagePollingRef.current) {
      window.clearInterval(usagePollingRef.current);
      usagePollingRef.current = null;
    }
  };

  // 데이터 검증 헬퍼 함수
  const validateText = (text: string): { valid: boolean; error?: string } => {
    if (!text || !text.trim()) return { valid: false, error: "텍스트를 입력해주세요" };
    if (text.length > 5000) return { valid: false, error: "텍스트는 5000자 이내여야 합니다" };
    if (text.length < 2) return { valid: false, error: "최소 2자 이상 입력해주세요" };
    return { valid: true };
  };

  const validateFile = (file: File | null): { valid: boolean; error?: string } => {
    if (!file) return { valid: false, error: "파일을 선택해주세요" };
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) return { valid: false, error: "파일 크기는 50MB 이하여야 합니다" };
    if (!["audio/wav", "audio/mpeg", "audio/mp3", "audio/ogg"].includes(file.type)) {
      return { valid: false, error: "WAV, MP3, OGG 파일만 지원됩니다" };
    }
    return { valid: true };
  };

  const validateYoutubeUrl = (url: string): { valid: boolean; error?: string } => {
    if (!url.trim()) {
      return { valid: false, error: "유튜브 링크를 입력해주세요" };
    }
    // 유튜브 URL 패턴 검증
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/)|youtu\.be\/)[\w-]{11}/;
    if (!youtubeRegex.test(url.trim())) {
      return { valid: false, error: "올바른 유튜브 링크를 입력해주세요 (예: https://www.youtube.com/watch?v=... 또는 https://youtu.be/...)" };
    }
    return { valid: true };
  };

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
    
    // 파일 또는 유튜브 링크 중 하나는 필수
    if (cloneForm.sampleType === "youtube") {
      if (!cloneForm.youtubeUrl) {
        return { valid: false, error: "유튜브 링크를 입력해주세요" };
      }
      const youtubeCheck = validateYoutubeUrl(cloneForm.youtubeUrl);
      if (!youtubeCheck.valid) return youtubeCheck;
    } else {
      if (!cloneForm.sampleFile && !cloneForm.sampleName) {
        return { valid: false, error: "샘플 음성 파일을 업로드해주세요" };
      }
      if (cloneForm.sampleFile) {
        const fileCheck = validateFile(cloneForm.sampleFile);
        if (!fileCheck.valid) return fileCheck;
      }
    }
    return { valid: true };
  };

  const validateScheduleForm = (form: any): { valid: boolean; error?: string } => {
    if (!form.channel) return { valid: false, error: "전송 채널을 선택해주세요" };
    if (!form.scheduledTime) return { valid: false, error: "전송 시간을 설정해주세요" };
    const scheduled = new Date(form.scheduledTime);
    const now = new Date();
    if (scheduled < now) return { valid: false, error: "현재보다 미래 시간을 선택해주세요" };
    return { valid: true };
  };

  const handleCloneSubmit = () => {
    const validation = validateCloneForm();
    if (!validation.valid) {
      toast({ title: "입력 오류", description: validation.error, variant: "destructive" });
      addOperationLog("warning", `클론 요청 실패: ${validation.error}`);
      return;
    }

    const base = getVoiceMeta(cloneForm.baseVoiceId);
    // 유튜브 비디오 ID 추출
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
      baseVoiceName: base?.name || getVoiceDisplayName(cloneForm.baseVoiceId),
      language: cloneForm.language || "ko",
      status: "processing",
      createdAt: new Date().toISOString(),
      memo: cloneForm.memo,
      sampleName,
      voiceId,
      voiceName,
      gender: (base as any)?.gender || "neutral",
    };

    setCloneRequests((prev) => [newClone, ...prev]);
    setIsCloneModalOpen(false);
    setCloneForm(createCloneForm({ language: cloneForm.language }));

    toast({ title: "클로닝 요청 접수", description: `${voiceName}를 분석 중입니다.` });
    addOperationLog("info", `클론 생성 시작: ${voiceName}`);

    const timer = window.setTimeout(() => {
      const completionTime = new Date().toISOString();
      const completedClone: CloneRequest = { ...newClone, status: "completed", completedAt: completionTime };
      setCloneRequests((prev) => prev.map((cl) => (cl.id === newClone.id ? completedClone : cl)));
      registerCloneVoice(completedClone);
      toast({ title: "클로닝 완료", description: `${completedClone.voiceName} 음성이 추가되었습니다.` });
      addOperationLog("success", `클론 생성 완료: ${voiceName}`);
    }, 1500);

    cloneTimeoutsRef.current.push(timer);
  };


  const purposeMeta = getPurposeMeta(selectedPurpose);

  const formatDateTime = (iso?: string) => {
    if (!iso) return "-";
    try {
      return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    } catch {
      return iso;
    }
  };

  // 고유 ID 생성 (중복 방지)
  const generateUniqueId = (): number => {
    const base = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return base * 10000 + random;
  };

  const formatErrorDetail = (val: any): string => {
    if (!val) return "";
    if (typeof val === "string") return val;
    try { return JSON.stringify(val); } catch { return String(val); }
  };

  const estimateDurationFromText = (text: string) => {
    const multiplier = getSpeedMultiplier();
    const estimated = text.length * 0.1 / multiplier;
    return Math.round(estimated * 100) / 100;
  };

  const base64ToBlob = (base64: string, mimeType = "audio/mpeg") => {
    const cleanBase64 = base64.includes(",") ? base64.split(",").pop() || "" : base64;
    const decoded = atob(cleanBase64);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  };
  const languageCodeToKo = (code: string) => {
    if (!code) return "-";
    const map: Record<string, string> = { ko: "한국어", en: "영어", ja: "일본어", zh: "중국어", es: "스페인어", fr: "프랑스어", de: "독일어" };
    return map[code] || code;
  };
  const formatLanguagesKo = (lang: string | string[] | undefined) => {
    if (!lang) return "-";
    const arr = Array.isArray(lang) ? lang : [lang];
    return arr.map(languageCodeToKo).join(", ");
  };

  const styleCodeToKo = (style: string) => {
    const map: Record<string, string> = {
      neutral: "중립",
      happy: "밝음",
      sad: "슬픔",
      angry: "분노",
      calm: "차분",
      friendly: "친근",
      professional: "전문",
      excited: "흥분",
      serious: "진지",
      whisper: "속삭임",
      shout: "고성",
      formal: "격식",
      casual: "캐주얼",
      narrative: "서술",
      meme: "밈",
      serene: "평온",
      shy: "수줍음",
      sleepy: "졸림",
      suspicious: "의심",
      confident: "자신감",
      unfriendly: "불친절",
      embarrassed: "당황",
      painful: "고통"
    };
    return map[style] || style;
  };

  const formatStylesKo = (styles: string | string[] | undefined) => {
    if (!styles) return "-";
    const arr = Array.isArray(styles) ? styles : [styles];
    return arr.map(styleCodeToKo).join(", ");
  };

  const genderCodeToKo = (gender?: string) => {
    const map: Record<string, string> = {
      male: "남성",
      female: "여성",
      neutral: "중성",
      child_male: "남아",
      child_female: "여아",
    };
    return gender ? (map[gender] || gender) : "-";
  };

  const useCaseToKo = (useCase?: string) => {
    const map: Record<string, string> = {
      announcement: "공지",
      "public-service": "공공서비스",
      broadcast: "방송",
      education: "교육",
      marketing: "마케팅",
      narration: "내레이션",
      assistant: "어시스턴트",
      news: "뉴스",
      audiobook: "오디오북",
      gaming: "게임",
      advertisement: "광고",
      telephone: "전화",
      meme: "밈",
    };
    return useCase ? (map[useCase] || useCase) : undefined;
  };

  // 우선순위: 한국어 > 영어 > 일본어
  const LANGUAGE_PRIORITY = ["ko", "en", "ja"] as const;
  const normalizeLanguage = (code?: string) => (code || "").toLowerCase().split("-")[0];
  const computeVoiceLanguageRank = (voice: any): number => {
    const langs = Array.isArray(voice?.language) ? voice.language : (voice?.language ? [voice.language] : []);
    const norm = langs.map((l: string) => normalizeLanguage(l));
    for (let i = 0; i < LANGUAGE_PRIORITY.length; i++) {
      if (norm.includes(LANGUAGE_PRIORITY[i])) return i;
    }
    return LANGUAGE_PRIORITY.length + 1;
  };

  const getPreferredSampleUrl = (voice: any): string | null => {
    const samples: any[] = Array.isArray(voice?.samples) ? voice.samples : [];
    for (const lang of LANGUAGE_PRIORITY) {
      const s = samples.find((x) => x?.language === lang && x?.url);
      if (s?.url) return s.url;
    }
    return samples[0]?.url || null;
  };

  const parseSupertoneResponse = async (resp: Response) => {
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
        return {
          blob, // blob 데이터 저장
          duration,
          mimeType,
        };
      }

      if (remoteUrl) {
        const remoteResponse = await fetch(remoteUrl);
        if (!remoteResponse.ok) {
          throw new Error(`오디오 다운로드 실패 (${remoteResponse.status})`);
        }
        const remoteBlob = await remoteResponse.blob();
        const remoteDurationHeader = remoteResponse.headers.get("X-Audio-Length") || remoteResponse.headers.get("x-audio-length");
        const remoteDuration = remoteDurationHeader ? parseFloat(remoteDurationHeader) : null;
        return {
          blob: remoteBlob, // blob 데이터 저장
          duration: duration ?? remoteDuration,
          mimeType: remoteBlob.type || mimeType,
        };
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
    return {
      blob, // blob 데이터 저장
      duration,
      mimeType: blob.type || "audio/mpeg",
    };
  };

  const HISTORY_STORAGE_KEY = "tts_generation_history_v1";
  const FAV_STORAGE_KEY = "tts_favorite_voice_ids_v1";
  const PURPOSE_STORAGE_KEY = "tts_selected_purpose_v1";
  const CLONE_STORAGE_KEY = "tts_clone_requests_v1";
  const MIXING_STORAGE_KEY = "tts_mixing_states_v1";
  const SCHEDULE_STORAGE_KEY = "tts_schedule_requests_v1";
  const REVIEW_STORAGE_KEY = "tts_review_states_v1";
  const MESSAGE_HISTORY_STORAGE_KEY = "tts_message_history_v1";
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const normalized = parsed.map((item: any, index: number) => {
            const purposeId = item.purpose || "announcement";
            const meta = getPurposeMeta(purposeId);
            return {
              id: item.id || generateUniqueId() + index,
              purpose: purposeId,
              purposeLabel: item.purposeLabel || meta.label,
              voiceId: item.voiceId || item.voice_id || "",
              voiceName: item.voiceName || getVoiceDisplayName(item.voiceId || item.voice_id || ""),
              createdAt: item.createdAt || item.created_at || new Date().toISOString(),
              duration: item.duration || null,
              status: item.status || (item.hasAudio === false ? "mock" : "ready"),
              hasAudio: typeof item.hasAudio === "boolean" ? item.hasAudio : true,
              language: item.language || "",
              textPreview: item.textPreview || item.text || "",
              cacheKey: item.cacheKey || item.key || "",
              savedName: item.savedName || null,
              audioUrl: (() => {
                // cacheKey가 있으면 cacheRef에서 blob 데이터로부터 새 blob URL 생성
                if (item.cacheKey || item.key) {
                  const cached = cacheRef.current.get(item.cacheKey || item.key || "");
                  if (cached?.blob) {
                    // blob 데이터가 있으면 새 blob URL 생성
                    if (!cached._audioUrl) {
                      const newUrl = URL.createObjectURL(cached.blob);
                      cacheRef.current.set(item.cacheKey || item.key || "", { ...cached, _audioUrl: newUrl });
                      return newUrl;
                    }
                    return cached._audioUrl;
                  }
                  // blob 데이터가 없으면 기존 audioUrl 사용 (구형 호환)
                  if (cached?._audioUrl) return cached._audioUrl;
                }
                // cacheKey가 없거나 cacheRef에 없으면 기존 audioUrl 사용
                return item.audioUrl || null;
              })(),
            };
          });
          setGenerationHistory(normalized);
        }
      }
      const favRaw = localStorage.getItem(FAV_STORAGE_KEY);
      if (favRaw) {
        const ids: string[] = JSON.parse(favRaw);
        if (Array.isArray(ids)) setFavoriteVoiceIds(new Set(ids));
      }
      const purposeRaw = localStorage.getItem(PURPOSE_STORAGE_KEY);
      if (purposeRaw) {
        setSelectedPurpose(purposeRaw);
      }
      const cloneRaw = localStorage.getItem(CLONE_STORAGE_KEY);
      if (cloneRaw) {
        const parsed = JSON.parse(cloneRaw);
        if (Array.isArray(parsed)) {
          const normalized: CloneRequest[] = parsed.map((item: any, index: number) => {
            const id = item.id || generateUniqueId() + index;
            const baseId = item.baseVoiceId || item.base_voice_id || "";
            const baseName = item.baseVoiceName || item.base_voice_name || getVoiceDisplayName(baseId);
            const status = item.status === "processing" ? "processing" : "completed";
            return {
              id,
              targetName: item.targetName || item.target_name || baseName || `클론 음성 ${index + 1}`,
              baseVoiceId: baseId,
              baseVoiceName: baseName,
              language: item.language || "ko",
              status,
              createdAt: item.createdAt || item.created_at || new Date().toISOString(),
              completedAt: item.completedAt || item.completed_at,
              memo: item.memo || "",
              sampleName: item.sampleName || item.sample_name || "",
              voiceId: item.voiceId || item.voice_id || `clone_${id}`,
              voiceName: item.voiceName || item.voice_name || `${baseName} 클론`,
              gender: item.gender || undefined,
            };
          });
          setCloneRequests(normalized);
          normalized
            .filter((clone) => clone.status === "completed" || !clone.status)
            .forEach((clone) => registerCloneVoice({ ...clone, status: "completed" }));
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (selectedPurpose) {
        localStorage.setItem(PURPOSE_STORAGE_KEY, selectedPurpose);
      }
    } catch {}
  }, [selectedPurpose]);

  useEffect(() => {
    try {
      localStorage.setItem(CLONE_STORAGE_KEY, JSON.stringify(cloneRequests));
    } catch {}
  }, [cloneRequests]);

  useEffect(() => {
    try {
      const messageHistoryRaw = localStorage.getItem(MESSAGE_HISTORY_STORAGE_KEY);
      if (messageHistoryRaw) {
        const parsed = JSON.parse(messageHistoryRaw);
        if (Array.isArray(parsed)) {
          setMessageHistory(parsed.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const mixingRaw = localStorage.getItem(MIXING_STORAGE_KEY);
      if (mixingRaw) {
        const data = JSON.parse(mixingRaw);
        const map = new Map(Object.entries(data));
        setMixingStates(map as any);
      }
      const scheduleRaw = localStorage.getItem(SCHEDULE_STORAGE_KEY);
      if (scheduleRaw) {
        const parsed = JSON.parse(scheduleRaw);
        if (Array.isArray(parsed)) setScheduleRequests(parsed);
      }
      const reviewRaw = localStorage.getItem(REVIEW_STORAGE_KEY);
      if (reviewRaw) {
        const data = JSON.parse(reviewRaw);
        const map = new Map(Object.entries(data).map(([k, v]: [string, any]) => [parseInt(k), v]) as any);
        setReviewStates(map as any);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(MIXING_STORAGE_KEY, JSON.stringify(Object.fromEntries(mixingStates)));
      localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(scheduleRequests));
      localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(Object.fromEntries(reviewStates)));
    } catch {}
  }, [mixingStates, scheduleRequests, reviewStates]);

  const pushHistory = (entry: any) => {
    try {
      const next = [entry, ...generationHistory].slice(0, 100);
      setGenerationHistory(next);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  // 음원 삭제 확인
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });

  // 음원 삭제
  const deleteGeneration = (id: number) => {
    const updated = generationHistory.filter((g) => g.id !== id);
    setGenerationHistory(updated);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    setDeleteConfirmDialog({ open: false, id: null });
    toast({
      title: "음원 삭제 완료",
      description: "생성 기록이 삭제되었습니다.",
    });
  };

  // 음원 이름 편집
  const editGenerationName = (id: number, newName: string | null) => {
    const updated = generationHistory.map((g) =>
      g.id === id ? { ...g, savedName: newName } : g
    );
    setGenerationHistory(updated);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    setEditingGenerationId(null);
    setEditNameInput("");
    toast({
      title: "이름 변경 완료",
      description: newName ? `"${newName}"으로 변경되었습니다.` : "이름이 제거되었습니다.",
    });
  };

  // 음원 다운로드
  const downloadGeneration = async (entry: any) => {
    try {
      let audioUrl = entry.audioUrl;
      let blob: Blob | null = null;
      
      if (entry.cacheKey) {
        const cached = cacheRef.current.get(entry.cacheKey);
        if (cached?.blob) {
          blob = cached.blob;
        } else if (cached?._audioUrl) {
          audioUrl = cached._audioUrl;
        }
      }

      if (!blob && !audioUrl) {
        toast({
          title: "다운로드 불가",
          description: "오디오 파일을 찾을 수 없습니다.",
          variant: "destructive",
        });
        return;
      }

      const downloadBlob = blob || (audioUrl ? await fetch(audioUrl).then(r => r.blob()) : null);
      if (!downloadBlob) {
        toast({
          title: "다운로드 실패",
          description: "오디오 파일을 다운로드할 수 없습니다.",
          variant: "destructive",
        });
        return;
      }
      
      const url = URL.createObjectURL(downloadBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${entry.savedName || formatDateTime(entry.createdAt)}.mp3`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "다운로드 완료",
        description: "음원 파일이 다운로드되었습니다.",
      });
    } catch (error: any) {
      toast({
        title: "다운로드 실패",
        description: error.message || "파일 다운로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const buildGenerationKey = (params: {
    text: string;
    voiceId: string;
    language: string;
    model: string;
    style: string;
    speed: number;
    pitchShift: number;
  }) => {
    const { text, voiceId, language, model, style, speed, pitchShift } = params;
    return [voiceId, language, model, style, speed.toFixed(2), pitchShift, text].join("::");
  };

  const toggleFavorite = (voiceId: string) => {
    setFavoriteVoiceIds(prev => {
      const next = new Set(prev);
      if (next.has(voiceId)) next.delete(voiceId); else next.add(voiceId);
      try { localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  };

  const languageCodeToFlag = (code: string) => {
    const map: Record<string, string> = { ko: "🇰🇷", en: "🇺🇸", ja: "🇯🇵" };
    return map[code] || "";
  };

  const fetchWithSupabaseProxy = useCallback(async (path: string, init?: RequestInit) => {
    try {
      const headers = new Headers(init?.headers as HeadersInit | undefined);
      if (init?.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      if (SUPABASE_ANON_KEY) {
        headers.set("Authorization", `Bearer ${SUPABASE_ANON_KEY}`);
      }
      const response = await fetch(`${SUPABASE_PROXY_BASE_URL}${path}`, {
        ...init,
        headers,
      });
      return response;
    } catch (error: any) {
      // AbortError는 정상 흐름(이전 요청 취소)으로 간주하고 로그를 남기지 않음
      if (error?.name !== "AbortError") {
      console.warn("Supabase 프록시 호출 실패:", error);
      }
      return null;
    }
  }, []);

  const cleanupGeneratedAudioUrl = (url: string | null) => {
    if (url && url.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        console.warn("blob URL 해제 실패:", error);
      }
    }
  };

  useEffect(() => {
    return () => {
      cleanupGeneratedAudioUrl(generatedAudio);
    };
  }, [generatedAudio]);

  // 고급 음성 설정 상태
  const [voiceSettings, setVoiceSettings] = useState({
    emotion: {
      type: "general",
      preset: "A",
      customPrompt: "",
      tags: ["#명료하게", "#따뜻하게", "#추궁하듯", "#넋을 잃은 듯", "#귀찮은 듯"]
    },
    readingSpeed: {
      preset: "보통",
      customTime: "1.0"
    },
    pause: {
      duration: 0.1,
      segments: [] as Array<{ position: number; duration: number }>
    },
    endingTone: {
      mode: "auto"
    },
    playbackSpeed: 1.0,
    pitch: 0
  });

  // 공공기관 특화 음성 템플릿
  const voiceTemplates = {
    greeting: [
      {
        id: "mayor_greeting",
        title: "시장 인사말",
        description: "신년, 지역축제 등 주요 행사 인사말",
        template: "안녕하십니까. {기관명} 시장 {담당자명}입니다. {이벤트명}을 맞이하여 시민 여러분께 인사드립니다. 항상 시민의 행복과 지역발전을 위해 최선을 다하겠습니다. 감사합니다.",
        category: "인사말",
        icon: Users
      },
      {
        id: "governor_greeting",
        title: "도지사 인사말",
        description: "도정 주요 정책 발표 및 인사말",
        template: "안녕하십니까. {기관명} 도지사 {담당자명}입니다. {정책명} 정책을 통해 도민 여러분의 삶의 질 향상에 최선을 다하겠습니다. 여러분의 소중한 의견과 참여를 부탁드립니다.",
        category: "인사말",
        icon: Building2
      },
      {
        id: "institute_director_greeting",
        title: "연구원장 인사말",
        description: "연구기관 주요 성과 발표 및 인사말",
        template: "안녕하십니까. {기관명} 원장 {담당자명}입니다. {연구분야} 연구를 통해 지역사회와 국가발전에 기여하겠습니다. 앞으로도 지속적인 연구개발을 통해 혁신을 이끌어가겠습니다.",
        category: "인사말",
        icon: Users
      }
    ],
    announcement: [
      {
        id: "emergency_announcement",
        title: "긴급 안내방송",
        description: "재난, 비상상황 시 긴급 안내",
        template: "긴급 안내입니다. {기관명}에서 알려드립니다. {상황설명}으로 인해 {대응방안}을 시행합니다. 시민 여러분께서는 {행동지침}을 따라주시기 바랍니다. 자세한 사항은 {연락처}로 문의해주세요.",
        category: "안내방송",
        icon: Megaphone
      },
      {
        id: "service_announcement",
        title: "서비스 안내",
        description: "공공서비스 이용 안내",
        template: "{기관명}에서 안내드립니다. {서비스명} 서비스가 {변경사항}으로 운영됩니다. 이용시간은 {운영시간}이며, 문의사항은 {연락처}로 연락주시기 바랍니다.",
        category: "안내방송",
        icon: MessageSquare
      },
      {
        id: "event_announcement",
        title: "행사 안내",
        description: "지역 행사 및 문화프로그램 안내",
        template: "{기관명}에서 알려드립니다. {행사명}이 {일시}에 {장소}에서 개최됩니다. {행사내용}을 준비하였으니 많은 참여 부탁드립니다. 자세한 사항은 {연락처}로 문의해주세요.",
        category: "안내방송",
        icon: Calendar
      }
    ],
    policy: [
      {
        id: "policy_announcement",
        title: "정책 발표",
        description: "새로운 정책 및 제도 안내",
        template: "{기관명}에서 새로운 정책을 발표합니다. {정책명}을 통해 {정책목표}를 달성하고자 합니다. {정책내용}으로 운영되며, {적용대상}에게 혜택이 제공됩니다. 자세한 내용은 {홈페이지}에서 확인하실 수 있습니다.",
        category: "정책안내",
        icon: FileText
      }
    ]
  };

  // 공공기관 특화 음성 스타일
  const voiceStyles = [
    {
      id: "formal_male",
      name: "정중한 남성",
      description: "도지사, 시장 등 지자체장용",
      category: "지자체장",
      icon: Building2
    },
    {
      id: "formal_female",
      name: "정중한 여성",
      description: "부시장, 부지사 등 부단체장용",
      category: "부단체장",
      icon: Users
    },
    {
      id: "professional_male",
      name: "전문적인 남성",
      description: "연구원장, 공단 이사장용",
      category: "기관장",
      icon: Users
    },
    {
      id: "professional_female",
      name: "전문적인 여성",
      description: "연구소장, 공사 사장용",
      category: "기관장",
      icon: Users
    },
    {
      id: "friendly_male",
      name: "친근한 남성",
      description: "일반 안내방송용",
      category: "안내방송",
      icon: Megaphone
    },
    {
      id: "friendly_female",
      name: "친근한 여성",
      description: "일반 안내방송용",
      category: "안내방송",
      icon: Megaphone
    }
  ];

  // 템플릿에서 변수 추출
  const extractVariables = (templateText: string): string[] => {
    const matches = templateText.match(/\{([^}]+)\}/g);
    if (!matches) return [];
    return Array.from(new Set(matches.map(m => m.replace(/[{}]/g, '').trim())));
  };

  // 변수 값으로 템플릿 교체
  const replaceTemplateWithVariables = (templateText: string, variables: Record<string, string>): string => {
    return templateText.replace(/\{([^}]+)\}/g, (_, key) => {
      const k = String(key).trim();
      return variables[k] || `{${k}}`;
    });
  };

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template.id);
    setSelectedTemplateObj(template);
    
    // 템플릿에서 변수 추출
    const variables = extractVariables(template.template);
    
    // 기본값 설정
    const defaultValues: Record<string, string> = {
      "기관명": user?.organization || "강원특별자치도청",
      "담당자명": (user as any)?.full_name || (user as any)?.name || (user as any)?.email?.split("@")[0] || "김철수",
      "부서명": user?.department || "관계 부서",
      "연락처": "",
      "홈페이지": "",
      "이벤트명": "",
      "정책명": "",
      "정책목표": "",
      "정책내용": "",
      "적용대상": "",
      "상황설명": "",
      "대응방안": "",
      "행동지침": "",
      "일시": new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
      "장소": "",
      "연구분야": "",
      "서비스명": "",
      "변경사항": "",
      "운영시간": "",
      "행사명": "",
      "행사내용": "",
    };
    
    // 추출된 변수들의 기본값 설정
    const initialVariables: Record<string, string> = {};
    variables.forEach(v => {
      initialVariables[v] = defaultValues[v] || "";
    });
    
    setTemplateVariables(initialVariables);
    
    // 초기 텍스트 생성
    const replaced = replaceTemplateWithVariables(template.template, initialVariables);
    setCustomText(replaced);
  };

  // 변수 값 변경 핸들러
  const handleVariableChange = (variableName: string, value: string) => {
    const updated = { ...templateVariables, [variableName]: value };
    setTemplateVariables(updated);
    
    // 템플릿 재생성
    if (selectedTemplateObj) {
      const replaced = replaceTemplateWithVariables(selectedTemplateObj.template, updated);
      setCustomText(replaced);
    }
  };

  // Supertone API에서 음성 목록 가져오기 (Supabase Edge Function 프록시 사용)
  // 공식 레퍼런스: https://docs.supertoneapi.com/en/api-reference/endpoints/list-voices
  const fetchVoices = async (showToast = true) => {
    if (showToast) {
      toast({
        title: "모든 음성 가져오는 중...",
        description: "음성 목록을 불러오고 있습니다. 잠시만 기다려주세요.",
      });
    }
    setIsLoadingVoices(true);
    setVoiceLoadingProgress(0);
    let voicesLoaded = false;
    try {
      // 프록시를 통해 GET /v1/voices 호출 (최대 100개 요청)
      const response = await fetchWithSupabaseProxy("/voices?limit=100", { method: "GET" });
      if (response?.ok) {
        const data = await response.json();
        // 응답 형식: { items: [], total: 150, nextPageToken: "..." } 또는 배열/기타 필드
        const voices = data.items || (Array.isArray(data) ? data : (data.voices || data.data || []));
        setAllVoices(voices);
        setAvailableVoices(voices);
        const nextToken = data.nextPageToken || data.next_page_token || data.next_token || null;
        setVoiceNextToken(nextToken || null);
        const total = data.total || data.totalCount || null;
        setVoiceTotalCount(total);
        console.log(`✅ 음성 목록 로드 성공(프록시): ${voices.length}개`);
        voicesLoaded = true;
        
        // 진행률 계산 (초기 로드 완료)
        if (total && total > 0) {
          setVoiceLoadingProgress(Math.min(100, Math.round((voices.length / total) * 100)));
        } else {
          // total이 없으면 10%로 설정 (초기 로드 완료 표시)
          setVoiceLoadingProgress(10);
        }
        
        // 초기 로드시 전체 자동 로드 (더 많은 페이지)
        if (nextToken) {
          if (showToast) {
            toast({
              title: "전체 음성 로드 중...",
              description: `초기 ${voices.length}개 로드 완료. 나머지 음성들을 불러오고 있습니다.`,
            });
          }
          await autoLoadVoicesThrottled(100, 150, showToast);
        } else {
          // nextToken이 없으면 이미 모든 음성 로드 완료
          setVoiceLoadingProgress(100);
          if (showToast) {
            toast({
              title: "모든 음성 로드 완료",
              description: `총 ${voices.length}개의 음성을 불러왔습니다.`,
            });
          }
        }
      } else if (response) {
        console.warn("음성 목록 로드 실패(프록시):", await response.text());
        setVoiceLoadingProgress(0);
        if (showToast) {
          toast({
            title: "음성 로드 실패",
            description: "음성 목록을 불러올 수 없습니다. 다시 시도해주세요.",
            variant: "destructive",
          });
        }
      }
    } catch (e: any) {
      console.warn("음성 목록 로드 예외(프록시):", e.message);
      setVoiceLoadingProgress(0);
      if (showToast) {
        toast({
          title: "음성 로드 오류",
          description: e.message || "음성 목록을 불러오는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    }

    if (!voicesLoaded) {
      console.warn("⚠️ 음성 목록을 가져올 수 없어 기본 목록을 사용합니다.");
      setAvailableVoices([]);
      setVoiceLoadingProgress(0);
    }

    setIsLoadingVoices(false);
  };

  const buildVoiceQueryPath = (filters: typeof voiceFilters, extra: Record<string, string> = {}) => {
    const params = new URLSearchParams();
    if (filters.language) params.set("language", filters.language);
    if (filters.name) params.set("name", filters.name);
    if (filters.gender) params.set("gender", filters.gender);
    if (extra.limit) params.set("limit", extra.limit);
    if (extra.pageToken) params.set("pageToken", extra.pageToken);
    if (extra.nextPageToken) params.set("nextPageToken", extra.nextPageToken);
    // 스타일/용도는 upstream에서 미지원일 수 있어 잠시 제외
    const queryString = params.toString();
    // Supertone API는 /voices에 쿼리 파라미터로 필터링하는 형태로 가정
    return queryString ? `/voices?${queryString}` : "/voices";
  };

  const isAllFilters = (filters: typeof voiceFilters) => {
    return !filters.language && !filters.style && !filters.name && !filters.gender && !filters.useCase;
  };

  const searchVoices = useCallback(async () => {
    setIsSearchingVoices(true);
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const path = buildVoiceQueryPath(voiceFilters, { limit: "100" });
    try {
      const response = await fetchWithSupabaseProxy(path, { method: "GET", signal: controller.signal as any });
      if (response?.ok) {
        const data = await response.json();
        const results = data.items || (Array.isArray(data) ? data : (data.voices || data.data || []));
        // 마스터 목록 갱신 후 필터 적용
        setAllVoices(results);
        setAvailableVoices(results);
        // 클라이언트 필터링 적용
        const filtered = applyClientFilters(results, voiceFilters);
        setVoiceSearchResults(filtered);
        const nextToken = data.nextPageToken || data.next_page_token || data.next_token || null;
        setVoiceNextToken(nextToken || null);
        const total = data.total || data.totalCount || null;
        setVoiceTotalCount(total);
        console.log(`✅ 음성 검색 성공(프록시): ${results.length}개`);
        // 모든 필터가 전체이면 즉시 전체 로드하여 개수 일치시키기
        if (nextToken && isAllFilters(voiceFilters)) {
          await autoLoadVoicesThrottled(50, 0);
        } else if (nextToken) {
          // 그 외에는 완화된 속도로 배경 로드
          autoLoadVoicesThrottled(5, 300);
        }
      } else if (response) {
        console.warn("음성 검색 실패(프록시):", await response.text());
        setVoiceSearchResults([]);
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
      console.warn("음성 검색 예외(프록시):", error.message);
    }
    } finally {
      setIsSearchingVoices(false);
    }
  }, [voiceFilters, fetchWithSupabaseProxy]);

  const loadMoreVoices = async (token?: string | null) => {
    const useToken = token ?? voiceNextToken;
    if (!useToken) return { nextToken: null } as const;
    // 전체 로드 시에는 필터 없이 로드
    const path = isAllFilters(voiceFilters) 
      ? `/voices?limit=100&pageToken=${useToken}`
      : buildVoiceQueryPath(voiceFilters, { limit: "100", nextPageToken: useToken as string, pageToken: useToken as string });
    const response = await fetchWithSupabaseProxy(path, { method: "GET" });
    if (response?.ok) {
      let data: any = {};
      try { data = await response.json(); } catch {}
      const results = data.items || (Array.isArray(data) ? data : (data.voices || data.data || []));
      if (results?.length) {
        setAllVoices(prev => {
          // 중복 제거
          const existingIds = new Set(prev.map((v: any) => v.voice_id));
          const newVoices = results.filter((v: any) => !existingIds.has(v.voice_id));
          return [...prev, ...newVoices];
        });
        setAvailableVoices(prev => {
          // 중복 제거
          const existingIds = new Set(prev.map((v: any) => v.voice_id));
          const newVoices = results.filter((v: any) => !existingIds.has(v.voice_id));
          return [...prev, ...newVoices];
        });
        setVoiceSearchResults(prev => {
          const filtered = applyClientFilters(results, voiceFilters);
          const existingIds = new Set(prev.map((v: any) => v.voice_id));
          const newResults = filtered.filter((v: any) => !existingIds.has(v.voice_id));
          return [...prev, ...newResults];
        });
      }
      const nextToken = data.nextPageToken || data.next_page_token || data.next_token || null;
      setVoiceNextToken(nextToken || null);
      const total = data.total || data.totalCount || null;
      if (total) setVoiceTotalCount(total);
      return { nextToken: nextToken || null } as const;
    }
    return { nextToken: null } as const;
  };

  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

  const autoLoadVoicesThrottled = async (maxPages = 5, delayMs = 300, showToast = false) => {
    if (isAutoLoadingRef.current) return;
    isAutoLoadingRef.current = true;
    try {
      let pages = 0;
      let token: string | null = voiceNextToken;
      const startCount = allVoices.length;
      const total = voiceTotalCount;
      
      while (token && pages < maxPages) {
        const beforeCount = allVoices.length;
        const { nextToken } = await loadMoreVoices(token);
        token = nextToken;
        pages++;
        
        // 진행률 업데이트 (상태 업데이트 후 약간의 딜레이로 최신 값 반영)
        await sleep(10); // 상태 업데이트 대기
        const currentCount = allVoices.length;
        if (total && total > 0) {
          const progress = Math.min(100, Math.round((currentCount / total) * 100));
          setVoiceLoadingProgress(progress);
        } else {
          // total이 없으면 페이지 수 기반으로 대략적인 진행률 계산
          const estimatedProgress = Math.min(95, 10 + (pages / maxPages) * 85);
          setVoiceLoadingProgress(estimatedProgress);
        }
        
        if (!token) break;
        await sleep(delayMs);
      }
      
      // 모든 음성 로드 완료 시 토스트 표시 및 진행률 100% 설정
      await sleep(50); // 최종 상태 업데이트 대기
      if (!token) {
        setVoiceLoadingProgress(100);
        if (showToast) {
          const finalCount = allVoices.length;
          toast({
            title: "모든 음성 로드 완료",
            description: `총 ${finalCount}개의 음성을 모두 불러왔습니다.`,
          });
        }
        // 즐겨찾기 음성 자동 로드
        if (favoriteVoiceIds.size > 0) {
          setTimeout(() => {
            loadFavoriteVoices();
          }, 500);
        }
      } else if (showToast && token) {
        // maxPages에 도달했지만 아직 더 있음
        const currentCount = allVoices.length;
        const total = voiceTotalCount;
        if (total && total > 0) {
          const progress = Math.min(95, Math.round((currentCount / total) * 100));
          setVoiceLoadingProgress(progress);
        }
        toast({
          title: "음성 로드 진행 중",
          description: `${currentCount}개의 음성을 불러왔습니다. (최대 ${maxPages * 100}개까지 로드)`,
        });
      }
    } finally {
      isAutoLoadingRef.current = false;
    }
  };

  // 모달 열릴 때 최초 1회 검색 + 필터 변경 시 디바운스 검색
  useEffect(() => {
    if (!isVoiceFinderOpen) return;
    const timer = setTimeout(() => {
      searchVoices();
    }, 300);
    return () => clearTimeout(timer);
  }, [isVoiceFinderOpen, voiceFilters, searchVoices]);

  const applyClientFilters = (voices: any[], filters: typeof voiceFilters) => {
    const filtered = voices.filter((v) => {
      // 언어
      if (filters.language) {
        const langs = Array.isArray(v.language) ? v.language : (v.language ? [v.language] : []);
        const norm = langs.map((l: string) => normalizeLanguage(l));
        if (!norm.includes(filters.language)) return false;
      }
      // 이름 부분 검색
      if (filters.name) {
        const needle = filters.name.toLowerCase();
        const name = (v.name || v.voice_id || "").toLowerCase();
        if (!name.includes(needle)) return false;
      }
      // 성별
      if (filters.gender) {
        if ((v.gender || "") !== filters.gender) return false;
      }
      // 스타일
      if (filters.style) {
        const styles = Array.isArray(v.styles) ? v.styles : (v.styles ? [v.styles] : []);
        const stylesNorm = styles.map((s: string) => (s || "").toLowerCase());
        if (!stylesNorm.includes(filters.style)) return false;
      }
      // 용도
      if (filters.useCase) {
        const raw = v.use_case ?? v.useCase ?? v.usecases ?? v.useCases ?? "";
        const normalizeUseCase = (val: string) => (val || "").toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
        if (Array.isArray(raw)) {
          const vals = raw.map((x: any) => normalizeUseCase(String(x)));
          if (!vals.includes(normalizeUseCase(filters.useCase))) return false;
        } else if (typeof raw === "string") {
          if (normalizeUseCase(raw) !== normalizeUseCase(filters.useCase)) return false;
        } else {
          return false;
        }
      }
      return true;
    });
    // 언어 우선순위로 정렬: ko > en > ja > 기타
    return filtered.sort((a, b) => computeVoiceLanguageRank(a) - computeVoiceLanguageRank(b));
  };

  useEffect(() => {
    // 필터 변경 시 클라이언트 필터 적용
    if (allVoices.length > 0) {
      setVoiceSearchResults(applyClientFilters(allVoices, voiceFilters));
    }
    // 필터 변경 시 완화된 배경 로드
    if (isVoiceFinderOpen && voiceNextToken) {
      autoLoadVoicesThrottled(5, 300);
    }
  }, [voiceFilters, allVoices]);

  // 언마운트/모달 닫힘 시 진행 중 요청 중단 및 검색 상태 정리
  useEffect(() => {
    if (!isVoiceFinderOpen && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    setIsSearchingVoices(false);
      // 오디오 정리
      if (audioSampleRef.current) {
        audioSampleRef.current.pause();
        audioSampleRef.current.currentTime = 0;
        setPlayingSample(null);
      }
    }
  }, [isVoiceFinderOpen]);

  // playingSample이 변경될 때 오디오 재생 관리
  useEffect(() => {
    const audio = audioSampleRef.current;
    if (!audio) return;

    if (playingSample) {
      // src가 변경되었으면 로드
      const url = playingSample;
      if (audio.src !== url) {
        audio.src = url;
      }
      
      // 재생 시작 (Promise 처리)
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise
          .catch((err) => {
            // AbortError는 무시 (다른 오디오 재생으로 인한 중단)
            // NotAllowedError는 사용자가 미디어 재생을 허용하지 않은 경우
            if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
              console.error('Audio play error:', err);
              setPlayingSample(null);
            }
          });
      }
    } else {
      // playingSample이 null이면 정지
      audio.pause();
      audio.currentTime = 0;
    }
  }, [playingSample]);

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      cloneTimeoutsRef.current.forEach((timer) => window.clearTimeout(timer));
      cloneTimeoutsRef.current = [];
      stopUsagePolling();
    };
  }, []);


  // 즐겨찾기된 음성들을 로드하는 함수 (allVoices와 availableVoices를 직접 참조)
  const loadFavoriteVoices = useCallback(async () => {
    if (favoriteVoiceIds.size === 0) return;
    
    // 현재 상태에서 누락된 즐겨찾기 음성 ID 찾기
    const missingVoiceIds = Array.from(favoriteVoiceIds).filter((vid) => {
      return !availableVoices.find((v: any) => v.voice_id === vid) && 
             !allVoices.find((v: any) => v.voice_id === vid);
    });
    
    if (missingVoiceIds.length === 0) {
      // allVoices에는 있지만 availableVoices에는 없는 경우 추가
      const foundInAll = allVoices.filter((v: any) => 
        favoriteVoiceIds.has(v.voice_id) && 
        !availableVoices.find((av: any) => av.voice_id === v.voice_id)
      );
      if (foundInAll.length > 0) {
        setAvailableVoices((prev) => {
          const existingIds = new Set(prev.map((v: any) => v.voice_id));
          const newVoices = foundInAll.filter((v: any) => !existingIds.has(v.voice_id));
          if (newVoices.length > 0) {
            console.log(`✅ 즐겨찾기 음성 ${newVoices.length}개를 availableVoices에 추가`);
            return [...prev, ...newVoices];
          }
          return prev;
        });
      }
      console.log("✅ 모든 즐겨찾기 음성이 이미 로드되어 있습니다.");
      return;
    }
    
    console.log(`즐겨찾기된 음성 ${missingVoiceIds.length}개를 로드합니다.`);
    
    try {
      // API에서 로드 시도
      const response = await fetchWithSupabaseProxy("/voices?limit=1000", { method: "GET" });
      if (response?.ok) {
        const data = await response.json();
        const voices = data.items || (Array.isArray(data) ? data : (data.voices || data.data || []));
        const favoriteVoices = voices.filter((v: any) => missingVoiceIds.includes(v.voice_id));
        
        if (favoriteVoices.length > 0) {
          // allVoices에 추가
          setAllVoices((prev) => {
            const existingIds = new Set(prev.map((v: any) => v.voice_id));
            const newVoices = favoriteVoices.filter((v: any) => !existingIds.has(v.voice_id));
            if (newVoices.length > 0) {
              console.log(`✅ 즐겨찾기 음성 ${newVoices.length}개를 allVoices에 추가`);
              return [...prev, ...newVoices];
            }
            return prev;
          });
          
          // availableVoices에도 추가
          setAvailableVoices((prev) => {
            const existingIds = new Set(prev.map((v: any) => v.voice_id));
            const newVoices = favoriteVoices.filter((v: any) => !existingIds.has(v.voice_id));
            if (newVoices.length > 0) {
              console.log(`✅ 즐겨찾기 음성 ${newVoices.length}개를 availableVoices에 추가`);
              return [...prev, ...newVoices];
            }
            return prev;
          });
          
          console.log(`✅ 즐겨찾기 음성 ${favoriteVoices.length}개 로드 완료`);
        } else {
          console.warn(`⚠️ 즐겨찾기된 음성 ${missingVoiceIds.length}개를 찾을 수 없습니다.`);
        }
      } else {
        console.warn("즐겨찾기 음성 로드 API 실패:", response?.status);
      }
    } catch (e: any) {
      console.warn("즐겨찾기 음성 로드 실패:", e.message);
    }
  }, [favoriteVoiceIds, fetchWithSupabaseProxy, allVoices, availableVoices]);

  // 컴포넌트 마운트 시 음성 목록 로드
  useEffect(() => {
    fetchVoices();
    startUsagePolling();
  }, []);

  // allVoices 변경 시 진행률 업데이트 (자동 로드 중일 때)
  useEffect(() => {
    if (isAutoLoadingRef.current && isLoadingVoices && voiceTotalCount) {
      const progress = Math.min(100, Math.round((allVoices.length / voiceTotalCount) * 100));
      setVoiceLoadingProgress(progress);
    }
  }, [allVoices.length, voiceTotalCount, isLoadingVoices]);

  // 즐겨찾기가 로드된 후 또는 음성 목록이 로드된 후 즐겨찾기 음성 자동 확인 및 로드
  useEffect(() => {
    if (favoriteVoiceIds.size > 0 && allVoices.length > 0 && !isLoadingVoices) {
      // 모든 음성 로드가 완료된 후 즐겨찾기 음성 확인
      // 약간의 딜레이 후 로드 (초기 로드 완료 대기)
      const timer = setTimeout(() => {
        // allVoices에서 이미 로드되었는지 확인
        const missingCount = Array.from(favoriteVoiceIds).filter((vid) => {
          return !allVoices.find((v: any) => v.voice_id === vid);
        }).length;
        
        if (missingCount > 0) {
          console.log(`즐겨찾기 음성 ${missingCount}개가 아직 로드되지 않았습니다. 로드 시도...`);
          loadFavoriteVoices();
        } else {
          console.log("✅ 모든 즐겨찾기 음성이 이미 로드되어 있습니다.");
          // availableVoices에도 추가되어 있는지 확인
          setAvailableVoices((prev) => {
            const missingInAvailable = Array.from(favoriteVoiceIds).filter((vid) => {
              return !prev.find((v: any) => v.voice_id === vid) && 
                     allVoices.find((v: any) => v.voice_id === vid);
            });
            if (missingInAvailable.length > 0) {
              const voicesToAdd = allVoices.filter((v: any) => missingInAvailable.includes(v.voice_id));
              return [...prev, ...voicesToAdd];
            }
            return prev;
          });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [favoriteVoiceIds.size, allVoices.length, loadFavoriteVoices, isLoadingVoices]);

  // 텍스트 변경 시 예상 오디오 길이 및 크레딧 자동 예측 (300자 초과 지원)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (customText.trim() && selectedVoice) {
        // 실제 API voice_id인 경우에만 예측 (기본 음성은 스킵)
        const isRealVoiceId = availableVoices.some((v: any) => v.voice_id === selectedVoice) || 
                             !voiceStyles.some((v: any) => v.id === selectedVoice);
        
        if (isRealVoiceId) {
          setIsPredictingDuration(true);
          
          // 선택된 음성의 언어 확인
          const selected = availableVoices.find((v: any) => v.voice_id === selectedVoice) || selectedVoiceInfo;
          const supportedLanguages: string[] = Array.isArray(selected?.language) ? selected.language : (selected?.language ? [selected.language] : []);
          const chosenLanguage = supportedLanguages.length > 0 && !supportedLanguages.includes("ko") ? supportedLanguages[0] : "ko";
          
          // 스타일 결정
          const styleValue = metaOverrides.style || 
            getEmotionValue(voiceSettings.emotion.preset, voiceSettings.emotion.customPrompt);
          
          if (customText.length <= 300) {
            // 300자 이하: 단일 예측
            const duration = await predictDuration(customText, selectedVoice, chosenLanguage, styleValue);
            setPredictedDuration(duration);
            setPredictedCredit(duration ? Math.ceil(duration) : null);
          } else {
            // 300자 초과: 전체 예측 (분할된 청크 전체)
            const prediction = await predictTotalDurationAndCredit(customText, selectedVoice, chosenLanguage, styleValue);
            setPredictedDuration(prediction.totalDuration);
            setPredictedCredit(prediction.totalCredit);
          }
          
          setIsPredictingDuration(false);
        } else {
          // 기본 음성 목록 사용 시 대략적인 추정
          const estimated = customText.length * 0.1 / (voiceSettings.readingSpeed.preset === "빠름" ? 1.3 : voiceSettings.readingSpeed.preset === "느림" ? 0.7 : 1.0);
          setPredictedDuration(Math.round(estimated * 100) / 100);
          setPredictedCredit(Math.ceil(estimated));
        }
      } else {
        setPredictedDuration(null);
        setPredictedCredit(null);
      }
    }, 500); // 디바운싱: 500ms 후 예측

    return () => clearTimeout(timer);
  }, [customText, selectedVoice, voiceSettings.readingSpeed.preset, voiceSettings.emotion, availableVoices, selectedVoiceInfo]);

  // 텍스트를 300자 단위로 분할 (문장 단위로 분할하여 자연스럽게)
  const splitTextIntoChunks = (text: string, maxLength: number = 300): string[] => {
    const trimmed = text.trim();
    if (trimmed.length <= maxLength) {
      return [trimmed];
    }

    const chunks: string[] = [];
    let currentIndex = 0;

    while (currentIndex < trimmed.length) {
      let chunkEnd = Math.min(currentIndex + maxLength, trimmed.length);
      
      // 문장 끝을 찾아서 자연스럽게 분할
      if (chunkEnd < trimmed.length) {
        // 마침표, 물음표, 느낌표, 줄바꿈 등으로 분할
        const sentenceEnd = Math.max(
          trimmed.lastIndexOf('。', chunkEnd),
          trimmed.lastIndexOf('.', chunkEnd),
          trimmed.lastIndexOf('!', chunkEnd),
          trimmed.lastIndexOf('?', chunkEnd),
          trimmed.lastIndexOf('\n', chunkEnd),
          trimmed.lastIndexOf('！', chunkEnd),
          trimmed.lastIndexOf('？', chunkEnd)
        );
        
        if (sentenceEnd > currentIndex) {
          chunkEnd = sentenceEnd + 1;
        } else {
          // 문장 끝이 없으면 공백으로 분할
          const spaceIndex = trimmed.lastIndexOf(' ', chunkEnd);
          if (spaceIndex > currentIndex) {
            chunkEnd = spaceIndex + 1;
          }
        }
      }

      const chunk = trimmed.slice(currentIndex, chunkEnd).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
      currentIndex = chunkEnd;
    }

    return chunks;
  };

  // 예상 오디오 길이 예측 함수 (Supabase Edge Function 프록시 사용)
  // 참고: https://docs.supertoneapi.com/en/user-guide/text-to-speech
  // 이 API는 크레딧을 소비하지 않음
  const predictDuration = async (text: string, voiceId: string, language: string = "ko", style: string = "neutral"): Promise<number | null> => {
    if (!text.trim() || !voiceId) return null;
    try {
      const response = await fetchWithSupabaseProxy(`/predict-duration/${voiceId}`, {
        method: "POST",
        body: JSON.stringify({ text, language, style }),
      });
      if (response?.ok) {
        const data = await response.json();
        return data?.duration ?? data?.data?.duration ?? null;
      }
    } catch (error) {
      console.warn("예상 길이 계산 실패:", error);
    }
    return null;
  };

  // 전체 텍스트의 예상 길이와 크레딧 계산
  const predictTotalDurationAndCredit = async (text: string, voiceId: string, language: string = "ko", style: string = "neutral"): Promise<{ totalDuration: number; totalCredit: number; chunkCount: number }> => {
    const chunks = splitTextIntoChunks(text, 300);
    let totalDuration = 0;
    
    // 각 청크에 대해 예측 수행
    for (const chunk of chunks) {
      const duration = await predictDuration(chunk, voiceId, language, style);
      if (duration) {
        totalDuration += duration;
      } else {
        // 예측 실패 시 대략적인 추정 (초당 10자 가정)
        totalDuration += chunk.length * 0.1;
      }
    }

    // 크레딧 계산: 일반적으로 1초당 1 크레딧 또는 더 복잡한 계산
    // 실제 API 문서를 확인해야 하지만, 여기서는 duration 기반으로 가정
    const totalCredit = Math.ceil(totalDuration); // 예: 1초당 1 크레딧

    return {
      totalDuration,
      totalCredit,
      chunkCount: chunks.length,
    };
  };

  // 여러 오디오를 하나로 결합하는 함수
  const concatenateAudios = async (audioBlobs: Blob[]): Promise<Blob> => {
    if (audioBlobs.length === 0) {
      throw new Error("결합할 오디오가 없습니다.");
    }
    if (audioBlobs.length === 1) {
      return audioBlobs[0];
    }

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
      const audioBuffers: AudioBuffer[] = [];

      // 모든 오디오를 디코딩
      for (const blob of audioBlobs) {
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        audioBuffers.push(audioBuffer);
      }

      // 전체 길이 계산
      const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.length, 0);
      const sampleRate = audioBuffers[0].sampleRate;
      const numChannels = audioBuffers[0].numberOfChannels;

      // 오프라인 컨텍스트로 결합
      const offlineCtx = new OfflineAudioContext(numChannels, totalLength, sampleRate);
      let currentOffset = 0;

      for (const buffer of audioBuffers) {
        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(offlineCtx.destination);
        source.start(currentOffset / sampleRate);
        currentOffset += buffer.length;
      }

      const renderedBuffer = await offlineCtx.startRendering();

      // WAV로 인코딩 (audioMixer의 함수 사용)
      const { encodeWavPCM16, mixDownToStereo } = await import("@/lib/audioMixer");
      const interleaved = mixDownToStereo(renderedBuffer);
      const wavBlob = encodeWavPCM16(interleaved, sampleRate, numChannels);

      return wavBlob;
    } catch (error: any) {
      console.error("오디오 결합 실패:", error);
      throw new Error(`오디오 결합 실패: ${error.message}`);
    }
  };


  async function generateWithOpenAI(prompt: string) {
    const { data, error } = await supabase.functions.invoke('openai-text-generation', {
      body: {
        type: 'generate',
        prompt,
        organization: user?.organization,
        department: user?.department,
      }
    });

    if (error) {
      throw new Error(error.message || 'OpenAI 텍스트 생성 실패');
    }

    if (!data?.text) {
      throw new Error('OpenAI 응답을 해석할 수 없습니다.');
    }

    return data.text;
  }

  async function editWithOpenAI(original: string, instruction: string) {
    const { data, error } = await supabase.functions.invoke('openai-text-generation', {
      body: {
        type: 'edit',
        original,
        instruction,
      }
    });

    if (error) {
      throw new Error(error.message || 'OpenAI 텍스트 편집 실패');
    }

    if (!data?.text) {
      throw new Error('OpenAI 응답을 해석할 수 없습니다.');
    }

    return data.text;
  }

  // 실제 음원 생성 로직 (템플릿 변수 검증 제외)
  const proceedWithGeneration = async (textToUse: string) => {
    const trimmedText = textToUse.trim();

    if (!selectedVoice) {
      setAlertDialog({ open: true, title: "선택 필요", message: "음성 스타일을 선택해주세요." });
      return;
    }

    // 300자 초과 시 자동 분할 처리 (에러 대신 진행)
    const needsSplitting = trimmedText.length > 300;
    if (needsSplitting) {
      console.log(`장문 텍스트 감지 (${trimmedText.length}자). 300자 단위로 분할하여 생성합니다.`);
      toast({ 
        title: "장문 텍스트 분할 생성", 
        description: `텍스트가 ${trimmedText.length}자로, ${Math.ceil(trimmedText.length / 300)}개 청크로 분할하여 생성합니다.`,
      });
    }

    // 실제 Supertone voice_id인지 확인 (기본 템플릿 id는 차단)
    const isRealVoiceId = availableVoices.some((v: any) => v.voice_id === selectedVoice);
    if (!isRealVoiceId) {
      toast({
        title: "실제 음성을 선택해주세요",
        description: "'음성 찾기'에서 목록의 음성을 선택해야 생성할 수 있습니다.",
        variant: "destructive",
      });
      return;
    }

    // 감정/스타일 값 결정: metaOverrides.style > customPrompt > preset 매핑
    const styleValue = metaOverrides.style || 
      getEmotionValue(voiceSettings.emotion.preset, voiceSettings.emotion.customPrompt);

    const speedValue = getSpeedMultiplier();
    // 피치: -100 ~ +100 범위를 -12 ~ +12 세미톤으로 변환
    const pitchShift = Math.max(-12, Math.min(12, Math.round(voiceSettings.pitch / 8.33)));

    // 끊어읽기 구간을 텍스트에 적용 (SSML 형식)
    let processedText = trimmedText;
    if (voiceSettings.pause.segments.length > 0) {
      // 구간을 위치 순으로 정렬
      const sortedSegments = [...voiceSettings.pause.segments].sort((a, b) => b.position - a.position);
      // 뒤에서부터 삽입 (인덱스 변경 방지)
      sortedSegments.forEach((segment) => {
        const position = Math.min(Math.max(0, segment.position), processedText.length);
        const breakTag = `<break time="${segment.duration}s"/>`;
        processedText = processedText.slice(0, position) + breakTag + processedText.slice(position);
      });
    }

    // 선택된 음성의 지원 언어/모델 파악
    const selected = availableVoices.find((v: any) => v.voice_id === selectedVoice) || selectedVoiceInfo;
    const supportedLanguages: string[] = Array.isArray(selected?.language) ? selected.language : (selected?.language ? [selected.language] : []);
    const supportedModels: string[] = Array.isArray(selected?.models) ? selected.models : (selected?.models ? [selected.models] : []);

    let chosenLanguage = metaOverrides.language || "ko";
    if (supportedLanguages.length > 0 && !supportedLanguages.includes("ko")) {
      if (!metaOverrides.language) chosenLanguage = supportedLanguages[0];
      toast({
        title: "선택한 음성의 지원 언어로 전환",
        description: `이 음성은 한국어를 지원하지 않습니다. ${chosenLanguage}로 생성합니다.`,
      });
    }

    let chosenModel = metaOverrides.model || "sona_speech_1";
    if (supportedModels.length > 0) {
      if (!metaOverrides.model) {
        chosenModel = supportedModels.includes("sona_speech_1") ? "sona_speech_1" : supportedModels[0];
      }
    }

    // 캐시 키 구성 및 캐시 히트 시 바로 반환
    const cacheKey = buildGenerationKey({
      text: processedText, // pause 구간이 적용된 텍스트 사용
      voiceId: selectedVoice,
      language: chosenLanguage,
      model: chosenModel,
      style: styleValue,
      speed: speedValue,
      pitchShift,
    });
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      // blob 데이터에서 새 blob URL 생성
      const audioUrl = cached._audioUrl || (cached.blob ? URL.createObjectURL(cached.blob) : null);
      if (!audioUrl) {
        console.warn('Cached entry has no blob or audioUrl');
        // 캐시 항목이 손상된 경우 계속 진행
      } else {
        if (!cached._audioUrl && cached.blob) {
          // cacheRef에 audioUrl 캐싱
          cacheRef.current.set(cacheKey, { ...cached, _audioUrl: audioUrl });
        }
        cleanupGeneratedAudioUrl(generatedAudio);
        setGeneratedAudio(audioUrl);
        setGeneratedDuration((cached.duration ?? estimateDurationFromText(trimmedText)) || 0);
        setPredictedDuration(cached.duration ?? null);
        toast({ title: "✅ 캐시 재사용", description: "이전에 생성한 동일한 음원을 재사용했습니다." });
        return;
      }
    }

    setIsGenerating(true);
    setGenerationProgress(null);

    // 300자 초과 시 분할 처리
    const textChunks = needsSplitting ? splitTextIntoChunks(processedText, 300) : [processedText];
    const estimatedDuration = estimateDurationFromText(trimmedText);

    try {
      cleanupGeneratedAudioUrl(generatedAudio);

      let finalAudioBlob: Blob | null = null;
      let finalDuration: number = 0;
      let finalMimeType: string = "audio/mpeg";
      const audioChunks: Blob[] = [];
      let totalDuration = 0;

      // 각 청크를 순차적으로 생성
      for (let i = 0; i < textChunks.length; i++) {
        const chunk = textChunks[i];
        setGenerationProgress({ current: i + 1, total: textChunks.length });

        const requestBody: Record<string, any> = {
          text: chunk,
          language: chosenLanguage,
          style: styleValue,
          model: chosenModel,
          voice_settings: {
            speed: speedValue,
            pitch_shift: pitchShift,
            pitch_variance: 1,
            playback_speed: voiceSettings.playbackSpeed,
          },
        };

        let audioResult: { blob: Blob; duration: number | null; mimeType?: string } | null = null;
        let source = "프록시";

        // 1. Supabase Edge Function 프록시 시도
        const proxyResponse = await fetchWithSupabaseProxy(`/text-to-speech/${selectedVoice}?output_format=mp3`, {
          method: "POST",
          body: JSON.stringify({ ...requestBody, voice_id: selectedVoice }),
        });

      if (proxyResponse?.ok) {
        audioResult = await parseSupertoneResponse(proxyResponse);
      } else if (proxyResponse) {
        let firstErrorMsg = `프록시 오류 (${proxyResponse.status})`;
        try {
          const errJson = await proxyResponse.clone().json();
          const msg = errJson?.error?.message || errJson?.error || errJson?.message || errJson?.detail;
          if (msg) firstErrorMsg += `: ${formatErrorDetail(msg)}`;
        } catch {
          const text = await proxyResponse.text();
          if (text) firstErrorMsg += `: ${text}`;
        }
        console.warn(firstErrorMsg);

        let finalFailed = true;
        // 400인 경우 최소 필드로 재시도 (text, language만)
        if (proxyResponse.status === 400) {
          try {
            const minimalBody: Record<string, any> = { text: chunk };
            if (chosenLanguage) minimalBody.language = chosenLanguage;
            const retryResp = await fetchWithSupabaseProxy(`/text-to-speech/${selectedVoice}?output_format=mp3`, {
              method: "POST",
              body: JSON.stringify(minimalBody),
            });
            if (retryResp?.ok) {
              audioResult = await parseSupertoneResponse(retryResp);
              console.log(`✅ 청크 ${i + 1}/${textChunks.length} 최소 필드로 재시도 성공`);
              finalFailed = false;
              if (i === 0) {
                toast({ title: "⚠️ 제한된 옵션으로 생성", description: "일부 파라미터 미지원으로 기본값으로 생성되었습니다.", });
              }
            } else if (retryResp) {
              let retryMsg = `재시도 실패 (${retryResp.status})`;
              try {
                const j = await retryResp.clone().json();
                const m = j?.error?.message || j?.error || j?.message || j?.detail;
                if (m) retryMsg += `: ${formatErrorDetail(m)}`;
              } catch {
                const t = await retryResp.text();
                if (t) retryMsg += `: ${t}`;
              }
              console.warn(retryMsg);
              firstErrorMsg = retryMsg;
            }
          } catch (e: any) {
            console.warn("재시도 예외:", e?.message || e);
            firstErrorMsg = e?.message || "재시도 중 오류";
          }
        }

        if (!audioResult && finalFailed) {
          throw new Error(`청크 ${i + 1}/${textChunks.length} 생성 실패: ${firstErrorMsg}`);
        }
      }

      // 2. Mock 폴백
      if (!audioResult) {
        source = "Mock";
        const mockBlob = base64ToBlob(MOCK_AUDIO_BASE64, "audio/wav");
        const chunkDuration = chunk.length * 0.1;
        audioResult = {
          blob: mockBlob,
          duration: chunkDuration,
          mimeType: "audio/wav",
        };
      }

      if (!audioResult) {
        throw new Error(`청크 ${i + 1}/${textChunks.length} 음성 데이터를 생성할 수 없습니다.`);
      }

      // 각 청크의 blob 저장
      audioChunks.push(audioResult.blob);
      if (audioResult.duration) {
        totalDuration += audioResult.duration;
      } else {
        totalDuration += chunk.length * 0.1; // 대략 추정
      }
      finalMimeType = audioResult.mimeType || "audio/mpeg";

      console.log(`✅ 청크 ${i + 1}/${textChunks.length} 생성 완료 (${audioResult.duration?.toFixed(2) || '추정'}초)`);
      }

      // 여러 청크가 있으면 결합, 하나면 그대로 사용
      if (audioChunks.length > 1) {
        console.log(`${audioChunks.length}개 청크를 결합합니다...`);
        finalAudioBlob = await concatenateAudios(audioChunks);
        finalMimeType = "audio/wav"; // 결합 후 WAV 형식
      } else {
        finalAudioBlob = audioChunks[0];
      }

      const roundedDuration = Math.round(totalDuration * 100) / 100;

      // blob에서 blob URL 생성
      const audioUrl = URL.createObjectURL(finalAudioBlob);
      
      setGeneratedAudio(audioUrl);
      setGeneratedDuration(roundedDuration);
      setPredictedDuration(roundedDuration);
      setGenerationProgress(null);

      const description = needsSplitting
        ? `총 ${textChunks.length}개 청크 생성 완료 | 길이: ${roundedDuration.toFixed(2)}초 | 형식: ${finalMimeType}`
        : `오디오 길이: ${roundedDuration.toFixed(2)}초 | 형식: ${finalMimeType}`;

      toast({
        title: "✅ 음성 생성 완료",
        description,
      });

      console.log(`음성 생성 성공 - ${needsSplitting ? `${textChunks.length}개 청크 결합` : '단일 생성'}`);
      
      // 이름 저장 다이얼로그 표시
      setPendingGeneration({
        id: generateUniqueId(),
        cacheKey,
        purpose: selectedPurpose,
        purposeLabel: purposeMeta.label,
        voiceId: selectedVoice || "",
        voiceName: getVoiceDisplayName(selectedVoice || ""),
        createdAt: new Date().toISOString(),
        duration: roundedDuration,
        status: "ready",
        hasAudio: true,
        language: chosenLanguage,
        model: chosenModel,
        style: styleValue,
        speed: speedValue,
        pitchShift,
        textPreview: trimmedText.slice(0, 120),
        textLength: trimmedText.length,
        audioUrl, // 새로 생성한 blob URL
      });
      setIsSaveNameDialogOpen(true);

      // 캐시에 blob 데이터 저장
      cacheRef.current.set(cacheKey, {
        blob: finalAudioBlob,
        duration: roundedDuration,
        mimeType: finalMimeType,
        _audioUrl: audioUrl,
      });
      // pushHistory는 이름 저장 다이얼로그에서 처리
    } catch (error: any) {
      console.error("음성 생성 오류:", error);
      const errorMessage = error?.message || "음성 생성 중 오류가 발생했습니다.";

      toast({
        title: "❌ 음성 생성 실패",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setGenerationProgress(null);
    }
  };

  const handleGenerateVoice = async () => {
    const trimmedText = customText.trim();
    if (!trimmedText) {
      setAlertDialog({ open: true, title: "입력 필요", message: "텍스트를 입력해주세요." });
      return;
    }

    // 템플릿 변수가 남아있는지 확인
    const remainingVariables = trimmedText.match(/\{([^}]+)\}/g);
    if (remainingVariables && remainingVariables.length > 0) {
      const variableNames = remainingVariables.map(v => v.replace(/[{}]/g, ''));
      setTemplateVariableWarning({ 
        open: true, 
        variables: variableNames,
        text: trimmedText
      });
      return;
    }

    // 변수가 없으면 바로 생성 진행
    await proceedWithGeneration(trimmedText);
  };

  const handlePlayPause = () => {
    if (generatedAudio) {
      setIsPlaying(!isPlaying);
      // TODO: 실제 오디오 재생 로직
    }
  };

  const handleDownload = async () => {
    if (!generatedAudio) return;
    
    try {
      const response = await fetch(generatedAudio);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `voice_${Date.now()}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("다운로드 오류:", error);
      setAlertDialog({ open: true, title: "다운로드 오류", message: "다운로드 중 오류가 발생했습니다." });
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F7FA' }}>
      {/* Header */}
      <div className="border-b border-border bg-white/95 backdrop-blur-lg shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="landio-text-h1 gradient-text">공공기관 음성 생성</h1>
              <p className="landio-text-body mt-2" style={{ color: '#4B5563' }}>지자체장 및 기관장 음성 메시지 생성</p>
              {user && (
                <div className="mt-2 flex items-center gap-2 text-sm" style={{ color: '#6B7280' }}>
                  <Building2 className="w-4 h-4" />
                  <span>{user.organization}</span>
                  {user.department && <span>• {user.department}</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <HomeButton />
              <Badge variant="outline" className="px-3 py-1">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                공공기관 특화
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Phase 4: 사용량 & 크레딧 모니터링 패널 */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4 landio-fade-up">
          <Card className="landio-card">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">이번 달 생성</span>
                  <Badge variant="outline">{usageStats.callsThisMonth}회</Badge>
                </div>
                <div className="text-2xl font-bold">{Math.round(usageStats.durationThisMonth / 60)}분</div>
                <div className="text-xs text-muted-foreground">전체: {usageStats.totalCalls}회 / {Math.round(usageStats.totalDuration / 3600)}시간</div>
              </div>
            </CardContent>
          </Card>
          <Card className="landio-card">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <span className="text-sm font-medium text-muted-foreground">크레딧 잔액</span>
                <div className={`text-2xl font-bold ${creditBalance.balance < 50000 ? "text-red-600" : creditBalance.balance < 100000 ? "text-orange-600" : "text-green-600"}`}>
                  ₩{creditBalance.balance.toLocaleString()}
                </div>
                <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                  <div className={`h-full transition-all ${creditBalance.balance < 50000 ? "bg-red-600" : "bg-green-600"}`} style={{ width: `${Math.min((creditBalance.balance / 500000) * 100, 100)}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="landio-card">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">최근 로그</span>
                  <Button size="sm" variant="ghost" onClick={() => setIsMonitoringPanelOpen(!isMonitoringPanelOpen)}>자세히</Button>
                </div>
                <div className="text-xs space-y-1">
                  {operationLogs.slice(0, 3).map((log) => (
                    <div key={log.id} className={`text-[11px] ${log.type === "error" ? "text-red-600" : log.type === "warning" ? "text-orange-600" : log.type === "success" ? "text-green-600" : "text-muted-foreground"}`}>
                      • {log.message}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8 landio-card landio-fade-up">
          <CardHeader>
            <CardTitle className="text-lg">문구 목적 설정</CardTitle>
            <CardDescription>방송 목적을 먼저 선택하면 이후 검수·예약 단계와 기록이 목적별로 정리됩니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {purposeOptions.map((option) => {
                const active = option.id === selectedPurpose;
                return (
                  <Button
                    key={option.id}
                    variant={active ? "default" : "outline"}
                    className={`landio-button h-auto flex flex-col items-start gap-1 text-left ${active ? "border-primary" : ""}`}
                    onClick={() => setSelectedPurpose(option.id)}
                  >
                    <span className="text-sm font-semibold">{option.label}</span>
                    <span className="text-xs text-muted-foreground leading-snug">{option.description}</span>
                  </Button>
                );
              })}
            </div>
            <div className="rounded-xl border border-dashed p-4 bg-muted/30" style={{ borderRadius: '12px' }}>
              <h4 className="text-sm font-medium mb-2">검수 체크리스트</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                {purposeMeta.checklist.map((item, idx) => (
                  <li key={idx}>• {item}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 템플릿 선택 */}
          <div className="lg:col-span-1">
            <Card className="landio-card landio-fade-up">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  메시지 템플릿
                </CardTitle>
                <CardDescription>
                  공공기관 특화 메시지 템플릿을 선택하세요
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="greeting" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="greeting">인사말</TabsTrigger>
                    <TabsTrigger value="announcement">안내방송</TabsTrigger>
                    <TabsTrigger value="policy">정책안내</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="greeting" className="space-y-3 mt-4">
                    {voiceTemplates.greeting.map((template) => (
                      <Card 
                        key={template.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedTemplate === template.id ? 'ring-2 ring-primary' : ''
                        }`}
                        onClick={() => handleTemplateSelect(template)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                              <template.icon className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-medium">{template.title}</h3>
                              <p className="text-sm text-muted-foreground">{template.description}</p>
                              <Badge variant="secondary" className="mt-1 text-xs">
                                {template.category}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                  
                  <TabsContent value="announcement" className="space-y-3 mt-4">
                    {voiceTemplates.announcement.map((template) => (
                      <Card 
                        key={template.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedTemplate === template.id ? 'ring-2 ring-primary' : ''
                        }`}
                        onClick={() => handleTemplateSelect(template)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                              <template.icon className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-medium">{template.title}</h3>
                              <p className="text-sm text-muted-foreground">{template.description}</p>
                              <Badge variant="secondary" className="mt-1 text-xs">
                                {template.category}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                  
                  <TabsContent value="policy" className="space-y-3 mt-4">
                    {voiceTemplates.policy.map((template) => (
                      <Card 
                        key={template.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedTemplate === template.id ? 'ring-2 ring-primary' : ''
                        }`}
                        onClick={() => handleTemplateSelect(template)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                              <template.icon className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-medium">{template.title}</h3>
                              <p className="text-sm text-muted-foreground">{template.description}</p>
                              <Badge variant="secondary" className="mt-1 text-xs">
                                {template.category}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* 음성 생성 */}
          <div className="lg:col-span-2">
            <Card className="landio-card landio-fade-up">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic2 className="w-5 h-5" />
                  음성 생성
                </CardTitle>
                <CardDescription>
                  텍스트를 입력하고 음성을 생성하세요
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 음성 스타일 선택 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="voice">음성 스타일 *</Label>
                    {isLoadingVoices && (
                      <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-300"
                            style={{ width: `${voiceLoadingProgress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {voiceLoadingProgress}%
                        </span>
                      </div>
                    )}
                  </div>
                  <Select value={selectedVoice} onValueChange={(value) => {
                    setSelectedVoice(value);
                    // 선택된 음성 정보 저장
                    const voice = availableVoices.find((v: any) => v.voice_id === value);
                    setSelectedVoiceInfo(voice || null);
                    if (voice && voice.styles && voice.styles.length > 0) {
                      setVoiceSettings(prev => ({
                        ...prev,
                        emotion: { ...prev.emotion, customPrompt: Array.isArray(voice.styles) ? voice.styles[0] : voice.styles }
                      }));
                    }
                    // 메타 오버라이드 초기화
                    setMetaOverrides({ language: "", style: "", model: "" });
                  }}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="음성 스타일을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* API에서 가져온 실제 음성 목록 */}
                      {availableVoices.length > 0 ? (
                        <>
                          <div className="px-2 py-1 text-[11px] text-muted-foreground grid gap-2 [grid-template-columns:56px_64px_128px_128px_minmax(120px,1fr)]">
                            <div>즐겨찾기</div>
                            <div>성별</div>
                            <div>이름</div>
                            <div>국가</div>
                            <div>스타일</div>
                          </div>
                          {[...(allVoices.length > 0 ? allVoices : availableVoices)]
                            .sort((a: any, b: any) => {
                              const fa = favoriteVoiceIds.has(a.voice_id) ? 1 : 0;
                              const fb = favoriteVoiceIds.has(b.voice_id) ? 1 : 0;
                              if (fa !== fb) return fb - fa; // 즐겨찾기 우선
                              return computeVoiceLanguageRank(a) - computeVoiceLanguageRank(b);
                            })
                            .map((voice: any) => {
                          const voiceName = voice.name || voice.voice_id;
                              const flags = (() => {
                                const arr = Array.isArray(voice.language) ? voice.language : (voice.language ? [voice.language] : []);
                                return arr.map((c: string) => languageCodeToFlag(c)).filter(Boolean).join(" ") || "";
                              })();
                              const stylesKo = formatStylesKo(voice.styles);
                              const genderKo = genderCodeToKo(voice.gender);
                              const genderColor = voice.gender === "female" ? "bg-red-500" : voice.gender === "male" ? "bg-blue-500" : "bg-gray-400";
                          return (
                            <SelectItem key={voice.voice_id} value={voice.voice_id}>
                                  <div className="grid gap-2 items-center [grid-template-columns:56px_64px_128px_128px_minmax(120px,1fr)]">
                                    <div className="flex items-center">
                                      <button
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={(e) => { e.stopPropagation(); toggleFavorite(voice.voice_id); }}
                                        className={`w-5 h-5 inline-flex items-center justify-center rounded ${favoriteVoiceIds.has(voice.voice_id) ? 'bg-yellow-400/20' : 'bg-transparent'}`}
                                        title={favoriteVoiceIds.has(voice.voice_id) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                                      >
                                        <Star className={`w-3 h-3 ${favoriteVoiceIds.has(voice.voice_id) ? 'text-yellow-400' : 'text-muted-foreground'}`} />
                                      </button>
                                  </div>
                                    <div className="flex items-center gap-1 text-xs">
                                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${genderColor}`}></span>
                                      <span>{genderKo}</span>
                                </div>
                                    <div className="truncate text-sm font-medium" title={voiceName}>{voiceName}</div>
                                    <div className="text-xs" title={flags}>{flags}</div>
                                    <div className="text-xs truncate" title={stylesKo || '-'}>{stylesKo || '-'}</div>
                              </div>
                            </SelectItem>
                          );
                            })}
                        </>
                      ) : (
                        /* 기본 음성 목록 (API 연결 실패 시) */
                        voiceStyles.map((style) => (
                          <SelectItem key={style.id} value={style.id}>
                            <div className="flex items-center gap-2">
                              <style.icon className="w-4 h-4" />
                              <div>
                                <div className="font-medium">{style.name}</div>
                                <div className="text-xs text-muted-foreground">{style.description}</div>
                              </div>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {availableVoices.length === 0 && !isLoadingVoices && (
                    <p className="text-xs text-muted-foreground">
                      💡 실제 Supertone 음성을 사용하려면 API 키를 설정하고 음성 목록을 로드하세요.
                    </p>
                  )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsVoiceFinderOpen(true)}
                  >
                    <Search className="w-4 h-4 mr-2" />
                    음성 찾기
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openCloneModal(selectedVoice)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    클론 생성
                  </Button>
                  {favoriteVoiceIds.size > 0 && (
                    <Select 
                      onValueChange={(v) => {
                        setSelectedVoice(v);
                        // availableVoices와 allVoices 모두에서 찾기
                        const voice = availableVoices.find((vv: any) => vv.voice_id === v) || 
                                     allVoices.find((vv: any) => vv.voice_id === v);
                        if (voice) {
                          setSelectedVoiceInfo(voice);
                        } else {
                          // 음성이 없으면 즉시 로드 시도
                          loadFavoriteVoices();
                          toast({
                            title: "음성 로딩 중",
                            description: "즐겨찾기된 음성을 불러오는 중입니다...",
                          });
                        }
                      }}
                      onOpenChange={(open) => {
                        // 드롭다운이 열릴 때 즐겨찾기 음성이 없으면 즉시 로드
                        if (open) {
                          const missingCount = Array.from(favoriteVoiceIds).filter((vid) => {
                            return !availableVoices.find((v: any) => v.voice_id === vid) && 
                                   !allVoices.find((v: any) => v.voice_id === vid);
                          }).length;
                          
                          if (missingCount > 0) {
                            loadFavoriteVoices();
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="h-9 w-48">
                        <SelectValue placeholder="즐겨찾기" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(favoriteVoiceIds).map((vid) => {
                          // availableVoices와 allVoices 모두에서 찾기
                          const v = availableVoices.find((x: any) => x.voice_id === vid) || 
                                   allVoices.find((x: any) => x.voice_id === vid);
                          // 없으면 즐겨찾기 ID만 표시
                          return (
                            <SelectItem key={vid} value={vid} disabled={!v}>
                              {v ? (v.name || vid) : `로딩 중... (${vid.slice(0, 12)}...)`}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchVoices()}
                  >
                    모든 음성가져오기
                  </Button>
                </div>
                  
                  {/* 선택된 음성 상세 정보 및 샘플 재생 */}
                  {selectedVoiceInfo && selectedVoiceInfo.samples && selectedVoiceInfo.samples.length > 0 && (
                    <div className="mt-4 p-4 border border-border rounded-lg bg-muted/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-sm">{selectedVoiceInfo.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {(() => {
                              const langs = Array.isArray(selectedVoiceInfo.language) ? selectedVoiceInfo.language : (selectedVoiceInfo.language ? [selectedVoiceInfo.language] : []);
                              const langsKo = langs.map((l: string) => languageCodeToKo(l)).join(", ");
                              const stylesKo = formatStylesKo(selectedVoiceInfo.styles);
                              return `언어: ${langsKo} | 스타일: ${stylesKo}`;
                            })()}
                          </p>
                        </div>
                      </div>
                      
                      {/* 샘플 오디오 목록 (언어별 행, 3그리드 버튼) */}
                      <div className="space-y-3">
                        {(["ko","en","ja"] as const).map((lang) => {
                          const langSamples = (selectedVoiceInfo.samples || []).filter((s: any) => s?.language === lang);
                          if (!langSamples || langSamples.length === 0) return null;
                          const items = langSamples
                            .slice(0, 9) // 언어별 최대 9개 (3x3)
                            .map((s: any) => ({ url: s.url, label: `${languageCodeToFlag(lang)} ${styleCodeToKo(s.style || 'neutral')}` }));
                          const rows = [] as any[];
                          for (let i = 0; i < items.length; i += 3) rows.push(items.slice(i, i + 3));
                          return (
                            <div key={lang} className="space-y-2">
                              <div className="text-xs font-medium text-muted-foreground">{languageCodeToKo(lang)}</div>
                              {rows.map((row, idx) => (
                                <div key={idx} className="grid grid-cols-3 gap-2">
                                  {row.map((it: any, j: number) => (
                              <Button
                                      key={j}
                                      variant="outline"
                                      className="justify-between"
                                      onClick={() => setPlayingSample(prev => prev === it.url ? null : it.url)}
                                    >
                                      <span className="text-xs">{it.label}</span>
                                      {playingSample === it.url ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                              </Button>
                                  ))}
                                  {Array.from({ length: Math.max(0, 3 - row.length) }).map((_, k) => (
                                    <div key={`sp-${k}`} />
                                  ))}
                            </div>
                          ))}
                        </div>
                          );
                        })}
                        
                        {playingSample && (
                          <audio
                            src={playingSample}
                            autoPlay
                            onEnded={() => setPlayingSample(null)}
                            onError={() => {
                              toast({
                                title: "샘플 재생 실패",
                                description: "샘플 오디오를 재생할 수 없습니다.",
                                variant: "destructive"
                              });
                              setPlayingSample(null);
                            }}
                            className="hidden"
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 텍스트 입력 및 OpenAI 작성 */}
                <div className="space-y-4">
                  <Tabs defaultValue="manual" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="manual">직접 작성</TabsTrigger>
                      <TabsTrigger value="ai-assist">OpenAI 작성</TabsTrigger>
                    </TabsList>

                    <TabsContent value="manual" className="mt-3 text-xs text-muted-foreground">
                      텍스트를 직접 입력하세요.
                    </TabsContent>

                    <TabsContent value="ai-assist" className="space-y-4 mt-3">
                      {/* 검수 체크리스트 및 최적 프롬프트 아코디언 */}
                      {(purposeMeta?.checklist || purposeMeta?.optimizedPrompt) && (
                        <Accordion type="multiple" defaultValue={["checklist", "prompt"]} className="space-y-2">
                          {/* 검수 체크리스트 */}
                          {purposeMeta && purposeMeta.checklist && (
                            <AccordionItem value="checklist" className="border border-blue-200 rounded-lg bg-blue-50 border-b-0">
                              <AccordionTrigger className="px-3 py-2 hover:no-underline">
                                <Label className="text-sm font-semibold text-blue-900 flex-1">검수 체크리스트</Label>
                              </AccordionTrigger>
                              <AccordionContent className="px-3 pb-3">
                                <ul className="space-y-1 text-xs text-blue-800">
                                  {purposeMeta.checklist.map((item, idx) => (
                                    <li key={idx} className="flex items-start gap-2">
                                      <span className="text-blue-500 mt-0.5">•</span>
                                      <span>{item}</span>
                                    </li>
                                  ))}
                                </ul>
                              </AccordionContent>
                            </AccordionItem>
                          )}

                          {/* 최적 프롬프트 제안 */}
                          {purposeMeta && purposeMeta.optimizedPrompt && (
                            <AccordionItem value="prompt" className="border border-green-200 rounded-lg bg-green-50 border-b-0">
                              <AccordionTrigger className="px-3 py-2 hover:no-underline">
                                <Label className="text-sm font-semibold text-green-900 flex-1">최적 프롬프트 가이드</Label>
                              </AccordionTrigger>
                              <AccordionContent className="px-3 pb-3">
                                <p className="text-xs text-green-800 mb-2">{purposeMeta.optimizedPrompt}</p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => {
                                    if (aiMode === "generate") {
                                      setOpenAIPrompt(purposeMeta.optimizedPrompt);
                                    } else {
                                      setOpenAIInstruction(purposeMeta.optimizedPrompt);
                                    }
                                  }}
                                >
                                  프롬프트로 적용
                                </Button>
                              </AccordionContent>
                            </AccordionItem>
                          )}
                        </Accordion>
                      )}

                      {/* 모드 선택 */}
                      <div className="flex gap-2">
                        <Button
                          variant={aiMode === "generate" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setAiMode("generate")}
                        >
                          작성
                        </Button>
                        <Button
                          variant={aiMode === "edit" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setAiMode("edit")}
                        >
                          수정
                        </Button>
                      </div>

                      {aiMode === "generate" ? (
                        <div className="space-y-2">
                      <Label htmlFor="ai-gen">요청 내용</Label>
                      <Textarea
                        id="ai-gen"
                        placeholder="예: 폭염 대비 시민 행동요령을 20초 분량으로 작성"
                        value={openAIPrompt}
                        onChange={(e) => setOpenAIPrompt(e.target.value)}
                      />
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setIsMessageHistoryOpen(true)}
                            >
                              이력 보기
                            </Button>
                        <Button
                          variant="outline"
                          onClick={async () => {
                            try {
                              setIsLoadingAI(true);
                              const org = user?.organization || "귀 기관";
                              const dept = user?.department || "관계 부서";
                                  const purposeLabel = purposeMeta?.label || "공지";
                                  const basePrompt = `${org} ${dept} 방송문 (${purposeLabel}): ${openAIPrompt}. ${purposeMeta?.optimizedPrompt || ""}`;
                              const out = await generateWithOpenAI(basePrompt);
                              setCustomText(out);
                              setLastAIPrompt(openAIPrompt);
                                  
                                  // 메시지 이력 저장
                                  const newMessage = {
                                    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                    text: out,
                                    purpose: selectedPurpose,
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString(),
                                  };
                                  const updated = [...messageHistory, newMessage];
                                  setMessageHistory(updated);
                                  localStorage.setItem(MESSAGE_HISTORY_STORAGE_KEY, JSON.stringify(updated));
                                  
                                  toast({
                                    title: "작성 완료",
                                    description: "메시지가 이력에 저장되었습니다.",
                                  });
                            } catch (e: any) {
                                  setAlertDialog({ open: true, title: "OpenAI 작성 실패", message: e?.message || "OpenAI 작성 중 오류가 발생했습니다." });
                            } finally {
                              setIsLoadingAI(false);
                            }
                          }}
                          disabled={isLoadingAI || !openAIPrompt.trim()}
                        >
                          {isLoadingAI ? "작성 중..." : "OpenAI로 작성"}
                        </Button>
                      </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                      <Label htmlFor="ai-edit">수정 지침</Label>
                          <Textarea
                        id="ai-edit"
                            placeholder="예: 20초 분량으로 단문으로 작성하고, 숫자를 명확히 발음할 수 있도록 수정"
                        value={openAIInstruction}
                        onChange={(e) => setOpenAIInstruction(e.target.value)}
                            className="min-h-[100px]"
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setIsMessageHistoryOpen(true)}
                            >
                              이력 보기
                            </Button>
                        <Button
                          variant="outline"
                          onClick={async () => {
                            try {
                                  if (!customText.trim()) { 
                                    setAlertDialog({ open: true, title: "텍스트 없음", message: "수정할 텍스트를 입력해주세요." });
                                    return; 
                                  }
                              setIsLoadingAI(true);
                                  const checklistGuide = purposeMeta?.checklist?.join(", ") || "";
                                  const instructionWithChecklist = `${openAIInstruction}. ${purposeMeta?.optimizedPrompt || ""} ${checklistGuide ? `검수 체크리스트: ${checklistGuide}` : ""}`;
                                  const out = await editWithOpenAI(customText, instructionWithChecklist);
                              setCustomText(out);
                              setLastAIInstruction(openAIInstruction);
                                  
                                  // 메시지 이력 업데이트 또는 새로 저장
                                  const existing = messageHistory.find(m => m.text === customText);
                                  if (existing) {
                                    const updated = messageHistory.map(m => 
                                      m.id === existing.id 
                                        ? { ...m, text: out, updatedAt: new Date().toISOString() }
                                        : m
                                    );
                                    setMessageHistory(updated);
                                    localStorage.setItem(MESSAGE_HISTORY_STORAGE_KEY, JSON.stringify(updated));
                                  } else {
                                    const newMessage = {
                                      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                                      text: out,
                                      purpose: selectedPurpose,
                                      createdAt: new Date().toISOString(),
                                      updatedAt: new Date().toISOString(),
                                    };
                                    const updated = [...messageHistory, newMessage];
                                    setMessageHistory(updated);
                                    localStorage.setItem(MESSAGE_HISTORY_STORAGE_KEY, JSON.stringify(updated));
                                  }
                                  
                                  toast({
                                    title: "수정 완료",
                                    description: "메시지가 이력에 저장되었습니다.",
                                  });
                            } catch (e: any) {
                                  setAlertDialog({ open: true, title: "OpenAI 수정 실패", message: e?.message || "OpenAI 수정 중 오류가 발생했습니다." });
                            } finally {
                              setIsLoadingAI(false);
                            }
                          }}
                          disabled={isLoadingAI || !openAIInstruction.trim()}
                        >
                          {isLoadingAI ? "수정 중..." : "OpenAI로 수정"}
                        </Button>
                      </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>

                  {/* 템플릿 변수 입력 */}
                  {selectedTemplate && selectedTemplateObj && Object.keys(templateVariables).length > 0 && (
                    <div id="template-variable-input" className="space-y-3 p-4 border rounded-lg bg-blue-50/50" tabIndex={-1}>
                      <Label className="text-sm font-semibold">템플릿 변수 입력</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.keys(templateVariables).map((varName) => {
                          const isRequired = ["기관명", "담당자명", "부서명"].includes(varName);
                          return (
                            <div key={varName} className="space-y-1">
                              <Label htmlFor={`var-${varName}`} className="text-xs">
                                {varName} {isRequired && <span className="text-red-500">*</span>}
                              </Label>
                              <Input
                                id={`var-${varName}`}
                                value={templateVariables[varName]}
                                onChange={(e) => handleVariableChange(varName, e.target.value)}
                                placeholder={`예: ${varName === "기관명" ? "강원특별자치도청" : varName === "담당자명" ? "김철수" : varName === "이벤트명" ? "신년인사" : ""}`}
                                className="text-sm"
                              />
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        💡 변수를 입력하면 자동으로 메시지 내용에 반영됩니다.
                      </p>
                    </div>
                  )}

                  <Label htmlFor="text">메시지 내용 *</Label>
                  <Textarea
                    id="text"
                    placeholder="음성으로 변환할 텍스트를 입력하세요..."
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    className="min-h-[200px]"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {selectedTemplate ? (
                          <p className="mb-1">템플릿 변수를 입력하면 자동으로 반영됩니다.</p>
                        ) : (
                          <>
                            <p className="mb-1">템플릿의 {"{"}변수명{"}"} 부분을 실제 내용으로 교체해주세요.</p>
                            <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                              <li>예: {"{"}기관명{"}"} → 강원특별자치도청</li>
                              <li>예: {"{"}담당자명{"}"} → 김철수</li>
                              <li>예: {"{"}이벤트명{"}"} → 신년인사</li>
                            </ul>
                          </>
                        )}
                      </div>
                      <p className={`text-xs ${customText.length > 300 ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {customText.length} / 300자 (최대)
                      </p>
                    </div>
                    {predictedDuration !== null && customText.trim() && (
                      <div className="flex items-center gap-2 text-xs">
                        <Clock className="w-3 h-3 text-primary" />
                        <span className="text-muted-foreground">
                          예상 길이:
                        </span>
                        <span className="font-medium text-primary">
                          {isPredictingDuration ? "예측 중..." : `${predictedDuration.toFixed(2)}초`}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Button variant="outline" onClick={() => { 
                      setCustomText(""); 
                      setSelectedTemplate(""); 
                      setTemplateVariables({});
                      setSelectedTemplateObj(null);
                    }}>
                      내용 초기화
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          const prompt = (lastAIPrompt || openAIPrompt).trim();
                          if (!prompt) { 
                            setAlertDialog({ open: true, title: "프롬프트 없음", message: "프롬프트를 입력해주세요." });
                            return; 
                          }
                          setIsLoadingAI(true);
                          const org = user?.organization || "귀 기관";
                          const dept = user?.department || "관계 부서";
                          const purposeLabel = purposeMeta?.label || "공지";
                          const checklistGuide = purposeMeta?.checklist?.join(", ") || "";
                          const basePrompt = `${org} ${dept} 방송문 (${purposeLabel}): ${prompt}. ${purposeMeta?.optimizedPrompt || ""} ${checklistGuide ? `검수 체크리스트를 확인하세요: ${checklistGuide}` : ""}`;
                          const out = await generateWithOpenAI(basePrompt);
                          setCustomText(out);
                          setLastAIPrompt(prompt);
                        } catch (e: any) {
                          setAlertDialog({ open: true, title: "다시 생성 실패", message: e?.message || "다시 생성 중 오류가 발생했습니다." });
                        } finally {
                          setIsLoadingAI(false);
                        }
                      }}
                    >
                      다시 생성
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          const instruction = (lastAIInstruction || openAIInstruction).trim();
                          if (!instruction) { 
                            setAlertDialog({ open: true, title: "수정 지침 없음", message: "수정 지침을 입력해주세요." });
                            return; 
                          }
                          if (!customText.trim()) { 
                            setAlertDialog({ open: true, title: "텍스트 없음", message: "수정할 텍스트를 입력해주세요." });
                            return; 
                          }
                          setIsLoadingAI(true);
                          const checklistGuide = purposeMeta?.checklist?.join(", ") || "";
                          const instructionWithChecklist = `${instruction}. ${purposeMeta?.optimizedPrompt || ""} ${checklistGuide ? `검수 체크리스트를 확인하세요: ${checklistGuide}` : ""}`;
                          const out = await editWithOpenAI(customText, instructionWithChecklist);
                          setCustomText(out);
                          setLastAIInstruction(instruction);
                        } catch (e: any) {
                          setAlertDialog({ open: true, title: "다시 수정 실패", message: e?.message || "다시 수정 중 오류가 발생했습니다." });
                        } finally {
                          setIsLoadingAI(false);
                        }
                      }}
                    >
                      다시 수정
                    </Button>
                  </div>
                </div>

                {/* 고급 설정 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    <Label className="text-sm font-medium">고급 설정</Label>
                  </div>
                  {/* 음성 메타 설정 드롭다운 (선택한 음성의 실제 지원 목록 기반) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">언어 (음성 지원 목록)</Label>
                      <Select
                        value={metaOverrides.language ? metaOverrides.language : "auto"}
                        onValueChange={(v) => setMetaOverrides(prev => ({ ...prev, language: v === "auto" ? "" : v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="자동" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">자동</SelectItem>
                          {(() => {
                            const sv = selectedVoiceInfo || availableVoices.find((v: any) => v.voice_id === selectedVoice);
                            if (!sv) return null;
                            const langs = Array.isArray(sv?.language) ? sv.language : (sv?.language ? [sv.language] : []);
                            if (langs.length === 0) return null;
                            return langs.map((l: string) => {
                              const langLabel = languageCodeToKo(l);
                              return <SelectItem key={l} value={l}>{langLabel} ({l})</SelectItem>;
                            });
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">스타일 (음성 지원 목록)</Label>
                      <Select
                        value={metaOverrides.style ? metaOverrides.style : "auto"}
                        onValueChange={(v) => setMetaOverrides(prev => ({ ...prev, style: v === "auto" ? "" : v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="자동" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">자동</SelectItem>
                          {(() => {
                            const sv = selectedVoiceInfo || availableVoices.find((v: any) => v.voice_id === selectedVoice);
                            if (!sv) return null;
                            const styles = Array.isArray(sv?.styles) ? sv.styles : (sv?.styles ? [sv.styles] : []);
                            if (styles.length === 0) return null;
                            return styles.map((s: string) => (
                              <SelectItem key={s} value={s}>{formatStylesKo(s)}</SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">모델 (음성 지원 목록)</Label>
                      <Select
                        value={metaOverrides.model ? metaOverrides.model : "auto"}
                        onValueChange={(v) => setMetaOverrides(prev => ({ ...prev, model: v === "auto" ? "" : v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="자동" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">자동</SelectItem>
                          {(() => {
                            const sv = selectedVoiceInfo || availableVoices.find((v: any) => v.voice_id === selectedVoice);
                            if (!sv) return null;
                            const models = Array.isArray(sv?.models) ? sv.models : (sv?.models ? [sv.models] : []);
                            if (models.length === 0) return null;
                            return models.map((m: string) => (
                              <SelectItem key={m} value={m}>{m}</SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <Tabs defaultValue="emotion" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="emotion">감정</TabsTrigger>
                      <TabsTrigger value="speed">속도</TabsTrigger>
                      <TabsTrigger value="pause">끊어읽기</TabsTrigger>
                      <TabsTrigger value="tone">톤</TabsTrigger>
                    </TabsList>

                    <TabsContent value="emotion" className="space-y-3 mt-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">PRO 감정</Label>
                          <Info className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-2">
                        <div className="flex gap-1">
                            {["A", "B", "C", "D"].map((preset) => {
                              const presetLabels: Record<string, string> = {
                                "A": "중립 (neutral)",
                                "B": "기쁨 (happy)",
                                "C": "슬픔 (sad)",
                                "D": "분노 (angry)"
                              };
                              return (
                            <Button
                              key={preset}
                              size="sm"
                              variant={voiceSettings.emotion.preset === preset ? "default" : "outline"}
                                  className="w-auto px-3 h-8"
                                  onClick={() => {
                                    // preset 변경 시 customPrompt 초기화 (선택적)
                                    setVoiceSettings(prev => ({
                                ...prev,
                                      emotion: { ...prev.emotion, preset, customPrompt: "" }
                                    }));
                                  }}
                            >
                                  {preset} - {presetLabels[preset]}
                            </Button>
                              );
                            })}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            프리셋을 선택하거나 아래 입력란에 커스텀 감정을 입력하세요.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder="예: 발랄하게"
                            value={voiceSettings.emotion.customPrompt}
                            onChange={(e) => setVoiceSettings(prev => ({
                              ...prev,
                              emotion: { ...prev.emotion, customPrompt: e.target.value }
                            }))}
                            className="flex-1"
                          />
                          <Button 
                            size="sm"
                            onClick={() => {
                              const emotionValue = getEmotionValue(voiceSettings.emotion.preset, voiceSettings.emotion.customPrompt);
                              toast({
                                title: "감정 적용됨",
                                description: emotionValue ? `감정: ${emotionValue}` : `감정 프리셋: ${voiceSettings.emotion.preset}`,
                              });
                            }}
                          >
                            적용
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {voiceSettings.emotion.tags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="text-xs cursor-pointer hover:bg-primary/10"
                              onClick={() => setVoiceSettings(prev => ({
                                ...prev,
                                emotion: { ...prev.emotion, customPrompt: tag }
                              }))}
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="speed" className="space-y-3 mt-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">PRO 읽는 속도</Label>
                          <Info className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex gap-2">
                          {["느림", "보통", "빠름"].map((speed) => (
                            <Button
                              key={speed}
                              size="sm"
                              variant={voiceSettings.readingSpeed.preset === speed ? "default" : "outline"}
                              onClick={() => {
                                const speedValue = speedPresetMap[speed] || "1.0";
                                setVoiceSettings(prev => ({
                                ...prev,
                                  readingSpeed: { 
                                    ...prev.readingSpeed, 
                                    preset: speed,
                                    customTime: speedValue
                                  }
                                }));
                              }}
                            >
                              {speed}
                            </Button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            step="0.1"
                            min="0.5"
                            max="2.0"
                            value={voiceSettings.readingSpeed.customTime}
                            onChange={(e) => setVoiceSettings(prev => ({
                              ...prev,
                              readingSpeed: { ...prev.readingSpeed, customTime: e.target.value }
                            }))}
                            className="flex-1"
                            placeholder="0.7 ~ 1.3"
                          />
                          <Button 
                            size="sm"
                            onClick={() => {
                              toast({
                                title: "속도 적용됨",
                                description: `읽는 속도: ${voiceSettings.readingSpeed.customTime}x`,
                              });
                            }}
                          >
                            적용
                          </Button>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="pause" className="space-y-3 mt-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">끊어 읽기</Label>
                          <Info className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg border border-border">
                          <p className="text-xs text-muted-foreground mb-2">
                            텍스트의 특정 위치에 일시정지를 삽입할 수 있습니다. 구간을 추가하여 자연스러운 리듬감을 만드세요.
                          </p>
                        <div className="flex items-center gap-2">
                            <Label className="text-xs">기본 일시정지:</Label>
                          <Slider
                            value={[voiceSettings.pause.duration]}
                            onValueChange={(value) => setVoiceSettings(prev => ({
                              ...prev,
                              pause: { ...prev.pause, duration: value[0] }
                            }))}
                            min={0}
                            max={10}
                            step={0.1}
                            className="flex-1"
                          />
                            <span className="text-sm w-12 text-center">{voiceSettings.pause.duration.toFixed(1)}초</span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setNewPauseSegment({ position: Math.floor(customText.length / 2), duration: 0.5 });
                            setIsPauseSegmentDialogOpen(true);
                          }}
                          disabled={!customText.trim()}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          구간 추가하기
                        </Button>
                        
                        {voiceSettings.pause.segments.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">추가된 구간 ({voiceSettings.pause.segments.length}개)</Label>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {voiceSettings.pause.segments.map((segment, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded border border-border">
                                  <div className="flex-1">
                                    <span className="text-xs">
                                      위치: {segment.position}번째 문자 | 
                                      시간: {segment.duration}초
                                    </span>
                                    {customText && (
                                      <span className="text-xs text-muted-foreground block mt-1">
                                        "{customText.slice(Math.max(0, segment.position - 5), Math.min(customText.length, segment.position + 5))}"
                                      </span>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => {
                                      setVoiceSettings(prev => ({
                                        ...prev,
                                        pause: {
                                          ...prev.pause,
                                          segments: prev.pause.segments.filter((_, i) => i !== idx)
                                        }
                                      }));
                                    }}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="tone" className="space-y-3 mt-4">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm">PRO 재생 속도</Label>
                            <Info className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="p-3 bg-muted/50 rounded-lg border border-border">
                            <p className="text-xs text-muted-foreground mb-2">
                              생성된 오디오의 재생 속도를 조절합니다. (0.5x ~ 2.0x)
                            </p>
                          <Slider
                            value={[voiceSettings.playbackSpeed]}
                            onValueChange={(value) => setVoiceSettings(prev => ({
                              ...prev,
                              playbackSpeed: value[0]
                            }))}
                            min={0.5}
                            max={2}
                            step={0.1}
                            className="w-full"
                          />
                            <div className="flex justify-between mt-2">
                              <span className="text-xs text-muted-foreground">0.5x (느림)</span>
                              <span className="text-sm font-medium">{voiceSettings.playbackSpeed.toFixed(1)}x</span>
                              <span className="text-xs text-muted-foreground">2.0x (빠름)</span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm">PRO 피치</Label>
                            <Info className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="p-3 bg-muted/50 rounded-lg border border-border">
                            <p className="text-xs text-muted-foreground mb-2">
                              음성의 높낮이를 조절합니다. (-100: 낮음, 0: 기본, +100: 높음)
                            </p>
                          <Slider
                            value={[voiceSettings.pitch]}
                            onValueChange={(value) => setVoiceSettings(prev => ({
                              ...prev,
                              pitch: value[0]
                            }))}
                            min={-100}
                            max={100}
                            step={1}
                            className="w-full"
                          />
                            <div className="flex justify-between mt-2">
                              <span className="text-xs text-muted-foreground">-100 (낮음)</span>
                              <span className="text-sm font-medium">
                                {voiceSettings.pitch > 0 ? '+' : ''}{voiceSettings.pitch}
                              </span>
                              <span className="text-xs text-muted-foreground">+100 (높음)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>

                {/* 생성 버튼 */}
                <Button 
                  onClick={handleGenerateVoice}
                  disabled={isGenerating || !customText.trim() || !selectedVoice}
                  className="w-full h-11 landio-button"
                  variant="gradient"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      음성 생성 중...
                    </>
                  ) : (
                    <>
                      <Mic2 className="w-4 h-4 mr-2" />
                      음성 생성하기
                    </>
                  )}
                </Button>

                {/* 생성된 음성 */}
                {generatedAudio && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        생성 완료
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        MP3 형식
                      </Badge>
                    </div>
                    <AudioPlayer
                      audioUrl={generatedAudio}
                      title="생성된 음성"
                      duration={generatedDuration}
                      onDownload={handleDownload}
                    />
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setGeneratedAudio(null);
                        setGeneratedDuration(0);
                        toast({
                          title: "오디오 제거됨",
                          description: "새로운 음성을 생성할 수 있습니다."
                        });
                      }}
                    >
                      오디오 제거하고 다시 생성
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 생성 기록 & 사용 가이드 */}
        <div className="mt-8 space-y-6">
          <Card className="landio-card landio-fade-up">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Mic2 className="w-5 h-5" />
                  클론 음성 관리
                </CardTitle>
                <CardDescription>기존 음성을 기반으로 클론 음성을 생성하고 관리합니다.</CardDescription>
              </div>
              <Button size="sm" className="landio-button" onClick={() => openCloneModal()}>새 클론 음성 생성</Button>
            </CardHeader>
            <CardContent>
              {cloneRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">아직 생성된 클론 음성이 없습니다. 기준 음성을 선택한 후 클론 생성 버튼을 눌러보세요.</p>
              ) : (
                <div className="space-y-3">
                  {cloneRequests.map((clone) => {
                    const isFavorite = favoriteVoiceIds.has(clone.voiceId);
                    const languageLabel = languageCodeToKo(clone.language);
                    return (
                      <div key={clone.id} className="rounded-xl border border-border bg-muted/20 p-3 grid gap-3 md:grid-cols-[150px_minmax(0,1fr)_180px_180px] items-center transition-all hover:shadow-md" style={{ borderRadius: '12px' }}>
                        <div className="space-y-1">
                          <Badge variant={clone.status === "completed" ? "default" : "outline"}>{clone.status === "completed" ? "완료" : "진행중"}</Badge>
                          <div className="text-xs text-muted-foreground">{formatDateTime(clone.createdAt)}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">{clone.voiceName}</div>
                          <div className="text-xs text-muted-foreground">기준 음성: {clone.baseVoiceName || "-"}</div>
                          <div className="text-xs text-muted-foreground">언어: {languageLabel}</div>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div>샘플: {clone.sampleName || "-"}</div>
                          <div>메모: {clone.memo || "-"}</div>
                          {clone.completedAt && (
                            <div>완료: {formatDateTime(clone.completedAt)}</div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                          <Button
                            size="sm"
                            variant={isFavorite ? "default" : "outline"}
                            className="landio-button"
                            onClick={() => toggleFavorite(clone.voiceId)}
                          >
                            {isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="landio-button"
                            disabled={clone.status !== "completed"}
                            onClick={() => {
                              if (clone.status !== "completed") return;
                              setSelectedVoice(clone.voiceId);
                              const meta = getVoiceMeta(clone.voiceId);
                              setSelectedVoiceInfo(meta || null);
                              toast({ title: "클론 음성 선택", description: `${clone.voiceName} 음성을 선택했습니다.` });
                            }}
                          >
                            사용하기
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="landio-card landio-fade-up">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                생성 기록 & 작업 관리
              </CardTitle>
              <CardDescription>최근 생성한 음성을 목적별로 관리하고, 향후 클로닝·믹싱·예약 작업을 연결합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              {generationHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">아직 생성된 음성이 없습니다. 목적을 선택하고 음성을 생성해 보세요.</p>
              ) : (
                <div className="space-y-3">
                  {generationHistory.map((entry) => {
                    const languageKo = languageCodeToKo(entry.language);
                    const isExpanded = expandedGenerationId === entry.id;
                    const isEditing = editingGenerationId === entry.id;
                    
                    // audioUrl 복원: cacheKey가 있으면 cacheRef에서 blob 데이터로부터 새 blob URL 생성
                    let audioUrl = entry.audioUrl;
                    
                    if (entry.cacheKey) {
                      const cached = cacheRef.current.get(entry.cacheKey);
                      if (cached?.blob) {
                        // blob 데이터가 있으면 새 blob URL 생성
                        if (!cached._audioUrl) {
                          const newUrl = URL.createObjectURL(cached.blob);
                          cacheRef.current.set(entry.cacheKey, { ...cached, _audioUrl: newUrl });
                          audioUrl = newUrl;
                          // generationHistory 업데이트
                          setGenerationHistory((prev) => 
                            prev.map((g) => 
                              g.id === entry.id ? { ...g, audioUrl: newUrl } : g
                            )
                          );
                        } else {
                          audioUrl = cached._audioUrl;
                        }
                      } else if (cached?._audioUrl) {
                        // blob 데이터는 없지만 audioUrl이 있는 경우
                        audioUrl = cached._audioUrl;
                      }
                    }
                    return (
                      <div key={entry.id} className="rounded-xl border border-border bg-muted/20 p-3 transition-all hover:shadow-md" style={{ borderRadius: '12px' }}>
                        <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)_160px_auto] items-center">
                          <div className="space-y-1">
                            <Badge>{entry.purposeLabel}</Badge>
                            <div className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {isEditing ? (
                                <div className="flex items-center gap-2 flex-1">
                                  <Input
                                    value={editNameInput}
                                    onChange={(e) => setEditNameInput(e.target.value)}
                                    placeholder="이름 입력"
                                    className="h-7 text-sm"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        editGenerationName(entry.id, editNameInput.trim() || null);
                                      } else if (e.key === 'Escape') {
                                        setEditingGenerationId(null);
                                        setEditNameInput("");
                                      }
                                    }}
                                    autoFocus
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2"
                                    onClick={() => editGenerationName(entry.id, editNameInput.trim() || null)}
                                  >
                                    확인
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2"
                                    onClick={() => {
                                      setEditingGenerationId(null);
                                      setEditNameInput("");
                                    }}
                                  >
                                    취소
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <div className="text-sm font-medium truncate flex-1" title={entry.savedName || formatDateTime(entry.createdAt)}>
                                    {entry.savedName || formatDateTime(entry.createdAt)}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={() => {
                                      setEditingGenerationId(entry.id);
                                      setEditNameInput(entry.savedName || "");
                                    }}
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate" title={entry.textPreview}>{entry.textPreview || "(텍스트 없음)"}</div>
                            <div className="text-xs text-muted-foreground">길이: {entry.duration != null ? `${entry.duration.toFixed(2)}초` : "-"}</div>
                          </div>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div>음성: {entry.voiceName || "-"}</div>
                            <div>언어: {languageKo}</div>
                            <div>상태: <Badge variant="outline" className="text-[10px] uppercase">{entry.status}</Badge></div>
                          </div>
                          <div className="flex flex-wrap gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="landio-button"
                              onClick={() => setExpandedGenerationId(isExpanded ? null : entry.id)}
                            >
                              {isExpanded ? "접기" : "미리듣기"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="landio-button"
                              onClick={() => openCloneModal(entry.voiceId)}
                            >
                              클로닝
                            </Button>
                            <Button size="sm" variant="outline" className="landio-button" onClick={() => openMixingModal(entry)}>믹싱</Button>
                            <Button size="sm" variant="outline" className="landio-button" onClick={() => openScheduleModal(entry)}>예약</Button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-border space-y-3">
                            {/* 미리듣기 */}
                            {audioUrl ? (
                              <div className="p-3 bg-muted/40 rounded-lg">
                                <div className="text-xs font-semibold mb-2 text-muted-foreground">미리듣기</div>
                                <AudioPlayer
                                  audioUrl={audioUrl}
                                  title={entry.savedName || formatDateTime(entry.createdAt)}
                                  duration={entry.duration || 0}
                                  cacheKey={entry.cacheKey}
                                  onError={async () => {
                                    // blob URL이 만료된 경우 복원 시도
                                    if (entry.cacheKey) {
                                      const cached = cacheRef.current.get(entry.cacheKey);
                                      if (cached?.blob) {
                                        // blob 데이터가 있으면 새 URL 생성
                                        const newUrl = URL.createObjectURL(cached.blob);
                                        setGenerationHistory((prev) => 
                                          prev.map((g) => 
                                            g.id === entry.id ? { ...g, audioUrl: newUrl } : g
                                          )
                                        );
                                        toast({
                                          title: "음원 복원 완료",
                                          description: "만료된 음원을 복원했습니다.",
                                        });
                                      } else {
                                        // cacheRef에 blob 데이터가 없는 경우 - 복원 불가능
                                        toast({
                                          title: "음원 복원 불가",
                                          description: "음원 데이터를 찾을 수 없습니다. 페이지를 새로고침하여 다시 시도해주세요.",
                                          variant: "destructive",
                                        });
                                      }
                                    } else {
                                      toast({
                                        title: "음원 복원 불가",
                                        description: "음원을 복원할 수 없습니다. 다시 생성해주세요.",
                                        variant: "destructive",
                                      });
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground">
                                오디오 파일을 불러올 수 없습니다.
                              </div>
                            )}
                            {/* 관리 기능 */}
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="landio-button"
                                onClick={() => downloadGeneration(entry)}
                                disabled={!audioUrl}
                              >
                                <Download className="w-3 h-3 mr-1" />
                                다운로드
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="landio-button text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDeleteConfirmDialog({ open: true, id: entry.id })}
                              >
                                <Trash2 className="w-3 h-3 mr-1" />
                                삭제
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="landio-card landio-fade-up">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                사용 가이드
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="font-semibold">템플릿 사용법</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 템플릿의 {"{"}변수명{"}"} 부분을 실제 내용으로 교체</li>
                    <li>• 예: {"{"}기관명{"}"} → 강원특별자치도청</li>
                    <li>• 예: {"{"}담당자명{"}"} → 김철수</li>
                    <li>• 예: {"{"}이벤트명{"}"} → 신년인사</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h3 className="font-semibold">음성 스타일 선택</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 지자체장용: 정중하고 권위있는 톤</li>
                    <li>• 기관장용: 전문적이고 신뢰감 있는 톤</li>
                    <li>• 안내방송용: 친근하고 명확한 톤</li>
                    <li>• 용도에 맞는 스타일을 선택하세요</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isVoiceFinderOpen} onOpenChange={setIsVoiceFinderOpen}>
        <DialogContent className="sm:max-w-4xl dark-dialog bg-gray-900/95 border-gray-700">
          <DialogHeader>
            <DialogTitle style={{ color: '#FFFFFF' }}>음성 검색</DialogTitle>
            <DialogDescription style={{ color: '#E5E7EB' }}>
              언어, 스타일, 이름 등을 조합하여 원하는 음성을 검색하고 선택하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
            <div className="md:col-span-2 space-y-3">
              <div>
                <Label className="text-xs" style={{ color: '#E5E7EB' }}>언어</Label>
                <Select value={voiceFilters.language || undefined} onValueChange={(v) => setVoiceFilters(prev => ({ ...prev, language: v === "all" ? "" : v }))}>
                  <SelectTrigger className="bg-gray-800/50 border-gray-600 text-white">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="all" className="text-white focus:bg-gray-700">전체</SelectItem>
                    {getAvailableLanguages().map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-white focus:bg-gray-700">{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs" style={{ color: '#E5E7EB' }}>스타일</Label>
                <Select value={voiceFilters.style || undefined} onValueChange={(v) => setVoiceFilters(prev => ({ ...prev, style: v === "all" ? "" : v }))}>
                  <SelectTrigger className="bg-gray-800/50 border-gray-600 text-white">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600 max-h-[300px]">
                    <SelectItem value="all" className="text-white focus:bg-gray-700">전체</SelectItem>
                    {getAvailableStyles().grouped.map((group) => (
                      <React.Fragment key={group.group}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 bg-gray-700/50 sticky top-0 z-10">
                          {group.group}
                        </div>
                        {group.styles.map((style) => (
                          <SelectItem key={style.value} value={style.value} className="text-white focus:bg-gray-700 pl-6">
                            {style.label}
                          </SelectItem>
                        ))}
                      </React.Fragment>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs" style={{ color: '#E5E7EB' }}>이름 (부분 검색 가능)</Label>
                <Input
                  value={voiceFilters.name}
                  onChange={(e) => setVoiceFilters(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="예: Adam"
                  className="bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-400 focus-visible:ring-gray-500"
                />
                {/* 이름 빠른 선택 */}
                <div className="mt-2">
                  <Select value={voiceFilters.name || undefined} onValueChange={(v) => setVoiceFilters(prev => ({ ...prev, name: v }))}>
                    <SelectTrigger className="bg-gray-800/50 border-gray-600 text-white">
                      <SelectValue placeholder="이름 빠른 선택 (옵션)" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600">
                      {(availableVoices || []).map((v: any) => (
                        <SelectItem key={v.voice_id} value={v.name || v.voice_id} className="text-white focus:bg-gray-700">{v.name || v.voice_id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs" style={{ color: '#E5E7EB' }}>성별</Label>
                <Select value={voiceFilters.gender || undefined} onValueChange={(v) => setVoiceFilters(prev => ({ ...prev, gender: v === "all" ? "" : v }))}>
                  <SelectTrigger className="bg-gray-800/50 border-gray-600 text-white">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="all" className="text-white focus:bg-gray-700">전체</SelectItem>
                    {getAvailableGenders().map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-white focus:bg-gray-700">{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs" style={{ color: '#E5E7EB' }}>용도</Label>
                <Select value={voiceFilters.useCase || undefined} onValueChange={(v) => setVoiceFilters(prev => ({ ...prev, useCase: v === "all" ? "" : v }))}>
                  <SelectTrigger className="bg-gray-800/50 border-gray-600 text-white">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="all" className="text-white focus:bg-gray-700">전체</SelectItem>
                    {getAvailableUseCases().map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-white focus:bg-gray-700">{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={searchVoices} disabled={isSearchingVoices}>
                  {isSearchingVoices ? "검색 중..." : "검색"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    // 한국어 기본값으로 필터 초기화
                    setVoiceFilters({ language: "ko", style: "", name: "", gender: "", useCase: "" });
                    // 기존 결과를 한국어 기준으로 즉시 재필터링
                    if (allVoices.length > 0) {
                      setVoiceSearchResults(applyClientFilters(allVoices, { language: "ko", style: "", name: "", gender: "", useCase: "" } as any));
                    }
                  }}
                >
                  초기화
                </Button>
              </div>
              <p className="text-xs" style={{ color: '#9CA3AF' }}>
                💡 언어와 스타일을 함께 지정하면 더 정확한 결과를 얻을 수 있습니다. 샘플의 language/style/model 정보를 참고하세요.
              </p>
            </div>
            <div className="md:col-span-3">
              <div className="flex items-center justify-between text-xs mb-2" style={{ color: '#E5E7EB' }}>
                <span>검색 결과 {voiceSearchResults.length}{voiceTotalCount ? ` / 총 ${voiceTotalCount}` : ""}개</span>
                <div className="flex items-center gap-2">
                  {voiceNextToken && (
                    <Button size="sm" variant="outline" onClick={() => loadMoreVoices()}>더 보기</Button>
                  )}
                  {voiceNextToken && (
                    <Button size="sm" variant="outline" onClick={() => autoLoadVoicesThrottled(50, 200)}>전체보기</Button>
                  )}
                </div>
              </div>
              <ScrollArea className="h-96 border border-gray-600 rounded-lg p-3 bg-gray-800/30">
                {isSearchingVoices ? (
                  <p className="text-sm" style={{ color: '#9CA3AF' }}>검색 중입니다...</p>
                ) : voiceSearchResults.length === 0 ? (
                  <p className="text-sm" style={{ color: '#9CA3AF' }}>검색 결과가 없습니다. 조건을 조정해보세요.</p>
                ) : (
                  <div className="space-y-3">
                    {voiceSearchResults.map((voice) => {
                      const languages = (() => {
                        const arr = Array.isArray(voice.language) ? voice.language : (voice.language ? [voice.language] : []);
                        const flags = arr.map((c: string) => languageCodeToFlag(c)).filter(Boolean);
                        return flags.join(" ") || "-";
                      })();
                      const styles = formatStylesKo(voice.styles);
                      const models = Array.isArray(voice.models) ? voice.models.join(", ") : voice.models;
                      const genderKo = genderCodeToKo(voice.gender);
                      const useCaseKo = useCaseToKo(voice.use_case);
                      const genderColor = voice.gender === "female" ? "bg-red-500" : voice.gender === "male" ? "bg-blue-500" : "bg-gray-400";
                      return (
                        <Card key={voice.voice_id} className="landio-card border-gray-600 hover:border-blue-500 transition-colors bg-gray-800/50">
                          <CardContent className="p-4 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-semibold flex items-center gap-2" style={{ color: '#FFFFFF' }}>
                                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${genderColor}`}></span>
                                  {voice.name || voice.voice_id}
                              </div>
                                <div className="text-xs break-all" style={{ color: '#9CA3AF' }}>ID: {voice.voice_id}</div>
                              </div>
                              <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                  variant="ghost"
                                  className="landio-button hover:bg-gray-800"
                                  onClick={() => {
                                    const sampleUrl = getPreferredSampleUrl(voice);
                                    if (sampleUrl) {
                                      // 같은 샘플이면 정지
                                      if (playingSample === sampleUrl) {
                                        if (audioSampleRef.current) {
                                          audioSampleRef.current.pause();
                                          audioSampleRef.current.currentTime = 0;
                                        }
                                        setPlayingSample(null);
                                        return;
                                      }
                                      
                                      // 이전 재생 중인 오디오 정리
                                      if (audioSampleRef.current && playingSample) {
                                        audioSampleRef.current.pause();
                                        audioSampleRef.current.currentTime = 0;
                                      }
                                      
                                      // 새 샘플 설정 (useEffect에서 자동으로 재생됨)
                                      setPlayingSample(sampleUrl);
                                    } else {
                                      toast({ title: "샘플 없음", description: "이 음성은 샘플 오디오가 없습니다.", variant: "destructive" });
                                    }
                                  }}
                                >
                                  {playingSample && getPreferredSampleUrl(voice) === playingSample ? <Pause className="w-3 h-3" style={{ color: '#E5E7EB' }} /> : <Play className="w-3 h-3" style={{ color: '#E5E7EB' }} />}
                                </Button>
                                <Button
                                  size="sm"
                                  variant={favoriteVoiceIds.has(voice.voice_id) ? "default" : "outline"}
                                  className="landio-button hover:bg-gray-800"
                                  onClick={() => toggleFavorite(voice.voice_id)}
                                  title={favoriteVoiceIds.has(voice.voice_id) ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                                >
                                  <Star className="w-3 h-3 text-yellow-400" />
                                </Button>
                              <Button
                                size="sm"
                                className="landio-button bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => {
                                  setSelectedVoice(voice.voice_id);
                                  setSelectedVoiceInfo(voice);
                                  setIsVoiceFinderOpen(false);
                                  if (!availableVoices.some(v => v.voice_id === voice.voice_id)) {
                                    setAvailableVoices(prev => [...prev, voice]);
                                  }
                                }}
                              >
                                선택
                              </Button>
                            </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs" style={{ color: '#9CA3AF' }}>
                              <div>언어: {languages || "-"}</div>
                              <div>스타일: {styles || "-"}</div>
                              <div>모델: {models || "-"}</div>
                              <div>성별: {genderKo}</div>
                            </div>
                            {useCaseKo && (
                              <Badge variant="secondary" className="text-xs border-gray-600" style={{ color: '#E5E7EB', backgroundColor: 'rgba(75, 85, 99, 0.3)' }}>용도: {useCaseKo}</Badge>
                            )}
                            {voice.samples && voice.samples.length > 0 && (
                              <div className="text-xs" style={{ color: '#9CA3AF' }}>샘플 {voice.samples.length}개 제공</div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
              {/* 전역 샘플 재생 오디오 */}
              <audio
                ref={audioSampleRef}
                src={playingSample || undefined}
                onEnded={() => {
                  setPlayingSample(null);
                  if (audioSampleRef.current) {
                    audioSampleRef.current.currentTime = 0;
                  }
                }}
                onError={() => {
                  setPlayingSample(null);
                  if (audioSampleRef.current) {
                    audioSampleRef.current.currentTime = 0;
                  }
                }}
                className="hidden"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCloneModalOpen} onOpenChange={setIsCloneModalOpen}>
        <DialogContent className="sm:max-w-lg dark-dialog">
          <DialogHeader>
            <DialogTitle className="text-white font-bold text-lg" style={{ color: '#FFFFFF' }}>새 클론 음성 생성</DialogTitle>
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
                className="bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-400 focus-visible:ring-gray-500"
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
                  {allVoices.map((voice: any) => (
                    <SelectItem key={voice.voice_id} value={voice.voice_id} className="text-white focus:bg-gray-700">
                      {voice.name || voice.voice_id}
                    </SelectItem>
                  ))}
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
                    <SelectItem key={option.value} value={option.value} className="text-white focus:bg-gray-700">{option.label}</SelectItem>
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
                className="bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-400 focus-visible:ring-gray-500"
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
                    className="bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-400 focus-visible:ring-gray-500"
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

      <Dialog open={isMixingModalOpen} onOpenChange={setIsMixingModalOpen}>
        <DialogContent className="sm:max-w-2xl dark-dialog bg-gray-900/95 border-gray-700">
          <DialogHeader>
            <DialogTitle style={{ color: '#FFFFFF' }}>음원 믹싱 설정</DialogTitle>
            <DialogDescription style={{ color: '#E5E7EB' }}>음원을 선택하고 배경음과 효과음을 추가하여 믹싱합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* 생성된 음원 정보 (가장 중요) */}
            <div className="p-4 bg-blue-900/30 border-2 border-blue-600/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <Label style={{ color: '#FFFFFF' }} className="text-base font-bold">🎵 생성된 음원 (주요)</Label>
                {mixingStates.get(selectedGenerationForMixing?.id)?.selectedVoiceTrack?.duration && (
                  <span className="text-sm text-blue-300">
                    {formatTime(mixingStates.get(selectedGenerationForMixing?.id)?.selectedVoiceTrack?.duration || 0)}
                  </span>
                )}
              </div>
              <Select 
                value={mixingStates.get(selectedGenerationForMixing?.id)?.selectedVoiceTrack?.id?.toString() || selectedGenerationForMixing?.id?.toString()}
                onValueChange={(value) => {
                  const selectedTrack = generationHistory.find((g) => g.id.toString() === value);
                  if (selectedGenerationForMixing?.id && selectedTrack) {
                    // audioUrl 복원: cacheKey가 있으면 cacheRef에서 blob 데이터로부터 새 blob URL 생성
                    let audioUrl = selectedTrack.audioUrl;
                    if (selectedTrack.cacheKey) {
                      const cached = cacheRef.current.get(selectedTrack.cacheKey);
                      if (cached?.blob) {
                        // blob 데이터가 있으면 새 blob URL 생성
                        if (!cached._audioUrl) {
                          const newUrl = URL.createObjectURL(cached.blob);
                          cacheRef.current.set(selectedTrack.cacheKey, { ...cached, _audioUrl: newUrl });
                          audioUrl = newUrl;
                        } else {
                          audioUrl = cached._audioUrl;
                        }
                        // generationHistory도 업데이트
                        setGenerationHistory((prev) => 
                          prev.map((g) => 
                            g.id === selectedTrack.id 
                              ? { ...g, audioUrl }
                              : g
                          )
                        );
                      } else if (cached?._audioUrl) {
                        audioUrl = cached._audioUrl;
                        setGenerationHistory((prev) => 
                          prev.map((g) => 
                            g.id === selectedTrack.id 
                              ? { ...g, audioUrl }
                              : g
                          )
                        );
                      }
                    }
                    
                    const state = mixingStates.get(selectedGenerationForMixing.id) || { 
                      voiceTrackVolume: 100, 
                      backgroundTrackVolume: 50, 
                      effectTrackVolume: 70 
                    };
                    setMixingStates((prev) => new Map(prev).set(selectedGenerationForMixing.id, { 
                      ...state, 
                      selectedVoiceTrack: { ...selectedTrack, audioUrl: audioUrl || selectedTrack.audioUrl }
                    }));
                    
                    // 음원 변경 시 실시간 미리듣기 중지
                    if (mixingPreviewAudio) {
                      mixingPreviewAudio.pause();
                      mixingPreviewAudio.currentTime = 0;
                      setIsMixingPreviewPlaying(false);
                    }
                  }
                }}
              >
                <SelectTrigger className="bg-gray-800/50 border-gray-600 text-white">
                  <SelectValue placeholder="믹싱할 음원을 선택하세요" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {generationHistory.map((gen) => (
                    <SelectItem 
                      key={gen.id} 
                      value={gen.id.toString()} 
                      className="text-white focus:bg-gray-700"
                    >
                      {gen.savedName || formatDateTime(gen.createdAt)}
                      {gen.duration && ` (${gen.duration.toFixed(1)}초)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {mixingStates.get(selectedGenerationForMixing?.id)?.selectedVoiceTrack && (
                <div className="mt-2 p-2 bg-gray-800/50 rounded border border-gray-700">
                  <AudioPlayer
                    audioUrl={mixingStates.get(selectedGenerationForMixing?.id)?.selectedVoiceTrack?.audioUrl}
                    title="선택된 음원"
                    duration={mixingStates.get(selectedGenerationForMixing?.id)?.selectedVoiceTrack?.duration || 0}
                  />
                </div>
              )}
            </div>
            
            {/* 타임라인 시각화 및 BGM 오프셋 조절 */}
            {mixingStates.get(selectedGenerationForMixing?.id)?.selectedVoiceTrack && (
              <div className="space-y-3 p-4 bg-gray-800/30 rounded-lg border border-gray-700">
                <Label style={{ color: '#E5E7EB' }} className="text-sm font-semibold">타임라인 (생성 음원 중심)</Label>
                <MixingTimeline
                  ttsDuration={mixingStates.get(selectedGenerationForMixing?.id)?.selectedVoiceTrack?.duration || 0}
                  bgmDuration={(() => {
                    // BGM 길이 가져오기 (uploadedBgmFile 또는 selectedBackground에서)
                    const bgmState = mixingStates.get(selectedGenerationForMixing?.id)?.selectedBackground;
                    // 실제로는 AudioBuffer의 duration을 가져와야 하지만, 여기서는 placeholder
                    return 30; // 기본값 30초
                  })()}
                  bgmOffset={mixingStates.get(selectedGenerationForMixing?.id)?.bgmOffset ?? DEFAULT_MIXING_SETTINGS.bgmOffset}
                  fadeIn={mixingStates.get(selectedGenerationForMixing?.id)?.fadeIn ?? DEFAULT_MIXING_SETTINGS.fadeIn}
                  fadeOut={mixingStates.get(selectedGenerationForMixing?.id)?.fadeOut ?? DEFAULT_MIXING_SETTINGS.fadeOut}
                  onBgmOffsetChange={(offset) => {
                    const genId = selectedGenerationForMixing?.id;
                    if (genId) {
                      const state = mixingStates.get(genId) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 };
                      setMixingStates((prev) => new Map(prev).set(genId, { ...state, bgmOffset: offset }));
                      // 실시간 미리듣기 업데이트
                      if (isMixingPreviewPlaying && mixingPreviewAudio) {
                        // 재생 중이면 재시작
                        startRealtimePreview();
                      }
                    }
                  }}
                  onFadeInChange={(fade) => {
                    const genId = selectedGenerationForMixing?.id;
                    if (genId) {
                      const state = mixingStates.get(genId) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 };
                      setMixingStates((prev) => new Map(prev).set(genId, { ...state, fadeIn: fade }));
                    }
                  }}
                  onFadeOutChange={(fade) => {
                    const genId = selectedGenerationForMixing?.id;
                    if (genId) {
                      const state = mixingStates.get(genId) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 };
                      setMixingStates((prev) => new Map(prev).set(genId, { ...state, fadeOut: fade }));
                    }
                  }}
                />
                
                {/* BGM 오프셋 상세 설정 */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-700">
                  <div className="space-y-2">
                    <Label style={{ color: '#E5E7EB' }} className="text-xs">BGM 시작: TTS 전</Label>
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[Math.max(0, -((mixingStates.get(selectedGenerationForMixing?.id)?.bgmOffset ?? 0)))]}
                        onValueChange={(values) => {
                          const genId = selectedGenerationForMixing?.id;
                          if (genId) {
                            const state = mixingStates.get(genId) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 };
                            setMixingStates((prev) => new Map(prev).set(genId, { ...state, bgmOffset: -values[0] }));
                            if (isMixingPreviewPlaying) startRealtimePreview();
                          }
                        }}
                        min={0}
                        max={30}
                        step={0.1}
                        className="flex-1"
                      />
                      <span className="text-xs text-gray-400 w-12 text-right">
                        {Math.max(0, -((mixingStates.get(selectedGenerationForMixing?.id)?.bgmOffset ?? 0))).toFixed(1)}초
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label style={{ color: '#E5E7EB' }} className="text-xs">BGM 종료: TTS 후</Label>
                    <div className="flex items-center gap-2">
                      <Slider
                        value={[Math.max(0, (mixingStates.get(selectedGenerationForMixing?.id)?.bgmOffset ?? 0))]}
                        onValueChange={(values) => {
                          const genId = selectedGenerationForMixing?.id;
                          if (genId) {
                            const state = mixingStates.get(genId) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 };
                            // TTS 후 BGM 연장 (trimEndSec 조절)
                            const ttsDuration = mixingStates.get(genId)?.selectedVoiceTrack?.duration || 0;
                            setMixingStates((prev) => new Map(prev).set(genId, { 
                              ...state, 
                              trimEndSec: ttsDuration + values[0]
                            }));
                            if (isMixingPreviewPlaying) startRealtimePreview();
                          }
                        }}
                        min={0}
                        max={30}
                        step={0.1}
                        className="flex-1"
                      />
                      <span className="text-xs text-gray-400 w-12 text-right">
                        {Math.max(0, (mixingStates.get(selectedGenerationForMixing?.id)?.trimEndSec ? 
                          (mixingStates.get(selectedGenerationForMixing?.id)?.selectedVoiceTrack?.duration || 0) - 
                          (mixingStates.get(selectedGenerationForMixing?.id)?.trimEndSec || 0) : 0)).toFixed(1)}초
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label style={{ color: '#E5E7EB' }}>배경음 선택</Label>
              <div className="space-y-2">
                <input
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file && selectedGenerationForMixing?.id) {
                      setUploadedBgmFile(file);
                      const bgmUrl = URL.createObjectURL(file);
                      const asset: MixingAsset = {
                        id: `uploaded_bgm_${Date.now()}`,
                        name: file.name,
                        type: "background",
                        url: bgmUrl,
                      };
                      const state = mixingStates.get(selectedGenerationForMixing.id) || { 
                        voiceTrackVolume: 100, 
                        backgroundTrackVolume: 50, 
                        effectTrackVolume: 70 
                      };
                      setMixingStates((prev) => new Map(prev).set(selectedGenerationForMixing.id, { 
                        ...state, 
                        selectedBackground: asset 
                      }));
                      toast({
                        title: "배경음 업로드 완료",
                        description: `${file.name}이 업로드되었습니다.`,
                      });
                    }
                  }}
                  className="hidden"
                  id="bgm-upload-input"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-600 hover:bg-gray-800 hover:text-white flex-1"
                    style={{ color: '#E5E7EB' }}
                    onClick={() => document.getElementById('bgm-upload-input')?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    MP3 파일 업로드
                  </Button>
                  {mixingStates.get(selectedGenerationForMixing?.id)?.selectedBackground && (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-gray-600 hover:bg-gray-800 hover:text-white"
                      style={{ color: '#E5E7EB' }}
                      onClick={() => {
                        const genId = selectedGenerationForMixing?.id;
                        if (genId) {
                          const state = mixingStates.get(genId) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 };
                          setMixingStates((prev) => new Map(prev).set(genId, { ...state, selectedBackground: undefined }));
                          if (uploadedBgmFile) {
                            URL.revokeObjectURL(state.selectedBackground?.url || "");
                            setUploadedBgmFile(null);
                          }
                        }
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {mixingStates.get(selectedGenerationForMixing?.id)?.selectedBackground && (
                  <div className="p-2 bg-gray-800/50 rounded border border-gray-700">
                    <div className="text-sm text-gray-300">
                      선택된 파일: {mixingStates.get(selectedGenerationForMixing?.id)?.selectedBackground?.name}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 고급 설정: 음량 조절 */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="volume-controls">
                <AccordionTrigger style={{ color: '#E5E7EB' }} className="text-sm font-semibold">
                  음량 조절
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label style={{ color: '#E5E7EB' }} className="text-sm">TTS 음량</Label>
                        <span className="text-xs text-gray-400">{mixingStates.get(selectedGenerationForMixing?.id)?.voiceTrackVolume ?? 100}%</span>
                      </div>
                      <Slider
                        value={[mixingStates.get(selectedGenerationForMixing?.id)?.voiceTrackVolume ?? 100]}
                        onValueChange={(values) => {
                          const genId = selectedGenerationForMixing?.id;
                          if (genId) {
                            const state = mixingStates.get(genId) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 };
                            setMixingStates((prev) => new Map(prev).set(genId, { ...state, voiceTrackVolume: values[0] }));
                          }
                        }}
                        min={0}
                        max={200}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label style={{ color: '#E5E7EB' }} className="text-sm">배경음 음량</Label>
                        <span className="text-xs text-gray-400">{mixingStates.get(selectedGenerationForMixing?.id)?.backgroundTrackVolume ?? 50}%</span>
                      </div>
                      <Slider
                        value={[mixingStates.get(selectedGenerationForMixing?.id)?.backgroundTrackVolume ?? 50]}
                        onValueChange={(values) => {
                          const genId = selectedGenerationForMixing?.id;
                          if (genId) {
                            const state = mixingStates.get(genId) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 };
                            setMixingStates((prev) => new Map(prev).set(genId, { ...state, backgroundTrackVolume: values[0] }));
                          }
                        }}
                        min={0}
                        max={200}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label style={{ color: '#E5E7EB' }} className="text-sm">마스터 음량</Label>
                        <span className="text-xs text-gray-400">{Math.round((mixingStates.get(selectedGenerationForMixing?.id)?.masterGain ?? DEFAULT_MIXING_SETTINGS.masterGain) * 100)}%</span>
                      </div>
                      <Slider
                        value={[(mixingStates.get(selectedGenerationForMixing?.id)?.masterGain ?? DEFAULT_MIXING_SETTINGS.masterGain) * 100]}
                        onValueChange={(values) => {
                          const genId = selectedGenerationForMixing?.id;
                          if (genId) {
                            const state = mixingStates.get(genId) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 };
                            setMixingStates((prev) => new Map(prev).set(genId, { ...state, masterGain: values[0] / 100 }));
                          }
                        }}
                        min={20}
                        max={200}
                        step={1}
                        className="w-full"
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* 페이드 설정 */}
              <AccordionItem value="fade-controls">
                <AccordionTrigger style={{ color: '#E5E7EB' }} className="text-sm font-semibold">
                  페이드 인/아웃
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label style={{ color: '#E5E7EB' }} className="text-sm">페이드 인 (초)</Label>
                        <span className="text-xs text-gray-400">{(mixingStates.get(selectedGenerationForMixing?.id)?.fadeIn ?? DEFAULT_MIXING_SETTINGS.fadeIn).toFixed(2)}s</span>
                      </div>
                      <Slider
                        value={[(mixingStates.get(selectedGenerationForMixing?.id)?.fadeIn ?? DEFAULT_MIXING_SETTINGS.fadeIn) * 10]}
                        onValueChange={(values) => {
                          const genId = selectedGenerationForMixing?.id;
                          if (genId) {
                            const state = mixingStates.get(genId) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 };
                            setMixingStates((prev) => new Map(prev).set(genId, { ...state, fadeIn: values[0] / 10 }));
                          }
                        }}
                        min={0}
                        max={50}
                        step={0.5}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label style={{ color: '#E5E7EB' }} className="text-sm">페이드 아웃 (초)</Label>
                        <span className="text-xs text-gray-400">{(mixingStates.get(selectedGenerationForMixing?.id)?.fadeOut ?? DEFAULT_MIXING_SETTINGS.fadeOut).toFixed(2)}s</span>
                      </div>
                      <Slider
                        value={[(mixingStates.get(selectedGenerationForMixing?.id)?.fadeOut ?? DEFAULT_MIXING_SETTINGS.fadeOut) * 10]}
                        onValueChange={(values) => {
                          const genId = selectedGenerationForMixing?.id;
                          if (genId) {
                            const state = mixingStates.get(genId) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 };
                            setMixingStates((prev) => new Map(prev).set(genId, { ...state, fadeOut: values[0] / 10 }));
                          }
                        }}
                        min={0}
                        max={50}
                        step={0.5}
                        className="w-full"
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* EQ 설정 */}
              <AccordionItem value="eq-controls">
                <AccordionTrigger style={{ color: '#E5E7EB' }} className="text-sm font-semibold">
                  BGM 이퀄라이저
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label style={{ color: '#E5E7EB' }} className="text-sm">Low Shelf (100Hz)</Label>
                        <span className="text-xs text-gray-400">{(mixingStates.get(selectedGenerationForMixing?.id)?.lowShelf ?? DEFAULT_MIXING_SETTINGS.lowShelf).toFixed(1)} dB</span>
                      </div>
                      <Slider
                        value={[(mixingStates.get(selectedGenerationForMixing?.id)?.lowShelf ?? DEFAULT_MIXING_SETTINGS.lowShelf) + 12]}
                        onValueChange={(values) => {
                          const genId = selectedGenerationForMixing?.id;
                          if (genId) {
                            const state = mixingStates.get(genId) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 };
                            setMixingStates((prev) => new Map(prev).set(genId, { ...state, lowShelf: values[0] - 12 }));
                          }
                        }}
                        min={0}
                        max={24}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label style={{ color: '#E5E7EB' }} className="text-sm">Mid Peaking (1kHz, Q=1)</Label>
                        <span className="text-xs text-gray-400">{(mixingStates.get(selectedGenerationForMixing?.id)?.midPeaking ?? DEFAULT_MIXING_SETTINGS.midPeaking).toFixed(1)} dB</span>
                      </div>
                      <Slider
                        value={[(mixingStates.get(selectedGenerationForMixing?.id)?.midPeaking ?? DEFAULT_MIXING_SETTINGS.midPeaking) + 12]}
                        onValueChange={(values) => {
                          const genId = selectedGenerationForMixing?.id;
                          if (genId) {
                            const state = mixingStates.get(genId) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 };
                            setMixingStates((prev) => new Map(prev).set(genId, { ...state, midPeaking: values[0] - 12 }));
                          }
                        }}
                        min={0}
                        max={24}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label style={{ color: '#E5E7EB' }} className="text-sm">High Shelf (8kHz)</Label>
                        <span className="text-xs text-gray-400">{(mixingStates.get(selectedGenerationForMixing?.id)?.highShelf ?? DEFAULT_MIXING_SETTINGS.highShelf).toFixed(1)} dB</span>
                      </div>
                      <Slider
                        value={[(mixingStates.get(selectedGenerationForMixing?.id)?.highShelf ?? DEFAULT_MIXING_SETTINGS.highShelf) + 12]}
                        onValueChange={(values) => {
                          const genId = selectedGenerationForMixing?.id;
                          if (genId) {
                            const state = mixingStates.get(genId) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 };
                            setMixingStates((prev) => new Map(prev).set(genId, { ...state, highShelf: values[0] - 12 }));
                          }
                        }}
                        min={0}
                        max={24}
                        step={0.1}
                        className="w-full"
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* 오토덕킹 설정 */}
              <AccordionItem value="ducking-controls">
                <AccordionTrigger style={{ color: '#E5E7EB' }} className="text-sm font-semibold">
                  오토덕킹 (TTS 재생 시 BGM 자동 감소)
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label style={{ color: '#E5E7EB' }} className="text-sm">오토덕킹 활성화</Label>
                      <input
                        type="checkbox"
                        checked={mixingStates.get(selectedGenerationForMixing?.id)?.duckingEnabled ?? DEFAULT_MIXING_SETTINGS.duckingEnabled}
                        onChange={(e) => {
                          const genId = selectedGenerationForMixing?.id;
                          if (genId) {
                            const state = mixingStates.get(genId) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 };
                            setMixingStates((prev) => new Map(prev).set(genId, { ...state, duckingEnabled: e.target.checked }));
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                    {mixingStates.get(selectedGenerationForMixing?.id)?.duckingEnabled ?? DEFAULT_MIXING_SETTINGS.duckingEnabled ? (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label style={{ color: '#E5E7EB' }} className="text-sm">덕킹 감소량 (dB)</Label>
                            <span className="text-xs text-gray-400">{(mixingStates.get(selectedGenerationForMixing?.id)?.duckDb ?? DEFAULT_MIXING_SETTINGS.duckDb).toFixed(1)} dB</span>
                          </div>
                          <Slider
                            value={[(mixingStates.get(selectedGenerationForMixing?.id)?.duckDb ?? DEFAULT_MIXING_SETTINGS.duckDb) + 24]}
                            onValueChange={(values) => {
                              const genId = selectedGenerationForMixing?.id;
                              if (genId) {
                                const state = mixingStates.get(genId) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 };
                                setMixingStates((prev) => new Map(prev).set(genId, { ...state, duckDb: values[0] - 24 }));
                              }
                            }}
                            min={0}
                            max={24}
                            step={0.5}
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label style={{ color: '#E5E7EB' }} className="text-sm">임계값 (dBFS)</Label>
                            <span className="text-xs text-gray-400">{(mixingStates.get(selectedGenerationForMixing?.id)?.duckThreshold ?? DEFAULT_MIXING_SETTINGS.duckThreshold).toFixed(0)} dBFS</span>
                          </div>
                          <Slider
                            value={[(mixingStates.get(selectedGenerationForMixing?.id)?.duckThreshold ?? DEFAULT_MIXING_SETTINGS.duckThreshold) + 80]}
                            onValueChange={(values) => {
                              const genId = selectedGenerationForMixing?.id;
                              if (genId) {
                                const state = mixingStates.get(genId) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 };
                                setMixingStates((prev) => new Map(prev).set(genId, { ...state, duckThreshold: values[0] - 80 }));
                              }
                            }}
                            min={0}
                            max={70}
                            step={1}
                            className="w-full"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label style={{ color: '#E5E7EB' }} className="text-sm">릴리즈 시간 (초)</Label>
                            <span className="text-xs text-gray-400">{(mixingStates.get(selectedGenerationForMixing?.id)?.duckRelease ?? DEFAULT_MIXING_SETTINGS.duckRelease).toFixed(2)}s</span>
                          </div>
                          <Slider
                            value={[(mixingStates.get(selectedGenerationForMixing?.id)?.duckRelease ?? DEFAULT_MIXING_SETTINGS.duckRelease) * 100]}
                            onValueChange={(values) => {
                              const genId = selectedGenerationForMixing?.id;
                              if (genId) {
                                const state = mixingStates.get(genId) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 };
                                setMixingStates((prev) => new Map(prev).set(genId, { ...state, duckRelease: values[0] / 100 }));
                              }
                            }}
                            min={0}
                            max={100}
                            step={1}
                            className="w-full"
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            
            {/* 실시간 미리듣기 */}
            <div className="space-y-2 p-3 bg-gray-800/50 rounded border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <Label style={{ color: '#E5E7EB' }} className="text-sm font-semibold">실시간 미리듣기</Label>
                <div className="flex gap-2">
                  {!isMixingPreviewPlaying ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-blue-600 hover:bg-blue-800 hover:text-white text-xs"
                      style={{ color: '#E5E7EB' }}
                      onClick={startRealtimePreview}
                      disabled={!mixingStates.get(selectedGenerationForMixing?.id)?.selectedVoiceTrack}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      실시간 재생
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-600 hover:bg-red-800 hover:text-white text-xs"
                      style={{ color: '#E5E7EB' }}
                      onClick={stopRealtimePreview}
                    >
                      <Pause className="w-3 h-3 mr-1" />
                      정지
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-600 hover:bg-gray-800 hover:text-white text-xs"
                    style={{ color: '#E5E7EB' }}
                    onClick={() => handleExportMix("wav")}
                    disabled={!previewMixedAudio}
                  >
                    WAV 다운로드
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-600 hover:bg-gray-800 hover:text-white text-xs"
                    style={{ color: '#E5E7EB' }}
                    onClick={() => handleExportMix("mp3")}
                    disabled={!previewMixedAudio}
                  >
                    MP3 다운로드
                  </Button>
                </div>
              </div>
              {isMixingPreviewPlaying && (
                <div className="space-y-2">
                  <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 transition-all duration-100"
                      style={{ width: `${mixingPreviewProgress}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 text-center">
                    {mixingPreviewProgress.toFixed(0)}%
                  </div>
                </div>
              )}
              {previewMixedAudio && !isMixingPreviewPlaying && (
                <AudioPlayer
                  audioUrl={previewMixedAudio}
                  title="믹싱된 음원 (최종)"
                  duration={0}
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              className="border-gray-600 hover:bg-gray-800 hover:text-white" 
              style={{ color: '#E5E7EB' }} 
              onClick={() => {
                setIsMixingModalOpen(false);
                setPreviewMixedAudio(null);
              }}
            >
              취소
            </Button>
            <Button 
              variant="outline"
              className="border-gray-600 hover:bg-gray-800 hover:text-white" 
              style={{ color: '#E5E7EB' }}
              disabled={isMixingAudio}
              onClick={async () => {
                const state = mixingStates.get(selectedGenerationForMixing?.id);
                if (!state?.selectedVoiceTrack) {
                  toast({ 
                    title: "음원 선택 필요", 
                    description: "믹싱할 음원을 선택해주세요.",
                    variant: "destructive"
                  });
                  return;
                }
                await performMixing(state);
              }}
            >
              {isMixingAudio ? "믹싱 중..." : "미리듣기"}
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white" 
              onClick={() => {
                const state = mixingStates.get(selectedGenerationForMixing?.id);
                if (!state?.selectedVoiceTrack) {
                  toast({ 
                    title: "음원 선택 필요", 
                    description: "믹싱할 음원을 선택해주세요.",
                    variant: "destructive"
                  });
                  return;
                }
                handleMixingSubmit({ 
                  background: state.selectedBackground?.id
                });
              }}
            >
              완료
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 이름 저장 다이얼로그 */}
      <Dialog open={isSaveNameDialogOpen} onOpenChange={setIsSaveNameDialogOpen}>
        <DialogContent className="sm:max-w-lg dark-dialog bg-gray-900/95 border-gray-700">
          <DialogHeader>
            <DialogTitle style={{ color: '#FFFFFF' }}>음원 저장</DialogTitle>
            <DialogDescription style={{ color: '#E5E7EB' }}>
              생성된 음원에 이름을 지정하여 저장하세요. 이름을 지정하지 않으면 생성 날짜가 표시됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label style={{ color: '#E5E7EB' }}>저장 이름 (선택사항)</Label>
              <Input
                value={saveNameInput}
                onChange={(e) => setSaveNameInput(e.target.value)}
                placeholder="예: 신년인사 메시지"
                className="bg-gray-800/50 border-gray-600 text-white"
                style={{ color: '#FFFFFF' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const savedName = saveNameInput.trim() || null;
                    if (pendingGeneration) {
                      pushHistory({
                        ...pendingGeneration,
                        savedName,
                      });
                    }
                    setIsSaveNameDialogOpen(false);
                    setSaveNameInput("");
                    setPendingGeneration(null);
                  }
                }}
              />
              <p className="text-xs text-gray-400">
                이름을 입력하지 않으면 생성 날짜({pendingGeneration ? formatDateTime(pendingGeneration.createdAt) : ""})가 표시됩니다.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-gray-600 hover:bg-gray-800 hover:text-white"
              style={{ color: '#E5E7EB' }}
              onClick={() => {
                setIsSaveNameDialogOpen(false);
                setSaveNameInput("");
                setPendingGeneration(null);
              }}
            >
              취소
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                const savedName = saveNameInput.trim() || null;
                if (pendingGeneration) {
                  pushHistory({
                    ...pendingGeneration,
                    savedName,
                  });
                  toast({
                    title: "음원 저장 완료",
                    description: savedName ? `"${savedName}"으로 저장되었습니다.` : "생성 날짜로 저장되었습니다.",
                  });
                }
                setIsSaveNameDialogOpen(false);
                setSaveNameInput("");
                setPendingGeneration(null);
              }}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen}>
        <DialogContent className="sm:max-w-lg dark-dialog bg-gray-900/95 border-gray-700">
          <DialogHeader>
            <DialogTitle style={{ color: '#FFFFFF' }}>예약 전송 설정</DialogTitle>
            <DialogDescription style={{ color: '#E5E7EB' }}>음성을 전송할 채널과 시간을 설정합니다. (기준시간: Asia/Seoul)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schedule-channel" style={{ color: '#E5E7EB' }}>전송 채널 *</Label>
              <Select>
                <SelectTrigger className="bg-gray-800/50 border-gray-600 text-white"><SelectValue placeholder="전송 채널을 선택하세요" /></SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {scheduleChannels.map((ch) => (
                    <SelectItem key={ch.value} value={ch.value} className="text-white focus:bg-gray-700">
                      <div className="flex flex-col">
                        <span>{ch.label}</span>
                        {ch.description && (
                          <span className="text-xs text-gray-400 mt-0.5">{ch.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-time" style={{ color: '#E5E7EB' }}>전송 시간 *</Label>
              <Input type="datetime-local" id="schedule-time" className="bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-400 focus-visible:ring-gray-500" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-repeat" style={{ color: '#E5E7EB' }}>반복 옵션</Label>
              <Select defaultValue="once">
                <SelectTrigger className="bg-gray-800/50 border-gray-600 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  <SelectItem value="once" className="text-white focus:bg-gray-700">1회 전송</SelectItem>
                  <SelectItem value="daily" className="text-white focus:bg-gray-700">매일</SelectItem>
                  <SelectItem value="weekly" className="text-white focus:bg-gray-700">매주</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-gray-600 hover:bg-gray-800 hover:text-white" style={{ color: '#E5E7EB' }} onClick={() => setIsScheduleModalOpen(false)}>취소</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleScheduleSubmit({ channel: "", scheduledTime: "", repeatOption: "once" })}>예약 등록</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMonitoringPanelOpen} onOpenChange={setIsMonitoringPanelOpen}>
        <DialogContent className="sm:max-w-2xl max-h-96 overflow-y-auto dark-dialog bg-gray-900/95 border-gray-700">
          <DialogHeader>
            <DialogTitle style={{ color: '#FFFFFF' }}>운영 모니터링</DialogTitle>
            <DialogDescription style={{ color: '#E5E7EB' }}>최근 API 호출, 오류, 경고 이벤트 로그</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm" style={{ color: '#FFFFFF' }}>사용량 통계</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-800/50 p-3 rounded border border-gray-600">
                  <div style={{ color: '#9CA3AF' }}>월별 호출</div>
                  <div className="text-xl font-bold" style={{ color: '#FFFFFF' }}>{usageStats.callsThisMonth}회</div>
                </div>
                <div className="bg-gray-800/50 p-3 rounded border border-gray-600">
                  <div style={{ color: '#9CA3AF' }}>월별 생성시간</div>
                  <div className="text-xl font-bold" style={{ color: '#FFFFFF' }}>{Math.round(usageStats.durationThisMonth / 60)}분</div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm" style={{ color: '#FFFFFF' }}>최근 이벤트 로그</h4>
              <ScrollArea className="h-48 border border-gray-600 rounded p-3 bg-gray-800/30">
                <div className="space-y-2">
                  {operationLogs.length === 0 ? (
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>로그가 없습니다.</p>
                  ) : (
                    operationLogs.map((log) => (
                      <div key={log.id} className={`text-xs p-2 rounded border-l-2 ${
                        log.type === "error" ? "border-red-400 bg-red-900/30" :
                        log.type === "warning" ? "border-orange-400 bg-orange-900/30" :
                        log.type === "success" ? "border-green-400 bg-green-900/30" :
                        "border-blue-400 bg-blue-900/30"
                      }`}>
                        <div className="font-medium" style={{ color: '#FFFFFF' }}>{log.message}</div>
                        <div className="text-[10px]" style={{ color: '#9CA3AF' }}>{new Date(log.timestamp).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 메시지 이력 관리 다이얼로그 */}
      <Dialog open={isMessageHistoryOpen} onOpenChange={setIsMessageHistoryOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] dark-dialog bg-gray-900/95 border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: '#FFFFFF' }}>
              <History className="w-5 h-5" />
              메시지 이력 관리
            </DialogTitle>
            <DialogDescription style={{ color: '#E5E7EB' }}>
              저장된 메시지를 확인하고, 불러오거나 수정, 삭제할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-3">
              {messageHistory.length === 0 ? (
                <div className="text-center py-8" style={{ color: '#9CA3AF' }}>
                  저장된 메시지가 없습니다.
                </div>
              ) : (
                messageHistory.map((msg) => {
                  const purposeLabel = purposeOptions.find(p => p.id === msg.purpose)?.label || msg.purpose;
                  return (
                    <div key={msg.id} className="p-4 border border-gray-600 rounded-lg space-y-3 hover:bg-gray-800/50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs border-gray-600" style={{ color: '#E5E7EB', backgroundColor: 'rgba(75, 85, 99, 0.3)' }}>
                              {purposeLabel}
                            </Badge>
                            <span className="text-xs" style={{ color: '#9CA3AF' }}>
                              {new Date(msg.updatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                            </span>
                          </div>
                          <p className="text-sm line-clamp-3" style={{ color: '#FFFFFF' }}>{msg.text}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:bg-gray-800"
                            onClick={() => {
                              setCustomText(msg.text);
                              setSelectedPurpose(msg.purpose);
                              setIsMessageHistoryOpen(false);
                              toast({
                                title: "메시지 불러오기 완료",
                                description: "메시지가 편집 영역에 로드되었습니다.",
                              });
                            }}
                          >
                            <Edit className="w-4 h-4" style={{ color: '#E5E7EB' }} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="hover:bg-gray-800"
                            onClick={() => {
                              const updated = messageHistory.filter(m => m.id !== msg.id);
                              setMessageHistory(updated);
                              localStorage.setItem(MESSAGE_HISTORY_STORAGE_KEY, JSON.stringify(updated));
                              toast({
                                title: "메시지 삭제 완료",
                                description: "메시지가 삭제되었습니다.",
                              });
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button 
              variant="outline" 
              className="border-gray-600 hover:bg-gray-800 hover:text-white"
              style={{ color: '#E5E7EB' }}
              onClick={() => setIsMessageHistoryOpen(false)}
            >
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog */}
      <AlertDialog open={alertDialog.open} onOpenChange={(open) => setAlertDialog({ ...alertDialog, open })}>
        <AlertDialogContent className="dark-dialog bg-gray-900/95 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: '#FFFFFF' }}>{alertDialog.title}</AlertDialogTitle>
            <AlertDialogDescription style={{ color: '#E5E7EB' }}>{alertDialog.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setAlertDialog({ ...alertDialog, open: false });
              if (alertDialog.onConfirm) alertDialog.onConfirm();
            }}>
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 끊어읽기 구간 추가 다이얼로그 */}
      <Dialog open={isPauseSegmentDialogOpen} onOpenChange={setIsPauseSegmentDialogOpen}>
        <DialogContent className="sm:max-w-lg dark-dialog bg-gray-900/95 border-gray-700">
          <DialogHeader>
            <DialogTitle style={{ color: '#FFFFFF' }}>끊어읽기 구간 추가</DialogTitle>
            <DialogDescription style={{ color: '#E5E7EB' }}>
              텍스트의 특정 위치에 일시정지를 삽입합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-white">위치 (문자 인덱스)</Label>
              <div className="space-y-2">
                <Slider
                  value={[newPauseSegment.position]}
                  onValueChange={(value) => setNewPauseSegment(prev => ({ ...prev, position: value[0] }))}
                  min={0}
                  max={Math.max(0, customText.length - 1)}
                  step={1}
                  className="w-full"
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={newPauseSegment.position}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(Math.max(0, customText.length - 1), parseInt(e.target.value) || 0));
                      setNewPauseSegment(prev => ({ ...prev, position: val }));
                    }}
                    className="flex-1 bg-gray-800/50 border-gray-600 text-white"
                    min={0}
                    max={Math.max(0, customText.length - 1)}
                  />
                  <span className="text-sm text-gray-400">/ {Math.max(0, customText.length - 1)}</span>
                </div>
                {customText && (
                  <div className="p-2 bg-gray-800/50 rounded text-xs text-gray-300">
                    <span className="text-gray-500">
                      {customText.slice(Math.max(0, newPauseSegment.position - 10), newPauseSegment.position)}
                    </span>
                    <span className="bg-blue-500/30 px-1">
                      {customText[newPauseSegment.position] || '|'}
                    </span>
                    <span className="text-gray-400">
                      {customText.slice(newPauseSegment.position + 1, Math.min(customText.length, newPauseSegment.position + 11))}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-white">일시정지 시간 (초)</Label>
              <div className="space-y-2">
                <Slider
                  value={[newPauseSegment.duration]}
                  onValueChange={(value) => setNewPauseSegment(prev => ({ ...prev, duration: value[0] }))}
                  min={0.1}
                  max={5}
                  step={0.1}
                  className="w-full"
                />
                <Input
                  type="number"
                  value={newPauseSegment.duration}
                  onChange={(e) => {
                    const val = Math.max(0.1, Math.min(5, parseFloat(e.target.value) || 0.5));
                    setNewPauseSegment(prev => ({ ...prev, duration: val }));
                  }}
                  className="flex-1 bg-gray-800/50 border-gray-600 text-white"
                  min={0.1}
                  max={5}
                  step={0.1}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
              onClick={() => setIsPauseSegmentDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={() => {
                if (customText && newPauseSegment.position >= 0 && newPauseSegment.position <= customText.length) {
                  setVoiceSettings(prev => ({
                    ...prev,
                    pause: {
                      ...prev.pause,
                      segments: [...prev.pause.segments, { ...newPauseSegment }]
                    }
                  }));
                  setIsPauseSegmentDialogOpen(false);
                  toast({
                    title: "구간 추가 완료",
                    description: `${newPauseSegment.position}번째 문자 위치에 ${newPauseSegment.duration}초 일시정지가 추가되었습니다.`,
                  });
                }
              }}
            >
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 음원 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteConfirmDialog.open} onOpenChange={(open) => setDeleteConfirmDialog({ open, id: open ? deleteConfirmDialog.id : null })}>
        <AlertDialogContent className="dark-dialog bg-gray-900/95 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: '#FFFFFF' }}>음원 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription style={{ color: '#E5E7EB' }}>
              정말 이 음원을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-600 hover:bg-gray-800 hover:text-white" style={{ color: '#E5E7EB' }}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deleteConfirmDialog.id) {
                  deleteGeneration(deleteConfirmDialog.id);
                }
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 템플릿 변수 미교체 경고 다이얼로그 */}
      <AlertDialog open={templateVariableWarning.open} onOpenChange={(open) => setTemplateVariableWarning({ ...templateVariableWarning, open })}>
        <AlertDialogContent className="dark-dialog bg-gray-900/95 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: '#FFFFFF' }}>템플릿 변수 미교체</AlertDialogTitle>
            <AlertDialogDescription style={{ color: '#E5E7EB' }}>
              다음 변수가 실제 내용으로 교체되지 않았습니다:
              <div className="mt-2 p-3 bg-gray-800/50 rounded-lg">
                {templateVariableWarning.variables.map((v, idx) => (
                  <div key={idx} className="text-sm font-mono text-yellow-400">
                    {'{'}{v}{'}'}
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-gray-400">
                변수를 그대로 두고 생성하면 음성에 "{'{'}기관명{'}'}", "{'{'}담당자명{'}'}" 같은 문구가 그대로 읽힙니다.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="border-gray-600 hover:bg-gray-800 hover:text-white w-full sm:w-auto" style={{ color: '#E5E7EB' }}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
              onClick={() => {
                // 템플릿 변수 입력 다이얼로그로 이동
                setTemplateVariableWarning({ ...templateVariableWarning, open: false });
                // 템플릿 변수 입력 섹션으로 스크롤
                setTimeout(() => {
                  const templateSection = document.getElementById('template-variable-input');
                  if (templateSection) {
                    templateSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    templateSection.focus();
                  } else {
                    toast({
                      title: "템플릿 변수 입력",
                      description: "위의 템플릿 변수 입력 섹션에서 변수를 교체해주세요.",
                    });
                  }
                }, 100);
              }}
            >
              변수 교체하러 가기
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700 text-white w-full sm:w-auto"
              onClick={async () => {
                // 변수 그대로 두고 생성 진행
                setTemplateVariableWarning({ ...templateVariableWarning, open: false });
                await proceedWithGeneration(templateVariableWarning.text);
              }}
            >
              그대로 생성하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PublicVoiceGenerator;

