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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  Minus,
  Activity,
  BarChart3,
  Music2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import AudioPlayer from "@/components/AudioPlayer";
import WaveformCanvas from "@/components/WaveformCanvas";
import { correctKoreanPostpositions } from "@/lib/koreanPostposition";
import { removeMarkdown } from "@/lib/textUtils";
import * as dbService from "@/services/dbService";
import * as fileStorageService from "@/services/fileStorageService";
import {
  exportMixToWav,
  decodeUrlToBuffer,
  downloadBlob,
  formatTime,
  type MixingSettings,
  DEFAULT_MIXING_SETTINGS,
} from "@/lib/audioMixer";
import PageContainer from "@/components/layout/PageContainer";
import { formatDateTime, purposeOptions, getPurposeMeta } from "@/lib/pageUtils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Stepper } from "@/components/ui/stepper";
import { getPurposeColor } from "@/lib/categoryColors";
import { cn } from "@/lib/utils";
import { getVoiceDisplayNameKo } from "@/lib/voiceNames";

// CloneFormState and CloneRequest 타입은 VoiceCloning.tsx로 이동됨

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
  fadeInRatio?: number; // 페이드인 음원증감 비율 (0-100, 50% = 기본 볼륨)
  fadeOutRatio?: number; // 페이드아웃 음원증감 비율 (0-100, 50% = 기본 볼륨)
  lowShelf?: number;
  midPeaking?: number;
  highShelf?: number;
  duckingEnabled?: boolean;
  duckDb?: number;
  duckThreshold?: number;
  duckRelease?: number;
  bgmOffset?: number; // TTS 시작 전 BGM 시작 오프셋 (양수)
  ttsOffset?: number;
  bgmOffsetAfterTts?: number; // TTS 종료 후 BGM 연장 시간 (양수)
  trimEndSec?: number | null; // 호환성을 위해 유지 (deprecated)
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

// 사용량 및 크레딧 모니터링 타입 정의 제거 (Dashboard에서 관리)
// type UsageStats = ...
// type CreditBalance = ...
// type OperationLog = ...

