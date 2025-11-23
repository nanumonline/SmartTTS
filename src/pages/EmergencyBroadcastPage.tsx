import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Mic2, 
  Radio, 
  Clock, 
  Send, 
  Star, 
  FileText, 
  Volume2,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowLeft,
  Zap
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import * as dbService from "@/services/dbService";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/layout/AppShell";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";
import { getPurposeColor } from "@/lib/categoryColors";
import { getVoiceDisplayNameKo } from "@/lib/voiceNames";
import AudioPlayer from "@/components/AudioPlayer";

export default function EmergencyBroadcastPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // 상태 관리
  const [activeTab, setActiveTab] = useState<"message" | "favorite">("message");
  const [customText, setCustomText] = useState("");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [selectedGenerationId, setSelectedGenerationId] = useState<string>("");
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [scheduleType, setScheduleType] = useState<"immediate" | "delayed">("immediate");
  const [delayMinutes, setDelayMinutes] = useState<number>(5);
  const [scheduleName, setScheduleName] = useState<string>("");
  
  // 데이터 로드
  const [channels, setChannels] = useState<dbService.ChannelEntry[]>([]);
  const [favoriteMessages, setFavoriteMessages] = useState<dbService.MessageHistoryEntry[]>([]);
  const [favoriteGenerations, setFavoriteGenerations] = useState<dbService.GenerationEntry[]>([]);
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [favoriteVoiceIds, setFavoriteVoiceIds] = useState<Set<string>>(new Set());
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [selectedGeneration, setSelectedGeneration] = useState<dbService.GenerationEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // blob URL 정리 (data URL은 정리 불필요, blob URL만 정리)
  useEffect(() => {
    return () => {
      if (generatedAudioUrl && generatedAudioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(generatedAudioUrl);
      }
    };
  }, [generatedAudioUrl]);
  
  // 즐겨찾기 메시지 로드
  const loadFavoriteMessages = useCallback(async () => {
    if (!user?.id) return;
    try {
      const favoriteIds = await dbService.loadMessageFavorites(user.id);
      if (favoriteIds.length === 0) {
        setFavoriteMessages([]);
        return;
      }
      
      const allMessages = await dbService.loadMessages(user.id);
      const favorites = allMessages.filter(msg => favoriteIds.includes(String(msg.id)));
      setFavoriteMessages(favorites);
    } catch (error) {
      console.error("즐겨찾기 메시지 로드 실패:", error);
    }
  }, [user?.id]);
  
  // 즐겨찾기 음원 로드
  const loadFavoriteGenerations = useCallback(async () => {
    if (!user?.id) return;
    try {
      const generations = await dbService.loadGenerations(user.id, 100);
      const favorites = generations.filter(gen => gen.isFavorite === true);
      setFavoriteGenerations(favorites);
    } catch (error) {
      console.error("즐겨찾기 음원 로드 실패:", error);
    }
  }, [user?.id]);
  
  // 채널 로드
  const loadChannels = useCallback(async () => {
    if (!user?.id) return;
    try {
      const channelsList = await dbService.loadChannels(user.id);
      setChannels(channelsList);
      if (channelsList.length > 0 && !selectedChannelId) {
        setSelectedChannelId(channelsList[0].id || channelsList[0].type);
      }
    } catch (error) {
      console.error("채널 로드 실패:", error);
      toast({
        title: "채널 로드 실패",
        description: "채널 목록을 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  }, [user?.id, selectedChannelId, toast]);
  
  // 즐겨찾기 음성 로드
  const loadFavoriteVoices = useCallback(async () => {
    if (!user?.id) return;
    try {
      const favorites = await dbService.loadFavorites(user.id);
      if (favorites && Array.isArray(favorites)) {
        setFavoriteVoiceIds(new Set(favorites));
      }
    } catch (error) {
      console.error("즐겨찾기 음성 로드 실패:", error);
    }
  }, [user?.id]);
  
  // 음성 목록 로드
  const loadVoices = useCallback(async () => {
    try {
      const voiceCatalog = await dbService.loadVoiceCatalog();
      if (Array.isArray(voiceCatalog) && voiceCatalog.length > 0) {
        // 즐겨찾기 음성을 먼저 정렬
        const sortedVoices = [...voiceCatalog].sort((a, b) => {
          const aIsFavorite = favoriteVoiceIds.has(a.voice_id);
          const bIsFavorite = favoriteVoiceIds.has(b.voice_id);
          if (aIsFavorite && !bIsFavorite) return -1;
          if (!aIsFavorite && bIsFavorite) return 1;
          return 0;
        });
        setAvailableVoices(sortedVoices);
        if (!selectedVoiceId && sortedVoices.length > 0) {
          // 즐겨찾기 음성이 있으면 첫 번째 즐겨찾기 음성 선택, 없으면 첫 번째 음성 선택
          const favoriteVoice = sortedVoices.find(v => favoriteVoiceIds.has(v.voice_id));
          setSelectedVoiceId(favoriteVoice?.voice_id || sortedVoices[0].voice_id);
        }
      }
    } catch (error) {
      console.error("음성 목록 로드 실패:", error);
    }
  }, [selectedVoiceId, favoriteVoiceIds]);
  
  // 초기 데이터 로드
  useEffect(() => {
    if (user?.id) {
      loadChannels();
      loadFavoriteMessages();
      loadFavoriteGenerations();
      loadFavoriteVoices();
    }
  }, [user?.id, loadChannels, loadFavoriteMessages, loadFavoriteGenerations, loadFavoriteVoices]);
  
  // 즐겨찾기 음성 로드 후 음성 목록 로드
  useEffect(() => {
    if (favoriteVoiceIds.size >= 0) {
      loadVoices();
    }
  }, [favoriteVoiceIds, loadVoices]);
  
  // 문구 선택 시 텍스트 설정
  const handleSelectMessage = (message: dbService.MessageHistoryEntry) => {
    setCustomText(message.text);
    setActiveTab("message");
    toast({
      title: "문구 선택됨",
      description: "문구가 입력 영역에 로드되었습니다.",
    });
  };
  
  // 음원 선택
  const handleSelectGeneration = (generation: dbService.GenerationEntry) => {
    setSelectedGenerationId(String(generation.id));
    setSelectedGeneration(generation);
    setScheduleName(generation.savedName || generation.purposeLabel || "긴급 방송");
    // 즐겨찾기 음원의 오디오 URL 설정
    if (generation.audioUrl) {
      setGeneratedAudioUrl(generation.audioUrl);
    }
    toast({
      title: "음원 선택됨",
      description: `${generation.savedName || "음원"}이 선택되었습니다.`,
    });
  };
  
  // 오디오 복원 함수
  const handleAudioError = useCallback(async () => {
    if (!selectedGenerationId || !user?.id) {
      console.warn("[EmergencyBroadcast] 복원 불가: selectedGenerationId 또는 user.id 없음");
      return;
    }
    
    try {
      console.log(`[EmergencyBroadcast] 오디오 복원 시작: ${selectedGenerationId}`);
      const result = await dbService.loadGenerationBlob(user.id, selectedGenerationId);
      
      if (result?.audioBlob && result.audioBlob.byteLength > 0) {
        // mimeType이 application/json인 경우 실제 오디오 형식 감지
        let mimeType = result.mimeType || selectedGeneration?.mimeType || "audio/mpeg";
        
        // application/json인 경우 실제 오디오 형식 감지
        if (mimeType === "application/json" || !mimeType || mimeType.startsWith("application/")) {
          const bytes = new Uint8Array(result.audioBlob);
          
          // MP3 파일 시그니처 확인 (ID3 태그 또는 MP3 프레임)
          if (bytes.length >= 3) {
            // ID3 태그: "ID3"
            if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
              mimeType = "audio/mpeg";
            }
            // MP3 프레임: 0xFF 0xFB 또는 0xFF 0xF3
            else if (bytes[0] === 0xFF && (bytes[1] === 0xFB || bytes[1] === 0xF3 || bytes[1] === 0xF2)) {
              mimeType = "audio/mpeg";
            }
            // WAV 파일: "RIFF"
            else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
              mimeType = "audio/wav";
            }
            // OGG 파일: "OggS"
            else if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
              mimeType = "audio/ogg";
            }
            // 기본값: MP3
            else {
              mimeType = "audio/mpeg";
            }
          } else {
            mimeType = "audio/mpeg";
          }
          
          console.log(`[EmergencyBroadcast] mimeType 자동 감지: ${mimeType}`);
        }
        
        console.log(`[EmergencyBroadcast] 오디오 데이터 로드 완료: ${result.audioBlob.byteLength} bytes, mimeType: ${mimeType}`);
        
        // 데이터가 JSON 객체로 감싸져 있는지 확인
        let audioData = result.audioBlob;
        const bytes = new Uint8Array(audioData);
        
        // 첫 바이트가 '{' (123)인 경우 JSON 객체일 수 있음
        if (bytes.length > 0 && bytes[0] === 123 /* '{' */) {
          try {
            const text = new TextDecoder().decode(audioData);
            const parsed = JSON.parse(text);
            
            // JSON 객체에서 오디오 데이터 추출
            if (parsed.audioData || parsed.audio_base64 || parsed.audioBase64) {
              const base64Audio = parsed.audioData || parsed.audio_base64 || parsed.audioBase64;
              const cleanBase64 = base64Audio.includes(",") ? base64Audio.split(",").pop() || "" : base64Audio;
              const decoded = atob(cleanBase64);
              const decodedBytes = new Uint8Array(decoded.length);
              for (let i = 0; i < decoded.length; i++) {
                decodedBytes[i] = decoded.charCodeAt(i);
              }
              audioData = decodedBytes.buffer;
              console.log(`[EmergencyBroadcast] JSON 객체에서 오디오 데이터 추출 완료: ${decodedBytes.length} bytes`);
            }
          } catch (error) {
            console.warn("[EmergencyBroadcast] JSON 객체 파싱 실패, 원본 데이터 사용:", error);
          }
        }
        
        const blob = dbService.arrayBufferToBlob(audioData, mimeType);
        
        if (!blob || blob.size === 0) {
          throw new Error("Blob 변환 실패 또는 빈 데이터");
        }
        
        console.log(`[EmergencyBroadcast] Blob 생성 완료: ${blob.size} bytes, type: ${blob.type}`);
        
        // 이전 blob URL 정리
        if (generatedAudioUrl && generatedAudioUrl.startsWith('blob:')) {
          URL.revokeObjectURL(generatedAudioUrl);
        }
        
        // data URL 사용 (더 안정적이고 브라우저 호환성 좋음)
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (reader.result && typeof reader.result === 'string') {
              console.log(`[EmergencyBroadcast] Data URL 생성 완료`);
              resolve(reader.result);
            } else {
              reject(new Error("FileReader 결과가 문자열이 아님"));
            }
          };
          reader.onerror = (e) => {
            console.error("[EmergencyBroadcast] FileReader 에러:", e);
            reject(new Error("FileReader 에러"));
          };
          reader.readAsDataURL(blob);
        });
        
        // URL을 null로 먼저 설정하여 AudioPlayer 상태 리셋
        setGeneratedAudioUrl(null);
        
        // 다음 틱에서 새 URL 설정 (컴포넌트 재마운트 보장)
        await new Promise(resolve => setTimeout(resolve, 150));
        
        setGeneratedAudioUrl(dataUrl);
        console.log("[EmergencyBroadcast] 오디오 복원 완료 - Data URL 업데이트됨");
        
        toast({
          title: "음원 복원 완료",
          description: "오디오가 복원되었습니다.",
        });
      } else {
        console.warn("[EmergencyBroadcast] 오디오 데이터 없음 또는 빈 데이터");
        toast({
          title: "음원 복원 실패",
          description: "오디오 데이터를 불러올 수 없습니다.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("[EmergencyBroadcast] 오디오 복원 실패:", error);
      toast({
        title: "음원 복원 실패",
        description: error?.message || "오디오 복원 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  }, [selectedGenerationId, selectedGeneration, user?.id, toast]);
  
  // 음원 생성
  const handleGenerateAudio = async () => {
    if (!customText.trim()) {
      toast({
        title: "문구 필요",
        description: "방송할 문구를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedVoiceId) {
      toast({
        title: "음성 선택 필요",
        description: "음성을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }
    
    setIsGenerating(true);
    try {
      const SUPABASE_PROXY_BASE_URL = "https://gxxralruivyhdxyftsrg.supabase.co/functions/v1/supertone-proxy";
      const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4eHJhbHJ1aXZ5aGR4eWZ0c3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NDM0MzQsImV4cCI6MjA3NzIxOTQzNH0.6lJjJq15spXWrktl-8d5qXI3L5FHkyaEArWiH2R5AjA";
      
      // Supabase 프록시를 통한 TTS 생성
      const requestBody = {
        text: customText.substring(0, 300), // 최대 300자
        language: "ko",
        style: "neutral",
        model: "sona_speech_1",
        voice_settings: {
          speed: 1.0,
          pitch_shift: 0,
          pitch_variance: 1,
        },
      };
      
      const response = await fetch(`${SUPABASE_PROXY_BASE_URL}/text-to-speech/${selectedVoiceId}?output_format=mp3`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`음원 생성 실패 (${response.status}): ${errorText}`);
      }
      
      // Supertone 프록시는 JSON 형식으로 응답 (audioData, contentType, audioLength)
      const contentType = response.headers?.get("content-type")?.toLowerCase() || "";
      let audioBlob: Blob;
      let mimeType = "audio/mpeg";
      
      if (contentType.includes("application/json")) {
        const json = await response.json();
        const payload = json.data ?? json.result ?? json;
        const base64Audio = payload?.audio_base64 ?? payload?.audioBase64 ?? payload?.audio ?? payload?.audio_data ?? payload?.audioData ?? null;
        mimeType = payload?.mime_type ?? payload?.mimetype ?? payload?.content_type ?? json.contentType ?? "audio/mpeg";
        
        if (!base64Audio) {
          throw new Error("오디오 데이터가 응답에 포함되어 있지 않습니다.");
        }
        
        // base64를 blob으로 변환
        const cleanBase64 = base64Audio.includes(",") ? base64Audio.split(",").pop() || "" : base64Audio;
        const decoded = atob(cleanBase64);
        const bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) {
          bytes[i] = decoded.charCodeAt(i);
        }
        audioBlob = new Blob([bytes], { type: mimeType });
      } else {
        // 직접 blob 응답인 경우
        audioBlob = await response.blob();
        mimeType = audioBlob.type || "audio/mpeg";
      }
      
      if (!audioBlob || audioBlob.size === 0) {
        throw new Error("생성된 오디오 데이터가 비어있습니다.");
      }
      
      // 오디오 재생 시간 측정 (선택사항 - 실패해도 계속 진행)
      let duration: number | null = null;
      try {
        const blobUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(blobUrl);
        
        // 에러 핸들러를 먼저 설정하여 에러가 발생해도 처리
        audio.onerror = () => {
          // 에러가 발생해도 resolve하여 계속 진행
          console.warn("오디오 메타데이터 로드 실패 (계속 진행)");
        };
        
        await new Promise<void>((resolve) => {
          let resolved = false;
          
          const cleanup = () => {
            if (!resolved) {
              resolved = true;
              URL.revokeObjectURL(blobUrl);
              resolve();
            }
          };
          
          audio.onloadedmetadata = () => {
            if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
              duration = audio.duration;
            }
            cleanup();
          };
          
          // 타임아웃 설정 (3초)
          const timeout = setTimeout(() => {
            cleanup();
          }, 3000);
          
          // 에러 발생 시에도 정리하고 계속 진행
          audio.onerror = () => {
            clearTimeout(timeout);
            cleanup();
          };
          
          // 오디오 로드 시작
          audio.load();
        });
      } catch (e) {
        // 에러가 발생해도 경고만 출력하고 계속 진행
        console.warn("오디오 재생 시간 측정 실패 (계속 진행):", e);
      }
      
      // duration이 없으면 텍스트 길이로 추정
      if (duration == null || duration <= 0) {
        duration = customText.length * 0.1; // 대략 초당 10자
      }
      
      const audioUrl = URL.createObjectURL(audioBlob);
      setGeneratedAudioUrl(audioUrl); // 미리듣기용 URL 저장
      
      // 생성 이력 저장
      const generationEntry: dbService.GenerationEntry = {
        id: crypto.randomUUID(),
        purpose: "emergency",
        purposeLabel: "긴급 방송",
        voiceId: selectedVoiceId,
        voiceName: getVoiceDisplayNameKo(availableVoices.find(v => v.voice_id === selectedVoiceId)?.name, selectedVoiceId, availableVoices.find(v => v.voice_id === selectedVoiceId)?.name_ko),
        savedName: scheduleName || "긴급 방송",
        textPreview: customText.substring(0, 50),
        textLength: customText.length,
        duration: duration || 0,
        language: "ko",
        audioUrl: audioUrl,
        mimeType: mimeType,
        status: "ready",
        hasAudio: true,
        createdAt: new Date().toISOString(),
      };
      
      if (user?.id) {
        const savedId = await dbService.saveGeneration(user.id, generationEntry, audioBlob);
        const finalId = savedId || String(generationEntry.id);
        setSelectedGenerationId(finalId);
        setSelectedGeneration({ ...generationEntry, id: finalId });
        toast({
          title: "음원 생성 완료",
          description: "음원이 생성되었습니다. 미리듣기를 확인하고 송출 버튼을 눌러주세요.",
        });
      }
    } catch (error: any) {
      console.error("음원 생성 실패:", error);
      toast({
        title: "음원 생성 실패",
        description: error.message || "음원 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  // 송출 실행
  const handleBroadcast = async () => {
    if (!selectedGenerationId) {
      toast({
        title: "음원 선택 필요",
        description: "송출할 음원을 선택하거나 생성해주세요.",
        variant: "destructive",
      });
      return;
    }
    
    if (!selectedChannelId) {
      toast({
        title: "채널 선택 필요",
        description: "송출할 채널을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const options: dbService.BroadcastOptions = {
        generationId: selectedGenerationId,
        channelId: selectedChannelId,
        scheduleName: scheduleName || "긴급 방송",
      };
      
      let result;
      if (scheduleType === "immediate") {
        result = await dbService.broadcastImmediately(options);
      } else {
        result = await dbService.broadcastDelayed(options, delayMinutes);
      }
      
      if (result.success) {
        const message = scheduleType === "immediate" 
          ? "즉시 송출이 시작되었습니다."
          : `${delayMinutes}분 후 송출이 예약되었습니다.`;
        
        toast({
          title: "송출 완료",
          description: message,
        });
        
        // 초기화
        setCustomText("");
        setSelectedGenerationId("");
        setSelectedGeneration(null);
        setScheduleName("");
        setScheduleType("immediate");
        setGeneratedAudioUrl(null);
      } else {
        throw new Error(result.error || "송출 실패");
      }
    } catch (error: any) {
      console.error("송출 실패:", error);
      toast({
        title: "송출 실패",
        description: error.message || "송출 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <ProtectedRoute>
      <AppShell>
        <PageContainer maxWidth="wide">
          <PageHeader
            title="긴급 방송 송출"
            description="급한 상황에서 신속하게 방송을 송출합니다"
            icon={Zap}
            showBreadcrumb={false}
            action={{
              label: "뒤로",
              onClick: () => navigate("/dashboard"),
              icon: ArrowLeft,
            }}
          />
          
          <div className="space-y-4 md:space-y-6">
            {/* 채널 선택 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Radio className="w-5 h-5" />
                  송출 채널
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="채널을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((channel) => (
                      <SelectItem key={channel.id || channel.type} value={channel.id || channel.type}>
                        {channel.name} ({channel.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
            
            {/* 문구 작성 / 즐겨찾기 선택 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5" />
                  방송 문구
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "message" | "favorite")}>
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="message">문구 작성</TabsTrigger>
                    <TabsTrigger value="favorite">즐겨찾기</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="message" className="space-y-4">
                    <div className="space-y-2">
                      <Label>방송 문구</Label>
                      <Textarea
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        placeholder="방송할 문구를 입력하세요..."
                        className="min-h-[120px] text-base"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>음성 선택</Label>
                      <Select value={selectedVoiceId} onValueChange={setSelectedVoiceId}>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="음성을 선택하세요">
                            {selectedVoiceId && (() => {
                              const selectedVoice = availableVoices.find(v => v.voice_id === selectedVoiceId);
                              return selectedVoice 
                                ? getVoiceDisplayNameKo(selectedVoice.name, selectedVoice.voice_id, selectedVoice.name_ko)
                                : "음성을 선택하세요";
                            })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {availableVoices.slice(0, 20).map((voice) => {
                            const isFavorite = favoriteVoiceIds.has(voice.voice_id);
                            return (
                              <SelectItem key={voice.voice_id} value={voice.voice_id}>
                                <div className="flex items-center gap-2">
                                  {isFavorite && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                                  <span>{getVoiceDisplayNameKo(voice.name, voice.voice_id, voice.name_ko)}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <Button
                      onClick={handleGenerateAudio}
                      disabled={!customText.trim() || !selectedVoiceId || isGenerating}
                      className="w-full h-12"
                      variant="default"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          음원 생성 중...
                        </>
                      ) : (
                        <>
                          <Mic2 className="w-4 h-4 mr-2" />
                          음원 생성
                        </>
                      )}
                    </Button>
                    
                    {/* 생성된 음원 미리듣기 */}
                    {generatedAudioUrl && selectedGenerationId && (
                      <div className="space-y-2 pt-4 border-t">
                        <Label>생성된 음원 미리듣기</Label>
                        <AudioPlayer
                          key={`${selectedGenerationId}-${generatedAudioUrl}`}
                          audioUrl={generatedAudioUrl}
                          title={scheduleName || "긴급 방송"}
                          className="w-full"
                          onError={handleAudioError}
                          cacheKey={selectedGenerationId}
                        />
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="favorite" className="space-y-4">
                    <div className="space-y-2">
                      <Label>즐겨찾기 문구</Label>
                      <div className="max-h-[200px] md:max-h-[300px] overflow-y-auto space-y-2">
                        {favoriteMessages.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            즐겨찾기 문구가 없습니다
                          </div>
                        ) : (
                          favoriteMessages.map((msg) => (
                            <div
                              key={msg.id}
                              onClick={() => handleSelectMessage(msg)}
                              className="p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <Badge 
                                    variant="outline" 
                                    className={cn("text-xs mb-2", getPurposeColor(msg.purpose || ""))}
                                  >
                                    {msg.purposeLabel || "문구"}
                                  </Badge>
                                  <p className="text-sm line-clamp-2">{msg.text}</p>
                                </div>
                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>즐겨찾기 음원</Label>
                      <div className="max-h-[200px] md:max-h-[300px] overflow-y-auto space-y-2">
                        {favoriteGenerations.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            즐겨찾기 음원이 없습니다
                          </div>
                        ) : (
                          favoriteGenerations.map((gen) => (
                            <div
                              key={gen.id}
                              onClick={() => handleSelectGeneration(gen)}
                              className={cn(
                                "p-3 rounded-lg border cursor-pointer transition-colors",
                                selectedGenerationId === String(gen.id)
                                  ? "bg-primary/10 border-primary"
                                  : "bg-card hover:bg-muted/50"
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className="text-xs">
                                      {gen.purposeLabel || "음원"}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {gen.voiceName || "음성"}
                                    </span>
                                  </div>
                                  <p className="text-sm font-medium">{gen.savedName || "음원"}</p>
                                  {gen.textPreview && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                      {gen.textPreview}
                                    </p>
                                  )}
                                </div>
                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    
                    {/* 선택된 음원 미리듣기 */}
                    {generatedAudioUrl && selectedGenerationId && (
                      <div className="space-y-2 pt-4 border-t">
                        <Label>선택된 음원 미리듣기</Label>
                        <AudioPlayer
                          key={`${selectedGenerationId}-${generatedAudioUrl}`}
                          audioUrl={generatedAudioUrl}
                          title={scheduleName || "선택된 음원"}
                          className="w-full"
                          onError={handleAudioError}
                          cacheKey={selectedGenerationId}
                        />
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            
            {/* 송출 설정 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Send className="w-5 h-5" />
                  송출 설정
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>스케줄명</Label>
                  <Input
                    value={scheduleName}
                    onChange={(e) => setScheduleName(e.target.value)}
                    placeholder="긴급 방송"
                    className="h-12"
                  />
                </div>
                
                <div className="space-y-3">
                  <Label>송출 방식</Label>
                  <RadioGroup value={scheduleType} onValueChange={(v) => setScheduleType(v as "immediate" | "delayed")}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="immediate" id="immediate" />
                      <Label htmlFor="immediate" className="flex items-center gap-2 cursor-pointer">
                        <Zap className="w-4 h-4" />
                        즉시 송출
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="delayed" id="delayed" />
                      <Label htmlFor="delayed" className="flex items-center gap-2 cursor-pointer">
                        <Clock className="w-4 h-4" />
                        지연 송출
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                
                {scheduleType === "delayed" && (
                  <div className="space-y-2">
                    <Label>지연 시간 (분)</Label>
                    <Select 
                      value={String(delayMinutes)} 
                      onValueChange={(v) => setDelayMinutes(parseInt(v))}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1분</SelectItem>
                        <SelectItem value="3">3분</SelectItem>
                        <SelectItem value="5">5분</SelectItem>
                        <SelectItem value="10">10분</SelectItem>
                        <SelectItem value="15">15분</SelectItem>
                        <SelectItem value="30">30분</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <Button
                  onClick={handleBroadcast}
                  disabled={!selectedGenerationId || !selectedChannelId || isSubmitting}
                  className="w-full h-14 text-lg font-semibold"
                  variant="default"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      송출 중...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      {scheduleType === "immediate" ? "즉시 송출" : `${delayMinutes}분 후 송출`}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
            
            {/* 선택된 음원 표시 */}
            {selectedGenerationId && (
              <Card className="border-primary/50 bg-primary/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="font-medium">선택된 음원:</span>
                    <span>{scheduleName || "음원"}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </PageContainer>
      </AppShell>
    </ProtectedRoute>
  );
}

