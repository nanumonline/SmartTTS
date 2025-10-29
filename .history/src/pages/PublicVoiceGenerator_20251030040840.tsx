import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
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
  CheckCircle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import AudioPlayer from "@/components/AudioPlayer";

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
    setCustomText(template.template);
  };

  // Supertone API에서 음성 목록 가져오기 (Supabase Edge Function 프록시 사용)
  // 참고: https://docs.supertoneapi.com/en/user-guide/voice-selection
  const fetchVoices = async () => {
    setIsLoadingVoices(true);
    try {
      const SUPABASE_URL = "https://gxxralruivyhdxyftsrg.supabase.co";
      const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4eHJhbHJ1aXZ5aGR4eWZ0c3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NDM0MzQsImV4cCI6MjA3NzIxOTQzNH0.6lJjJq15spXWrktl-8d5qXI3L5FHkyaEArWiH2R5AjA";
      const proxyUrl = `${SUPABASE_URL}/functions/v1/supertone-proxy/voices`;
      const response = await fetch(proxyUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
      });
      if (response.ok) {
        const data = await response.json();
        const voices = Array.isArray(data) ? data : data.voices || [];
        const koreanVoices = voices.filter((v: any) => v.language?.includes("ko") || !v.language);
        setAvailableVoices(koreanVoices.length > 0 ? koreanVoices : voices);
        console.log(`✅ 음성 목록 로드 성공: ${voices.length}개`);
      } else {
        console.warn("음성 목록 로드 실패:", await response.text());
      }
    } catch (e: any) {
      console.warn("음성 목록 로드 예외:", e.message);
    } finally {
      setIsLoadingVoices(false);
    }
  };

  // 컴포넌트 마운트 시 음성 목록 로드
  useEffect(() => {
    fetchVoices();
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
      const SUPABASE_URL = "https://gxxralruivyhdxyftsrg.supabase.co";
      const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4eHJhbHJ1aXZ5aGR4eWZ0c3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NDM0MzQsImV4cCI6MjA3NzIxOTQzNH0.6lJjJq15spXWrktl-8d5qXI3L5FHkyaEArWiH2R5AjA";
      const proxyUrl = `${SUPABASE_URL}/functions/v1/supertone-proxy/predict-duration/${voiceId}`;
      const response = await fetch(proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ text, language: "ko", style: "neutral" }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.duration || null;
      }
    } catch (error) {}
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
    if (!customText.trim()) {
      alert("텍스트를 입력해주세요.");
      return;
    }

    setIsGenerating(true);
    
    try {
      // Supertone API 호출
      // 참고: https://docs.supertoneapi.com/en/api-reference/introduction
      // 엔드포인트: POST /v1/text-to-speech/{voice_id}
      // 헤더: x-sup-api-key
      
      if (!selectedVoice) {
        alert("음성 스타일을 선택해주세요.");
        setIsGenerating(false);
        return;
      }

      // Supertone API 호출
      // 참고: https://docs.supertoneapi.com/en/user-guide/quickstart
      // CORS 문제 해결: Supabase Edge Function 프록시 사용
      const useProxy = true; // Supabase 프록시 활성화
      
      const possibleBaseUrls = [
        "https://api.supertoneapi.com/v1",
        "https://api.supertoneapi.com",
        "https://api.supertone.ai/v1",
        "https://api.supertone.ai",
      ];
      
      let lastError: Error | null = null;
      let response: Response | null = null;
      let lastEndpoint = "";
      
      // 텍스트 길이 확인 (최대 300자)
      if (customText.length > 300) {
        alert(`텍스트가 너무 깁니다. 최대 300자까지 입력 가능합니다. (현재: ${customText.length}자)`);
        setIsGenerating(false);
        return;
      }

      // 1. Supabase Edge Function 프록시를 통한 호출 시도 (CORS 해결)
      if (useProxy) {
        try {
          console.log("Supabase 프록시를 통해 Supertone API 호출 시도");
          
          const styleValue = voiceSettings.emotion.customPrompt || 
                            (voiceSettings.emotion.preset === "A" ? "neutral" : 
                             voiceSettings.emotion.preset === "B" ? "happy" : "neutral");
          
          const requestBody = {
            text: customText,
            language: "ko",
            style: styleValue,
            model: "sona_speech_1",
            voice_settings: {
              pitch_shift: Math.max(-12, Math.min(12, Math.round(voiceSettings.pitch / 8.33))),
              pitch_variance: 1,
              speed: voiceSettings.readingSpeed.preset === "빠름" ? 1.3 : 
                     voiceSettings.readingSpeed.preset === "느림" ? 0.7 : 1.0,
            },
          };
          
          // Supabase Edge Function 호출
          // URL을 통해 voice_id 전달을 위해 직접 fetch 사용
          const SUPABASE_URL = "https://gxxralruivyhdxyftsrg.supabase.co";
          const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4eHJhbHJ1aXZ5aGR4eWZ0c3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NDM0MzQsImV4cCI6MjA3NzIxOTQzNH0.6lJjJq15spXWrktl-8d5qXI3L5FHkyaEArWiH2R5AjA";
          const proxyUrl = `${SUPABASE_URL}/functions/v1/supertone-proxy/text-to-speech/${selectedVoice}?output_format=mp3`;
          
          console.log("Supabase 프록시 URL:", proxyUrl);
          
          const proxyResponse = await fetch(proxyUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify(requestBody),
          });
          
          if (proxyResponse.ok) {
            // 프록시 성공
            console.log("✅ Supabase 프록시 성공");
            
            // 응답이 오디오 Blob인 경우 처리
            const contentType = proxyResponse.headers.get("content-type") || "";
            
            if (contentType.includes("audio") || contentType.includes("mpeg") || contentType.includes("wav")) {
              const blob = await proxyResponse.blob();
              const audioUrl = URL.createObjectURL(blob);
              setGeneratedAudio(audioUrl);
              
              // X-Audio-Length 헤더 확인
              const audioLengthHeader = proxyResponse.headers.get("X-Audio-Length") || proxyResponse.headers.get("x-audio-length");
              const audioDuration = audioLengthHeader ? parseFloat(audioLengthHeader) : null;
              
              // 예상 길이 사용 또는 추정
              const finalDuration = audioDuration ?? predictedDuration ?? 
                (customText.length * 0.1 / (voiceSettings.readingSpeed.preset === "빠름" ? 1.3 : voiceSettings.readingSpeed.preset === "느림" ? 0.7 : 1.0));
              setGeneratedDuration(Math.round(finalDuration * 100) / 100);
              
              toast({
                title: "✅ 음성 생성 완료",
                description: `오디오 길이: ${finalDuration.toFixed(2)}초 | 형식: MP3`,
              });
              
              setPredictedDuration(null);
              setIsGenerating(false);
              return;
            } else {
              // JSON 에러 응답인 경우
              const errorData = await proxyResponse.json();
              throw new Error(errorData.error || "프록시 오류");
            }
          } else {
            // HTTP 오류
            const errorText = await proxyResponse.text();
            throw new Error(`프록시 오류 (${proxyResponse.status}): ${errorText}`);
          }
        } catch (proxyError: any) {
          console.warn("Supabase 프록시 실패, 직접 호출 시도:", proxyError.message);
          // 프록시 실패 시 직접 호출로 진행
        }
      }

      // Supertone API 응답: WAV 오디오 파일 스트림
      // X-Audio-Length 헤더에 오디오 길이(초)가 포함됨
      const audioLengthHeader = response.headers.get("X-Audio-Length") || response.headers.get("x-audio-length");
      const audioDuration = audioLengthHeader ? parseFloat(audioLengthHeader) : null;
      
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      
      // 오디오 길이 설정 (헤더 값이 있으면 사용, 없으면 추정)
      const finalDuration = audioDuration ?? 
        (customText.length * 0.1 / (voiceSettings.readingSpeed.preset === "빠름" ? 1.3 : voiceSettings.readingSpeed.preset === "느림" ? 0.7 : 1.0));
      
      setGeneratedAudio(audioUrl);
      setGeneratedDuration(Math.round(finalDuration * 100) / 100);
      
      // 성공 메시지
      toast({
        title: "✅ 음성 생성 완료",
        description: `오디오 길이: ${finalDuration.toFixed(2)}초 | 형식: MP3`,
      });
      
      // 예상 길이 초기화 (실제 생성 완료)
      setPredictedDuration(null);
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
                  }}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="음성 스타일을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* API에서 가져온 실제 음성 목록 */}
                      {availableVoices.length > 0 ? (
                        availableVoices.map((voice: any) => {
                          const voiceName = voice.name || voice.voice_id;
                          const languages = Array.isArray(voice.language) ? voice.language.join(", ") : voice.language || "ko";
                          const styles = Array.isArray(voice.styles) ? voice.styles.join(", ") : voice.styles || "neutral";
                          
                          return (
                            <SelectItem key={voice.voice_id} value={voice.voice_id}>
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4" />
                                <div>
                                  <div className="font-medium">{voiceName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    언어: {languages} | 스타일: {styles}
                                  </div>
                                </div>
                              </div>
                            </SelectItem>
                          );
                        })
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
                  
                  {/* 선택된 음성 상세 정보 및 샘플 재생 */}
                  {selectedVoiceInfo && selectedVoiceInfo.samples && selectedVoiceInfo.samples.length > 0 && (
                    <div className="mt-4 p-4 border border-border rounded-lg bg-muted/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-sm">{selectedVoiceInfo.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            언어: {Array.isArray(selectedVoiceInfo.language) ? selectedVoiceInfo.language.join(", ") : selectedVoiceInfo.language}
                            {" | "}
                            스타일: {Array.isArray(selectedVoiceInfo.styles) ? selectedVoiceInfo.styles.join(", ") : selectedVoiceInfo.styles}
                          </p>
                        </div>
                      </div>
                      
                      {/* 샘플 오디오 목록 */}
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">샘플 오디오:</p>
                        <div className="grid grid-cols-1 gap-2">
                          {selectedVoiceInfo.samples.slice(0, 3).map((sample: any, index: number) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-background rounded border border-border">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {sample.language} - {sample.style}
                                </Badge>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (playingSample === sample.url) {
                                    setPlayingSample(null);
                                  } else {
                                    setPlayingSample(sample.url);
                                  }
                                }}
                              >
                                {playingSample === sample.url ? (
                                  <Pause className="w-3 h-3" />
                                ) : (
                                  <Play className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          ))}
                        </div>
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

        {/* 사용 가이드 */}
        <div className="mt-8">
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
    </div>
  );
};

export default PublicVoiceGenerator;
