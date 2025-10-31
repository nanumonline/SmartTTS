import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import HomeButton from "@/components/HomeButton";
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
  Star
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import AudioPlayer from "@/components/AudioPlayer";

type CloneFormState = {
  targetName: string;
  baseVoiceId: string;
  language: string;
  memo: string;
  sampleFile: File | null;
  sampleName?: string;
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
  selectedBackground?: MixingAsset;
  selectedEffect?: MixingAsset;
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
  const [openAIPrompt, setOpenAIPrompt] = useState("");
  const [openAIInstruction, setOpenAIInstruction] = useState("");
  const [lastAIPrompt, setLastAIPrompt] = useState("");
  const [lastAIInstruction, setLastAIInstruction] = useState("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("formal_male");
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [allVoices, setAllVoices] = useState<any[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [voiceSearchLanguage, setVoiceSearchLanguage] = useState<string>("ko");
  const [voiceSearchStyle, setVoiceSearchStyle] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [generatedDuration, setGeneratedDuration] = useState<number>(0);
  const [predictedDuration, setPredictedDuration] = useState<number | null>(null);
  const [isPredictingDuration, setIsPredictingDuration] = useState(false);
  const [selectedVoiceInfo, setSelectedVoiceInfo] = useState<any | null>(null);
  const [playingSample, setPlayingSample] = useState<string | null>(null);
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
  const cacheRef = useRef<Map<string, { audioUrl: string; duration: number | null; mimeType?: string }>>(new Map());
  const cloneTimeoutsRef = useRef<number[]>([]);
  const [generationHistory, setGenerationHistory] = useState<any[]>([]);
  const [metaOverrides, setMetaOverrides] = useState<{ language: string; style: string; model: string }>({ language: "", style: "", model: "" });
  const [favoriteVoiceIds, setFavoriteVoiceIds] = useState<Set<string>>(new Set());
  const [selectedPurpose, setSelectedPurpose] = useState<string>("announcement");
  const [cloneRequests, setCloneRequests] = useState<CloneRequest[]>([]);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const createCloneForm = useCallback((overrides?: Partial<CloneFormState>): CloneFormState => ({
    targetName: "",
    baseVoiceId: "",
    language: "ko",
    memo: "",
    sampleFile: null,
    sampleName: undefined,
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
  const [selectedGenerationForSchedule, setSelectedGenerationForSchedule] = useState<any>(null);

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

  // 믹싱 자산 라이브러리 (사전정의)
  const mixingAssetLibrary: MixingAsset[] = [
    { id: "bg_silence", name: "무음", type: "background" },
    { id: "bg_office", name: "사무실 배경음", type: "background", duration: 3600 },
    { id: "bg_nature", name: "자연음", type: "background", duration: 3600 },
    { id: "effect_bell", name: "벨소리", type: "effect", duration: 2 },
    { id: "effect_chime", name: "칩음", type: "effect", duration: 1.5 },
  ];

  // 전송 채널 옵션
  const scheduleChannels = [
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
  const useCaseOptions = [
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

  const purposeOptions = [
    {
      id: "announcement",
      label: "공공 공지",
      description: "긴급 안내·재난 알림 등 즉시 전파가 필요한 방송",
      checklist: ["대상과 지역을 명확히 언급했는가?", "비상 연락처를 포함했는가?", "지시 사항이 명확한가?"],
    },
    {
      id: "event",
      label: "행사 축사",
      description: "시장·도지사 등 주요 인사의 행사 축사",
      checklist: ["행사명/일시/장소를 포함했는가?", "감사 인사와 기대 메시지가 있는가?", "기관 identity가 드러나는가?"],
    },
    {
      id: "promotion",
      label: "홍보/광고",
      description: "관광·정책·캠페인 홍보 방송",
      checklist: ["핵심 메시지가 3문장 이내로 명확한가?", "콜 투 액션이 있는가?", "대상 채널에 맞는 톤인가?"],
    },
    {
      id: "service",
      label: "서비스 안내",
      description: "민원·공공서비스 이용 안내",
      checklist: ["접수 방법과 운영시간을 포함했는가?", "필수 서류/준비물을 안내했는가?", "문의 경로를 제시했는가?"],
    },
  ];

  // Supertone API 엔드포인트 (공식 레퍼런스: https://docs.supertoneapi.com/en/api-reference/introduction)
  const SUPABASE_PROXY_BASE_URL = "https://gxxralruivyhdxyftsrg.supabase.co/functions/v1/supertone-proxy";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4eHJhbHJ1aXZ5aGR4eWZ0c3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NDM0MzQsImV4cCI6MjA3NzIxOTQzNH0.6lJjJq15spXWrktl-8d5qXI3L5FHkyaEArWiH2R5AjA";
  const SUPERTONE_API_BASE_URL = "https://supertoneapi.com/v1";
  const MOCK_AUDIO_BASE64 = "UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBzqO0fPTgjMGHm7A7+OZURE=";

  const getSpeedMultiplier = () => {
    const preset = voiceSettings.readingSpeed.preset;
    if (preset === "빠름") return 1.3;
    if (preset === "느림") return 0.7;
    return 1.0;
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
        })
      );
    }
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

  const handleMixingSubmit = (form: { background?: string; effect?: string }) => {
    if (!selectedGenerationForMixing?.id) return;
    const genId = selectedGenerationForMixing.id;
    const bg = form.background ? mixingAssetLibrary.find((x) => x.id === form.background) : undefined;
    const ef = form.effect ? mixingAssetLibrary.find((x) => x.id === form.effect) : undefined;
    const mixingState = mixingStates.get(genId) || {
      voiceTrackVolume: 100,
      backgroundTrackVolume: 50,
      effectTrackVolume: 70,
    };
    const updated = { ...mixingState, selectedBackground: bg, selectedEffect: ef };
    setMixingStates((prev) => new Map(prev).set(genId, updated));
    setIsMixingModalOpen(false);
    toast({ title: "믹싱 설정 저장", description: "음원이 믹싱되었습니다." });
  };

  const handleScheduleSubmit = (form: { channel: string; scheduledTime: string; repeatOption: "once" | "daily" | "weekly" }) => {
    if (!selectedGenerationForSchedule?.id) return;
    const newSchedule: ScheduleRequest = {
      id: Date.now(),
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
      id: Date.now(),
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

  const handleCloneSubmit = () => {
    if (!cloneForm.targetName.trim()) {
      toast({ title: "대상 이름을 입력해주세요", variant: "destructive" });
      return;
    }
    if (!cloneForm.baseVoiceId) {
      toast({ title: "기준 음성을 선택해주세요", variant: "destructive" });
      return;
    }
    if (!cloneForm.sampleFile && !cloneForm.sampleName) {
      toast({ title: "샘플 음성을 업로드해주세요", variant: "destructive" });
      return;
    }

    const base = getVoiceMeta(cloneForm.baseVoiceId);
    const sampleName = cloneForm.sampleFile?.name || cloneForm.sampleName || "sample.wav";
    const id = Date.now();
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

    toast({ title: "클로닝 요청 접수", description: "샘플을 분석 중입니다." });

    const timer = window.setTimeout(() => {
      const completionTime = new Date().toISOString();
      const completedClone: CloneRequest = { ...newClone, status: "completed", completedAt: completionTime };
      setCloneRequests((prev) => prev.map((cl) => (cl.id === newClone.id ? completedClone : cl)));
      registerCloneVoice(completedClone);
      toast({ title: "클로닝 완료", description: `${completedClone.voiceName} 음성이 추가되었습니다.` });
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
          audioUrl: URL.createObjectURL(blob),
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
          audioUrl: URL.createObjectURL(remoteBlob),
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
      audioUrl: URL.createObjectURL(blob),
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
              id: item.id || Date.now() + index,
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
            const id = item.id || Date.now() + index;
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
      preset: "normal",
      customTime: "3.5"
    },
    pause: {
      duration: 0.1,
      segments: []
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

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template.id);
    const context: Record<string, string> = {
      "기관명": user?.organization || "귀 기관",
      "담당자명": (user as any)?.full_name || (user as any)?.name || (user as any)?.email?.split("@")[0] || "담당자",
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
      "일시": new Date().toLocaleString(),
      "장소": "",
      "연구분야": "",
    };
    const replaced = template.template.replace(/\{([^}]+)\}/g, (_, key) => {
      const k = String(key).trim();
      return (context[k] ?? `{${k}}`);
    });
    setCustomText(replaced);
  };

  // Supertone API에서 음성 목록 가져오기 (Supabase Edge Function 프록시 사용)
  // 공식 레퍼런스: https://docs.supertoneapi.com/en/api-reference/endpoints/list-voices
  const fetchVoices = async () => {
    setIsLoadingVoices(true);
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
        // 초기 로드시 전체 자동 로드 (완화된 속도)
        if (nextToken) {
          await autoLoadVoicesThrottled(50, 200);
        }
      } else if (response) {
        console.warn("음성 목록 로드 실패(프록시):", await response.text());
      }
    } catch (e: any) {
      console.warn("음성 목록 로드 예외(프록시):", e.message);
    }

    if (!voicesLoaded) {
      console.warn("⚠️ 음성 목록을 가져올 수 없어 기본 목록을 사용합니다.");
      setAvailableVoices([]);
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
    const path = buildVoiceQueryPath(voiceFilters, { limit: "100", nextPageToken: useToken as string, pageToken: useToken as string });
    const response = await fetchWithSupabaseProxy(path, { method: "GET" });
    if (response?.ok) {
      let data: any = {};
      try { data = await response.json(); } catch {}
      const results = data.items || (Array.isArray(data) ? data : (data.voices || data.data || []));
      if (results?.length) {
        setAllVoices(prev => [...prev, ...results]);
        setAvailableVoices(prev => [...prev, ...results]);
        setVoiceSearchResults(prev => applyClientFilters([...prev, ...results], voiceFilters));
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

  const autoLoadVoicesThrottled = async (maxPages = 5, delayMs = 300) => {
    if (isAutoLoadingRef.current) return;
    isAutoLoadingRef.current = true;
    try {
      let pages = 0;
      let token: string | null = voiceNextToken;
      while (token && pages < maxPages) {
        const { nextToken } = await loadMoreVoices(token);
        token = nextToken;
        pages++;
        if (!token) break;
        await sleep(delayMs);
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
    }
  }, [isVoiceFinderOpen]);

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


  // 컴포넌트 마운트 시 음성 목록 로드
  useEffect(() => {
    fetchVoices();
    startUsagePolling();
  }, []);

  // 텍스트 변경 시 예상 오디오 길이 자동 예측
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (customText.trim() && selectedVoice && customText.length <= 300) {
        // 실제 API voice_id인 경우에만 예측 (기본 음성은 스킵)
        const isRealVoiceId = availableVoices.some((v: any) => v.voice_id === selectedVoice) || 
                             !voiceStyles.some((v: any) => v.id === selectedVoice);
        
        if (isRealVoiceId) {
          setIsPredictingDuration(true);
          const duration = await predictDuration(customText, selectedVoice);
          setPredictedDuration(duration);
          setIsPredictingDuration(false);
        } else {
          // 기본 음성 목록 사용 시 대략적인 추정
          const estimated = customText.length * 0.1 / (voiceSettings.readingSpeed.preset === "빠름" ? 1.3 : voiceSettings.readingSpeed.preset === "느림" ? 0.7 : 1.0);
          setPredictedDuration(Math.round(estimated * 100) / 100);
        }
      } else {
        setPredictedDuration(null);
      }
    }, 500); // 디바운싱: 500ms 후 예측

    return () => clearTimeout(timer);
  }, [customText, selectedVoice, voiceSettings.readingSpeed.preset, availableVoices]);

  // 예상 오디오 길이 예측 함수 (Supabase Edge Function 프록시 사용)
  // 참고: https://docs.supertoneapi.com/en/user-guide/text-to-speech
  // 이 API는 크레딧을 소비하지 않음
  const predictDuration = async (text: string, voiceId: string): Promise<number | null> => {
    if (!text.trim() || !voiceId) return null;
    try {
      const response = await fetchWithSupabaseProxy(`/predict-duration/${voiceId}`, {
        method: "POST",
        body: JSON.stringify({ text, language: "ko", style: "neutral" }),
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

  const handleGenerateVoice = async () => {
    const trimmedText = customText.trim();
    if (!trimmedText) {
      alert("텍스트를 입력해주세요.");
      return;
    }

    if (!selectedVoice) {
      alert("음성 스타일을 선택해주세요.");
      return;
    }

    if (trimmedText.length > 300) {
      alert(`텍스트가 너무 깁니다. 최대 300자까지 입력 가능합니다. (현재: ${trimmedText.length}자)`);
      return;
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

    const styleValue = (metaOverrides.style || voiceSettings.emotion.customPrompt) ||
      (voiceSettings.emotion.preset === "A" ? "neutral" :
       voiceSettings.emotion.preset === "B" ? "happy" : "neutral");

    const speedValue = getSpeedMultiplier();
    const pitchShift = Math.max(-12, Math.min(12, Math.round(voiceSettings.pitch / 8.33)));

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
      text: trimmedText,
      voiceId: selectedVoice,
      language: chosenLanguage,
      model: chosenModel,
      style: styleValue,
      speed: speedValue,
      pitchShift,
    });
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      cleanupGeneratedAudioUrl(generatedAudio);
      setGeneratedAudio(cached.audioUrl);
      setGeneratedDuration((cached.duration ?? estimateDurationFromText(trimmedText)) || 0);
      setPredictedDuration(cached.duration ?? null);
      toast({ title: "✅ 캐시 재사용", description: "이전에 생성한 동일한 음원을 재사용했습니다." });
      return;
    }

    setIsGenerating(true);

    const requestBody: Record<string, any> = {
      text: trimmedText,
      language: chosenLanguage,
      style: styleValue,
      model: chosenModel,
      voice_settings: {
        speed: speedValue,
        pitch_shift: pitchShift,
        pitch_variance: 1,
      },
    };

    const estimatedDuration = estimateDurationFromText(trimmedText);

    try {
      cleanupGeneratedAudioUrl(generatedAudio);

      let audioResult: { audioUrl: string; duration: number | null; mimeType?: string } | null = null;
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
            const minimalBody: Record<string, any> = { text: trimmedText };
            if (chosenLanguage) minimalBody.language = chosenLanguage;
            const retryResp = await fetchWithSupabaseProxy(`/text-to-speech/${selectedVoice}?output_format=mp3`, {
              method: "POST",
              body: JSON.stringify(minimalBody),
            });
            if (retryResp?.ok) {
              audioResult = await parseSupertoneResponse(retryResp);
              console.log("✅ 최소 필드로 재시도 성공");
              finalFailed = false;
              toast({ title: "⚠️ 제한된 옵션으로 생성", description: "일부 파라미터 미지원으로 기본값으로 생성되었습니다.", });
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
          toast({ title: "❌ 음성 생성 실패", description: firstErrorMsg, variant: "destructive" });
        }
      }

      // 2. Mock 폴백
      let usedMock = false;
      if (!audioResult) {
        source = "Mock";
        usedMock = true;
        const blob = base64ToBlob(MOCK_AUDIO_BASE64, "audio/wav");
        audioResult = {
          audioUrl: URL.createObjectURL(blob),
          duration: estimatedDuration,
          mimeType: "audio/wav",
        };
      }

      if (!audioResult) {
        throw new Error("음성 데이터를 생성할 수 없습니다.");
      }

      const finalDuration = audioResult.duration ?? predictedDuration ?? estimatedDuration;
      const roundedDuration = Math.round(finalDuration * 100) / 100;

      setGeneratedAudio(audioResult.audioUrl);
      setGeneratedDuration(roundedDuration);
      setPredictedDuration(roundedDuration);

      const description = usedMock
        ? `Mock 오디오로 대체되었습니다. 예상 길이: ${roundedDuration.toFixed(2)}초`
        : `오디오 길이: ${roundedDuration.toFixed(2)}초 | 형식: ${audioResult.mimeType || "알 수 없음"}`;

      toast({
        title: "✅ 음성 생성 완료",
        description,
      });

      console.log(`음성 생성 성공 - ${source}`);

      // 캐시에 저장 및 이력 기록
      cacheRef.current.set(cacheKey, audioResult);
      pushHistory({
        id: Date.now(),
        cacheKey,
        purpose: selectedPurpose,
        purposeLabel: purposeMeta.label,
        voiceId: selectedVoice,
        voiceName: getVoiceDisplayName(selectedVoice),
        language: chosenLanguage,
        model: chosenModel,
        style: styleValue,
        speed: speedValue,
        pitchShift,
        textPreview: trimmedText.slice(0, 120),
        textLength: trimmedText.length,
        duration: roundedDuration,
        createdAt: new Date().toISOString(),
        status: usedMock ? "mock" : "ready",
        hasAudio: !usedMock,
      });
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
    }
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
      alert("다운로드 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold gradient-text">공공기관 음성 생성</h1>
              <p className="text-muted-foreground mt-1">지자체장 및 기관장 음성 메시지 생성</p>
              {user && (
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
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
        <Card className="mb-8">
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
                    className={`h-auto flex flex-col items-start gap-1 text-left ${active ? "border-primary" : ""}`}
                    onClick={() => setSelectedPurpose(option.id)}
                  >
                    <span className="text-sm font-semibold">{option.label}</span>
                    <span className="text-xs text-muted-foreground leading-snug">{option.description}</span>
                  </Button>
                );
              })}
            </div>
            <div className="rounded-lg border border-dashed p-4 bg-muted/30">
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
            <Card>
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
            <Card>
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="voice">음성 스타일 *</Label>
                    {isLoadingVoices && (
                      <span className="text-xs text-muted-foreground">음성 목록 로드 중...</span>
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
                    <Select onValueChange={(v) => {
                      setSelectedVoice(v);
                      const voice = availableVoices.find((vv: any) => vv.voice_id === v);
                      setSelectedVoiceInfo(voice || null);
                    }}>
                      <SelectTrigger className="h-9 w-48">
                        <SelectValue placeholder="즐겨찾기에서 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(favoriteVoiceIds).map((vid) => {
                          const v = availableVoices.find((x: any) => x.voice_id === vid);
                          if (!v) return null;
                          return (
                            <SelectItem key={vid} value={vid}>{v.name || vid}</SelectItem>
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
                    목록 새로고침
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

                {/* 텍스트 입력 및 OpenAI 보조 */}
                <div className="space-y-4">
                  <Tabs defaultValue="manual" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="manual">직접 작성</TabsTrigger>
                      <TabsTrigger value="ai-generate">OpenAI로 작성</TabsTrigger>
                      <TabsTrigger value="ai-edit">OpenAI로 수정</TabsTrigger>
                    </TabsList>

                    <TabsContent value="manual" className="mt-3 text-xs text-muted-foreground">
                      텍스트를 직접 입력하세요.
                    </TabsContent>

                    <TabsContent value="ai-generate" className="space-y-2 mt-3">
                      <Label htmlFor="ai-gen">요청 내용</Label>
                      <Textarea
                        id="ai-gen"
                        placeholder="예: 폭염 대비 시민 행동요령을 20초 분량으로 작성"
                        value={openAIPrompt}
                        onChange={(e) => setOpenAIPrompt(e.target.value)}
                      />
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          onClick={async () => {
                            try {
                              setIsLoadingAI(true);
                              const org = user?.organization || "귀 기관";
                              const dept = user?.department || "관계 부서";
                              const basePrompt = `${org} ${dept} 방송문: ${openAIPrompt}`;
                              const out = await generateWithOpenAI(basePrompt);
                              setCustomText(out);
                              setLastAIPrompt(openAIPrompt);
                            } catch (e: any) {
                              alert(e?.message || "OpenAI 작성 실패");
                            } finally {
                              setIsLoadingAI(false);
                            }
                          }}
                          disabled={isLoadingAI || !openAIPrompt.trim()}
                        >
                          {isLoadingAI ? "작성 중..." : "OpenAI로 작성"}
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="ai-edit" className="space-y-2 mt-3">
                      <Label htmlFor="ai-edit">수정 지침</Label>
                      <Input
                        id="ai-edit"
                        placeholder="예: 20초 분량, 단문, 숫자 명확히"
                        value={openAIInstruction}
                        onChange={(e) => setOpenAIInstruction(e.target.value)}
                      />
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          onClick={async () => {
                            try {
                              if (!customText.trim()) { alert("수정할 텍스트가 없습니다"); return; }
                              setIsLoadingAI(true);
                              const out = await editWithOpenAI(customText, openAIInstruction);
                              setCustomText(out);
                              setLastAIInstruction(openAIInstruction);
                            } catch (e: any) {
                              alert(e?.message || "OpenAI 수정 실패");
                            } finally {
                              setIsLoadingAI(false);
                            }
                          }}
                          disabled={isLoadingAI || !openAIInstruction.trim()}
                        >
                          {isLoadingAI ? "수정 중..." : "OpenAI로 수정"}
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>

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
                      <p className="text-xs text-muted-foreground">
                        템플릿의 {"{"}변수명{"}"} 부분을 실제 내용으로 교체해주세요.
                      </p>
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
                    <Button variant="outline" onClick={() => { setCustomText(""); setSelectedTemplate(""); }}>
                      내용 초기화
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          const prompt = (lastAIPrompt || openAIPrompt).trim();
                          if (!prompt) { alert("프롬프트가 없습니다"); return; }
                          setIsLoadingAI(true);
                          const org = user?.organization || "귀 기관";
                          const dept = user?.department || "관계 부서";
                          const basePrompt = `${org} ${dept} 방송문: ${prompt}`;
                          const out = await generateWithOpenAI(basePrompt);
                          setCustomText(out);
                          setLastAIPrompt(prompt);
                        } catch (e: any) {
                          alert(e?.message || "다시 생성 실패");
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
                          if (!instruction) { alert("수정 지침이 없습니다"); return; }
                          if (!customText.trim()) { alert("수정할 텍스트가 없습니다"); return; }
                          setIsLoadingAI(true);
                          const out = await editWithOpenAI(customText, instruction);
                          setCustomText(out);
                          setLastAIInstruction(instruction);
                        } catch (e: any) {
                          alert(e?.message || "다시 수정 실패");
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
                        value={metaOverrides.language || undefined}
                        onValueChange={(v) => setMetaOverrides(prev => ({ ...prev, language: v === "auto" ? "" : v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="자동" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">자동</SelectItem>
                          {(() => {
                            const sv = selectedVoiceInfo || availableVoices.find((v: any) => v.voice_id === selectedVoice);
                            const langs = Array.isArray(sv?.language) ? sv.language : (sv?.language ? [sv.language] : []);
                            return langs.map((l: string) => (
                              <SelectItem key={l} value={l}>{l}</SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">스타일 (음성 지원 목록)</Label>
                      <Select
                        value={metaOverrides.style || undefined}
                        onValueChange={(v) => setMetaOverrides(prev => ({ ...prev, style: v === "auto" ? "" : v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="자동" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">자동</SelectItem>
                          {(() => {
                            const sv = selectedVoiceInfo || availableVoices.find((v: any) => v.voice_id === selectedVoice);
                            const styles = Array.isArray(sv?.styles) ? sv.styles : (sv?.styles ? [sv.styles] : []);
                            return styles.map((s: string) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ));
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">모델 (음성 지원 목록)</Label>
                      <Select
                        value={metaOverrides.model || undefined}
                        onValueChange={(v) => setMetaOverrides(prev => ({ ...prev, model: v === "auto" ? "" : v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="자동" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">자동</SelectItem>
                          {(() => {
                            const sv = selectedVoiceInfo || availableVoices.find((v: any) => v.voice_id === selectedVoice);
                            const models = Array.isArray(sv?.models) ? sv.models : (sv?.models ? [sv?.models] : []);
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
                        <div className="flex gap-1">
                          {["A", "B", "C", "D"].map((preset) => (
                            <Button
                              key={preset}
                              size="sm"
                              variant={voiceSettings.emotion.preset === preset ? "default" : "outline"}
                              className="w-8 h-8 p-0"
                              onClick={() => setVoiceSettings(prev => ({
                                ...prev,
                                emotion: { ...prev.emotion, preset }
                              }))}
                            >
                              {preset}
                            </Button>
                          ))}
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
                          <Button size="sm">적용</Button>
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
                              onClick={() => setVoiceSettings(prev => ({
                                ...prev,
                                readingSpeed: { ...prev.readingSpeed, preset: speed }
                              }))}
                            >
                              {speed}
                            </Button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            value={voiceSettings.readingSpeed.customTime}
                            onChange={(e) => setVoiceSettings(prev => ({
                              ...prev,
                              readingSpeed: { ...prev.readingSpeed, customTime: e.target.value }
                            }))}
                            className="flex-1"
                          />
                          <Button size="sm">적용</Button>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="pause" className="space-y-3 mt-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">끊어 읽기</Label>
                          <Info className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex items-center gap-2">
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
                          <span className="text-sm w-12">{voiceSettings.pause.duration}초</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          구간 추가하기
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="tone" className="space-y-3 mt-4">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm">PRO 재생 속도</Label>
                            <Info className="w-4 h-4 text-muted-foreground" />
                          </div>
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
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm">PRO 피치</Label>
                            <Info className="w-4 h-4 text-muted-foreground" />
                          </div>
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
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>

                {/* 생성 버튼 */}
                <Button 
                  onClick={handleGenerateVoice}
                  disabled={isGenerating || !customText.trim() || !selectedVoice}
                  className="w-full h-11"
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
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Mic2 className="w-5 h-5" />
                  클론 음성 관리
                </CardTitle>
                <CardDescription>기존 음성을 기반으로 클론 음성을 생성하고 관리합니다.</CardDescription>
              </div>
              <Button size="sm" onClick={() => openCloneModal()}>새 클론 음성 생성</Button>
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
                      <div key={clone.id} className="rounded-lg border border-border bg-muted/20 p-3 grid gap-3 md:grid-cols-[150px_minmax(0,1fr)_180px_180px] items-center">
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
                            onClick={() => toggleFavorite(clone.voiceId)}
                          >
                            {isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
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

          <Card>
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
                    return (
                      <div key={entry.id} className="rounded-lg border border-border bg-muted/20 p-3 grid gap-3 md:grid-cols-[160px_minmax(0,1fr)_160px_200px] items-center">
                        <div className="space-y-1">
                          <Badge>{entry.purposeLabel}</Badge>
                          <div className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm font-medium truncate" title={entry.textPreview}>{entry.textPreview || "(텍스트 없음)"}</div>
                          <div className="text-xs text-muted-foreground">길이: {entry.duration != null ? `${entry.duration.toFixed(2)}초` : "-"}</div>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div>음성: {entry.voiceName || "-"}</div>
                          <div>언어: {languageKo}</div>
                          <div>상태: <Badge variant="outline" className="text-[10px] uppercase">{entry.status}</Badge></div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openCloneModal(entry.voiceId)}
                          >
                            클로닝
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openMixingModal(entry)}>믹싱</Button>
                          <Button size="sm" variant="outline" onClick={() => openScheduleModal(entry)}>예약</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
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
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Supertone 음성 탐색</DialogTitle>
            <DialogDescription>
              언어, 스타일, 이름 등을 조합하여 원하는 음성을 검색하고 선택하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
            <div className="md:col-span-2 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">언어</Label>
                <Select value={voiceFilters.language || undefined} onValueChange={(v) => setVoiceFilters(prev => ({ ...prev, language: v === "all" ? "" : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {languageOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">스타일</Label>
                <Select value={voiceFilters.style || undefined} onValueChange={(v) => setVoiceFilters(prev => ({ ...prev, style: v === "all" ? "" : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {styleOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">이름 (부분 검색 가능)</Label>
                <Input
                  value={voiceFilters.name}
                  onChange={(e) => setVoiceFilters(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="예: Adam"
                />
                {/* 이름 빠른 선택 */}
                <div className="mt-2">
                  <Select value={voiceFilters.name || undefined} onValueChange={(v) => setVoiceFilters(prev => ({ ...prev, name: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="이름 빠른 선택 (옵션)" />
                    </SelectTrigger>
                    <SelectContent>
                      {(availableVoices || []).map((v: any) => (
                        <SelectItem key={v.voice_id} value={v.name || v.voice_id}>{v.name || v.voice_id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">성별</Label>
                <Select value={voiceFilters.gender || undefined} onValueChange={(v) => setVoiceFilters(prev => ({ ...prev, gender: v === "all" ? "" : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {genderOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">용도</Label>
                <Select value={voiceFilters.useCase || undefined} onValueChange={(v) => setVoiceFilters(prev => ({ ...prev, useCase: v === "all" ? "" : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {useCaseOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
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
              <p className="text-xs text-muted-foreground">
                💡 언어와 스타일을 함께 지정하면 더 정확한 결과를 얻을 수 있습니다. 샘플의 language/style/model 정보를 참고하세요.
              </p>
            </div>
            <div className="md:col-span-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
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
              <ScrollArea className="h-96 border rounded-lg p-3 bg-muted/30">
                {isSearchingVoices ? (
                  <p className="text-sm text-muted-foreground">검색 중입니다...</p>
                ) : voiceSearchResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">검색 결과가 없습니다. 조건을 조정해보세요.</p>
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
                        <Card key={voice.voice_id} className="border-border hover:border-primary transition-colors">
                          <CardContent className="p-4 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-semibold flex items-center gap-2">
                                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${genderColor}`}></span>
                                  {voice.name || voice.voice_id}
                                </div>
                                <div className="text-xs text-muted-foreground break-all">ID: {voice.voice_id}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    const sampleUrl = getPreferredSampleUrl(voice);
                                    if (sampleUrl) {
                                      setPlayingSample(prev => prev === sampleUrl ? null : sampleUrl);
                                    } else {
                                      toast({ title: "샘플 없음", description: "이 음성은 샘플 오디오가 없습니다.", variant: "destructive" });
                                    }
                                  }}
                                >
                                  {playingSample && getPreferredSampleUrl(voice) === playingSample ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                </Button>
                                <Button
                                  size="sm"
                                  variant={favoriteVoiceIds.has(voice.voice_id) ? "default" : "outline"}
                                  onClick={() => toggleFavorite(voice.voice_id)}
                                  title={favoriteVoiceIds.has(voice.voice_id) ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                                >
                                  <Star className="w-3 h-3 text-yellow-400" />
                                </Button>
                              <Button
                                size="sm"
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                              <div>언어: {languages || "-"}</div>
                              <div>스타일: {styles || "-"}</div>
                              <div>모델: {models || "-"}</div>
                              <div>성별: {genderKo}</div>
                            </div>
                            {useCaseKo && (
                              <Badge variant="secondary" className="text-xs">용도: {useCaseKo}</Badge>
                            )}
                            {voice.samples && voice.samples.length > 0 && (
                              <div className="text-xs text-muted-foreground">샘플 {voice.samples.length}개 제공</div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
              {/* 전역 샘플 재생 오디오 */}
              {(
                <audio
                  src={playingSample || undefined}
                  autoPlay={Boolean(playingSample)}
                  onEnded={() => setPlayingSample(null)}
                  onError={() => setPlayingSample(null)}
                  className="hidden"
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCloneModalOpen} onOpenChange={setIsCloneModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>새 클론 음성 생성</DialogTitle>
            <DialogDescription>
              기준 음성과 샘플 음성을 업로드하면, 동일한 톤의 클론 음성을 만들어 음성 목록에 추가합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clone-target">대상 이름 *</Label>
              <Input
                id="clone-target"
                placeholder="예: 시장님 공식 음성"
                value={cloneForm.targetName}
                onChange={(e) => setCloneForm((prev) => ({ ...prev, targetName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>기준 음성 *</Label>
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
                <SelectTrigger>
                  <SelectValue placeholder="기준 음성을 선택하세요" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {allVoices.map((voice: any) => (
                    <SelectItem key={voice.voice_id} value={voice.voice_id}>
                      {voice.name || voice.voice_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>주요 언어 *</Label>
              <Select
                value={cloneForm.language}
                onValueChange={(value) => setCloneForm((prev) => ({ ...prev, language: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="언어를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="clone-memo">메모</Label>
              <Textarea
                id="clone-memo"
                placeholder="예: 시장님 축사톤으로 30초 분량"
                value={cloneForm.memo}
                onChange={(e) => setCloneForm((prev) => ({ ...prev, memo: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clone-sample">샘플 업로드 *</Label>
              <Input
                id="clone-sample"
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setCloneForm((prev) => ({ ...prev, sampleFile: file, sampleName: file?.name }));
                }}
              />
              {cloneForm.sampleName && (
                <p className="text-xs text-muted-foreground">선택된 파일: {cloneForm.sampleName}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCloneModalOpen(false);
                setCloneForm(createCloneForm({ language: cloneForm.language }));
              }}
            >
              취소
            </Button>
            <Button onClick={handleCloneSubmit}>클로닝 요청</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMixingModalOpen} onOpenChange={setIsMixingModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>음원 믹싱 설정</DialogTitle>
            <DialogDescription>배경음과 효과음을 선택하고 각 트랙의 음량을 조절합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>배경음 선택</Label>
              <Select onValueChange={(value) => { const asset = mixingAssetLibrary.find((x) => x.id === value); if (selectedGenerationForMixing?.id && asset) { const state = mixingStates.get(selectedGenerationForMixing.id) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 }; setMixingStates((prev) => new Map(prev).set(selectedGenerationForMixing.id, { ...state, selectedBackground: asset })); } }}>
                <SelectTrigger><SelectValue placeholder="배경음을 선택하세요" /></SelectTrigger>
                <SelectContent>
                  {mixingAssetLibrary.filter((x) => x.type === "background").map((asset) => (<SelectItem key={asset.id} value={asset.id}>{asset.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>효과음 선택</Label>
              <Select onValueChange={(value) => { const asset = mixingAssetLibrary.find((x) => x.id === value); if (selectedGenerationForMixing?.id && asset) { const state = mixingStates.get(selectedGenerationForMixing.id) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 }; setMixingStates((prev) => new Map(prev).set(selectedGenerationForMixing.id, { ...state, selectedEffect: asset })); } }}>
                <SelectTrigger><SelectValue placeholder="효과음을 선택하세요" /></SelectTrigger>
                <SelectContent>
                  {mixingAssetLibrary.filter((x) => x.type === "effect").map((asset) => (<SelectItem key={asset.id} value={asset.id}>{asset.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMixingModalOpen(false)}>취소</Button>
            <Button onClick={() => handleMixingSubmit({ background: mixingStates.get(selectedGenerationForMixing?.id)?.selectedBackground?.id, effect: mixingStates.get(selectedGenerationForMixing?.id)?.selectedEffect?.id })}>믹싱 완료</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>예약 전송 설정</DialogTitle>
            <DialogDescription>음성을 전송할 채널과 시간을 설정합니다. (기준시간: Asia/Seoul)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schedule-channel">전송 채널 *</Label>
              <Select>
                <SelectTrigger><SelectValue placeholder="전송 채널을 선택하세요" /></SelectTrigger>
                <SelectContent>
                  {scheduleChannels.map((ch) => (<SelectItem key={ch.value} value={ch.value}>{ch.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-time">전송 시간 *</Label>
              <Input type="datetime-local" id="schedule-time" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-repeat">반복 옵션</Label>
              <Select defaultValue="once">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">1회 전송</SelectItem>
                  <SelectItem value="daily">매일</SelectItem>
                  <SelectItem value="weekly">매주</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsScheduleModalOpen(false)}>취소</Button>
            <Button onClick={() => handleScheduleSubmit({ channel: "", scheduledTime: "", repeatOption: "once" })}>예약 등록</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default PublicVoiceGenerator;