const PublicVoiceGenerator = () => {
  const [saveDialog, setSaveDialog] = useState<{ open: boolean; entry?: any; filename?: string; format?: string }>({ open: false });
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [offlineToastShown, setOfflineToastShown] = useState(false);


  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [customText, setCustomText] = useState("");
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [selectedTemplateObj, setSelectedTemplateObj] = useState<any>(null);
  const [dbTemplates, setDbTemplates] = useState<{ greeting: dbService.TemplateEntry[]; announcement: dbService.TemplateEntry[]; policy: dbService.TemplateEntry[] }>({
    greeting: [],
    announcement: [],
    policy: [],
  });
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templatePage, setTemplatePage] = useState(1);
  const templateItemsPerPage = 5; // 페이지당 템플릿 개수
  const [templateSearchQuery, setTemplateSearchQuery] = useState("");
  // 문구목록 즐겨찾기 관련 상태
  const [messageFavorites, setMessageFavorites] = useState<Set<string>>(new Set());
  const [favoriteMessages, setFavoriteMessages] = useState<dbService.MessageHistoryEntry[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
  const [favoriteSearchQuery, setFavoriteSearchQuery] = useState("");
  const [favoriteFilterPurpose, setFavoriteFilterPurpose] = useState<string>("all"); // 목적별 필터
  const [favoritePage, setFavoritePage] = useState(1);
  const favoriteItemsPerPage = 5; // 페이지당 즐겨찾기 문구 개수
  const updateFavoriteMessages = useCallback((messages: dbService.MessageHistoryEntry[]) => {
    setFavoriteMessages(messages.filter((msg) => msg.isFavorite));
  }, [setFavoriteMessages]);

  const [openAIPrompt, setOpenAIPrompt] = useState("");
  const [openAIInstruction, setOpenAIInstruction] = useState("");
  const [lastAIPrompt, setLastAIPrompt] = useState("");
  const [lastAIInstruction, setLastAIInstruction] = useState("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiMode, setAiMode] = useState<"generate" | "edit">("generate");
  const [messageHistory, setMessageHistory] = useState<Array<{ id: string; text: string; purpose: string; createdAt: string; updatedAt: string }>>([]);
  const [isMessageHistoryOpen, setIsMessageHistoryOpen] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("");
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [allVoices, setAllVoices] = useState<any[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [voiceLoadingProgress, setVoiceLoadingProgress] = useState(0); // 0-100
  const [voiceSearchLanguage, setVoiceSearchLanguage] = useState<string>("ko");
  const [voiceSearchStyle, setVoiceSearchStyle] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [generatedAudioCacheKey, setGeneratedAudioCacheKey] = useState<string | null>(null); // 생성된 audio의 cacheKey
  const [generatedDuration, setGeneratedDuration] = useState<number>(0);
  const [predictedDuration, setPredictedDuration] = useState<number | null>(null);
  const [isPredictingDuration, setIsPredictingDuration] = useState(false);
  const [predictedCredit, setPredictedCredit] = useState<number | null>(null);
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number } | null>(null);
  const [chunkLogs, setChunkLogs] = useState<Array<{ index: number; text: string; charCount: number; startTime: number; endTime?: number; duration?: number; status: 'pending' | 'generating' | 'complete' | 'error'; error?: string }>>([]);
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
  const isInitialMountRef = useRef(true);
  const loadFavoriteVoicesRef = useRef<boolean>(false); // 중복 호출 방지
  const canUpdateSavedNameRef = useRef<boolean>(true);
  const favoriteCheckTimerRef = useRef<number | null>(null);
  // cacheRef: blob 데이터를 저장하여 blob URL 만료 문제 해결
  const cacheRef = useRef<Map<string, { blob: Blob; duration: number | null; mimeType?: string; dataUrl?: string; _audioUrl?: string }>>(new Map());
  const [historyPreviewUrls, setHistoryPreviewUrls] = useState<Record<string, string>>({});
  const historyPreviewUrlsRef = useRef<Record<string, string>>({});
  const [generationHistory, setGenerationHistory] = useState<any[]>([]);
  const [metaOverrides, setMetaOverrides] = useState<{ language: string; style: string; model: string }>({ language: "", style: "", model: "" });
  const [localSaveDialog, setLocalSaveDialog] = useState<{
    open: boolean;
    entry: any | null;
    isPreparing: boolean;
    fileName: string;
    downloadUrl: string | null;
    sizeLabel: string;
    error: string | null;
    mimeType: string | null;
  }>({
    open: false,
    entry: null,
    isPreparing: false,
    fileName: "",
    downloadUrl: null,
    sizeLabel: "",
    error: null,
    mimeType: null,
  });

  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
  const [historyItemsPerPage, setHistoryItemsPerPage] = useState(10);
  const [favoriteVoiceIds, setFavoriteVoiceIds] = useState<Set<string>>(new Set());
  const [selectedPurpose, setSelectedPurpose] = useState<string>("announcement");
  const [alertDialog, setAlertDialog] = useState<{ open: boolean; title: string; message: string; onConfirm?: () => void }>({ open: false, title: "", message: "" });
  const [templateVariableWarning, setTemplateVariableWarning] = useState<{ open: boolean; variables: string[]; text: string }>({ open: false, variables: [], text: "" });

  const mergeUniqueVoices = (current: any[], additions: any[]) => {
    if (!Array.isArray(additions) || additions.length === 0) return current;
    const existingIds = new Set(current.map((item: any) => item.voice_id));
    const filtered = additions.filter((voice: any) => voice && voice.voice_id && !existingIds.has(voice.voice_id));
    return filtered.length ? [...current, ...filtered] : current;
  };

  const loadFavoriteVoices = useCallback(async () => {
    if (loadFavoriteVoicesRef.current) return;
    if (favoriteVoiceIds.size === 0) return;

    const missingIds = Array.from(favoriteVoiceIds).filter((id) =>
      !availableVoices.some((voice: any) => voice.voice_id === id) &&
      !allVoices.some((voice: any) => voice.voice_id === id)
    );

    if (missingIds.length === 0) return;

    loadFavoriteVoicesRef.current = true;
    try {
      const catalogVoices = await dbService.loadVoiceCatalog();
      let collected: any[] = [];
      if (Array.isArray(catalogVoices) && catalogVoices.length > 0) {
        collected = catalogVoices.filter((voice: any) => missingIds.includes(voice.voice_id));
      }

      if (collected.length > 0) {
        setAllVoices((prev) => mergeUniqueVoices(prev, collected));
        setAvailableVoices((prev) => mergeUniqueVoices(prev, collected));
      } else {
        console.warn("즐겨찾기 음성을 로드할 수 있는 데이터가 없습니다. 음성 목록을 다시 로드해주세요.");
      }
    } catch (error) {
      console.error("즐겨찾기 음성 로드 실패:", error);
    } finally {
      loadFavoriteVoicesRef.current = false;
    }
  }, [favoriteVoiceIds, availableVoices, allVoices]);

  useEffect(() => {
    historyPreviewUrlsRef.current = historyPreviewUrls;
  }, [historyPreviewUrls]);

  useEffect(() => {
    const validIds = new Set(generationHistory.map((item) => String(item.id)));
    setHistoryPreviewUrls((prev) => {
      const next: Record<string, string> = {};
      Object.entries(prev).forEach(([id, url]) => {
        if (validIds.has(id)) {
          next[id] = url;
        }
      });
      return next;
    });
  }, [generationHistory]);

  // 음성 찾기 모달에서 샘플 미리듣기 재생
  useEffect(() => {
    if (playingSample && audioSampleRef.current && isVoiceFinderOpen) {
      const audio = audioSampleRef.current;
      
      // 오디오 로드 후 재생
      const handleCanPlay = () => {
        audio.play().catch((error) => {
          console.error("샘플 재생 실패:", error);
          // 사용자 상호작용이 필요한 경우 무시 (모달 내부 클릭은 상호작용으로 간주)
        });
      };
      
      // 이미 로드된 경우 바로 재생
      if (audio.readyState >= 2) {
        audio.play().catch((error) => {
          console.error("샘플 재생 실패:", error);
        });
      } else {
        audio.addEventListener("canplay", handleCanPlay, { once: true });
      }
      
      return () => {
        audio.removeEventListener("canplay", handleCanPlay);
      };
    }
  }, [playingSample, isVoiceFinderOpen]);
  
  useEffect(() => {
    return () => {
      if (localSaveDialog.downloadUrl) {
        try {
          URL.revokeObjectURL(localSaveDialog.downloadUrl);
        } catch {
          // ignore revoke errors
        }
      }
    };
  }, [localSaveDialog.downloadUrl]);

  // 끊어읽기 구간 추가 다이얼로그
  const [isPauseSegmentDialogOpen, setIsPauseSegmentDialogOpen] = useState(false);
  const [newPauseSegment, setNewPauseSegment] = useState({ position: 0, duration: 0.5 });

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
  const [expandedGenerationId, setExpandedGenerationId] = useState<string | null>(null);
  const [editingGenerationId, setEditingGenerationId] = useState<string | null>(null);
  const [editNameInput, setEditNameInput] = useState("");
  const [mixingPreviewAudio, setMixingPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isMixingPreviewPlaying, setIsMixingPreviewPlaying] = useState(false);
  const [mixingPreviewProgress, setMixingPreviewProgress] = useState(0);
  // 실시간 미리듣기 오디오 소스 추적 (정지 시 명시적으로 중지하기 위해)
  const mixingAudioSourcesRef = useRef<{ ttsSource?: AudioBufferSourceNode; bgmSource?: AudioBufferSourceNode; intervalId?: number }>({});
  // 정렬 관련 상태
  const [voiceSortBy, setVoiceSortBy] = useState<"name" | "language" | "gender" | "none">("none");
  const [voiceSortOrder, setVoiceSortOrder] = useState<"asc" | "desc">("asc");
  const [searchResultSortBy, setSearchResultSortBy] = useState<"name" | "language" | "gender" | "none">("none");
  const [searchResultSortOrder, setSearchResultSortOrder] = useState<"asc" | "desc">("asc");

  // Phase 4: 사용량 및 크레딧 모니터링 (제거: Dashboard에서 관리)
  // const [usageStats, setUsageStats] = useState<UsageStats>({...});
  // const [creditBalance, setCreditBalance] = useState<CreditBalance>({...});
  // const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
  // const [isMonitoringPanelOpen, setIsMonitoringPanelOpen] = useState(false);
  // const usagePollingRef = useRef<number | null>(null);

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
    { value: "game", label: "게임" }, // API에서 game으로 반환되는 경우 대비
    { value: "advertisement", label: "광고" },
    { value: "telephone", label: "전화" },
    { value: "documentary", label: "다큐멘터리" },
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
    
    // 실제 존재하는 용도만 필터링 (game과 gaming 모두 게임으로 처리)
    return allUseCaseOptions.filter(opt => {
      if (opt.value === "gaming" || opt.value === "game") {
        // game 또는 gaming 중 하나라도 있으면 게임 표시
        return foundUseCases.has("game") || foundUseCases.has("gaming");
      }
      return foundUseCases.has(opt.value);
    }).filter((opt, index, arr) => {
      // game과 gaming 둘 다 있으면 gaming만 표시 (중복 제거)
      if (opt.value === "game") {
        return !arr.some(o => o.value === "gaming");
      }
      return true;
    });
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

  // purposeOptions는 pageUtils에서 가져옴

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

  // getPurposeMeta는 pageUtils에서 가져옴

  const getVoiceMeta = (voiceId: string) => {
    if (!voiceId) return null;
    return availableVoices.find((v: any) => v.voice_id === voiceId)
      || allVoices.find((v: any) => v.voice_id === voiceId)
      || null;
  };

  const getVoiceDisplayName = (voiceId: string) => {
    const meta = getVoiceMeta(voiceId);
    return getVoiceDisplayNameKo(meta?.name, voiceId || meta?.voice_id || "", meta?.name_ko);
  };

  // registerCloneVoice와 openCloneModal은 VoiceCloning.tsx로 이동됨

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
          fadeInRatio: 50, // 기본값 50% (중앙 = 기본 볼륨)
          fadeOutRatio: 50, // 기본값 50% (중앙 = 기본 볼륨)
          lowShelf: DEFAULT_MIXING_SETTINGS.lowShelf,
          midPeaking: DEFAULT_MIXING_SETTINGS.midPeaking,
          highShelf: DEFAULT_MIXING_SETTINGS.highShelf,
          duckingEnabled: DEFAULT_MIXING_SETTINGS.duckingEnabled,
          duckDb: DEFAULT_MIXING_SETTINGS.duckDb,
          duckThreshold: DEFAULT_MIXING_SETTINGS.duckThreshold,
          duckRelease: DEFAULT_MIXING_SETTINGS.duckRelease,
          bgmOffset: DEFAULT_MIXING_SETTINGS.bgmOffset,
          bgmOffsetAfterTts: 0, // 기본값 0초
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
        fadeInRatio: state.fadeInRatio !== undefined ? state.fadeInRatio : 50, // 기본값 50% (중앙)
        fadeOutRatio: state.fadeOutRatio !== undefined ? state.fadeOutRatio : 50, // 기본값 50% (중앙)
        lowShelf: state.lowShelf !== undefined ? state.lowShelf : DEFAULT_MIXING_SETTINGS.lowShelf,
        midPeaking: state.midPeaking !== undefined ? state.midPeaking : DEFAULT_MIXING_SETTINGS.midPeaking,
        highShelf: state.highShelf !== undefined ? state.highShelf : DEFAULT_MIXING_SETTINGS.highShelf,
        duckingEnabled: state.duckingEnabled !== undefined ? state.duckingEnabled : DEFAULT_MIXING_SETTINGS.duckingEnabled,
        duckDb: state.duckDb !== undefined ? state.duckDb : DEFAULT_MIXING_SETTINGS.duckDb,
        duckThreshold: state.duckThreshold !== undefined ? state.duckThreshold : DEFAULT_MIXING_SETTINGS.duckThreshold,
        duckRelease: state.duckRelease !== undefined ? state.duckRelease : DEFAULT_MIXING_SETTINGS.duckRelease,
        bgmOffset: state.bgmOffset !== undefined ? state.bgmOffset : DEFAULT_MIXING_SETTINGS.bgmOffset,
        bgmOffsetAfterTts: state.bgmOffsetAfterTts !== undefined ? state.bgmOffsetAfterTts : 0,
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
      
      // 소스 추적을 위해 ref에 저장
      mixingAudioSourcesRef.current.ttsSource = ttsSource;

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

        // BGM은 항상 0초부터 시작 (고정)
        const bgmStartTime = 0;
        
        // BGM 페이드인 (0초부터 시작, 음원증감 비율 적용)
        // 음원증감 비율: 50%가 기본값(원래 볼륨), 0-50%는 감소, 50-100%는 증가
        let bgmFadeInGain: GainNode | null = null;
        if (settings.fadeIn > 0) {
          bgmFadeInGain = ctx.createGain();
          const fadeInRatio = (settings.fadeInRatio ?? 50) / 100; // 0-100을 0-1로 변환 (50%가 중앙 = 기본 볼륨)
          // 50% = 기본 볼륨 (bgmGain * 1.0), 0% = 0 볼륨, 100% = bgmGain * 2.0
          const fadeInTargetGain = settings.bgmGain * (fadeInRatio * 2); // 0.5 * 2 = 1.0, 0.25 * 2 = 0.5, 0.75 * 2 = 1.5
          bgmFadeInGain.gain.setValueAtTime(0.0001, ctx.currentTime + bgmStartTime);
          bgmFadeInGain.gain.exponentialRampToValueAtTime(fadeInTargetGain, ctx.currentTime + bgmStartTime + Math.max(0.01, settings.fadeIn));
        }

        // TTS 시작 시간: fadeIn + bgmOffset
        const ttsStartTime = settings.fadeIn + settings.bgmOffset;
        const ttsEndTime = ttsStartTime + ttsBuffer.duration;
        
        // BGM 전체 길이: fadeIn + bgmOffset + ttsDuration + bgmOffsetAfterTts + fadeOut
        let bgmTotalDuration = 0;
        if (settings.trimEndSec != null && settings.trimEndSec > 0) {
          bgmTotalDuration = settings.trimEndSec;
        } else {
          bgmTotalDuration = settings.fadeIn + settings.bgmOffset + ttsBuffer.duration + (settings.bgmOffsetAfterTts || 0) + settings.fadeOut;
          // 최소 BGM 길이 보장
          const minBgmDuration = ttsBuffer.duration + settings.fadeIn + settings.fadeOut;
          bgmTotalDuration = Math.max(bgmTotalDuration, minBgmDuration);
        }
        
        const bgmEndTime = ctx.currentTime + bgmTotalDuration;
        let bgmFadeOutGain: GainNode | null = null;
        if (settings.fadeOut > 0) {
          bgmFadeOutGain = ctx.createGain();
          // 페이드아웃 시작 시간: BGM 종료 시간에서 fadeOut 시간 빼기
          const fadeOutStartTime = bgmEndTime - settings.fadeOut;
          const fadeOutRatio = (settings.fadeOutRatio ?? 50) / 100; // 0-100을 0-1로 변환 (50%가 중앙 = 기본 볼륨)
          // 50% = 기본 볼륨 (bgmGain * 1.0), 0% = 0 볼륨, 100% = bgmGain * 2.0
          const fadeOutStartGain = settings.bgmGain * (fadeOutRatio * 2); // 중앙 기준 증감
          bgmFadeOutGain.gain.setValueAtTime(fadeOutStartGain, ctx.currentTime + fadeOutStartTime);
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
        
        // 소스 추적을 위해 ref에 저장
        mixingAudioSourcesRef.current.bgmSource = bgmSource;
        
        // BGM이 필요한 길이만큼 재생되도록 루프 설정
        const bgmNeededDuration = bgmTotalDuration;
        const bgmOriginalDuration = bgmBuffer.duration;
        
        // BGM은 항상 0초부터 시작
        if (bgmNeededDuration > bgmOriginalDuration) {
          // BGM이 더 길 필요가 있으면 루프 설정
          bgmSource.loop = true;
          bgmSource.loopEnd = bgmOriginalDuration;
          // 정확한 종료 시간에 정지 (bgmTotalDuration 후)
          bgmSource.start(ctx.currentTime + bgmStartTime, 0);
          bgmSource.stop(ctx.currentTime + bgmStartTime + bgmTotalDuration);
        } else {
          // BGM이 짧으면 루프 없이 한 번만 재생
          bgmSource.loop = false;
          bgmSource.start(ctx.currentTime + bgmStartTime);
          // 원래 길이보다 짧게 재생하려면 stop 호출 필요 없음 (자동 종료)
        }
      }

      // TTS 시작: fadeIn + bgmOffset 위치 (페이드 없이)
      const ttsStartTime = settings.fadeIn + settings.bgmOffset;
      ttsSource.start(ctx.currentTime + ttsStartTime);

      // 마스터 게인은 상수로 유지 (페이드 없음)
      masterGain.gain.value = settings.masterGain;
      masterGain.connect(ctx.destination);

      setIsMixingPreviewPlaying(true);

      // 재생 완료 시 정리 (BGM이 항상 더 길거나 같음)
      // BGM 전체 길이 계산 (위에서 계산한 것과 동일)
      let bgmTotalDurationCalc = 0;
      if (bgmBuffer) {
        if (settings.trimEndSec != null && settings.trimEndSec > 0) {
          bgmTotalDurationCalc = settings.trimEndSec;
        } else {
          bgmTotalDurationCalc = settings.fadeIn + settings.bgmOffset + ttsBuffer.duration + (settings.bgmOffsetAfterTts || 0) + settings.fadeOut;
          const minBgmDuration = ttsBuffer.duration + settings.fadeIn + settings.fadeOut;
          bgmTotalDurationCalc = Math.max(bgmTotalDurationCalc, minBgmDuration);
        }
      } else {
        // BGM이 없으면 TTS 길이만 사용
        bgmTotalDurationCalc = settings.fadeIn + settings.bgmOffset + ttsBuffer.duration;
      }
      
      // BGM 종료 시간 = 시작 시간 + 총 길이 (bgmStartTime은 항상 0이므로 ctx.currentTime + bgmTotalDurationCalc)
      const bgmEndTimeCalc = ctx.currentTime + bgmTotalDurationCalc;
      const totalEndTime = bgmEndTimeCalc;
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
      
      // interval ID 추적 (정지 시 정리)
      if (mixingAudioSourcesRef.current.intervalId) {
        clearInterval(mixingAudioSourcesRef.current.intervalId);
      }
      mixingAudioSourcesRef.current.intervalId = progressInterval;

    } catch (error: any) {
      // 실시간 미리듣기 오류 (무시 가능)
      toast({
        title: "미리듣기 실패",
        description: error.message || "실시간 미리듣기 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      setIsMixingPreviewPlaying(false);
    }
  };

  // 실시간 미리듣기 중지 (모든 오디오 소스 명시적으로 정지)
  const stopRealtimePreview = () => {
    try {
      // 모든 AudioBufferSource 명시적으로 정지
      if (mixingAudioSourcesRef.current.ttsSource) {
        try {
          mixingAudioSourcesRef.current.ttsSource.stop();
        } catch (e) {
          // 이미 정지되었으면 무시
        }
        mixingAudioSourcesRef.current.ttsSource = undefined;
      }
      
      if (mixingAudioSourcesRef.current.bgmSource) {
        try {
          mixingAudioSourcesRef.current.bgmSource.stop();
        } catch (e) {
          // 이미 정지되었으면 무시
        }
        mixingAudioSourcesRef.current.bgmSource = undefined;
      }
      
      // 진행률 업데이트 interval 정리
      if (mixingAudioSourcesRef.current.intervalId) {
        clearInterval(mixingAudioSourcesRef.current.intervalId);
        mixingAudioSourcesRef.current.intervalId = undefined;
      }
      
      // AudioContext 일시 중지
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.suspend();
      }
      
      // mixingPreviewAudio도 정지 (HTMLAudioElement가 있는 경우)
      if (mixingPreviewAudio) {
        mixingPreviewAudio.pause();
        mixingPreviewAudio.currentTime = 0;
      }
    } catch (e) {
      // 미리듣기 중지 중 오류 (무시 가능)
    } finally {
      setIsMixingPreviewPlaying(false);
      setMixingPreviewProgress(0);
    }
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
      // 믹싱 오류 (무시 가능)
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

  // validateCloneForm은 VoiceCloning.tsx로 이동됨

  const validateScheduleForm = (form: any): { valid: boolean; error?: string } => {
    if (!form.channel) return { valid: false, error: "전송 채널을 선택해주세요" };
    if (!form.scheduledTime) return { valid: false, error: "전송 시간을 설정해주세요" };
    const scheduled = new Date(form.scheduledTime);
    const now = new Date();
    if (scheduled < now) return { valid: false, error: "현재보다 미래 시간을 선택해주세요" };
    return { valid: true };
  };

  // handleCloneSubmit은 VoiceCloning.tsx로 이동됨


  const purposeMeta = getPurposeMeta(selectedPurpose);

  // formatDateTime은 pageUtils에서 가져옴

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
      game: "게임", // API에서 game으로 반환되는 경우
      advertisement: "광고",
      telephone: "전화",
      documentary: "다큐멘터리",
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
      // Our edge function may return { audioData, contentType, audioLength }
      let base64Audio = payload?.audio_base64 ?? payload?.audioBase64 ?? payload?.audio ?? payload?.audio_data ?? payload?.audioData ?? null;
      let remoteUrl = payload?.audio_url ?? payload?.audioUrl ?? payload?.url ?? payload?.file_url ?? payload?.fileUrl ?? null;
      
      // duration 안전하게 파싱
      const rawDuration = payload?.duration ?? payload?.audio_duration ?? payload?.length ?? payload?.meta?.duration ?? json.duration ?? json.audioLength ?? null;
      if (rawDuration != null) {
        const parsed = typeof rawDuration === 'number' 
          ? (Number.isFinite(rawDuration) ? rawDuration : null)
          : (Number.isFinite(Number(rawDuration)) ? Number(rawDuration) : null);
        duration = parsed;
      }
      
      const mimeType = payload?.mime_type ?? payload?.mimetype ?? payload?.content_type ?? json.contentType ?? "audio/mpeg";

      if (base64Audio) {
        try {
        const blob = base64ToBlob(base64Audio, mimeType);
          if (!blob || blob.size === 0) {
            throw new Error("생성된 오디오 데이터가 비어있습니다.");
          }
        return {
          blob, // blob 데이터 저장
          duration,
          mimeType,
        };
        } catch (blobError: any) {
          console.error("Base64 오디오 변환 실패:", blobError);
          throw new Error(`오디오 데이터 변환 실패: ${blobError?.message || '알 수 없는 오류'}`);
        }
      }

      if (remoteUrl) {
        try {
        const remoteResponse = await fetch(remoteUrl);
        if (!remoteResponse.ok) {
          throw new Error(`오디오 다운로드 실패 (${remoteResponse.status})`);
        }
        const remoteBlob = await remoteResponse.blob();
          if (!remoteBlob || remoteBlob.size === 0) {
            throw new Error("원격 오디오 데이터가 비어 있습니다.");
          }
        const remoteDurationHeader = remoteResponse.headers.get("X-Audio-Length") || remoteResponse.headers.get("x-audio-length");
          let remoteDuration: number | null = null;
          if (remoteDurationHeader) {
            const parsed = parseFloat(remoteDurationHeader);
            remoteDuration = Number.isNaN(parsed) || !Number.isFinite(parsed) ? null : parsed;
          }
        return {
          blob: remoteBlob, // blob 데이터 저장
          duration: duration ?? remoteDuration,
          mimeType: remoteBlob.type || mimeType,
        };
        } catch (fetchError: any) {
          console.error("원격 오디오 다운로드 실패:", fetchError);
          throw new Error(`원격 오디오 다운로드 실패: ${fetchError?.message || '알 수 없는 오류'}`);
        }
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
      duration = Number.isNaN(parsed) || !Number.isFinite(parsed) ? null : parsed;
    }
    return {
      blob, // blob 데이터 저장
      duration,
      mimeType: blob.type || "audio/mpeg",
    };
  };
  // localStorage 마이그레이션 플래그 (한 번만 실행)
  const [hasMigratedLocalStorage, setHasMigratedLocalStorage] = useState(false);
  const HISTORY_STORAGE_KEY = "tts_generation_history_v1";
  const FAV_STORAGE_KEY = "tts_favorite_voice_ids_v1";
  const PURPOSE_STORAGE_KEY = "tts_selected_purpose_v1";
  const CLONE_STORAGE_KEY = "tts_clone_requests_v1";
  const MIXING_STORAGE_KEY = "tts_mixing_states_v1";
  const SCHEDULE_STORAGE_KEY = "tts_schedule_requests_v1";
  const REVIEW_STORAGE_KEY = "tts_review_states_v1";
  const MESSAGE_HISTORY_STORAGE_KEY = "tts_message_history_v1";
  const MIGRATION_FLAG_KEY = "tts_db_migration_completed_v1";

  // 데이터베이스에서 데이터 로드
  const loadDataFromDB = useCallback(async () => {
    if (!user?.id) {
      setFavoriteMessages([]);
      setIsLoadingFavorites(false);
      return;
    }

    setIsLoadingFavorites(true);

    try {
      // 생성 이력
      let dbHistory: any[] = [];
      try {
        dbHistory = await dbService.loadGenerations(user.id, 100);
      } catch (err: any) {
        const errMsg = (err?.message || "") + " " + (err?.details || "");
        if (errMsg.toLowerCase().includes("cors") || errMsg.toLowerCase().includes("522") || errMsg.toLowerCase().includes("failed to fetch")) {
          if (!offlineToastShown) {
            setOfflineToastShown(true);
            toast({
              title: "오프라인 모드",
              description: "네트워크 연결이 불안정합니다. 일부 기능이 제한될 수 있습니다.",
              variant: "default",
            });
          }
        }
        dbHistory = [];
      }
      if (dbHistory.length > 0) {
        canUpdateSavedNameRef.current = true;
        const normalized = dbHistory.map((item: any) => {
          // Blob URL 복원 (우선순위: audioBlob > cacheRef > audioUrl)
          let audioUrl: string | null = null;
          let cacheKey = item.cacheKey || (item.paramHash ? `hash_${item.paramHash}` : `${item.id}_${Date.now()}`);

          // 1. DB에 audioBlob이 있으면 cacheRef에만 저장 (blob URL은 생성하지 않음)
          // blob URL은 필요할 때만 생성하여 만료 문제를 방지합니다
          if (item.audioBlob) {
            try {
              const blob = dbService.arrayBufferToBlob(item.audioBlob, item.mimeType || "audio/mpeg");
              // cacheRef에만 저장, blob URL은 생성하지 않음
              cacheRef.current.set(cacheKey, { 
                blob, 
                duration: item.duration || null, 
                mimeType: item.mimeType || "audio/mpeg"
                // _audioUrl은 생성하지 않음 - 필요할 때만 생성
              });
            } catch (e) {
              // Blob 복원 실패 (무시 가능)
            }
          }

          // 2. audioUrl이 blob: URL이 아니면 사용 (외부 URL 등)
          if (item.audioUrl && !item.audioUrl.startsWith('blob:')) {
            audioUrl = item.audioUrl;
          }

          // 3. blob: URL은 null로 설정 (필요할 때만 생성)
          // 이렇게 하면 브라우저가 만료된 blob URL에 접근하지 않습니다
          if (item.audioUrl && item.audioUrl.startsWith('blob:')) {
            audioUrl = null; // null로 설정하여 브라우저가 접근하지 않도록 함
          }

          const format = item.format || (item.mimeType?.includes('wav') ? 'wav' : 'mp3');

          return {
            id: item.id || generateUniqueId(),
            purpose: item.purpose || "announcement",
            purposeLabel: item.purposeLabel || getPurposeMeta(item.purpose || "announcement").label,
            voiceId: item.voiceId || "",
            voiceName: item.voiceName || getVoiceDisplayName(item.voiceId || ""),
            createdAt: item.createdAt || new Date().toISOString(),
            duration: item.duration,
            status: item.status || "ready",
            hasAudio: item.hasAudio !== false,
            language: item.language || "",
            model: item.model || "",
            style: item.style || "",
            speed: item.speed ?? 1.0,
            pitchShift: item.pitchShift ?? 0,
            textPreview: item.textPreview || "",
            textLength: item.textLength ?? (item.textPreview ? item.textPreview.length : 0),
            cacheKey: cacheKey, // 항상 cacheKey 설정 (복원을 위해)
            savedName: item.savedName || null,
            audioUrl,
            mimeType: item.mimeType || "audio/mpeg",
            storagePath: item.storagePath || null,
            format,
            paramHash: item.paramHash || null,
            isPersisted: true,
            allowServerUpdate: false,
          };
        });
        setGenerationHistory(normalized);
        try {
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(normalized));
        } catch {}
        
        // 복원되지 않은 항목이 있으면 로그
        const restoredCount = normalized.filter((n: any) => n.audioUrl).length;
        const totalCount = normalized.length;
        if (restoredCount < totalCount) {
          // 일부 음원 복원 실패
        }
      }

      // 즐겨찾기
      const favorites = await dbService.loadFavorites(user.id);
      if (favorites.length > 0) {
        setFavoriteVoiceIds(new Set(favorites));
      }

      // 사용자 설정
      const settings = await dbService.loadUserSettings(user.id);
      if (settings) {
        if (settings.selectedPurpose) {
          setSelectedPurpose(settings.selectedPurpose);
        }
        // voiceSettings는 나중에 적용
      }

      // 클론 요청은 VoiceCloning.tsx에서 로드함

      // 믹싱 상태
      const mixingMap = await dbService.loadMixingStates(user.id);
      if (mixingMap.size > 0) {
        const convertedMap = new Map<number, MixingState>();
        mixingMap.forEach((value, key) => {
          const genId = parseInt(key.replace(/-/g, "").substring(0, 10) || `${Date.now()}`);
          convertedMap.set(genId, value.settings);
        });
        setMixingStates(convertedMap);
      }

      // 예약 요청
      const schedules = await dbService.loadScheduleRequests(user.id);
      if (schedules.length > 0) {
        const normalized: ScheduleRequest[] = schedules.map((item: any) => ({
          id: parseInt(item.id?.replace(/-/g, "").substring(0, 10) || `${Date.now()}`),
          generationId: parseInt(item.generationId?.replace(/-/g, "").substring(0, 10) || `${Date.now()}`),
          targetChannel: item.targetChannel,
          targetName: item.targetName,
          scheduledTime: item.scheduledTime,
          repeatOption: item.repeatOption || "once",
          status: item.status || "scheduled",
          createdAt: item.createdAt || new Date().toISOString(),
          sentAt: item.sentAt,
          failReason: item.failReason,
          mixingState: item.mixingState,
        }));
        setScheduleRequests(normalized);
      }

      // 검수 상태
      const reviewMap = await dbService.loadReviewStates(user.id);
      if (reviewMap.size > 0) {
        const convertedMap = new Map<number, ReviewState>();
        reviewMap.forEach((value, key) => {
          const genId = parseInt(key.replace(/-/g, "").substring(0, 10) || `${Date.now()}`);
          const statusValue = value.status as "draft" | "review" | "approved" | "rejected";
          convertedMap.set(genId, {
            generationId: genId,
            status: statusValue || "draft",
            comments: value.comments || "",
            updatedAt: value.updatedAt || new Date().toISOString(),
          });
        });
        setReviewStates(convertedMap);
      }

      // 메시지 이력
      const messages = await dbService.loadMessages(user.id);
      updateFavoriteMessages(messages);
      if (messages.length > 0) {
        const normalized = messages.map(msg => ({
          id: String(msg.id || generateUniqueId()),
          text: msg.text,
          purpose: msg.purpose,
          createdAt: msg.createdAt || new Date().toISOString(),
          updatedAt: msg.updatedAt || msg.createdAt || new Date().toISOString(),
        }));
        setMessageHistory(normalized.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
      } else {
        setMessageHistory([]);
      }
    } catch (error: any) {
      // DB에서 데이터 로드 실패 (무시 가능)
    } finally {
      setIsLoadingFavorites(false);
    }
  }, [user?.id, offlineToastShown, toast, updateFavoriteMessages]);

  // localStorage에서 DB로 마이그레이션
  const migrateLocalStorageToDB = useCallback(async () => {
    if (!user?.id || hasMigratedLocalStorage) return;

    try {
      const migrationFlag = localStorage.getItem(MIGRATION_FLAG_KEY);
      if (migrationFlag === "true") {
        setHasMigratedLocalStorage(true);
        return;
      }

      // LocalStorage에서 DB로 데이터 마이그레이션 시작

      // 생성 이력 마이그레이션
      const historyRaw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (historyRaw) {
        const parsed = JSON.parse(historyRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const item of parsed) {
            const entry: dbService.GenerationEntry = {
              purpose: item.purpose || "announcement",
              purposeLabel: item.purposeLabel || getPurposeMeta(item.purpose || "announcement").label,
              voiceId: item.voiceId || item.voice_id || "",
              voiceName: item.voiceName || getVoiceDisplayName(item.voiceId || item.voice_id || ""),
              savedName: item.savedName || null,
              textPreview: item.textPreview || item.text || "",
              textLength: item.textPreview?.length || item.text?.length || 0,
              duration: item.duration || null,
              language: item.language || "ko",
              cacheKey: item.cacheKey || item.key || "",
              audioUrl: item.audioUrl || null,
              status: item.status || (item.hasAudio === false ? "mock" : "ready"),
              hasAudio: typeof item.hasAudio === "boolean" ? item.hasAudio : true,
              isFavorite: item.isFavorite === true,
            };

            // audioBlob 복원 시도
            let audioBlob: Blob | undefined = undefined;
            if (item.cacheKey || item.key) {
              const cached = cacheRef.current.get(item.cacheKey || item.key || "");
              if (cached?.blob) {
                audioBlob = cached.blob;
                entry.audioBlob = await cached.blob.arrayBuffer();
              }
            }

            await dbService.saveGeneration(user.id, entry, audioBlob);
          }
        }
      }

      // 즐겨찾기 마이그레이션
      const favRaw = localStorage.getItem(FAV_STORAGE_KEY);
      if (favRaw) {
        const ids: string[] = JSON.parse(favRaw);
        if (Array.isArray(ids)) {
          for (const voiceId of ids) {
            await dbService.addFavorite(user.id, voiceId);
          }
        }
      }

      // 사용자 설정 마이그레이션
      const purposeRaw = localStorage.getItem(PURPOSE_STORAGE_KEY);
      if (purposeRaw) {
        await dbService.saveUserSettings(user.id, { selectedPurpose: purposeRaw });
      }

      // 클론 요청 마이그레이션
      const cloneRaw = localStorage.getItem(CLONE_STORAGE_KEY);
      if (cloneRaw) {
        const parsed = JSON.parse(cloneRaw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const entry: dbService.CloneRequestEntry = {
              targetName: item.targetName || item.target_name || "",
              baseVoiceId: item.baseVoiceId || item.base_voice_id || "",
              baseVoiceName: item.baseVoiceName || item.base_voice_name || "",
              language: item.language || "ko",
              memo: item.memo || "",
              sampleName: item.sampleName || item.sample_name || "",
              voiceId: item.voiceId || item.voice_id || "",
              voiceName: item.voiceName || item.voice_name || "",
              gender: item.gender,
              status: item.status || "processing",
              completedAt: item.completedAt || item.completed_at,
            };
            await dbService.saveCloneRequest(user.id, entry);
          }
        }
      }

      // 메시지 이력 마이그레이션
      const messageRaw = localStorage.getItem(MESSAGE_HISTORY_STORAGE_KEY);
      if (messageRaw) {
        const parsed = JSON.parse(messageRaw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            await dbService.saveMessage(user.id, {
              text: item.text || "",
              purpose: item.purpose || "announcement",
            });
          }
        }
      }

      // 마이그레이션 완료 플래그 설정
      localStorage.setItem(MIGRATION_FLAG_KEY, "true");
      setHasMigratedLocalStorage(true);
      // LocalStorage 마이그레이션 완료
      
      toast({
        title: "데이터베이스 마이그레이션 완료",
        description: "모든 데이터가 안전하게 저장되었습니다.",
      });
    } catch (error: any) {
      // 마이그레이션 실패 (무시 가능)
    }
  }, [user?.id, hasMigratedLocalStorage]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;

    (async () => {
      await migrateLocalStorageToDB();
      if (!active) return;
      await loadDataFromDB();
    })();

    return () => {
      active = false;
    };
  }, [user?.id, migrateLocalStorageToDB, loadDataFromDB]);

  // 초기 로드: DB에서 데이터 가져오기 또는 localStorage에서 로드
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
                  if (cached?.dataUrl) {
                    return cached.dataUrl;
                  }
                  if (cached?.blob) {
                    return cached._audioUrl;
                  }
                  // blob 데이터가 없으면 기존 audioUrl 사용 (구형 호환)
                  if (cached?._audioUrl) return cached._audioUrl;
                }
                // cacheKey가 없거나 cacheRef에 없으면 기존 audioUrl 사용
                return item.audioUrl || null;
              })(),
              isPersisted: item.isPersisted === true,
              allowServerUpdate: item.allowServerUpdate === true,
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
          // CloneRequest 타입은 VoiceCloning.tsx로 이동했으므로 any[] 사용
          const normalized: any[] = parsed.map((item: any, index: number) => {
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
          // 클론 요청은 VoiceCloning.tsx에서 처리함
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (user?.id && selectedPurpose) {
      // DB에 저장
      dbService.saveUserSettings(user.id, { selectedPurpose }).catch(() => {});
    }
    // localStorage도 업데이트 (폴백)
    try {
      if (selectedPurpose) {
        localStorage.setItem(PURPOSE_STORAGE_KEY, selectedPurpose);
      }
    } catch {}
  }, [selectedPurpose, user?.id]);

  // cloneRequests는 VoiceCloning.tsx에서 관리함

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

  const pushHistory = async (entry: any): Promise<any> => {
    if (!user?.id) {
      // 로그인하지 않은 경우 localStorage에만 저장 (임시)
      try {
        const savedEntry = { ...entry, id: entry.id || generateUniqueId(), isFavorite: entry.isFavorite === true, isPersisted: false, allowServerUpdate: false };
        const next = [savedEntry, ...generationHistory].slice(0, 100);
        setGenerationHistory(next);
        try {
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
        } catch {}
        return savedEntry;
      } catch {}
      return { ...entry, id: entry.id || generateUniqueId() };
    }

    try {
      // DB에 저장
      // cacheKey에서 blob 가져오기 (우선순위)
      let audioBlob: Blob | null = null;
      if (entry.cacheKey) {
        const cached = cacheRef.current.get(entry.cacheKey);
        audioBlob = cached?.blob || null;
      }
      
      // finalCacheKey 결정 (entry.cacheKey가 있으면 사용, 없으면 생성)
      let finalCacheKey = entry.cacheKey || `saved_${entry.id || Date.now()}_${generateUniqueId()}`;
      
      // blob URL에서 blob을 가져오지 않음 (만료 문제 방지)
      // cacheRef에 이미 blob이 저장되어 있으므로 그것을 사용
      // audioUrl이 blob: URL이면 무시하고 cacheRef에서만 가져옴
      
      // mimeType 정보 포함
      const mimeType = entry.mimeType || (audioBlob?.type || "audio/mpeg");
      const audioUrlForDb = entry.audioUrl && entry.audioUrl.startsWith("data:audio") ? null : entry.audioUrl;
      
      // 실제 파일 저장 (로컬 파일 시스템)
      let actualStoragePath = entry.storagePath || null;
      if (audioBlob && entry.storagePath) {
        try {
          // 브라우저에서는 자동 다운로드를 방지하고, Electron 환경에서만 자동 저장 수행
          const isElectron = typeof window !== 'undefined' && (((window as any).electron !== undefined) || ((window as any).require !== undefined));
          if (isElectron) {
          const userSettings = await dbService.loadUserSettings(user.id);
          const rootPath = userSettings?.storagePath || null;
          const savedFilePath = await fileStorageService.saveAudioFile(
            entry.storagePath,
            audioBlob,
            rootPath
          );
          if (savedFilePath) {
            actualStoragePath = savedFilePath;
            }
          }
        } catch (fileError) {
          console.warn("파일 저장 실패 (DB는 저장됨):", fileError);
        }
      }
      
      const dbEntry: dbService.GenerationEntry = {
        purpose: entry.purpose || "announcement",
        purposeLabel: entry.purposeLabel,
        voiceId: entry.voiceId || "",
        voiceName: entry.voiceName,
        savedName: entry.savedName || null,
        textPreview: entry.textPreview || "",
        textLength: entry.textLength ?? entry.textPreview?.length ?? 0,
        duration: entry.duration ?? null,
        language: entry.language || "ko",
        model: entry.model,
        style: entry.style,
        speed: entry.speed,
        pitchShift: entry.pitchShift,
        cacheKey: finalCacheKey,
        audioUrl: audioUrlForDb, // data URL은 DB에 저장하지 않음
        storagePath: actualStoragePath, // 실제 저장된 경로 사용
        format: entry.format || null,
        paramHash: entry.paramHash || null,
        status: entry.status || "ready",
        hasAudio: entry.hasAudio !== false,
        mimeType: mimeType,
        isFavorite: entry.isFavorite === true,
      };

      const dbId = await dbService.saveGeneration(user.id, dbEntry, audioBlob);

      // 로컬 상태 업데이트 (cacheKey와 mimeType 포함)
      // entry.audioUrl이 있으면 로컬 상태에 포함 (생성 직후에는 유효한 blob URL)
      // DB에는 여전히 null로 저장 (blob URL은 페이지 새로고침 시 만료됨)
      const savedEntry = { 
        ...entry, 
        id: dbId || entry.id || generateUniqueId(),
        cacheKey: finalCacheKey,
        mimeType: mimeType,
        storagePath: entry.storagePath || null,
        format: entry.format || null,
        paramHash: entry.paramHash || null,
        textLength: dbEntry.textLength,
        audioUrl: entry.audioUrl || null, // 전달받은 audioUrl 사용 (생성 직후에는 유효)
        isFavorite: entry.isFavorite === true,
        isPersisted: Boolean(dbId),
        allowServerUpdate: Boolean(dbId),
      };
      const next = [savedEntry, ...generationHistory.filter((g) => String(g.id) !== String(savedEntry.id))].slice(0, 100);
      setGenerationHistory(next);
      try {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
      } catch {}

      // 성공 토스트
      console.log(`음원 저장 완료: ${savedEntry.id}, blob: ${audioBlob ? '있음' : '없음'}`);

      return savedEntry;
    } catch (error: any) {
      console.error("pushHistory 저장 실패:", error);
      // 생성 이력 저장 실패 (무시 가능)
      // 실패 시 localStorage에 저장 (폴백)
      try {
        const savedEntry = { ...entry, id: entry.id || generateUniqueId(), isPersisted: false };
        const next = [savedEntry, ...generationHistory].slice(0, 100);
        setGenerationHistory(next);
        try {
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
        } catch {}
        return savedEntry;
      } catch {
        return { ...entry, id: entry.id || generateUniqueId() };
      }
    }
  };

  // 음원 삭제 확인
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  // 기본 파일명 생성 함수 (카테고리_YYYYMMDD 형식)
  const generateDefaultFileName = (generation: any): string => {
    if (!generation) return `음원_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
    const purposeLabel = generation.purposeLabel || getPurposeMeta(generation.purpose || "announcement").label;
    const dateStr = new Date(generation.createdAt || new Date()).toISOString().slice(0, 10).replace(/-/g, "");
    const extension = generation.format || "mp3";
    return `${purposeLabel}_${dateStr}.${extension}`;
  };

  // 음원 저장 처리 함수
  const handleSaveGeneration = async (savedName: string) => {
    if (!pendingGeneration) return;

    try {
      // pendingGeneration이 이미 DB에 저장되어 있는지 확인
      // (음원 생성 시 자동으로 pushHistory가 호출되어 저장됨)
      let savedEntry = pendingGeneration;
      const nameChanged = savedName !== pendingGeneration.savedName;

      if (!pendingGeneration.id) {
        // 아직 DB에 저장되지 않은 경우 (드문 경우) pushHistory 호출
        savedEntry = await pushHistory({
          ...pendingGeneration,
          savedName,
          allowServerUpdate: false,
        });
      } else if (nameChanged) {
        if (pendingGeneration.allowServerUpdate && user?.id && canUpdateSavedNameRef.current) {
          try {
            const success = await dbService.updateGeneration(user.id, String(pendingGeneration.id), { savedName });
            if (!success) {
              canUpdateSavedNameRef.current = false;
            }
          } catch (error) {
            // updateGeneration 내부에서 대부분의 에러를 처리하므로 여기서는 조용히 무시
            canUpdateSavedNameRef.current = false;
          }
        }
        savedEntry = { ...pendingGeneration, savedName };
        setGenerationHistory((prev) =>
          prev.map((g) =>
            String(g.id) === String(pendingGeneration.id)
              ? { ...g, savedName }
              : g
          )
        );
      }
      
      // 저장 완료 확인
      if (savedEntry?.id) {
        toast({
          title: "✅ 저장 완료",
          description: `음원이 "${savedName}"으로 저장되었습니다.`,
          duration: 2000,
        });
        // 믹스보드로 이동하지 않음 (요청사항)
      } else {
        toast({
          title: "저장 완료",
          description: `음원이 "${savedName}"으로 저장되었습니다.`,
        });
      }
    } catch (error) {
      console.error("음원 저장 실패:", error);
      toast({
        title: "저장 실패",
        description: "음원 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      return; // 에러 발생 시 모달을 닫지 않음
    }
    
    // 저장 성공 시에만 모달 닫기
    setIsSaveNameDialogOpen(false);
    setSaveNameInput("");
    setPendingGeneration(null);
  };

  // 음원 삭제
  const deleteGeneration = async (id: string) => {
    if (user?.id) {
      // DB에서 삭제 (DB에 저장된 항목에 한함)
      const entry = generationHistory.find((g) => String(g.id || '') === String(id));
      if (entry?.id && entry?.isPersisted) {
        await dbService.deleteGeneration(user.id, String(entry.id));
      }
    }

    // 로컬 상태 업데이트
    const updated = generationHistory.filter((g) => String(g.id || '') !== String(id));
    setGenerationHistory(updated);

    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    
    setDeleteConfirmDialog({ open: false, id: null });
    toast({
      title: "음원 삭제 완료",
      description: "생성 기록이 삭제되었습니다.",
    });
  };

  // 음원 이름 편집
  const editGenerationName = async (id: string, newName: string | null) => {
    if (user?.id && canUpdateSavedNameRef.current) {
      // DB에서 업데이트 (DB에 저장된 항목에 한함)
      const entry = generationHistory.find((g) => String(g.id || '') === String(id));
      if (entry?.id && entry?.allowServerUpdate) {
        try {
          const success = await dbService.updateGeneration(user.id, String(entry.id), { savedName: newName });
          if (!success) {
            canUpdateSavedNameRef.current = false;
          }
        } catch {
          // updateGeneration 내부에서 이미 오류 처리를 수행하므로 추가 조치는 필요 없음
          canUpdateSavedNameRef.current = false;
        }
      }
    }

    // 로컬 상태 업데이트
    const updated = generationHistory.map((g) =>
      String(g.id || '') === String(id) ? { ...g, savedName: newName } : g
    );
    setGenerationHistory(updated);

    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    
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
        } else if (cached?.dataUrl) {
          audioUrl = cached.dataUrl;
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
      const extension = entry.format || guessExtensionFromMime(downloadBlob.type || entry.mimeType);
      a.download = `${entry.savedName || formatDateTime(entry.createdAt)}.${extension}`;
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

  const canonicalizeValue = (value: any): any => {
    if (Array.isArray(value)) {
      return value.map(canonicalizeValue);
    }
    if (value && typeof value === "object") {
      const sortedKeys = Object.keys(value).sort();
      const result: Record<string, any> = {};
      sortedKeys.forEach((key) => {
        result[key] = canonicalizeValue(value[key]);
      });
      return result;
    }
    return value;
  };
  const stableStringify = (payload: Record<string, any>) => JSON.stringify(canonicalizeValue(payload));

  const computeGenerationHash = async (payload: Record<string, any>): Promise<string> => {
    const canonical = stableStringify(payload);
    try {
      if (typeof window !== "undefined" && window.crypto?.subtle) {
        const data = new TextEncoder().encode(canonical);
        const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
        return Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
      }
    } catch (error) {
      console.warn("crypto.subtle digest 실패, 폴백 해시 사용:", error);
    }
    let hash = 0;
    for (let i = 0; i < canonical.length; i++) {
      hash = (hash << 5) - hash + canonical.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  };
  const buildGenerationKey = (params: Record<string, any>) => stableStringify(params);

  const guessExtensionFromMime = (mimeType?: string | null) => {
    if (!mimeType) return "mp3";
    const lower = mimeType.toLowerCase();
    if (lower.includes("wav") || lower.includes("wave")) return "wav";
    if (lower.includes("ogg")) return "ogg";
    if (lower.includes("flac")) return "flac";
    return "mp3";
  };

  const buildStoragePath = (voiceId: string | undefined, paramHash: string, extension: string, createdAt: Date = new Date()) => {
    const year = createdAt.getFullYear();
    const month = String(createdAt.getMonth() + 1).padStart(2, "0");
    const day = String(createdAt.getDate()).padStart(2, "0");
    const safeVoiceId = (voiceId || "voice").replace(/[^a-zA-Z0-9_-]/g, "_");
    const hashSegment = paramHash.slice(0, 12);
    return `/audio/tts/${year}/${month}${day}/${safeVoiceId}_${hashSegment}.${extension}`;
  };

  const toggleFavorite = async (voiceId: string) => {
    setFavoriteVoiceIds(prev => {
      const next = new Set(prev);
      const isFavorite = next.has(voiceId);
      
      if (isFavorite) {
        next.delete(voiceId);
        // DB에서 제거
        if (user?.id) {
          dbService.removeFavorite(user.id, voiceId).catch(() => {});
        }
      } else {
        next.add(voiceId);
        // DB에 추가
        if (user?.id) {
          dbService.addFavorite(user.id, voiceId).catch(() => {});
        }
      }
      
      // localStorage도 업데이트 (폴백)
      try { localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  };

  // API에서 가져온 음성 데이터에 DB의 name_ko를 병합하는 함수
  const enrichVoicesWithNameKo = async (voices: any[]): Promise<any[]> => {
    if (!voices || voices.length === 0) return voices;
    
    try {
      // DB에서 name_ko 정보 가져오기
      const catalog = await dbService.loadVoiceCatalog();
      const nameKoMap = new Map<string, string>();
      
      catalog.forEach((voice: any) => {
        const voiceId = voice.voice_id;
        // loadVoiceCatalog는 voice_data에 name_ko를 포함시킴
        // 따라서 voice.name_ko (voice_data.name_ko)를 직접 사용
        const nameKo = voice.name_ko;
        if (voiceId && nameKo) {
          nameKoMap.set(voiceId, nameKo);
        }
      });
      
      // 각 음성에 name_ko 추가
      return voices.map((voice: any) => {
        if (voice.voice_id && nameKoMap.has(voice.voice_id)) {
          return { ...voice, name_ko: nameKoMap.get(voice.voice_id) };
        }
        return voice;
      });
    } catch (error) {
      console.warn("name_ko 병합 실패:", error);
      return voices;
    }
  };

  const combineVoiceLists = (current: any[], incoming: any[]) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return current;
    const map = new Map<string, any>();
    current.forEach((voice: any) => {
      if (voice?.voice_id) {
        map.set(voice.voice_id, voice);
      }
    });
    incoming.forEach((voice: any) => {
      if (!voice?.voice_id) return;
      const existing = map.get(voice.voice_id) || {};
      map.set(voice.voice_id, { ...existing, ...voice });
    });
    return Array.from(map.values());
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
      // Supabase 프록시 호출 실패 (무시 가능)
      }
      return null;
    }
  }, []);

  const cleanupGeneratedAudioUrl = (url: string | null) => {
    if (url && url.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        // blob URL 해제 실패 (무시 가능)
      }
    }
  };

  const fetchSampleAsDataUrl = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      if (!blob || blob.size === 0) return null;
      return await blobToDataUrl(blob);
    } catch (error) {
      console.warn("샘플 데이터 URL 변환 실패:", error);
      return null;
    }
  };

  const blobToDataUrl = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          if (typeof result === "string") {
            resolve(result);
          } else {
            reject(new Error("데이터 URL 변환에 실패했습니다."));
          }
        };
        reader.onerror = () => {
          reject(reader.error || new Error("데이터 URL 변환 중 알 수 없는 오류가 발생했습니다."));
        };
        reader.readAsDataURL(blob);
      } catch (error: any) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  };

  useEffect(() => {
    return () => {
      cleanupGeneratedAudioUrl(generatedAudio);
    };
  }, [generatedAudio]);

  // 네트워크 상태 감지 및 오프라인 모드 처리
  useEffect(() => {
    const handleOnline = () => {
      if (isOffline) {
        setIsOffline(false);
        setOfflineToastShown(false);
        // 네트워크 복귀 시 자동 재로드
        if (user?.id) {
          loadDataFromDB();
        }
        toast({
          title: "네트워크 연결 복구",
          description: "데이터를 다시 불러오는 중입니다.",
        });
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isOffline, user?.id, loadDataFromDB, toast]);

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

  // 템플릿에서 변수 추출
  const extractVariables = (templateText: string): string[] => {
    const matches = templateText.match(/\{([^}]+)\}/g);
    if (!matches) return [];
    return Array.from(new Set(matches.map(m => m.replace(/[{}]/g, '').trim())));
  };

  // 변수 값으로 템플릿 교체
  const replaceTemplateWithVariables = (templateText: string, variables: Record<string, string>): string => {
    // 템플릿 변수 교체
    let replaced = templateText.replace(/\{([^}]+)\}/g, (_, key) => {
      const k = String(key).trim();
      return variables[k] || `{${k}}`;
    });
    
    // 한국어 조사 자동 교정
    try {
      replaced = correctKoreanPostpositions(replaced);
    } catch (e) {
      // 조사 교정 실패해도 원본 텍스트 반환
      // 한국어 조사 교정 실패 (무시 가능)
    }
    
    return replaced;
  };

  const handleTemplateSelect = (template: any) => {
    // DB 템플릿인 경우
    if (template.id && typeof template.id === "string" && template.isTemplate) {
      setSelectedTemplate(template.id);
      setSelectedTemplateObj({ ...template, template: template.text });
      
      // 템플릿에서 변수 추출
      const variables = extractVariables(template.text);
      
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
        "내용": "",
        "날짜": new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }),
      };
      
      // 추출된 변수들의 기본값 설정
      const initialVariables: Record<string, string> = {};
      variables.forEach(v => {
        initialVariables[v] = defaultValues[v] || "";
      });
      
      setTemplateVariables(initialVariables);
      
      // 초기 텍스트 생성
      const replaced = replaceTemplateWithVariables(template.text, initialVariables);
      setCustomText(replaced);
    } else {
      // 기존 하드코딩된 템플릿 (레거시 지원)
      setSelectedTemplate(template.id);
      setSelectedTemplateObj(template);
      
      const variables = extractVariables(template.template);
      
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
      
      const initialVariables: Record<string, string> = {};
      variables.forEach(v => {
        initialVariables[v] = defaultValues[v] || "";
      });
      
      setTemplateVariables(initialVariables);
      const replaced = replaceTemplateWithVariables(template.template, initialVariables);
      setCustomText(replaced);
    }
  };

  // 변수 값 변경 핸들러
  const handleVariableChange = (variableName: string, value: string) => {
    const updated = { ...templateVariables, [variableName]: value };
    setTemplateVariables(updated);
    
    // 템플릿 재생성
    if (selectedTemplateObj) {
      const templateText = selectedTemplateObj.template || selectedTemplateObj.text;
      if (templateText) {
        const replaced = replaceTemplateWithVariables(templateText, updated);
        setCustomText(replaced);
      }
    }
  };

  const normalizeString = (value?: string | null) => (value || "").toLowerCase().trim();

  const matchStringInArray = (value: string, list: string[] = []) => {
    const normalized = normalizeString(value);
    if (!normalized) return true;
    return list.some((item) => normalizeString(item) === normalized);
  };

  const applyClientFilters = (voices: any[], filters: typeof voiceFilters) => {
    const keyword = normalizeString(filters.name);
    const languageFilter = normalizeString(filters.language);
    const genderFilter = normalizeString(filters.gender);
    const styleFilter = normalizeString(filters.style);
    const useCaseFilter = normalizeString(filters.useCase);

    return voices.filter((voice) => {
      const voiceNameKo = getVoiceDisplayNameKo(voice.name, voice.voice_id, voice.name_ko);
      const voiceName = normalizeString(voiceNameKo);
      const originalName = normalizeString(voice.name || voice.voice_id);
      const matchesName = !keyword || voiceName.includes(keyword) || originalName.includes(keyword);

      const voiceLanguages = Array.isArray(voice.language)
        ? voice.language
        : voice.language
        ? [voice.language]
        : [];
      const matchesLanguage = !languageFilter || matchStringInArray(languageFilter, voiceLanguages);

      const voiceGender = normalizeString(voice.gender);
      const matchesGender = !genderFilter || voiceGender === genderFilter;

      const voiceStyles = Array.isArray(voice.styles)
        ? voice.styles
        : typeof voice.styles === "string"
        ? [voice.styles]
        : [];
      const matchesStyle = !styleFilter || matchStringInArray(styleFilter, voiceStyles);

      const rawUseCase = voice.use_case || voice.useCase || voice.usecases || voice.use_cases;
      const voiceUseCases = Array.isArray(rawUseCase)
        ? rawUseCase
        : rawUseCase
        ? [rawUseCase]
        : [];
      const normalizedUseCases = voiceUseCases.map((item: string) => normalizeString(item).replace(/_/g, "-"));
      const matchesUseCase = !useCaseFilter || normalizedUseCases.includes(useCaseFilter);

      return matchesName && matchesLanguage && matchesGender && matchesStyle && matchesUseCase;
    });
  };

  // Supertone API에서 음성 목록 가져오기 (Supabase Edge Function 프록시 사용)
  // 공식 레퍼런스: https://docs.supertoneapi.com/en/api-reference/endpoints/list-voices
  const fetchVoices = async (showToast = true, forceReload = false) => {
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
      // forceReload가 true이면 DB 체크 건너뛰고 API에서 직접 가져오기
      if (forceReload) {
        // 강제 재로드 모드
      } else {
        // 먼저 DB에서 음성 카탈로그 로드 시도 (샘플 음원 포함)
        const dbVoices = await dbService.loadVoiceCatalog();
        const dbCount = await dbService.getVoiceCatalogCount();
        const needsUpdate = await dbService.shouldUpdateCatalog();
        
        // DB에 음성이 있고, 개수가 충분하고 (20개 이상), 오늘 이미 업데이트했으면 DB에서 사용
        if (dbVoices && dbVoices.length > 0 && dbCount >= 20 && !needsUpdate) {
          setAllVoices((prev) => combineVoiceLists(prev, dbVoices));
          setAvailableVoices((prev) => combineVoiceLists(prev.length > 0 ? prev : [], dbVoices));
          setVoiceLoadingProgress(100);
          voicesLoaded = true;
          
          if (showToast) {
            toast({
              title: "음성 목록 로드 완료",
              description: `DB에서 ${dbVoices.length}개의 음성을 불러왔습니다.`,
            });
          }
          
          if (favoriteVoiceIds.size > 0) {
            setTimeout(() => {
              loadFavoriteVoices();
            }, 0);
          }
          
          setIsLoadingVoices(false);
          return; // DB에서 로드 완료했으면 함수 종료
        }
        
        // DB 음성 수가 적거나 (20개 미만) 업데이트가 필요하면 API에서 가져오기
        if (dbVoices && dbVoices.length > 0 && (dbCount < 20 || needsUpdate)) {
          if (showToast && needsUpdate) {
            toast({
              title: "음성 목록 업데이트 중",
              description: "최신 음성 목록을 불러오고 있습니다...",
            });
          }
        }
      }
      
      // DB에 음성이 없거나 forceReload=true이면 API에서 가져오기
      const response = await fetchWithSupabaseProxy("/voices?limit=100", { method: "GET" });
      if (response?.ok) {
            const data = await response.json();
        // 응답 형식: { items: [], total: 150, nextPageToken: "..." } 또는 배열/기타 필드
        const voices = data.items || (Array.isArray(data) ? data : (data.voices || data.data || []));
        // DB의 name_ko 정보를 병합
        const enrichedVoices = await enrichVoicesWithNameKo(voices);
        setAllVoices((prev) => combineVoiceLists(prev, enrichedVoices));
        setAvailableVoices((prev) => combineVoiceLists(prev.length > 0 ? prev : [], enrichedVoices));
        const nextToken = data.nextPageToken || data.next_page_token || data.next_token || null;
        setVoiceNextToken(nextToken || null);
        const total = data.total || data.totalCount || null;
        setVoiceTotalCount(total);
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
          // forceReload이면 모든 페이지 로드하고 DB에 저장
          await autoLoadVoicesThrottled(100, 150, showToast, forceReload);
        } else {
          // nextToken이 없으면 이미 모든 음성 로드 완료
          setVoiceLoadingProgress(100);
          if (showToast) {
            toast({
              title: "모든 음성 로드 완료",
              description: `총 ${voices.length}개의 음성을 불러왔습니다.`,
            });
          }
          // forceReload이거나 업데이트 필요하면 즉시 DB에 저장
          if (forceReload && voices.length > 0) {
            await dbService.syncVoiceCatalog(voices, true).catch(() => {});
            // forceReload 후 모든 기존 음성의 name_ko도 업데이트
            await dbService.updateAllVoiceNamesKo().catch(() => {});
            if (showToast) {
              toast({
                title: "DB 저장 완료",
                description: `${voices.length}개의 음성이 DB에 저장되었습니다.`,
              });
            }
          } else {
            // forceReload이 아니면 일별 동기화 체크 후 저장
            const needsUpdate = await dbService.shouldUpdateCatalog();
            if (needsUpdate && voices.length > 0) {
              await dbService.syncVoiceCatalog(voices, false).catch(() => {});
              // 동기화 후 모든 기존 음성의 name_ko도 업데이트
              await dbService.updateAllVoiceNamesKo().catch(() => {});
            }
          }
        }
        
        // forceReload이 아니면 일별 동기화 (백그라운드)
        if (!forceReload) {
          dbService.syncVoiceCatalog(voices, false).catch(() => {});
          // 백그라운드에서 모든 기존 음성의 name_ko도 업데이트
          dbService.updateAllVoiceNamesKo().catch(() => {});
        }

        if (favoriteVoiceIds.size > 0) {
          setTimeout(() => {
            loadFavoriteVoices();
          }, 0);
        }
      } else if (response) {
        // 조용히 실패 처리
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
      // 조용히 실패 처리
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
        // DB의 name_ko 정보를 병합
        const enrichedResults = await enrichVoicesWithNameKo(results);
        // 마스터 목록 갱신 (중복 제거)
        setAllVoices((prev) => {
          const existingIds = new Set(prev.map((v: any) => v.voice_id));
          const newVoices = enrichedResults.filter((v: any) => !existingIds.has(v.voice_id));
          return [...prev, ...newVoices];
        });
        setAvailableVoices((prev) => {
          const existingIds = new Set(prev.map((v: any) => v.voice_id));
          const newVoices = enrichedResults.filter((v: any) => !existingIds.has(v.voice_id));
          return [...prev, ...newVoices];
        });
        
        // 클라이언트 필터링은 allVoices 전체에서 적용 (useCase 같은 필터를 위해)
        // 상태 업데이트를 기다리기 위해 setTimeout 사용
        setTimeout(() => {
          setAllVoices((currentAllVoices) => {
            const filtered = applyClientFilters(currentAllVoices, voiceFilters);
            setVoiceSearchResults(filtered);
            return currentAllVoices;
          });
        }, 0);
        
        const nextToken = data.nextPageToken || data.next_page_token || data.next_token || null;
        setVoiceNextToken(nextToken || null);
        const total = data.total || data.totalCount || null;
        setVoiceTotalCount(total);
        // 모든 필터가 전체이면 즉시 전체 로드하여 개수 일치시키기
        if (nextToken && isAllFilters(voiceFilters)) {
          await autoLoadVoicesThrottled(50, 0);
        } else if (nextToken) {
          // 그 외에는 완화된 속도로 배경 로드
          autoLoadVoicesThrottled(5, 300);
        }
      } else if (response) {
        console.warn("음성 검색 실패(프록시):", await response.text());
        // API 실패 시에도 allVoices 전체에서 필터링 시도
        setAllVoices((currentAllVoices) => {
          if (currentAllVoices.length > 0) {
            const filtered = applyClientFilters(currentAllVoices, voiceFilters);
            setVoiceSearchResults(filtered);
          } else {
            setVoiceSearchResults([]);
          }
          return currentAllVoices;
        });
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        // 에러 발생 시에도 allVoices 전체에서 필터링 시도
        setAllVoices((currentAllVoices) => {
          if (currentAllVoices.length > 0) {
            const filtered = applyClientFilters(currentAllVoices, voiceFilters);
            setVoiceSearchResults(filtered);
          } else {
            setVoiceSearchResults([]);
          }
          return currentAllVoices;
        });
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
        // DB의 name_ko 정보를 병합
        const enrichedResults = await enrichVoicesWithNameKo(results);
        setAllVoices(prev => {
          // 중복 제거
          const existingIds = new Set(prev.map((v: any) => v.voice_id));
          const newVoices = enrichedResults.filter((v: any) => !existingIds.has(v.voice_id));
          return [...prev, ...newVoices];
        });
        setAvailableVoices(prev => {
          // 중복 제거
          const existingIds = new Set(prev.map((v: any) => v.voice_id));
          const newVoices = enrichedResults.filter((v: any) => !existingIds.has(v.voice_id));
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

  const autoLoadVoicesThrottled = async (maxPages = 5, delayMs = 300, showToast = false, forceSaveToDB = false) => {
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
        
        // 모든 음성 로드 완료 후 DB에 저장 (forceSaveToDB=true일 때만)
        if (forceSaveToDB) {
          // 상태 업데이트 완료 후 최신 allVoices를 가져오기 위해 약간의 딜레이
          await sleep(300);
          // 함수형 업데이트로 최신 allVoices 상태 사용
          setAllVoices((currentVoices) => {
            if (currentVoices.length > 0) {
              console.log(`모든 음성 ${currentVoices.length}개를 DB에 저장합니다...`);
              // 비동기 작업을 별도로 실행
              dbService.syncVoiceCatalog(currentVoices, true).then(async (success) => {
                if (success) {
                  console.log(`✅ 모든 음성 ${currentVoices.length}개 DB 저장 완료`);
                  // 동기화 후 모든 기존 음성의 name_ko도 업데이트
                  await dbService.updateAllVoiceNamesKo().catch(() => {});
                  if (showToast) {
                    toast({
                      title: "DB 저장 완료",
                      description: `${currentVoices.length}개의 음성이 DB에 저장되었습니다.`,
                    });
                  }
                } else {
                  console.warn("음성 카탈로그 DB 저장 실패");
                }
              }).catch(err => {
                console.error("DB 저장 중 오류:", err);
              });
            }
            return currentVoices; // 상태 변경 없음
          });
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

  useEffect(() => {
    historyPreviewUrlsRef.current = historyPreviewUrls;
  }, [historyPreviewUrls]);

  useEffect(() => {
    return () => {
      Object.values(historyPreviewUrlsRef.current).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore revoke errors
        }
      });
    };
  }, []);

  useEffect(() => {
    const validIds = new Set(generationHistory.map((item) => String(item.id)));
    setHistoryPreviewUrls((prev) => {
      const next: Record<string, string> = {};
      Object.entries(prev).forEach(([id, url]) => {
        if (validIds.has(id)) {
          next[id] = url;
        } else {
          try {
            URL.revokeObjectURL(url);
          } catch {
            // ignore revoke errors
          }
        }
      });
      return next;
    });
  }, [generationHistory]);

  const ensureHistoryAudio = useCallback(
    async (entry: any, options: { forceReload?: boolean } = {}) => {
      if (!entry?.id) return null;
      const entryId = String(entry.id);
      const forceReload = options.forceReload ?? false;

      if (!forceReload) {
        const existing = historyPreviewUrlsRef.current[entryId];
        if (existing) {
          return existing;
        }
      }

      const cacheKey = entry.cacheKey || entryId;
      let mimeType = entry.mimeType || "audio/mpeg";
      let candidateBlob: Blob | null = null;
      const cached = cacheRef.current.get(cacheKey);

      if (!forceReload && cached?.dataUrl) {
        return cached.dataUrl;
      }

      if (cached?.blob) {
        candidateBlob = cached.blob;
        mimeType = cached.mimeType || mimeType;
        if (forceReload) {
          try {
            const arrayBuffer = await cached.blob.arrayBuffer();
            candidateBlob = new Blob([arrayBuffer], { type: mimeType });
          } catch {
            candidateBlob = cached.blob;
          }
        }
      }

      if (!candidateBlob && entry.audioBlob) {
        try {
          candidateBlob = dbService.arrayBufferToBlob(entry.audioBlob, mimeType);
        } catch {
          candidateBlob = null;
        }
      }

      if (!candidateBlob && entry.audioUrl && !entry.audioUrl.startsWith("data:")) {
        try {
          const response = await fetch(entry.audioUrl);
          if (response.ok) {
            const fetchedBlob = await response.blob();
            if (fetchedBlob && fetchedBlob.size > 0) {
              mimeType = fetchedBlob.type || mimeType;
              candidateBlob = fetchedBlob;
            }
          }
        } catch (error) {
          console.warn("기존 음원 URL 가져오기 실패:", error);
        }
      }

      if (!candidateBlob && entry.audioUrl && !entry.audioUrl.startsWith("blob:") && !forceReload) {
        const existingUrl = entry.audioUrl;
        setHistoryPreviewUrls((prev) => ({ ...prev, [entryId]: existingUrl }));
        return existingUrl;
      }

      if (!candidateBlob && entry?.isPersisted !== false && user?.id && entry.id) {
        try {
          const result = await dbService.loadGenerationBlob(user.id, String(entry.id));
          if (result?.audioBlob) {
            mimeType = result.mimeType || mimeType;
            const tempBlob = dbService.arrayBufferToBlob(result.audioBlob, mimeType);
            try {
              const arrayBuffer = await tempBlob.arrayBuffer();
              candidateBlob = new Blob([arrayBuffer], { type: mimeType });
            } catch {
              candidateBlob = tempBlob;
            }
          }
        } catch (error) {
          console.error("음원 로드 실패:", error);
        }
      }

      if (!candidateBlob) {
        return null;
      }

      let playbackUrl: string;
      try {
        playbackUrl = await blobToDataUrl(candidateBlob);
      } catch (error) {
        console.warn("히스토리 데이터 URL 변환 실패, blob URL 사용:", error);
        playbackUrl = URL.createObjectURL(candidateBlob);
      }

      cacheRef.current.set(cacheKey, {
        ...cached,
        blob: candidateBlob,
        mimeType,
        dataUrl: playbackUrl,
        _audioUrl: playbackUrl,
      });

      setHistoryPreviewUrls((prev) => {
        const prevUrl = prev[entryId];
        if (prevUrl && prevUrl !== playbackUrl && prevUrl.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(prevUrl);
          } catch {
            // ignore revoke errors
          }
        }
        return { ...prev, [entryId]: playbackUrl };
      });

      setGenerationHistory((prev) => {
        const next = prev.map((g) =>
          String(g.id) === entryId
            ? {
                ...g,
                audioUrl: playbackUrl,
                mimeType,
                hasAudio: true,
                allowServerUpdate: g.allowServerUpdate ?? false,
              }
            : g
        );
        try {
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });

      return playbackUrl;
    },
    [user?.id]
  );

  const closeLocalSaveDialog = useCallback(() => {
    setLocalSaveDialog((prev) => {
      if (prev.downloadUrl) {
        try {
          URL.revokeObjectURL(prev.downloadUrl);
        } catch {
          // ignore revoke errors
        }
      }
      return {
        open: false,
        entry: null,
        isPreparing: false,
        fileName: "",
        downloadUrl: null,
        sizeLabel: "",
        error: null,
        mimeType: null,
      };
    });
  }, []);

  const handleLocalSaveClick = useCallback(async (entry: any) => {
    if (!entry) return;

    setLocalSaveDialog((prev) => {
      if (prev.downloadUrl) {
        try {
          URL.revokeObjectURL(prev.downloadUrl);
        } catch {
          // ignore revoke errors
        }
      }
      return {
        open: true,
        entry,
        isPreparing: true,
        fileName: "",
        downloadUrl: null,
        sizeLabel: "",
        error: null,
        mimeType: entry.mimeType || null,
      };
    });

    try {
      const ensuredUrl = await ensureHistoryAudio(entry);
      if (!ensuredUrl) {
        throw new Error("음원 데이터를 찾을 수 없습니다.");
      }

      const response = await fetch(ensuredUrl);
      if (!response.ok) {
        throw new Error("음원 데이터를 가져올 수 없습니다.");
      }

      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error("음원 데이터가 비어 있습니다.");
      }

      const sanitizedName = (entry.savedName?.trim() || formatDateTime(entry.createdAt)).replace(/[\\/:*?"<>|]+/g, "_");
      const extension = (entry.format || guessExtensionFromMime(blob.type || entry.mimeType) || "mp3").toLowerCase();
      const fileName = `${sanitizedName}.${extension}`;
      const sizeLabel = blob.size >= 1024 * 1024 ? `${(blob.size / (1024 * 1024)).toFixed(2)} MB` : `${(blob.size / 1024).toFixed(2)} KB`;
      const downloadUrl = URL.createObjectURL(blob);

      setLocalSaveDialog((prev) => ({
        ...prev,
        isPreparing: false,
        downloadUrl,
        fileName,
        sizeLabel,
        error: null,
        mimeType: blob.type || entry.mimeType || "audio/mpeg",
      }));
    } catch (error: any) {
      console.error("로컬 저장 준비 실패:", error);
      setLocalSaveDialog((prev) => ({
        ...prev,
        isPreparing: false,
        error: error?.message || "음원을 준비하는 중 문제가 발생했습니다.",
      }));
    }
  }, [ensureHistoryAudio, formatDateTime]);

  const handleConfirmLocalSave = useCallback(() => {
    if (!localSaveDialog.downloadUrl || !localSaveDialog.fileName) {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = localSaveDialog.downloadUrl;
    anchor.download = localSaveDialog.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    toast({
      title: "로컬 저장 완료",
      description: `"${localSaveDialog.fileName}" 파일이 저장되었습니다.`,
    });

    closeLocalSaveDialog();
  }, [closeLocalSaveDialog, localSaveDialog.downloadUrl, localSaveDialog.fileName, toast]);


  // 저장된 메시지 불러오기 함수
  const loadMessageById = useCallback(async (messageId: string) => {
    if (!user?.id) return;
    try {
      const messages = await dbService.loadMessages(user.id);
      updateFavoriteMessages(messages);
      const message = messages.find((m) => m.id === messageId);
      if (message) {
        setCustomText(message.text);
        setSelectedPurpose(message.purpose || "announcement");
        toast({
          title: "문구 불러오기 완료",
          description: "저장된 문구를 불러왔습니다.",
        });
      } else {
        toast({
          title: "문구를 찾을 수 없습니다",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("메시지 불러오기 실패:", error);
      toast({
        title: "문구 불러오기 실패",
        description: "저장된 문구를 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    }
  }, [user?.id, toast, updateFavoriteMessages]);

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
        const isRealVoiceId = availableVoices.some((v: any) => v.voice_id === selectedVoice);
        
        if (isRealVoiceId) {
          setIsPredictingDuration(true);
          
          // 선택된 음성의 언어 확인
          const selected = availableVoices.find((v: any) => v.voice_id === selectedVoice) || selectedVoiceInfo;
          const supportedLanguages: string[] = Array.isArray(selected?.language) ? selected.language : (selected?.language ? [selected.language] : []);
          const chosenLanguage = supportedLanguages.length > 0 && !supportedLanguages.includes("ko") ? supportedLanguages[0] : "ko";

  const handleLocalSaveClick = useCallback(async (entry: any) => {
    if (!entry) return;

    setLocalSaveDialog((prev) => {
      if (prev.downloadUrl) {
        try {
          URL.revokeObjectURL(prev.downloadUrl);
        } catch {
          // ignore revoke errors
        }
      }
      return {
        open: true,
        entry,
        isPreparing: true,
        fileName: "",
        downloadUrl: null,
        sizeLabel: "",
        error: null,
        mimeType: entry.mimeType || null,
      };
    });

    try {
      const ensuredUrl = await ensureHistoryAudio(entry);
      if (!ensuredUrl) {
        throw new Error("음원 데이터를 찾을 수 없습니다.");
      }

      const response = await fetch(ensuredUrl);
      if (!response.ok) {
        throw new Error("음원 데이터를 가져올 수 없습니다.");
      }

      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error("음원 데이터가 비어 있습니다.");
      }

      const sanitizedName = (entry.savedName?.trim() || formatDateTime(entry.createdAt)).replace(/[\\/:*?"<>|]+/g, "_");
      const extension = (entry.format || guessExtensionFromMime(blob.type || entry.mimeType) || "mp3").toLowerCase();
      const fileName = `${sanitizedName}.${extension}`;
      const sizeLabel = blob.size >= 1024 * 1024
        ? `${(blob.size / (1024 * 1024)).toFixed(2)} MB`
        : `${(blob.size / 1024).toFixed(2)} KB`;
      const downloadUrl = URL.createObjectURL(blob);

      setLocalSaveDialog((prev) => ({
        ...prev,
        isPreparing: false,
        downloadUrl,
        fileName,
        sizeLabel,
        error: null,
        mimeType: blob.type || entry.mimeType || "audio/mpeg",
      }));
    } catch (error: any) {
      console.error("로컬 저장 준비 실패:", error);
      setLocalSaveDialog((prev) => ({
        ...prev,
        isPreparing: false,
        error: error?.message || "음원을 준비하는 중 문제가 발생했습니다.",
      }));
    }
  }, [ensureHistoryAudio, formatDateTime]);

  const handleConfirmLocalSave = useCallback(() => {
    if (!localSaveDialog.downloadUrl || !localSaveDialog.fileName) {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = localSaveDialog.downloadUrl;
    anchor.download = localSaveDialog.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    toast({
      title: "로컬 저장 완료",
      description: `"${localSaveDialog.fileName}" 파일이 저장되었습니다.`,
    });

    closeLocalSaveDialog();
  }, [closeLocalSaveDialog, localSaveDialog.downloadUrl, localSaveDialog.fileName, toast]);

          
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
      } else if (response) {
        // 에러 응답 로깅
        try {
          const errorData = await response.clone().json();
          console.warn(`예상 길이 계산 실패 (${response.status}):`, errorData?.error || errorData?.detail || "알 수 없는 오류");
        } catch {
          const errorText = await response.text();
          console.warn(`예상 길이 계산 실패 (${response.status}):`, errorText);
        }
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.warn("예상 길이 계산 실패:", error?.message || error);
      }
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
  // 여러 오디오를 하나로 결합하는 함수 (mp3 형식 유지 시도)
  const concatenateAudios = async (audioBlobs: Blob[], preserveFormat: boolean = false): Promise<Blob> => {
    if (audioBlobs.length === 0) {
      throw new Error("결합할 오디오가 없습니다.");
    }
    if (audioBlobs.length === 1) {
      return audioBlobs[0];
    }

    // mp3 형식 유지 옵션이 있고 모든 청크가 mp3인 경우
    // Web Audio API로 디코딩 후 결합 (더 안정적)
    if (preserveFormat) {
      const allMp3 = audioBlobs.every(blob => blob.type.includes('mp3') || blob.type.includes('mpeg'));
      if (allMp3) {
    try {
          // Web Audio API로 디코딩 후 결합 (피치 변조 방지)
          const targetSampleRate = 44100;
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: targetSampleRate });
      const audioBuffers: AudioBuffer[] = [];

      // 모든 오디오를 디코딩
      for (const blob of audioBlobs) {
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        audioBuffers.push(audioBuffer);
      }

          // 전체 길이(초) 계산: 샘플레이트가 다른 청크가 섞여도 안전하게 동작
          const totalDurationSec = audioBuffers.reduce((sum, buf) => sum + buf.duration, 0);
      const numChannels = audioBuffers[0].numberOfChannels;

          // 오프라인 컨텍스트로 결합 (피치 변조 없이, 타임라인은 초 단위)
          const totalFrames = Math.ceil(totalDurationSec * targetSampleRate);
          const offlineCtx = new OfflineAudioContext(numChannels, totalFrames, targetSampleRate);
          let currentStartTimeSec = 0;

      for (const buffer of audioBuffers) {
        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;
            // 피치 변조 없이 원본 그대로 재생
            source.playbackRate.value = 1.0;
        source.connect(offlineCtx.destination);
            source.start(currentStartTimeSec);
            currentStartTimeSec += buffer.duration;
      }

      const renderedBuffer = await offlineCtx.startRendering();

          // WAV로 인코딩 (mp3 인코딩은 브라우저 제한으로 WAV 사용)
          // 실제로는 서버 측에서 mp3로 변환하는 것이 이상적입니다
      const { encodeWavPCM16, mixDownToStereo } = await import("@/lib/audioMixer");
      const interleaved = mixDownToStereo(renderedBuffer);
          const wavBlob = encodeWavPCM16(interleaved, targetSampleRate, numChannels);

          // mp3 형식으로 저장하려면 서버 측 변환이 필요하지만,
          // 현재는 WAV로 반환하고 mimeType을 mp3로 표시하지 않음
          return wavBlob;
        } catch (error: any) {
          console.warn("MP3 디코딩/결합 실패, 바이너리 결합 시도:", error);
          // 실패 시 바이너리 결합 시도
          try {
            const chunks: Uint8Array[] = [];
            for (const blob of audioBlobs) {
              const arrayBuffer = await blob.arrayBuffer();
              chunks.push(new Uint8Array(arrayBuffer));
            }
            const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
            const combined = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
              combined.set(chunk, offset);
              offset += chunk.length;
            }
            return new Blob([combined], { type: 'audio/mpeg' });
          } catch (binaryError) {
            console.error("바이너리 결합도 실패:", binaryError);
            throw error; // 원래 에러를 throw
          }
        }
      }
    }

    // 기본 동작: WAV로 변환하여 결합 (더 안정적)
    try {
      const targetSampleRate = 44100;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: targetSampleRate });
      const audioBuffers: AudioBuffer[] = [];

      // 모든 오디오를 디코딩
      for (const blob of audioBlobs) {
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          audioBuffers.push(audioBuffer);
        } catch (decodeError: any) {
          console.error(`오디오 디코딩 실패 (blob size: ${blob.size}, type: ${blob.type}):`, decodeError);
          throw new Error(`오디오 디코딩 실패: ${decodeError?.message || '알 수 없는 오류'}`);
        }
      }

      if (audioBuffers.length === 0) {
        throw new Error("디코딩된 오디오 버퍼가 없습니다.");
      }

      // 샘플레이트가 다른 경우를 고려하여 초 단위로 길이 계산
      const totalDurationSec = audioBuffers.reduce((sum, buf) => sum + buf.duration, 0);
      const numChannels = audioBuffers[0].numberOfChannels;

      // 오프라인 컨텍스트로 결합 (고정 샘플레이트 사용, 피치 변조 없이)
      const totalFrames = Math.ceil(totalDurationSec * targetSampleRate);
      const offlineCtx = new OfflineAudioContext(numChannels, totalFrames, targetSampleRate);
      let currentStartTimeSec = 0;

      for (const buffer of audioBuffers) {
        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;
        // 피치 변조 없이 원본 그대로 재생
        source.playbackRate.value = 1.0;
        source.connect(offlineCtx.destination);
        source.start(currentStartTimeSec);
        // 초 단위로 오프셋 증가 (샘플레이트 불일치 문제 해결)
        currentStartTimeSec += buffer.duration;
      }

      const renderedBuffer = await offlineCtx.startRendering();

      // WAV로 인코딩
      const { encodeWavPCM16, mixDownToStereo } = await import("@/lib/audioMixer");
      const interleaved = mixDownToStereo(renderedBuffer);
      const wavBlob = encodeWavPCM16(interleaved, targetSampleRate, numChannels);

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

    // 마크다운 기호 제거
    return removeMarkdown(data.text);
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

    // 마크다운 기호 제거
    return removeMarkdown(data.text);
  }
  // 실제 음원 생성 로직 (템플릿 변수 검증 제외)
  const proceedWithGeneration = async (textToUse: string) => {
    const trimmedText = textToUse.trim();

    if (!selectedVoice) {
      setAlertDialog({ open: true, title: "선택 필요", message: "음성 스타일을 선택해주세요." });
      return;
    }

    // 분할 여부는 가공된 텍스트 길이로 이후에 판단합니다.

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
    // 더 정확한 계산: (pitch / 100) * 12
    const pitchShift = voiceSettings.pitch === 0 
      ? 0 
      : Math.max(-12, Math.min(12, Math.round((voiceSettings.pitch / 100) * 12)));

    // SSML 태그를 텍스트에 적용하는 헬퍼 함수
    const applySSMLTags = (text: string): string => {
      let processed = text;
      
      // 기본 일시정지 적용: 문장 끝(마침표, 느낌표, 물음표)에 기본 일시정지 추가
      if (voiceSettings.pause.duration > 0) {
        // 문장 끝 패턴: 마침표, 느낌표, 물음표 뒤에 공백 또는 줄바꿈
        const sentenceEndPattern = /([.!?])\s+/g;
        processed = processed.replace(sentenceEndPattern, (match, punct) => {
          return `${punct}<break time="${voiceSettings.pause.duration}s"/> `;
        });
        // 마지막 문장 끝에도 적용 (공백이 없는 경우)
        if (/[.!?]$/.test(processed.trim())) {
          processed = processed.replace(/([.!?])$/, `$1<break time="${voiceSettings.pause.duration}s"/>`);
        }
      }
      
      // 사용자 지정 끊어읽기 구간 적용 (원본 텍스트 기준 위치)
    if (voiceSettings.pause.segments.length > 0) {
      // 구간을 위치 순으로 정렬
      const sortedSegments = [...voiceSettings.pause.segments].sort((a, b) => b.position - a.position);
      // 뒤에서부터 삽입 (인덱스 변경 방지)
      sortedSegments.forEach((segment) => {
          const position = Math.min(Math.max(0, segment.position), processed.length);
        const breakTag = `<break time="${segment.duration}s"/>`;
          processed = processed.slice(0, position) + breakTag + processed.slice(position);
      });
    }
      
      return processed;
    };

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

    const targetFormat = "mp3"; // 분할 시에도 mp3 유지
    // generationParams는 원본 텍스트 기준으로 생성 (캐시 키 일관성 유지)
    // 실제 API 호출 시에는 각 청크에 SSML이 적용된 텍스트를 사용
    const generationParams = {
      text: trimmedText, // 원본 텍스트 사용 (SSML 태그 제외)
      voiceId: selectedVoice,
      language: chosenLanguage,
      model: chosenModel,
      style: styleValue,
      speed: speedValue,
      pitchShift,
      format: targetFormat,
    };

    const paramHash = await computeGenerationHash(generationParams);
    const cacheKey = `hash_${paramHash}`;

    const findHistoryEntry = () =>
      generationHistory.find(
        (entry) =>
          (entry.paramHash && entry.paramHash === paramHash) ||
          (!entry.paramHash && entry.cacheKey === cacheKey)
      );

    const ensureCacheEntry = (blob: Blob, duration: number | null, mime: string, audioUrl: string | null) => {
      cacheRef.current.set(cacheKey, {
        blob,
        duration,
        mimeType: mime,
        dataUrl: audioUrl || undefined,
        _audioUrl: audioUrl || undefined,
      });
    };

    const finalizeReuse = (audioUrl: string | null, duration: number | null, entry: any, source: string) => {
      if (!audioUrl) return false;
      cleanupGeneratedAudioUrl(generatedAudio);
      setGeneratedAudio(audioUrl);
      setGeneratedAudioCacheKey(entry?.cacheKey || null);
      setGeneratedDuration(duration || 0);
      setPredictedDuration(duration || null);
      setPendingGeneration(null);
      setIsSaveNameDialogOpen(false);
      if (entry?.id) {
        setExpandedGenerationId(entry.id ? String(entry.id) : null);
      }
      toast({
        title: "✅ 기존 음원 재사용",
        description: source === "history" ? "이전에 저장된 음원을 불러왔습니다." : "저장된 음원을 재사용했습니다.",
      });
      return true;
    };

    let existingEntry = findHistoryEntry();
    const cached = cacheRef.current.get(cacheKey);

    if (cached && existingEntry) {
      let playbackUrl = cached.dataUrl || cached._audioUrl || null;
      if (!playbackUrl && cached.blob) {
        try {
          playbackUrl = await blobToDataUrl(cached.blob);
          ensureCacheEntry(cached.blob, cached.duration ?? existingEntry.duration ?? null, cached.mimeType || (existingEntry.mimeType ?? "audio/mpeg"), playbackUrl);
        } catch (error) {
          console.warn("캐시 데이터 URL 변환 실패:", error);
        }
      }
      if (playbackUrl && finalizeReuse(playbackUrl, cached.duration ?? existingEntry.duration ?? null, existingEntry, "history")) {
        return;
      }
    }

    if (!existingEntry && user?.id) {
      try {
        const dbEntry = await dbService.findGenerationByHash(user.id, paramHash);
        if (dbEntry) {
          existingEntry = dbEntry;
          setGenerationHistory((prev) => {
            const filtered = prev.filter((g) => String(g.id) !== String(dbEntry.id));
            return [dbEntry, ...filtered].slice(0, 100);
          });
        }
      } catch (e) {
        // findGenerationByHash 실패는 조용히 처리 (400 에러 등)
        console.warn("findGenerationByHash 실패:", e);
      }
    }

    if (existingEntry) {
      let audioUrl: string | null = null;
      let duration = existingEntry.duration ?? null;
      let blobToCache: Blob | null = null;
      const existingCacheKey = existingEntry.cacheKey || cacheKey;
      const cachedForExisting = cacheRef.current.get(existingCacheKey) || cacheRef.current.get(cacheKey);

      if (cachedForExisting?.blob) {
        blobToCache = cachedForExisting.blob;
        audioUrl = cachedForExisting.dataUrl || cachedForExisting._audioUrl || null;
        duration = cachedForExisting.duration ?? duration;
        if (!audioUrl) {
          try {
            audioUrl = await blobToDataUrl(cachedForExisting.blob);
          } catch (error) {
            console.warn("캐시된 blob 데이터 URL 변환 실패:", error);
          }
        }
      } else if (user?.id && existingEntry.id) {
        const blobData = await dbService.loadGenerationBlob(user.id, String(existingEntry.id));
        if (blobData?.audioBlob) {
          blobToCache = dbService.arrayBufferToBlob(blobData.audioBlob, blobData.mimeType || existingEntry.mimeType || "audio/mpeg");
          try {
            audioUrl = await blobToDataUrl(blobToCache);
          } catch (error) {
            console.warn("DB blob 데이터 URL 변환 실패:", error);
            audioUrl = URL.createObjectURL(blobToCache);
          }
        }
      }

      if (!audioUrl && existingEntry.audioUrl && !existingEntry.audioUrl.startsWith('blob:')) {
        audioUrl = existingEntry.audioUrl;
      }

      if (blobToCache) {
        ensureCacheEntry(blobToCache, duration, blobToCache.type, audioUrl);
      }
      if (finalizeReuse(audioUrl, duration, existingEntry, "history-db")) {
        return;
      }
    }

    setIsGenerating(true);
    setGenerationProgress(null);
    setChunkLogs([]);

    // 원본 텍스트 기준으로 분할 필요성 판단 (API 제한: 300 미만)
    // SSML 태그가 추가되기 전의 원본 텍스트 길이로 판단해야 함
    const needsSplitting = trimmedText.length >= 300;
    if (needsSplitting) {
      console.log(`장문 텍스트 감지 (원본: ${trimmedText.length}자). 280자 단위로 분할하여 생성합니다.`);
      toast({ 
        title: "장문 텍스트 분할 생성", 
        description: `텍스트가 ${trimmedText.length}자로, ${Math.ceil(trimmedText.length / 280)}개 청크로 분할하여 생성합니다.`,
      });
    }
    
    // 원본 텍스트를 먼저 분할한 후, 각 청크에 SSML 태그 적용
    const rawTextChunks = needsSplitting ? splitTextIntoChunks(trimmedText, 280) : [trimmedText];
    const textChunks = rawTextChunks.map(chunk => applySSMLTags(chunk));
    const estimatedDuration = estimateDurationFromText(trimmedText);

    // 초기 청크 로그 설정 (원본 텍스트 길이 표시)
    setChunkLogs(textChunks.map((chunk, idx) => ({
      index: idx + 1,
      text: chunk,
      charCount: rawTextChunks[idx]?.length || chunk.length, // 원본 텍스트 길이 표시
      startTime: 0,
      status: 'pending' as const
    })));
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
        const chunkStartTime = Date.now();
        
        // 청크 상태 업데이트: generating
        setChunkLogs(prev => prev.map((log, idx) => 
          idx === i ? { ...log, status: 'generating' as const, startTime: chunkStartTime } : log
        ));
        
        setGenerationProgress({ current: i + 1, total: textChunks.length });

        // Supertone API 요청 본문 구성 (필수 파라미터만 포함)
        // SSML 태그 제거 (Supertone API가 SSML을 지원하지 않을 수 있음)
        const cleanChunk = chunk.replace(/<break\s+time="[^"]*"\s*\/?>/gi, '');
        const requestBody: Record<string, any> = {
          text: cleanChunk, // SSML 태그 제거된 텍스트 사용
          language: chosenLanguage || "ko",
        };

        // style이 있으면 추가 (일부 모델만 지원)
        if (styleValue && styleValue !== "neutral") {
          requestBody.style = styleValue;
        }

        // model이 있으면 추가
        if (chosenModel) {
          requestBody.model = chosenModel;
        }

        // voice_settings 구성 (필수 필드만 포함)
        const voiceSettingsObj: Record<string, any> = {};
        if (speedValue !== undefined && speedValue !== 1.0) {
          voiceSettingsObj.speed = speedValue;
        }
        if (pitchShift !== undefined && pitchShift !== 0) {
          voiceSettingsObj.pitch_shift = pitchShift;
        }
        // pitch_variance는 선택사항이므로 제거 또는 기본값만 사용
        if (voiceSettings.playbackSpeed !== undefined && voiceSettings.playbackSpeed !== 1.0) {
          voiceSettingsObj.playback_speed = voiceSettings.playbackSpeed;
        }

        // voice_settings에 내용이 있으면 추가
        if (Object.keys(voiceSettingsObj).length > 0) {
          requestBody.voice_settings = voiceSettingsObj;
        }

        let audioResult: { blob: Blob; duration: number | null; mimeType?: string } | null = null;
      let source = "프록시";

      // 1. Supabase Edge Function 프록시 시도
      // voice_id는 URL에 포함되므로 body에서 제거 (Edge Function이 자동으로 처리)
      const proxyResponse = await fetchWithSupabaseProxy(`/text-to-speech/${selectedVoice}?output_format=mp3`, {
        method: "POST",
        body: JSON.stringify(requestBody), // voice_id 제거 (URL에 포함)
      });

      if (proxyResponse?.ok) {
        audioResult = await parseSupertoneResponse(proxyResponse);
      } else if (proxyResponse) {
        let firstErrorMsg = `프록시 오류 (${proxyResponse.status})`;
        let errorDetails: any = null;
        try {
          const errJson = await proxyResponse.clone().json();
          errorDetails = errJson;
          const msg = errJson?.error?.message || errJson?.error || errJson?.message || errJson?.detail;
          if (msg) firstErrorMsg += `: ${formatErrorDetail(msg)}`;
        } catch {
          const text = await proxyResponse.text();
          if (text) firstErrorMsg += `: ${text}`;
        }
        console.warn(firstErrorMsg);

        let finalFailed = true;
        // 400인 경우 최소 필드로 재시도 (text만, 또는 text + language)
        if (proxyResponse.status === 400) {
          try {
            // 텍스트 길이 초과 에러인지 확인
            const isTextTooLong = errorDetails?.message?.some?.((m: string) => m.includes("300 characters") || m.includes("300자")) ||
                                  errorDetails?.error?.message?.includes?.("300 characters") ||
                                  firstErrorMsg.includes("300 characters") ||
                                  firstErrorMsg.includes("300자");
            
            // SSML 태그 제거된 청크 길이로 확인 (cleanChunk는 루프 상단에서 정의됨)
            if (isTextTooLong && cleanChunk.length >= 300) {
              // 청크가 여전히 300자 이상이면 더 작게 분할 필요
              throw new Error(`청크 ${i + 1}의 텍스트가 너무 깁니다 (${cleanChunk.length}자). 자동 분할을 시도하지만, 텍스트를 더 짧게 나누어주세요.`);
            }
            
            const minimalBody: Record<string, any> = { text: cleanChunk };
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
            // 텍스트 길이 초과 에러는 그대로 throw
            if (e?.message?.includes("너무 깁니다")) {
              throw e;
            }
          }
        }

        if (!audioResult && finalFailed) {
          let userFriendlyMsg = firstErrorMsg;
          
          // 에러 메시지 개선
          if (firstErrorMsg.includes("300 characters") || firstErrorMsg.includes("300자")) {
            userFriendlyMsg = `텍스트가 너무 깁니다 (최대 300자). 자동으로 분할하여 재시도합니다.`;
          } else if (firstErrorMsg.includes("400")) {
            userFriendlyMsg = `API 요청 오류: ${firstErrorMsg}. 파라미터를 확인해주세요.`;
          } else if (firstErrorMsg.includes("401") || firstErrorMsg.includes("403")) {
            userFriendlyMsg = `인증 오류: API 키를 확인해주세요.`;
          } else if (firstErrorMsg.includes("429")) {
            userFriendlyMsg = `요청 한도 초과: 잠시 후 다시 시도해주세요.`;
          } else if (firstErrorMsg.includes("500") || firstErrorMsg.includes("502") || firstErrorMsg.includes("503")) {
            userFriendlyMsg = `서버 오류: 잠시 후 다시 시도해주세요.`;
          } else if (firstErrorMsg.includes("Failed to fetch") || firstErrorMsg.includes("network")) {
            userFriendlyMsg = `네트워크 오류: 인터넷 연결을 확인해주세요.`;
          }
          
          // 청크 상태 업데이트: error
          setChunkLogs(prev => prev.map((log, idx) => 
            idx === i ? { 
              ...log, 
              status: 'error' as const,
              endTime: Date.now(),
              error: userFriendlyMsg
            } : log
          ));
          
          throw new Error(`청크 ${i + 1}/${textChunks.length} 생성 실패: ${userFriendlyMsg}`);
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
        // 청크 상태 업데이트: error
        setChunkLogs(prev => prev.map((log, idx) => 
          idx === i ? { 
            ...log, 
            status: 'error' as const,
            endTime: Date.now(),
            error: '음성 데이터를 생성할 수 없습니다'
          } : log
        ));
        
        throw new Error(`청크 ${i + 1}/${textChunks.length} 음성 데이터를 생성할 수 없습니다.`);
      }

      // 각 청크의 blob 저장
      audioChunks.push(audioResult.blob);
      
      // duration 안전하게 처리
      const chunkDuration = audioResult.duration != null 
        ? (typeof audioResult.duration === 'number' 
            ? (Number.isFinite(audioResult.duration) ? audioResult.duration : null)
            : (Number.isFinite(Number(audioResult.duration)) ? Number(audioResult.duration) : null))
        : null;
      
      if (chunkDuration != null && chunkDuration > 0) {
        totalDuration += chunkDuration;
      } else {
        // duration이 없거나 유효하지 않으면 텍스트 길이로 추정
        totalDuration += chunk.length * 0.1; // 대략 추정
      }
      finalMimeType = audioResult.mimeType || "audio/mpeg";

      const _durLabel = chunkDuration != null && chunkDuration > 0 
        ? chunkDuration.toFixed(2) 
        : '추정';
      console.log(`✅ 청크 ${i + 1}/${textChunks.length} 생성 완료 (${_durLabel}초)`);
      
      // 청크 상태 업데이트: complete
      const chunkEndTime = Date.now();
      setChunkLogs(prev => prev.map((log, idx) => 
        idx === i ? { 
          ...log, 
          status: 'complete' as const, 
          endTime: chunkEndTime,
          duration: (chunkEndTime - log.startTime) / 1000
        } : log
      ));
      }

      // 여러 청크가 있으면 결합, 하나면 그대로 사용
      if (audioChunks.length > 1) {
        console.log(`${audioChunks.length}개 청크를 결합합니다...`);
        // mp3 형식 유지 시도 (모든 청크가 mp3인 경우)
        const allMp3 = audioChunks.every(chunk => chunk.type.includes('mp3') || chunk.type.includes('mpeg'));
        if (allMp3) {
          try {
            // Web Audio API로 디코딩 후 결합 (피치 변조 방지)
            finalAudioBlob = await concatenateAudios(audioChunks, true);
            // 브라우저에서 mp3 인코딩은 제한적이므로 WAV로 저장하되,
            // 사용자에게는 mp3 형식으로 표시 (실제로는 WAV)
            finalMimeType = "audio/wav"; // 실제로는 WAV로 저장
            console.log("✅ 오디오 결합 완료 (WAV 형식으로 저장)");
          } catch (error) {
            console.warn("오디오 결합 실패:", error);
            // 실패 시 WAV로 변환
            finalAudioBlob = await concatenateAudios(audioChunks, false);
            finalMimeType = "audio/wav";
          }
        } else {
          // 일부 청크가 mp3가 아닌 경우 WAV로 변환
          finalAudioBlob = await concatenateAudios(audioChunks, false);
          finalMimeType = "audio/wav";
        }
      } else {
        finalAudioBlob = audioChunks[0];
        // 단일 청크의 경우 원본 형식 유지
        finalMimeType = audioChunks[0].type || "audio/mpeg";
      }

      const roundedDuration = Math.round(totalDuration * 100) / 100;

      // blob URL 생성 전 유효성 검사 및 MIME type 명시
      if (!finalAudioBlob || finalAudioBlob.size === 0) {
        throw new Error("생성된 오디오 blob이 유효하지 않습니다.");
      }
      
      // MIME type을 명시하여 새 Blob 생성 (디코딩 오류 방지)
      // blob을 ArrayBuffer로 읽어서 다시 Blob으로 변환하여 "깨끗하게" 재구성
      // 이렇게 하면 브라우저가 blob을 더 안정적으로 인식할 수 있습니다
      let validBlob: Blob;
      try {
        const arrayBuffer = await finalAudioBlob.arrayBuffer();
        validBlob = new Blob([arrayBuffer], { type: finalMimeType });
      } catch (e) {
        console.warn('[생성] blob 재구성 실패, 원본 사용:', e);
        validBlob = new Blob([finalAudioBlob], { type: finalMimeType });
      }
      
      // 데이터 URL 생성 (AudioPlayer 안정성을 위해 blob URL 대신 데이터 URL 사용)
      let playbackUrl: string | null = null;
      try {
        playbackUrl = await blobToDataUrl(validBlob);
      } catch (error) {
        console.warn("데이터 URL 변환 실패, blob URL로 대체 사용:", error);
        playbackUrl = URL.createObjectURL(validBlob);
      }

      // 캐시에 blob 및 데이터 URL 저장
      cacheRef.current.set(cacheKey, {
        blob: validBlob,
        duration: roundedDuration,
        mimeType: finalMimeType,
        dataUrl: playbackUrl || undefined,
        _audioUrl: playbackUrl || undefined,
      });

      // 생성된 audio 상태 설정 (cacheKey 포함)
      setGeneratedAudio(playbackUrl || '');
      setGeneratedAudioCacheKey(cacheKey);
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

      const finalExtension = guessExtensionFromMime(finalMimeType);
      const storagePath = buildStoragePath(selectedVoice, paramHash, finalExtension);
      const createdAtIso = new Date().toISOString();
      const tempId = generateUniqueId();

      // 즉시 DB에 자동 저장 (임시 이름으로)
      // blob URL은 저장하지 않고 null로 설정 (필요할 때만 생성)
      const autoSavedEntry = await pushHistory({
        id: tempId,
        cacheKey,
        storagePath,
        format: finalExtension,
        paramHash,
        purpose: selectedPurpose,
        purposeLabel: purposeMeta.label,
        voiceId: selectedVoice || "",
        voiceName: getVoiceDisplayName(selectedVoice || ""),
        savedName: `음원_${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`,
        createdAt: createdAtIso,
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
        audioUrl: playbackUrl,
        mimeType: finalMimeType,
      });
      
      // 이름 저장 다이얼로그 표시
      setPendingGeneration({
        id: autoSavedEntry?.id || tempId, // DB 저장된 실제 ID 사용
        savedName: autoSavedEntry?.savedName || null, // 저장된 이름 포함
        cacheKey,
        storagePath,
        format: finalExtension,
        paramHash,
        purpose: selectedPurpose,
        purposeLabel: purposeMeta.label,
        voiceId: selectedVoice || "",
        voiceName: getVoiceDisplayName(selectedVoice || ""),
        createdAt: createdAtIso,
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
        audioUrl: playbackUrl,
        mimeType: finalMimeType,
        isPersisted: Boolean(autoSavedEntry?.isPersisted),
        allowServerUpdate: Boolean(autoSavedEntry?.allowServerUpdate ?? autoSavedEntry?.isPersisted),
      });
      setIsSaveNameDialogOpen(true);
      
      // 저장 모달을 필수로 표시 (취소 불가)
      toast({
        title: "✅ 음원 생성 완료",
        description: "음원 이름을 입력하고 저장해주세요.",
        duration: 2000,
      });
    } catch (error: any) {
      console.error("음성 생성 오류:", error);
      
      // 에러 메시지 개선
      let errorMessage = error?.message || "음성 생성 중 오류가 발생했습니다.";
      
      // 특정 에러 타입에 대한 사용자 친화적 메시지
      if (errorMessage.includes("청크") && errorMessage.includes("생성 실패")) {
        // 청크별 에러는 이미 상세한 메시지가 포함되어 있음
      } else if (errorMessage.includes("오디오 결합 실패")) {
        errorMessage = "오디오 결합 중 오류가 발생했습니다. 개별 청크는 생성되었지만 결합에 실패했습니다.";
      } else if (errorMessage.includes("디코딩 실패")) {
        errorMessage = "오디오 디코딩 중 오류가 발생했습니다. 생성된 오디오 형식을 확인해주세요.";
      } else if (errorMessage.includes("네트워크") || errorMessage.includes("Failed to fetch")) {
        errorMessage = "네트워크 연결 오류가 발생했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.";
      }
      
      // 청크 로그에 에러가 있는 경우 상세 정보 표시
      const errorChunks = chunkLogs.filter(log => log.status === 'error');
      if (errorChunks.length > 0) {
        const errorDetails = errorChunks.map(log => `청크 ${log.index}: ${log.error || '알 수 없는 오류'}`).join('\n');
        console.error("청크별 에러 상세:", errorDetails);
      }

      toast({
        title: "❌ 음성 생성 실패",
        description: errorMessage,
        variant: "destructive",
        duration: 5000, // 에러 메시지는 더 오래 표시
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
      // 즉시 revoke 시 일부 브라우저에서 다운로드 중 GET blob 에러가 날 수 있어 지연 처리
      setTimeout(() => window.URL.revokeObjectURL(url), 2000);
    } catch (error) {
      console.error("다운로드 오류:", error);
      setAlertDialog({ open: true, title: "다운로드 오류", message: "다운로드 중 오류가 발생했습니다." });
    }
  };
  return (
    <PageContainer maxWidth="wide">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">음원 생성 (TTS)</h1>
            <p className="text-muted-foreground mt-1">지자체장 및 기관장 음성 메시지 생성</p>
          </div>
          <Badge variant="outline" className="px-3 py-1">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            공공기관 특화
          </Badge>
        </div>
        {user && (
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="w-4 h-4" />
              <span>{user.organization}</span>
              {user.department && <span>• {user.department}</span>}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-8">
        {/* 워크플로우 진행 상태 */}
        <Card className="landio-card">
          <CardContent className="pt-6">
            <Stepper
              steps={[
                { label: "목적 선택", description: "방송 목적 선택" },
                { label: "문구 작성", description: "메시지 작성 또는 템플릿 선택" },
                { label: "음성 선택", description: "음성 스타일 선택" },
                { label: "음원 생성", description: "TTS 음원 생성" },
                { label: "저장 완료", description: "음원 저장 및 다음 단계" },
              ]}
              currentStep={
                pendingGeneration ? 4 : 
                generatedAudio ? 3 :
                selectedVoice ? 2 :
                customText.trim() ? 1 : 0
              }
            />
          </CardContent>
        </Card>

        {/* FHD/WFHD 최적화: 2-3 컬럼 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* 음성 생성 - 왼쪽 (주 역할) */}
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
                      <SelectValue
                        placeholder={
                          availableVoices.length === 0
                            ? "음성이 비어 있습니다. 상단의 '음성 목록 업데이트' 버튼을 눌러주세요."
                            : "사용할 음성을 선택하세요"
                        }
                      >
                        {selectedVoice && (() => {
                          const voice = availableVoices.find((v: any) => v.voice_id === selectedVoice) || selectedVoiceInfo;
                          return voice ? getVoiceDisplayNameKo(voice.name, voice.voice_id, voice.name_ko) : selectedVoice;
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {/* API에서 가져온 실제 음성 목록 */}
                      {availableVoices.length > 0 ? (
                        <>
                          <div className="px-2 py-1.5 border-b border-gray-700 space-y-2">
                            <div className="text-[11px] text-muted-foreground grid gap-2 [grid-template-columns:56px_64px_128px_128px_minmax(120px,1fr)]">
                              <div>즐겨찾기</div>
                              <div className="flex items-center gap-1 cursor-pointer" onClick={(e) => {
                                e.stopPropagation();
                                if (voiceSortBy === "gender") {
                                  setVoiceSortOrder(voiceSortOrder === "asc" ? "desc" : "asc");
                                } else {
                                  setVoiceSortBy("gender");
                                  setVoiceSortOrder("asc");
                                }
                              }}>
                                성별
                                {voiceSortBy === "gender" && (voiceSortOrder === "asc" ? "↑" : "↓")}
                              </div>
                              <div className="flex items-center gap-1 cursor-pointer" onClick={(e) => {
                                e.stopPropagation();
                                if (voiceSortBy === "name") {
                                  setVoiceSortOrder(voiceSortOrder === "asc" ? "desc" : "asc");
                                } else {
                                  setVoiceSortBy("name");
                                  setVoiceSortOrder("asc");
                                }
                              }}>
                                이름
                                {voiceSortBy === "name" && (voiceSortOrder === "asc" ? "↑" : "↓")}
                              </div>
                              <div className="flex items-center gap-1 cursor-pointer" onClick={(e) => {
                                e.stopPropagation();
                                if (voiceSortBy === "language") {
                                  setVoiceSortOrder(voiceSortOrder === "asc" ? "desc" : "asc");
                                } else {
                                  setVoiceSortBy("language");
                                  setVoiceSortOrder("asc");
                                }
                              }}>
                                국가
                                {voiceSortBy === "language" && (voiceSortOrder === "asc" ? "↑" : "↓")}
                              </div>
                              <div>스타일</div>
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              💡 헤더를 클릭하여 정렬 가능
                            </div>
                          </div>
                          {(() => {
                            const voices = [...(allVoices.length > 0 ? allVoices : availableVoices)];
                            // 정렬 적용
                            const sorted = voices.sort((a: any, b: any) => {
                              const fa = favoriteVoiceIds.has(a.voice_id) ? 1 : 0;
                              const fb = favoriteVoiceIds.has(b.voice_id) ? 1 : 0;
                              if (fa !== fb) return fb - fa; // 즐겨찾기 우선
                              
                              if (voiceSortBy === "name") {
                                const nameA = getVoiceDisplayNameKo(a.name, a.voice_id, a.name_ko).toLowerCase();
                                const nameB = getVoiceDisplayNameKo(b.name, b.voice_id, b.name_ko).toLowerCase();
                                return voiceSortOrder === "asc" 
                                  ? nameA.localeCompare(nameB, "ko") 
                                  : nameB.localeCompare(nameA, "ko");
                              } else if (voiceSortBy === "language") {
                                const langA = Array.isArray(a.language) ? a.language[0] || "" : (a.language || "");
                                const langB = Array.isArray(b.language) ? b.language[0] || "" : (b.language || "");
                                const langRankA = langA === "ko" ? 0 : langA === "en" ? 1 : langA === "ja" ? 2 : 3;
                                const langRankB = langB === "ko" ? 0 : langB === "en" ? 1 : langB === "ja" ? 2 : 3;
                                return voiceSortOrder === "asc" 
                                  ? langRankA - langRankB 
                                  : langRankB - langRankA;
                              } else if (voiceSortBy === "gender") {
                                const genderA = (a.gender || "").toLowerCase();
                                const genderB = (b.gender || "").toLowerCase();
                                const genderOrder = { female: 0, male: 1, neutral: 2, "": 3 };
                                const rankA = genderOrder[genderA as keyof typeof genderOrder] ?? 3;
                                const rankB = genderOrder[genderB as keyof typeof genderOrder] ?? 3;
                                return voiceSortOrder === "asc" ? rankA - rankB : rankB - rankA;
                              } else {
                                // 기본: 언어 우선순위
                                return computeVoiceLanguageRank(a) - computeVoiceLanguageRank(b);
                              }
                            });
                            return sorted;
                          })().map((voice: any) => {
                          const voiceName = getVoiceDisplayNameKo(voice.name, voice.voice_id, voice.name_ko);
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
                                    <div className="flex items-center justify-center">
                                      <button
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }}
                                        onClick={(e) => { 
                                          e.preventDefault();
                                          e.stopPropagation(); 
                                          toggleFavorite(voice.voice_id); 
                                        }}
                                        className={`w-6 h-6 inline-flex items-center justify-center rounded transition-colors ${
                                          favoriteVoiceIds.has(voice.voice_id) 
                                            ? 'bg-yellow-400/20 hover:bg-yellow-400/30' 
                                            : 'bg-transparent hover:bg-muted'
                                        }`}
                                        title={favoriteVoiceIds.has(voice.voice_id) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                                      >
                                        <Star className={`w-4 h-4 ${
                                          favoriteVoiceIds.has(voice.voice_id) 
                                            ? 'text-yellow-400 fill-yellow-400' 
                                            : 'text-muted-foreground'
                                        }`} />
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
                        <div className="px-3 py-4 text-xs text-muted-foreground leading-relaxed">
                          아직 로드된 음성이 없습니다. 상단의 <strong>음성 목록 업데이트</strong> 또는 <strong>모든 음성 가져오기</strong> 버튼을 눌러
                          최신 음성 데이터를 불러온 뒤 즐겨찾기를 선택하세요.
                        </div>
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
                  {/* 클로닝 기능은 현재 제공하지 않습니다 */}
                  {/* <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigate("/audio/cloning");
                      toast({
                        title: "클로닝 페이지로 이동",
                        description: "클론 음성 생성을 시작할 수 있습니다.",
                      });
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    클론 생성
                  </Button> */}
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
                          if (!v) {
                            return (
                              <SelectItem key={vid} value={vid} disabled={true}>
                                {`로딩 중... (${vid.slice(0, 12)}...)`}
                              </SelectItem>
                            );
                          }
                          // 성별 색상 구분
                          const genderKo = genderCodeToKo(v.gender);
                          const genderColor = v.gender === "female" ? "bg-red-500" : v.gender === "male" ? "bg-blue-500" : "bg-gray-400";
                          return (
                            <SelectItem key={vid} value={vid}>
                              <div className="flex items-center gap-2">
                                <span className={`inline-block w-2.5 h-2.5 rounded-full ${genderColor}`}></span>
                                <span>{getVoiceDisplayNameKo(v.name, v.voice_id, v.name_ko)}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchVoices(true, true)}
                    disabled={isLoadingVoices}
                    title="API에서 모든 음성을 가져와서 DB에 저장합니다"
                  >
                    모든 음성가져오기
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const needsUpdate = await dbService.shouldUpdateCatalog();
                      if (needsUpdate) {
                        fetchVoices(true, true);
                      } else {
                        toast({
                          title: "이미 업데이트됨",
                          description: "오늘 이미 음성 목록이 업데이트되었습니다.",
                        });
                      }
                    }}
                    disabled={isLoadingVoices}
                    title="오늘 00:00 이후 업데이트되지 않았으면 음성 목록을 업데이트합니다"
                  >
                    음성 목록 업데이트
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

                    <TabsContent value="manual" className="space-y-4 mt-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">메시지 내용 *</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            // 이미 열려있으면 닫기
                            if (isMessageHistoryOpen) {
                              setIsMessageHistoryOpen(false);
                              return;
                            }
                            // 문구 관리에서 저장된 메시지 로드
                            if (user?.id) {
                              try {
                                const messages = await dbService.loadMessages(user.id);
                                updateFavoriteMessages(messages);
                                // 타입 정규화
                                const normalized = messages.map(msg => ({
                                  id: String(msg.id || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`),
                                  text: msg.text,
                                  purpose: msg.purpose || selectedPurpose,
                                  createdAt: msg.createdAt || new Date().toISOString(),
                                  updatedAt: msg.updatedAt || msg.createdAt || new Date().toISOString(),
                                }));
                                setMessageHistory(normalized.sort((a, b) => 
                                  new Date(b.updatedAt).getTime() - 
                                  new Date(a.updatedAt).getTime()
                                ));
                                setIsMessageHistoryOpen(true);
                              } catch (error) {
                                console.error("메시지 로드 실패:", error);
                                toast({
                                  title: "문구 불러오기 실패",
                                  description: "저장된 문구를 불러오는데 실패했습니다.",
                                  variant: "destructive",
                                });
                              }
                            }
                          }}
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          {isMessageHistoryOpen ? "문구 목록 닫기" : "문구 불러오기"}
                        </Button>
                      </div>
                      <Textarea
                        placeholder="메시지를 입력하거나 위의 '문구 불러오기' 버튼을 클릭하여 저장된 문구를 불러오세요..."
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        className="min-h-[200px]"
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex flex-col gap-0.5">
                          <span>공백 포함 : {customText.length}자 {new Blob([customText]).size}byte</span>
                          <span>공백 제외 : {customText.replace(/\s/g, '').length}자 {new Blob([customText.replace(/\s/g, '')]).size}byte</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {customText.trim() && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                // 먼저 마크다운 제거
                                let cleaned = removeMarkdown(customText);
                                // 조사 교정
                                const corrected = correctKoreanPostpositions(cleaned);
                                if (corrected !== customText) {
                                  setCustomText(corrected);
                                  toast({
                                    title: "조사 교정 완료",
                                    description: "마크다운 기호 제거 및 한국어 조사가 자동으로 교정되었습니다.",
                                  });
                                } else if (cleaned !== customText) {
                                  // 마크다운만 제거된 경우
                                  setCustomText(cleaned);
                                  toast({
                                    title: "마크다운 제거 완료",
                                    description: "마크다운 기호가 제거되었습니다.",
                                  });
                                }
                              }}
                            >
                              조사 교정
                            </Button>
                          )}
                          {customText.length > 300 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                // 300자 초과 처리 다이얼로그
                                const choice = window.confirm(
                                  `현재 ${customText.length}자입니다.\n\n` +
                                  `확인: 300자 이내로 축약 (AI 활용)\n` +
                                  `취소: 300자 단위로 자동 분리`
                                );
                                
                                if (choice) {
                                  // 300자 이내로 축약
                                  try {
                                    setIsLoadingAI(true);
                                    const out = await editWithOpenAI(
                                      customText,
                                      `300자 이내로 간결하게 축약하세요. 핵심 내용은 유지하되 불필요한 설명은 생략하세요.`
                                    );
                                    setCustomText(out);
                                    toast({
                                      title: "축약 완료",
                                      description: `문구가 ${out.length}자로 축약되었습니다.`,
                                    });
                                  } catch (e: any) {
                                    toast({
                                      title: "축약 실패",
                                      description: e?.message || "문구 축약 중 오류가 발생했습니다.",
                                      variant: "destructive",
                                    });
                                  } finally {
                                    setIsLoadingAI(false);
                                  }
                                } else {
                                  // 300자 단위로 분리
                                  const chunks = splitTextIntoChunks(customText, 300);
                                  if (chunks.length > 1) {
                                    const combined = chunks.map((chunk, idx) => 
                                      `[${idx + 1}]\n${chunk}`
                                    ).join('\n\n');
                                    setCustomText(combined);
                                    toast({
                                      title: "분리 완료",
                                      description: `${chunks.length}개로 분리되었습니다.`,
                                    });
                                  }
                                }
                              }}
                              disabled={isLoadingAI}
                            >
                              {customText.length}자 → 처리
                            </Button>
                          )}
                        </div>
                      </div>
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
                              onClick={() => {
                                // 이미 열려있으면 닫기
                                if (isMessageHistoryOpen) {
                                  setIsMessageHistoryOpen(false);
                                } else {
                                  setIsMessageHistoryOpen(true);
                                }
                              }}
                            >
                              {isMessageHistoryOpen ? "이력 닫기" : "이력 보기"}
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
                              onClick={() => {
                                // 이미 열려있으면 닫기
                                if (isMessageHistoryOpen) {
                                  setIsMessageHistoryOpen(false);
                                } else {
                                  setIsMessageHistoryOpen(true);
                                }
                              }}
                            >
                              {isMessageHistoryOpen ? "이력 닫기" : "이력 보기"}
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
                                    // DB에서 업데이트
                                    if (user?.id && existing.id) {
                                      await dbService.updateMessage(user.id, existing.id, out);
                                    }
                                    
                                    // 로컬 상태 업데이트
                                    const updated = messageHistory.map(m => 
                                      m.id === existing.id 
                                        ? { ...m, text: out, updatedAt: new Date().toISOString() }
                                        : m
                                    );
                                    setMessageHistory(updated);
                                    
                                    // localStorage도 업데이트 (폴백)
                                    try {
                                      localStorage.setItem(MESSAGE_HISTORY_STORAGE_KEY, JSON.stringify(updated));
                                    } catch {}
                                  } else {
                                    // DB에 새 메시지 저장
                                    let messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                                    if (user?.id) {
                                      const dbId = await dbService.saveMessage(user.id, {
                                        text: out,
                                        purpose: selectedPurpose,
                                      });
                                      if (dbId) messageId = dbId;
                                    }
                                    
                                    const newMessage = {
                                      id: messageId,
                                      text: out,
                                      purpose: selectedPurpose,
                                      createdAt: new Date().toISOString(),
                                      updatedAt: new Date().toISOString(),
                                    };
                                    
                                    // 로컬 상태 업데이트
                                    setMessageHistory([newMessage, ...messageHistory]);
                                    
                                    // localStorage도 업데이트 (폴백)
                                    try {
                                      localStorage.setItem(MESSAGE_HISTORY_STORAGE_KEY, JSON.stringify([newMessage, ...messageHistory]));
                                    } catch {}
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
                      {/* 적용된 텍스트 미리보기 및 글자수 정보 */}
                      {customText && (
                        <div className="mt-3 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-border">
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs font-semibold">적용된 메시지 미리보기</Label>
                            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                              <span>공백 포함 : {customText.length}자 {new Blob([customText]).size}byte</span>
                              <span>공백 제외 : {customText.replace(/\s/g, '').length}자 {new Blob([customText.replace(/\s/g, '')]).size}byte</span>
                            </div>
                          </div>
                          <Textarea
                            value={customText}
                            readOnly
                            className="min-h-[80px] text-sm bg-muted/50"
                          />
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        💡 변수를 입력하면 자동으로 메시지 내용에 반영됩니다.
                      </p>
                    </div>
                  )}

                  {/* 중복 메시지 입력 영역 제거됨: 상단 '직접 작성' 탭의 단일 입력을 사용합니다. */}
                </div>
                {/* 고급 설정 */}
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="advanced-settings" className="border-none">
                    <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    <Label className="text-sm font-medium">고급 설정</Label>
                  </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-4">
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
                                    // preset 변경 시 customPrompt 초기화
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
                          {voiceSettings.emotion.tags.map((tag) => {
                            const isSelected = voiceSettings.emotion.customPrompt === tag;
                            return (
                            <Badge
                              key={tag}
                                variant={isSelected ? "default" : "outline"}
                                className={`text-xs cursor-pointer hover:bg-primary/10 ${
                                  isSelected ? "bg-primary text-primary-foreground" : ""
                                }`}
                                onClick={() => {
                                  // 해시태그 클릭 시 preset을 "A" (중립)으로 설정하고 customPrompt에 해시태그 설정
                                  setVoiceSettings(prev => ({
                                ...prev,
                                    emotion: { 
                                      ...prev.emotion, 
                                      preset: "A", // 중립으로 설정
                                      customPrompt: isSelected ? "" : tag // 토글 방식: 이미 선택된 경우 해제
                                    }
                                  }));
                                }}
                            >
                              {tag}
                            </Badge>
                            );
                          })}
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
                            <Label className="text-xs">기본 일시정지 (문장 끝):</Label>
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
                          <p className="text-xs text-muted-foreground mt-2">
                            문장 끝(마침표, 느낌표, 물음표)에 자동으로 일시정지가 추가됩니다.
                          </p>
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
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

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

                {/* 청크 생성 진행률 표시 */}
                {generationProgress && (
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-2">
                        <Activity className="w-4 h-4 animate-pulse text-primary" />
                        청크 생성 중...
                      </span>
                      <span className="text-muted-foreground">
                        {generationProgress.current} / {generationProgress.total}
                      </span>
                    </div>
                    <Progress 
                      value={(generationProgress.current / generationProgress.total) * 100} 
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      {generationProgress.current === generationProgress.total 
                        ? "마지막 청크 생성 중... 완료 후 자동으로 결합됩니다."
                        : `청크 ${generationProgress.current}/${generationProgress.total} 처리 중...`}
                    </p>
                  </div>
                )}

                {/* 청크 로그 뷰어 */}
                {chunkLogs.length > 0 && (
                  <Collapsible className="space-y-2">
                    <div className="flex items-center justify-between">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-2">
                          <BarChart3 className="w-4 h-4" />
                          청크 생성 로그 ({chunkLogs.length}개)
                          <ChevronRight className="w-4 h-4 transition-transform duration-200 data-[state=open]:rotate-90" />
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="space-y-2">
                      <ScrollArea className="h-[300px] rounded-md border p-3">
                        <div className="space-y-3">
                          {chunkLogs.map((log) => (
                            <Card key={log.index} className={`p-3 ${
                              log.status === 'complete' ? 'border-green-500/50 bg-green-500/5' :
                              log.status === 'generating' ? 'border-primary/50 bg-primary/5' :
                              log.status === 'error' ? 'border-destructive/50 bg-destructive/5' :
                              'border-muted'
                            }`}>
                              <div className="space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Badge variant={
                                      log.status === 'complete' ? 'default' :
                                      log.status === 'generating' ? 'secondary' :
                                      log.status === 'error' ? 'destructive' :
                                      'outline'
                                    } className="text-xs">
                                      청크 {log.index}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {log.charCount}자
                                    </span>
                                    {log.status === 'generating' && (
                                      <div className="flex items-center gap-1">
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                                        <span className="text-xs text-primary">생성 중...</span>
                                      </div>
                                    )}
                                    {log.status === 'complete' && log.duration && (
                                      <Badge variant="outline" className="text-xs bg-green-500/10">
                                        <Clock className="w-3 h-3 mr-1" />
                                        {log.duration.toFixed(2)}초
                                      </Badge>
                                    )}
                                    {log.status === 'error' && (
                                      <Badge variant="destructive" className="text-xs">
                                        <AlertCircle className="w-3 h-3 mr-1" />
                                        실패
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="text-xs break-all text-muted-foreground bg-muted/50 p-2 rounded">
                                  {log.text.length > 100 ? `${log.text.slice(0, 100)}...` : log.text}
                                </div>
                                {log.error && (
                                  <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                                    {log.error}
                                  </div>
                                )}
                              </div>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    </CollapsibleContent>
                  </Collapsible>
                )}

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
                      mimeType={pendingGeneration?.mimeType || "audio/mpeg"}
                      cacheKey={generatedAudioCacheKey || pendingGeneration?.cacheKey || undefined}
                      onDownload={handleDownload}
                      onError={async () => {
                        if (!pendingGeneration) return;
                        const recoveryKey = pendingGeneration.id ? `recovery_${pendingGeneration.id}` : undefined;
                        if (recoveryKey && (window as any)[recoveryKey]) {
                          return;
                        }
                        if (recoveryKey) {
                          (window as any)[recoveryKey] = true;
                        }
                        try {
                          const newUrl = await ensureHistoryAudio(pendingGeneration, { forceReload: true });
                          if (newUrl) {
                            setGeneratedAudio(newUrl);
                            if (pendingGeneration.cacheKey) {
                              setGeneratedAudioCacheKey(pendingGeneration.cacheKey);
                            }
                          } else {
                            toast({
                              title: "음원 복원 실패",
                              description: "음원 데이터를 불러올 수 없습니다. 새로 생성해주세요.",
                              variant: "destructive",
                            });
                          }
                        } catch (error) {
                          console.error("음원 복원 오류:", error);
                          toast({
                            title: "음원 복원 오류",
                            description: "복원 중 오류가 발생했습니다.",
                            variant: "destructive",
                          });
                        } finally {
                          if (recoveryKey) {
                            setTimeout(() => {
                              delete (window as any)[recoveryKey];
                            }, 5000);
                          }
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setGeneratedAudio(null);
                        setGeneratedAudioCacheKey(null);
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

          {/* 문구목록 즐겨찾기 - 오른쪽 */}
          <div className="lg:col-span-1 flex flex-col">
            <Card className="landio-card landio-fade-up flex flex-col h-full">
            <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  문구목록 즐겨찾기
                  </CardTitle>
                <CardDescription>
                  즐겨찾기한 문구를 선택하세요
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 min-h-0">
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="문구 검색..."
                        value={favoriteSearchQuery}
                        onChange={(e) => {
                          setFavoriteSearchQuery(e.target.value);
                          setFavoritePage(1); // 검색 시 첫 페이지로 리셋
                        }}
                        className="h-9"
                      />
                </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/scripts")}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      문구 관리
                    </Button>
                  </div>
                  <Select
                    value={favoriteFilterPurpose}
                    onValueChange={(value) => {
                      setFavoriteFilterPurpose(value);
                      setFavoritePage(1); // 필터 변경 시 첫 페이지로 리셋
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="전체 목적" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      {purposeOptions.map((option) => {
                        const count = favoriteMessages.filter((msg) => msg.purpose === option.id).length;
                        return (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label} ({count})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col flex-1 min-h-0">
                  {isLoadingFavorites ? (
                    <div className="text-center py-8 text-muted-foreground">즐겨찾기 로딩 중...</div>
                  ) : (() => {
                    // 검색어 및 목적 필터로 필터링
                    let filteredFavorites = favoriteMessages;
                    
                    // 목적 필터
                    if (favoriteFilterPurpose !== "all") {
                      filteredFavorites = filteredFavorites.filter((msg) => msg.purpose === favoriteFilterPurpose);
                    }
                    
                    // 검색어 필터
                    if (favoriteSearchQuery.trim()) {
                      const query = favoriteSearchQuery.trim().toLowerCase();
                      filteredFavorites = filteredFavorites.filter((msg) => {
                        const text = (msg.text || "").toLowerCase();
                        const purpose = (msg.purpose || "").toLowerCase();
                        const tags = (msg.tags || []).join(" ").toLowerCase();
                        return text.includes(query) || purpose.includes(query) || tags.includes(query);
                                });
                              }
                    
                    if (filteredFavorites.length === 0) {
                      const hasFilter = favoriteFilterPurpose !== "all" || favoriteSearchQuery.trim();
                      return (
                        <div className="text-center py-8 text-muted-foreground">
                          {hasFilter 
                            ? (favoriteFilterPurpose !== "all" && favoriteSearchQuery.trim()
                                ? "선택한 목적과 검색어에 해당하는 즐겨찾기가 없습니다."
                                : favoriteFilterPurpose !== "all"
                                ? `${purposeOptions.find(p => p.id === favoriteFilterPurpose)?.label || favoriteFilterPurpose} 목적의 즐겨찾기가 없습니다.`
                                : "검색 결과가 없습니다.")
                            : "즐겨찾기한 문구가 없습니다."}
                          <br />
                          <Button
                            variant="link"
                            className="mt-2"
                            onClick={() => navigate("/scripts")}
                          >
                            문구목록에서 즐겨찾기 추가하기
                          </Button>
                        </div>
                      );
                    }
                    
                    const totalPages = Math.ceil(filteredFavorites.length / favoriteItemsPerPage);
                    const startIndex = (favoritePage - 1) * favoriteItemsPerPage;
                    const endIndex = startIndex + favoriteItemsPerPage;
                    const paginatedFavorites = filteredFavorites.slice(startIndex, endIndex);
                    
                    return (
                      <>
                        <ScrollArea className="flex-1 min-h-0 pr-4">
                          <div className="space-y-3">
                            {paginatedFavorites.map((msg) => {
                              const purposeLabel = purposeOptions.find(p => p.id === msg.purpose)?.label || msg.purpose;
                              return (
                                <Card 
                                  key={msg.id}
                                  className="cursor-pointer transition-all hover:shadow-md"
                                  onClick={() => {
                                    setCustomText(msg.text);
                                    setSelectedPurpose(msg.purpose || "announcement");
                          toast({
                                      title: "문구 선택 완료",
                                      description: "선택한 문구가 입력란에 적용되었습니다.",
                          });
                                  }}
                                >
                                  <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                                        <Star className="w-4 h-4 text-primary fill-primary" />
                                      </div>
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <Badge variant="outline" className="text-xs">
                                            {purposeLabel}
                                          </Badge>
                                          {msg.tags && msg.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                              {msg.tags.slice(0, 2).map((tag) => (
                                                <Badge key={tag} variant="secondary" className="text-xs">
                                                  {tag}
                                                </Badge>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                        <p className="text-sm text-muted-foreground line-clamp-2">{msg.text}</p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </ScrollArea>
                        {totalPages > 1 && (
                          <div className="flex justify-center pt-4 mt-4 border-t">
                            <Pagination>
                              <PaginationContent>
                                <PaginationItem>
                    <Button
                                    variant="ghost"
                      size="sm"
                                    onClick={() => setFavoritePage(prev => Math.max(1, prev - 1))}
                                    disabled={favoritePage === 1}
                                    className="gap-1"
                    >
                                    <ChevronLeft className="h-4 w-4" />
                    </Button>
                                </PaginationItem>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                  <PaginationItem key={page}>
                                    <Button
                                      variant={favoritePage === page ? "outline" : "ghost"}
                                      size="sm"
                                      onClick={() => setFavoritePage(page)}
                                      className="min-w-[2.5rem]"
                                    >
                                      {page}
                                    </Button>
                                  </PaginationItem>
                                ))}
                                <PaginationItem>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setFavoritePage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={favoritePage === totalPages}
                                    className="gap-1"
                                  >
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </PaginationItem>
                              </PaginationContent>
                            </Pagination>
                  </div>
                )}
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        {/* 생성 기록 & 사용 가이드 */}
        <div className="mt-8 space-y-6">
          <Card className="landio-card landio-fade-up">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    생성 기록 & 작업 관리
                  </CardTitle>
                  <CardDescription>최근 생성한 음성을 목적별로 관리하고, 향후 클로닝·믹싱·예약 작업을 연결합니다.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {generationHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">아직 생성된 음성이 없습니다. 목적을 선택하고 음성을 생성해 보세요.</p>
              ) : (
                <>
                  {/* 페이지당 항목 수 선택 */}
                  <div className="flex items-center justify-end mb-4">
                    <Select 
                      value={String(historyItemsPerPage)} 
                      onValueChange={(v) => {
                        setHistoryItemsPerPage(Number(v));
                        setHistoryCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5개씩</SelectItem>
                        <SelectItem value="10">10개씩</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 페이지네이션 계산 */}
                  {(() => {
                    const totalPages = Math.ceil(generationHistory.length / historyItemsPerPage);
                    const startIndex = (historyCurrentPage - 1) * historyItemsPerPage;
                    const endIndex = startIndex + historyItemsPerPage;
                    const paginatedHistory = generationHistory.slice(startIndex, endIndex);

                    return (
                      <>
                <div className="space-y-3">
                          {paginatedHistory.map((entry) => {
                    if (!entry.id) return null; // id가 없으면 렌더링하지 않음
                    const languageKo = languageCodeToKo(entry.language);
                    const isExpanded = expandedGenerationId === String(entry.id || '');
                    const isEditing = editingGenerationId === entry.id;
                    
                            // audioUrl을 그대로 사용 (렌더링 시점에 생성하지 않음)
                            // AudioPlayer의 onError에서 복원하거나, 필요시 미리듣기 버튼 클릭 시 복원
                    const entryIdStr = String(entry.id);
                    const previewAudioUrl = historyPreviewUrls[entryIdStr] ?? entry.audioUrl ?? "";
                    return (
                      <div key={entry.id} className="rounded-xl border border-border bg-muted/20 p-3 transition-all hover:shadow-md" style={{ borderRadius: '12px' }}>
                        <div className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)_160px_auto] items-center">
                          <div className="space-y-1">
                            {(() => {
                              // purpose가 있으면 직접 사용, 없으면 purposeLabel에서 역으로 찾기
                              const purposeId = entry.purpose || 
                                purposeOptions.find(p => p.label === entry.purposeLabel)?.id || 
                                null;
                              const displayLabel = entry.purposeLabel || 
                                (entry.purpose ? purposeOptions.find(p => p.id === entry.purpose)?.label : null) || 
                                entry.purpose || 
                                "알 수 없음";
                              
                              return purposeId ? (
                                <Badge 
                                  variant="outline" 
                                  className={cn("text-xs font-medium", getPurposeColor(purposeId))}
                                >
                                  {displayLabel}
                                </Badge>
                              ) : entry.purposeLabel ? (
                                <Badge variant="outline" className="text-xs">
                                  {displayLabel}
                                </Badge>
                              ) : null;
                            })()}
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
                            <div className="text-xs text-muted-foreground truncate" title={entry.storagePath || "경로 미지정"}>경로: {entry.storagePath || "-"}</div>
                            <div className="text-xs text-muted-foreground">형식: {(entry.format || guessExtensionFromMime(entry.mimeType)).toUpperCase()} · Hash: {entry.paramHash ? entry.paramHash.slice(0, 8) : "-"}</div>
                          </div>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div>음성: {getVoiceDisplayNameKo(entry.voiceName, entry.voiceId || "", (entry as any).name_ko)}</div>
                            <div>언어: {languageKo}</div>
                            <div>상태: <Badge variant="outline" className="text-[10px] uppercase">{entry.status}</Badge></div>
                          </div>
                                  <TooltipProvider>
                                    <div className="flex flex-wrap gap-1.5 justify-end">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                                            className="landio-button p-2"
                                            onClick={async () => {
                                              if (!isExpanded) {
                                                const ensuredUrl = await ensureHistoryAudio(entry);
                                                if (!ensuredUrl) {
                                                  toast({
                                                    title: "미리듣기 불가",
                                                    description: "음원 데이터를 불러올 수 없습니다.",
                                                    variant: "destructive",
                                                  });
                                                  return;
                                                }
                                              }

                                              setExpandedGenerationId(isExpanded ? null : entry.id);
                                            }}
                                          >
                                            {isExpanded ? (
                                              <X className="w-4 h-4" />
                                            ) : (
                                              <Play className="w-4 h-4" />
                                            )}
                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>{isExpanded ? "접기" : "미리듣기"}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                      
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="landio-button p-2"
                                            onClick={() => handleLocalSaveClick(entry)}
                                          >
                                            <Download className="w-4 h-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>로컬 저장</p>
                                        </TooltipContent>
                                      </Tooltip>
                                      
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                                            className="landio-button p-2" 
                                            onClick={() => openMixingModal(entry)}
                            >
                                            <Music2 className="w-4 h-4" />
                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>믹싱</p>
                                        </TooltipContent>
                                      </Tooltip>
                                      
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="landio-button p-2" 
                                            onClick={() => openScheduleModal(entry)}
                                          >
                                            <Calendar className="w-4 h-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>예약</p>
                                        </TooltipContent>
                                      </Tooltip>
                          </div>
                                  </TooltipProvider>
                        </div>
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-border space-y-3">
                            {/* 미리듣기 */}
                              <div className="p-3 bg-muted/40 rounded-lg">
                                <div className="text-xs font-semibold mb-2 text-muted-foreground">미리듣기</div>
                                      {previewAudioUrl || entry.cacheKey ? (
                                <AudioPlayer
                                          key={`${entry.id}_${previewAudioUrl || entry.cacheKey || entryIdStr}`} // audioUrl 또는 cacheKey 변경 시 컴포넌트 재마운트
                                          audioUrl={previewAudioUrl}
                                  title={entry.savedName || formatDateTime(entry.createdAt)}
                                  duration={entry.duration || 0}
                                  mimeType={(entry as any).mimeType || "audio/mpeg"}
                                          cacheKey={entry.cacheKey || entryIdStr}
                                  onError={async () => {
                                    const recoveryKey = `recovery_${entry.id}`;
                                    if ((window as any)[recoveryKey]) {
                                      return;
                                    }
                                    (window as any)[recoveryKey] = true;
                                    try {
                                      const newUrl = await ensureHistoryAudio(entry, { forceReload: true });
                                      if (!newUrl && !(window as any)[`recovery_failed_${entry.id}`]) {
                                        (window as any)[`recovery_failed_${entry.id}`] = true;
                                        toast({
                                          title: "음원 복원 실패",
                                          description: "음원 데이터를 불러올 수 없습니다. 새로 생성해주세요.",
                                          variant: "destructive",
                                          duration: 3000,
                                        });
                                      }
                                    } catch (error) {
                                      console.error("음원 복원 오류:", error);
                                      if (!(window as any)[`recovery_error_${entry.id}`]) {
                                        (window as any)[`recovery_error_${entry.id}`] = true;
                                        toast({
                                          title: "음원 복원 오류",
                                          description: "복원 중 오류가 발생했습니다.",
                                          variant: "destructive",
                                          duration: 3000,
                                        });
                                      }
                                    } finally {
                                      setTimeout(() => {
                                        delete (window as any)[recoveryKey];
                                      }, 5000);
                                    }
                                  }}
                                />
                                      ) : (
                                        <div className="flex items-center justify-center py-8 text-muted-foreground">
                                          <div className="text-center">
                                            <p className="text-sm">음원을 불러올 수 없습니다.</p>
                                            {entry.cacheKey && (
                                              <p className="text-xs mt-1">cacheKey: {entry.cacheKey}</p>
                                            )}
                                          </div>
                              </div>
                            )}
                                    </div>
                            {/* 관리 기능 */}
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="landio-button"
                                        onClick={() => setSaveDialog({ open: true, entry })}
                                        // audioUrl이 없어도 버튼 활성화 (다운로드 시 생성)
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

                        {/* 페이지네이션 */}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-center mt-4">
                            <Pagination>
                              <PaginationContent>
                                <PaginationItem>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setHistoryCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={historyCurrentPage === 1}
                                  >
                                    이전
                                  </Button>
                                </PaginationItem>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                  <PaginationItem key={page}>
                                    <Button
                                      variant={historyCurrentPage === page ? "outline" : "ghost"}
                                      size="sm"
                                      onClick={() => setHistoryCurrentPage(page)}
                                      className="min-w-[2.5rem]"
                                    >
                                      {page}
                                    </Button>
                                  </PaginationItem>
                                ))}
                                <PaginationItem>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setHistoryCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={historyCurrentPage === totalPages}
                                  >
                                    다음
                                  </Button>
                                </PaginationItem>
                              </PaginationContent>
                            </Pagination>
                </div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
            </CardContent>
          </Card>
                </div>
                </div>
      {/* 저장 다이얼로그 */}
      <Dialog open={saveDialog.open} onOpenChange={(open) => setSaveDialog(open ? saveDialog : { open: false })}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>음원 저장</DialogTitle>
            <DialogDescription>파일명과 형식을 확인하고 저장을 진행하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="filename">파일명 (확장자 제외)</Label>
              <Input
                id="filename"
                value={(() => {
                  const base = saveDialog.filename ?? (saveDialog.entry?.savedName || formatDateTime(saveDialog.entry?.createdAt || new Date().toISOString()));
                  // 확장자 제거
                  return base.replace(/\.(mp3|wav|ogg|flac|m4a)$/i, '');
                })()}
                onChange={(e) => {
                  const val = e.target.value.replace(/\.(mp3|wav|ogg|flac|m4a)$/i, '');
                  setSaveDialog((prev) => ({ ...prev, filename: val }));
                }}
                placeholder="파일명을 입력하세요"
              />
              </div>
            <div>
              <Label htmlFor="format">파일 형식</Label>
              <Select
                value={saveDialog.format ?? (saveDialog.entry?.format || guessExtensionFromMime(saveDialog.entry?.mimeType) || 'mp3')}
                onValueChange={(v) => setSaveDialog((prev) => ({ ...prev, format: v }))}
              >
                <SelectTrigger id="format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mp3">MP3 (권장)</SelectItem>
                  <SelectItem value="wav">WAV (무손실)</SelectItem>
                  <SelectItem value="ogg">OGG</SelectItem>
                  <SelectItem value="flac">FLAC (무손실)</SelectItem>
                  <SelectItem value="m4a">M4A</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                저장될 파일: {(() => {
                  const name = (saveDialog.filename ?? (saveDialog.entry?.savedName || formatDateTime(saveDialog.entry?.createdAt || new Date().toISOString()))).replace(/\.(mp3|wav|ogg|flac|m4a)$/i, '');
                  const ext = (saveDialog.format ?? (saveDialog.entry?.format || guessExtensionFromMime(saveDialog.entry?.mimeType) || 'mp3')).toLowerCase();
                  return `${name || '음원'}.${ext}`;
                })()}
              </p>
        </div>
      </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialog({ open: false })}>취소</Button>
            <Button
              onClick={async () => {
                const entry = saveDialog.entry;
                if (!entry) { setSaveDialog({ open: false }); return; }
                const baseName = (saveDialog.filename ?? (entry.savedName || formatDateTime(entry.createdAt || new Date().toISOString()))).replace(/\.(mp3|wav|ogg|flac|m4a)$/i, '').trim() || '음원';
                const ext = (saveDialog.format ?? (entry.format || guessExtensionFromMime(entry.mimeType) || 'mp3')).toLowerCase();
                try {
                  await downloadGeneration({ ...entry, format: ext, savedName: baseName });
                  toast({
                    title: "저장 완료",
                    description: `${baseName}.${ext} 파일이 저장되었습니다.`,
                  });
                } catch (error: any) {
                  toast({
                    title: "저장 실패",
                    description: error.message || "파일 저장 중 오류가 발생했습니다.",
                    variant: "destructive",
                  });
                } finally {
                  setSaveDialog({ open: false });
                }
              }}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Dialogs */}
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
                  placeholder="예: 아가사, Adam (한글/영문 모두 검색 가능)"
                  className="bg-gray-800/50 border-gray-600 text-white placeholder:text-gray-400 focus-visible:ring-gray-500"
                />
                {/* 이름 빠른 선택 */}
                <div className="mt-2">
                  <Select value={voiceFilters.name || undefined} onValueChange={(v) => {
                    // 한글 이름으로 선택된 경우, 원본 name이나 voice_id로 변환하여 필터링
                    const selectedVoice = (allVoices.length > 0 ? allVoices : availableVoices).find((voice: any) => {
                      const displayName = getVoiceDisplayNameKo(voice.name, voice.voice_id, voice.name_ko);
                      return displayName === v || voice.name === v || voice.voice_id === v;
                    });
                    setVoiceFilters(prev => ({ ...prev, name: selectedVoice?.name || selectedVoice?.voice_id || v }));
                  }}>
                    <SelectTrigger className="bg-gray-800/50 border-gray-600 text-white">
                      <SelectValue placeholder="이름 빠른 선택 (옵션)" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-600 max-h-[300px]">
                      {/* 한글 이름으로 정렬하여 표시 */}
                      {[...(allVoices.length > 0 ? allVoices : availableVoices)]
                        .sort((a: any, b: any) => {
                          const nameA = getVoiceDisplayNameKo(a.name, a.voice_id, a.name_ko);
                          const nameB = getVoiceDisplayNameKo(b.name, b.voice_id, b.name_ko);
                          return nameA.localeCompare(nameB, "ko");
                        })
                        .map((v: any) => {
                          const displayName = getVoiceDisplayNameKo(v.name, v.voice_id, v.name_ko);
                          return (
                            <SelectItem 
                              key={v.voice_id} 
                              value={displayName} 
                              className="text-white focus:bg-gray-700"
                            >
                              {displayName}
                            </SelectItem>
                          );
                        })}
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
                  <Select value={searchResultSortBy} onValueChange={(v) => {
                    if (v === "none") {
                      setSearchResultSortBy("none");
                    } else {
                      setSearchResultSortBy(v as "name" | "language" | "gender");
                      if (searchResultSortBy !== v) setSearchResultSortOrder("asc");
                    }
                  }}>
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue placeholder="정렬..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">정렬 안함</SelectItem>
                      <SelectItem value="name">이름</SelectItem>
                      <SelectItem value="language">언어</SelectItem>
                      <SelectItem value="gender">성별</SelectItem>
                    </SelectContent>
                  </Select>
                  {searchResultSortBy !== "none" && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 w-7 p-0"
                      onClick={() => setSearchResultSortOrder(searchResultSortOrder === "asc" ? "desc" : "asc")}
                      title={searchResultSortOrder === "asc" ? "오름차순" : "내림차순"}
                    >
                      {searchResultSortOrder === "asc" ? "↑" : "↓"}
                    </Button>
                  )}
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
                    {(() => {
                      // 검색 결과 정렬 (한글 이름 기준)
                      const sorted = [...voiceSearchResults].sort((a: any, b: any) => {
                        if (searchResultSortBy === "name") {
                          // 한글 이름으로 정렬
                          const nameA = getVoiceDisplayNameKo(a.name, a.voice_id, a.name_ko).toLowerCase();
                          const nameB = getVoiceDisplayNameKo(b.name, b.voice_id, b.name_ko).toLowerCase();
                          return searchResultSortOrder === "asc" 
                            ? nameA.localeCompare(nameB, "ko") 
                            : nameB.localeCompare(nameA, "ko");
                        } else if (searchResultSortBy === "language") {
                          const langA = Array.isArray(a.language) ? a.language[0] || "" : (a.language || "");
                          const langB = Array.isArray(b.language) ? b.language[0] || "" : (b.language || "");
                          const langRankA = langA === "ko" ? 0 : langA === "en" ? 1 : langA === "ja" ? 2 : 3;
                          const langRankB = langB === "ko" ? 0 : langB === "en" ? 1 : langB === "ja" ? 2 : 3;
                          return searchResultSortOrder === "asc" 
                            ? langRankA - langRankB 
                            : langRankB - langRankA;
                        } else if (searchResultSortBy === "gender") {
                          const genderA = (a.gender || "").toLowerCase();
                          const genderB = (b.gender || "").toLowerCase();
                          const genderOrder = { female: 0, male: 1, neutral: 2, "": 3 };
                          const rankA = genderOrder[genderA as keyof typeof genderOrder] ?? 3;
                          const rankB = genderOrder[genderB as keyof typeof genderOrder] ?? 3;
                          return searchResultSortOrder === "asc" ? rankA - rankB : rankB - rankA;
                        }
                        return 0;
                      });
                      return sorted;
                    })().map((voice) => {
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
                                  {getVoiceDisplayNameKo(voice.name, voice.voice_id, voice.name_ko)}
                              </div>
                                <div className="text-xs break-all" style={{ color: '#9CA3AF' }}>ID: {voice.voice_id}</div>
                              </div>
                              <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                  variant="ghost"
                                  className="landio-button hover:bg-gray-800"
                                  onClick={async () => {
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
                                      
                                      // 새 샘플 설정
                                      setPlayingSample(sampleUrl);
                                      
                                      // 오디오 재생 (사용자 상호작용 컨텍스트 내에서)
                                      setTimeout(() => {
                                        if (audioSampleRef.current && audioSampleRef.current.src) {
                                          audioSampleRef.current.play().catch((error) => {
                                            console.error("[VoiceFinder] 샘플 재생 실패:", error);
                                            // 재생 실패 시 src 재설정 후 재시도
                                            if (audioSampleRef.current) {
                                              audioSampleRef.current.src = sampleUrl;
                                              audioSampleRef.current.load();
                                              audioSampleRef.current.play().catch((err) => {
                                                console.error("[VoiceFinder] 샘플 재생 재시도 실패:", err);
                                              });
                                            }
                                          });
                                        }
                                      }, 100);
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
                autoPlay={!!playingSample}
                onEnded={() => {
                  setPlayingSample(null);
                  if (audioSampleRef.current) {
                    audioSampleRef.current.currentTime = 0;
                  }
                }}
                onLoadedData={() => {
                  // 오디오가 로드되면 재생 시도
                  if (audioSampleRef.current && playingSample) {
                    audioSampleRef.current.play().catch((error) => {
                      console.warn("[VoiceFinder] 자동 재생 실패 (사용자 상호작용 필요할 수 있음):", error);
                    });
                  }
                }}
                onError={(event) => {
                  console.warn("샘플 오디오 재생 오류:", (event.target as HTMLAudioElement)?.error);
                  setPlayingSample(null);
                  if (audioSampleRef.current) {
                    audioSampleRef.current.currentTime = 0;
                  }
                  if (playingSample && playingSample.startsWith('http')) {
                    fetchSampleAsDataUrl(playingSample)
                      .then((dataUrl) => {
                        if (!dataUrl) {
                          toast({
                            title: "샘플 재생 실패",
                            description: "샘플 오디오를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.",
                            variant: "destructive",
                          });
                          return;
                        }
                        setPlayingSample(dataUrl);
                      })
                      .catch((error) => {
                        console.error("샘플 재생 복원 실패:", error);
                        toast({
                          title: "샘플 재생 실패",
                          description: "샘플 오디오를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.",
                          variant: "destructive",
                        });
                      });
                  }
                }}
                className="hidden"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 클론 음성 생성 모달은 VoiceCloning.tsx로 이동됨 */}

      <Dialog open={isMixingModalOpen} onOpenChange={(open) => {
        setIsMixingModalOpen(open);
        // 모달이 닫힐 때 모든 오디오 중지
        if (!open) {
          stopRealtimePreview();
          // 선택된 음원의 AudioPlayer도 정지 (있는 경우)
          if (mixingStates.get(selectedGenerationForMixing?.id)?.selectedVoiceTrack?.audioUrl) {
            // AudioPlayer는 자체적으로 관리되지만, 명시적으로 정리할 수도 있음
          }
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col dark-dialog bg-gray-900/95 border-gray-700">
          <DialogHeader>
            <DialogTitle style={{ color: '#FFFFFF' }}>음원 믹싱 설정</DialogTitle>
            <DialogDescription style={{ color: '#E5E7EB' }}>음원을 선택하고 배경음과 효과음을 추가하여 믹싱합니다.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 overflow-y-auto pr-4">
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
                onValueChange={async (value) => {
                  const selectedTrack = generationHistory.find((g) => g.id.toString() === value);
                  if (selectedGenerationForMixing?.id && selectedTrack) {
                    let audioUrl: string | null = null;
                    try {
                      audioUrl = await ensureHistoryAudio(selectedTrack, { forceReload: false });
                    } catch (error) {
                      console.warn("믹싱용 음원 복원 실패:", error);
                    }
                    if (!audioUrl) {
                      audioUrl = selectedTrack.audioUrl || null;
                    }

                    if (!audioUrl && selectedTrack.cacheKey) {
                      const cached = cacheRef.current.get(selectedTrack.cacheKey);
                      if (cached?.dataUrl) {
                        audioUrl = cached.dataUrl;
                      } else if (cached?.blob) {
                        try {
                          const dataUrl = await blobToDataUrl(cached.blob);
                          cacheRef.current.set(selectedTrack.cacheKey, {
                            ...cached,
                            dataUrl,
                          });
                          audioUrl = dataUrl;
                        } catch (error) {
                          console.warn("캐시 블랍 데이터 URL 변환 실패:", error);
                        }
                      }
                    }

                    setGenerationHistory((prev) => 
                      prev.map((g) => 
                        g.id === selectedTrack.id 
                          ? { ...g, audioUrl: audioUrl || g.audioUrl }
                          : g
                      )
                    );
                    
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
                      key={gen.id || `gen_${Date.now()}_${Math.random()}`} 
                      value={String(gen.id || '')} 
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
                    key={`mixing_selected_${selectedGenerationForMixing?.id}_${mixingStates.get(selectedGenerationForMixing?.id)?.selectedVoiceTrack?.audioUrl || ''}`}
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
                <Label style={{ color: '#E5E7EB' }} className="text-sm font-semibold">타임라인 (BGM 고정, TTS 이동)</Label>
                <MixingTimeline
                  ttsDuration={mixingStates.get(selectedGenerationForMixing?.id)?.selectedVoiceTrack?.duration || 0}
                  bgmDuration={(() => {
                    // BGM 길이 가져오기 (uploadedBgmFile 또는 selectedBackground에서)
                    const bgmState = mixingStates.get(selectedGenerationForMixing?.id)?.selectedBackground;
                    // 실제로는 AudioBuffer의 duration을 가져와야 하지만, 여기서는 placeholder
                    return bgmState?.duration || 30; // 기본값 30초
                  })()}
                  bgmOffset={Math.abs(mixingStates.get(selectedGenerationForMixing?.id)?.bgmOffset ?? DEFAULT_MIXING_SETTINGS.bgmOffset ?? 0)} // 항상 양수로 변환
                  fadeIn={mixingStates.get(selectedGenerationForMixing?.id)?.fadeIn ?? DEFAULT_MIXING_SETTINGS.fadeIn}
                  fadeOut={mixingStates.get(selectedGenerationForMixing?.id)?.fadeOut ?? DEFAULT_MIXING_SETTINGS.fadeOut}
                  bgmOffsetAfterTts={mixingStates.get(selectedGenerationForMixing?.id)?.bgmOffsetAfterTts ?? 0}
                  onBgmOffsetChange={(offset) => {
                    const genId = selectedGenerationForMixing?.id;
                    if (genId) {
                      const state = mixingStates.get(genId) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 };
                      // 항상 양수로 저장
                      setMixingStates((prev) => new Map(prev).set(genId, { ...state, bgmOffset: Math.abs(offset) }));
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
                      // 실시간 미리듣기 업데이트
                      if (isMixingPreviewPlaying && mixingPreviewAudio) {
                        startRealtimePreview();
                      }
                    }
                  }}
                  onFadeOutChange={(fade) => {
                    const genId = selectedGenerationForMixing?.id;
                    if (genId) {
                      const state = mixingStates.get(genId) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 };
                      setMixingStates((prev) => new Map(prev).set(genId, { ...state, fadeOut: fade }));
                      // 실시간 미리듣기 업데이트
                      if (isMixingPreviewPlaying && mixingPreviewAudio) {
                        startRealtimePreview();
                      }
                    }
                  }}
                  onBgmOffsetAfterTtsChange={(offset) => {
                    const genId = selectedGenerationForMixing?.id;
                    if (genId) {
                      const state = mixingStates.get(genId) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 };
                      setMixingStates((prev) => new Map(prev).set(genId, { ...state, bgmOffsetAfterTts: Math.abs(offset) }));
                      // 실시간 미리듣기 업데이트
                      if (isMixingPreviewPlaying && mixingPreviewAudio) {
                        startRealtimePreview();
                      }
                    }
                  }}
                  fadeInRatio={mixingStates.get(selectedGenerationForMixing?.id)?.fadeInRatio ?? 50}
                  fadeOutRatio={mixingStates.get(selectedGenerationForMixing?.id)?.fadeOutRatio ?? 50}
                  onFadeInRatioChange={(ratio) => {
                    const genId = selectedGenerationForMixing?.id;
                    if (genId) {
                      const state = mixingStates.get(genId) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 };
                      setMixingStates((prev) => new Map(prev).set(genId, { ...state, fadeInRatio: ratio }));
                      // 실시간 미리듣기 업데이트
                      if (isMixingPreviewPlaying && mixingPreviewAudio) {
                        startRealtimePreview();
                      }
                    }
                  }}
                  onFadeOutRatioChange={(ratio) => {
                    const genId = selectedGenerationForMixing?.id;
                    if (genId) {
                      const state = mixingStates.get(genId) || { voiceTrackVolume: 100, backgroundTrackVolume: 50, effectTrackVolume: 70 };
                      setMixingStates((prev) => new Map(prev).set(genId, { ...state, fadeOutRatio: ratio }));
                      // 실시간 미리듣기 업데이트
                      if (isMixingPreviewPlaying && mixingPreviewAudio) {
                        startRealtimePreview();
                      }
                    }
                  }}
                />
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
          </ScrollArea>
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

      {/* 이름 저장 다이얼로그 (필수) */}
      <Dialog 
        open={isSaveNameDialogOpen} 
        onOpenChange={(open) => {
          // 저장은 필수이므로 외부 클릭이나 ESC 키로 닫히는 것을 완전히 방지
          if (!open && pendingGeneration) {
            return; // 닫기 방지
          }
          // pendingGeneration이 없으면 (이미 저장된 경우) 정상적으로 닫기
          if (!open && !pendingGeneration) {
            setIsSaveNameDialogOpen(false);
          }
        }}
      >
        <DialogContent 
          className="sm:max-w-2xl max-w-[95vw] dark-dialog bg-gray-900/95 border-gray-700"
          onInteractOutside={(e) => {
            // 외부 클릭으로 닫히는 것을 완전히 방지 (필수 저장)
              e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            // ESC 키로 닫히는 것을 완전히 방지 (필수 저장)
              e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: '#FFFFFF' }} className="text-xl font-semibold flex items-center gap-2">
              음원 저장 (필수)
              <Badge variant="outline" className="text-[10px] bg-green-900/30 text-green-400 border-green-600">
                클라우드 서버
              </Badge>
            </DialogTitle>
            <DialogDescription style={{ color: '#E5E7EB' }}>
              생성된 음원을 저장해주세요. 이름을 입력하지 않으면 자동으로 카테고리_날짜 형식으로 저장됩니다.
            </DialogDescription>
            <div className="mt-2 p-3 bg-blue-900/20 border border-blue-600/30 rounded-lg">
              <div className="flex items-start gap-2 text-xs text-blue-300">
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <div><strong>저장 위치:</strong> 계정별 Supabase 클라우드 DB</div>
                  {pendingGeneration?.storagePath && (
                    <div><strong>로컬 파일 경로:</strong> <code className="text-[10px] bg-gray-800/50 px-1 py-0.5 rounded">{pendingGeneration.storagePath}</code></div>
                  )}
                  <div><strong>파일 형식:</strong> {pendingGeneration?.format?.toUpperCase() || "MP3/WAV"}</div>
                  <div><strong>접근 방식:</strong> 로그인 시 어디서든 사용 가능</div>
                </div>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label style={{ color: '#E5E7EB' }} className="text-sm font-medium">저장 이름 (선택사항)</Label>
              <Input
                value={saveNameInput}
                onChange={(e) => setSaveNameInput(e.target.value)}
                placeholder={`예: ${pendingGeneration?.purposeLabel || "안내방송"}_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`}
                className="bg-gray-800/50 border-gray-600 text-white h-10 w-full max-w-full"
                style={{ color: '#FFFFFF' }}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    // Enter 키로 저장 실행
                    const finalSavedName = saveNameInput.trim() || generateDefaultFileName(pendingGeneration);
                    await handleSaveGeneration(finalSavedName);
                  }
                }}
              />
              <p className="text-xs text-gray-400">
                이름을 입력하지 않으면 자동으로 <strong>{pendingGeneration ? generateDefaultFileName(pendingGeneration) : ""}</strong> 형식으로 저장됩니다.
              </p>
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2">
              <Button
              className="bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-700 hover:to-cyan-600 text-white h-10 text-sm font-medium px-4"
                onClick={async () => {
                // 이름이 없으면 자동으로 카테고리_YYYYMMDD 형식 생성
                const finalSavedName = saveNameInput.trim() || generateDefaultFileName(pendingGeneration);
                await handleSaveGeneration(finalSavedName);
                }}
              >
              저장
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 클론 관련 모달은 모두 VoiceCloning.tsx로 이동됨 */}

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

      {/* 사용량 모니터링 패널 제거 (Dashboard에서 관리) */}

      {/* 메시지 이력 관리 다이얼로그 */}
      <Dialog open={isMessageHistoryOpen} onOpenChange={setIsMessageHistoryOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] dark-dialog bg-gray-900/95 border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: '#FFFFFF' }}>
              <History className="w-5 h-5" />
              메시지 이력 관리
            </DialogTitle>
            <DialogDescription style={{ color: '#E5E7EB' }}>
              저장된 메시지를 선택하면 메시지 입력 영역에 불러옵니다.
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
                    <div 
                      key={msg.id} 
                      className="p-4 border border-gray-600 rounded-lg cursor-pointer hover:bg-gray-800/50 transition-colors"
                      onClick={() => {
                        setCustomText(msg.text);
                        setSelectedPurpose(msg.purpose);
                        setIsMessageHistoryOpen(false);
                        toast({
                          title: "문구 불러오기 완료",
                          description: "메시지가 편집 영역에 로드되었습니다.",
                        });
                      }}
                    >
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
                          <p className="text-sm line-clamp-2" style={{ color: '#FFFFFF' }}>{msg.text}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hover:bg-gray-700 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            // DB에서 삭제
                            if (user?.id && msg.id) {
                              dbService.deleteMessage(user.id, msg.id).then(() => {
                                // 로컬 상태 업데이트
                                const updated = messageHistory.filter(m => m.id !== msg.id);
                                setMessageHistory(updated);
                                
                                // localStorage도 업데이트 (폴백)
                                try {
                                  localStorage.setItem(MESSAGE_HISTORY_STORAGE_KEY, JSON.stringify(updated));
                                } catch {}
                                
                                toast({
                                  title: "메시지 삭제 완료",
                                  description: "메시지가 삭제되었습니다.",
                                });
                              }).catch(() => {});
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
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
        <AlertDialogContent className="sm:max-w-[500px]">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <AlertDialogTitle className="text-xl">음원 삭제 확인</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base pt-2">
              {(() => {
                const entry = deleteConfirmDialog.id ? generationHistory.find((g) => String(g.id || '') === String(deleteConfirmDialog.id)) : null;
                if (entry) {
                  return (
                    <div className="space-y-3">
                      <p className="text-muted-foreground">
              정말 이 음원을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                      </p>
                      <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-sm font-medium text-muted-foreground min-w-[60px]">이름:</span>
                          <span className="text-sm font-semibold flex-1">{entry.savedName || "이름 없음"}</span>
                        </div>
                        {entry.textPreview && (
                          <div className="flex items-start gap-2">
                            <span className="text-sm font-medium text-muted-foreground min-w-[60px]">내용:</span>
                            <span className="text-sm flex-1 line-clamp-2">{entry.textPreview}</span>
                          </div>
                        )}
                        {entry.duration && (
                          <div className="flex items-start gap-2">
                            <span className="text-sm font-medium text-muted-foreground min-w-[60px]">길이:</span>
                            <span className="text-sm flex-1">{entry.duration.toFixed(1)}초</span>
                          </div>
                        )}
                        {entry.createdAt && (
                          <div className="flex items-start gap-2">
                            <span className="text-sm font-medium text-muted-foreground min-w-[60px]">생성일:</span>
                            <span className="text-sm flex-1">{formatDateTime(entry.createdAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
                return (
                  <p className="text-muted-foreground">
                    정말 이 음원을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                  </p>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="mt-2 sm:mt-0">
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive"
              onClick={() => {
                if (deleteConfirmDialog.id) {
                  deleteGeneration(deleteConfirmDialog.id);
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              삭제하기
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
                    {`{${v}}`}
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-gray-400">
                변수를 그대로 두고 생성하면 음성에 {"{기관명}"}, {"{담당자명}"} 같은 문구가 그대로 읽힙니다.
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
      <Dialog open={localSaveDialog.open} onOpenChange={(open) => {
        if (!open) closeLocalSaveDialog();
      }}>
        <DialogContent className="sm:max-w-md dark-dialog bg-gray-900/95 border-gray-700">
          <DialogHeader>
            <DialogTitle>로컬에 저장</DialogTitle>
            <DialogDescription>
              선택한 음원을 컴퓨터에 저장합니다. 파일 정보를 확인한 후 다운로드를 진행해 주세요.
            </DialogDescription>
          </DialogHeader>
          {localSaveDialog.entry && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/10 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div
                    className="font-medium text-foreground truncate"
                    title={localSaveDialog.entry.savedName || formatDateTime(localSaveDialog.entry.createdAt)}
                  >
                    {localSaveDialog.entry.savedName || formatDateTime(localSaveDialog.entry.createdAt)}
                  </div>
                  <Badge variant="outline" className="text-[11px]">
                    {(localSaveDialog.entry.format || guessExtensionFromMime(localSaveDialog.entry.mimeType)).toUpperCase()}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>길이: {localSaveDialog.entry.duration != null ? `${localSaveDialog.entry.duration.toFixed(2)}초` : "-"}</span>
                  <span>생성일: {formatDateTime(localSaveDialog.entry.createdAt)}</span>
                  {localSaveDialog.sizeLabel && <span>파일 크기: {localSaveDialog.sizeLabel}</span>}
                </div>
              </div>

              {localSaveDialog.isPreparing && (
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-border/60 bg-muted/10 px-3 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>음원을 준비하고 있습니다...</span>
                </div>
              )}

              {localSaveDialog.error && !localSaveDialog.isPreparing && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {localSaveDialog.error}
                </div>
              )}

              {!localSaveDialog.isPreparing && !localSaveDialog.error && localSaveDialog.fileName && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">저장될 파일명</Label>
                  <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-sm text-foreground">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate" title={localSaveDialog.fileName}>{localSaveDialog.fileName}</span>
                  </div>
                  {localSaveDialog.mimeType && (
                    <p className="text-xs text-muted-foreground">MIME 타입: {localSaveDialog.mimeType}</p>
                  )}
                  {localSaveDialog.sizeLabel && (
                    <p className="text-xs text-muted-foreground">파일 크기: {localSaveDialog.sizeLabel}</p>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-4">
            <Button variant="outline" onClick={closeLocalSaveDialog} className="w-full sm:w-auto">
              취소
            </Button>
            <Button
              onClick={handleConfirmLocalSave}
              disabled={localSaveDialog.isPreparing || !!localSaveDialog.error || !localSaveDialog.downloadUrl}
              className="w-full sm:w-auto"
            >
              로컬에 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>

  );
};

export default PublicVoiceGenerator;