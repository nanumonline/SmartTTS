import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { voiceGenerationService, VoiceGenerationRequest } from "@/services/voiceGenerationService";
import AudioPlayer from "@/components/AudioPlayer";
import HomeButton from "@/components/HomeButton";
import { 
  Mic2, 
  Play, 
  Pause, 
  Download, 
  Volume2, 
  Settings,
  Info,
  Plus,
  Minus,
  Clock,
  Zap,
  Music,
  Palette,
  Type,
  Headphones,
  Star,
  Lock,
  CheckCircle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const AdvancedVoiceGenerator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [generatedDuration, setGeneratedDuration] = useState<number>(0);

  // 음성 설정 상태
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

  // 화자 목록
  const voices = [
    {
      id: "jiyun",
      name: "지윤",
      description: "자연스러운 여성 목소리",
      avatar: "👩",
      isPro: true,
      category: "여성"
    },
    {
      id: "male_anchor_1",
      name: "앵커 스타일 남성 1",
      description: "뉴스 앵커 톤 - 도지사, 시장용",
      avatar: "👨",
      isPro: false,
      category: "남성"
    },
    {
      id: "female_anchor_1",
      name: "아나운서 스타일 여성 1",
      description: "뉴스 아나운서 톤 - 부시장, 부지사용",
      avatar: "👩",
      isPro: false,
      category: "여성"
    }
  ];

  const handleGenerateVoice = async () => {
    if (!text.trim()) {
      toast({
        title: "텍스트를 입력해주세요",
        description: "음성으로 변환할 텍스트를 입력해야 합니다.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      const request: VoiceGenerationRequest = {
        text,
        voice: selectedVoice,
        settings: voiceSettings
      };

      const response = await voiceGenerationService.generateVoice(request);
      
      if (response.success && response.audioUrl) {
        setGeneratedAudio(response.audioUrl);
        setGeneratedDuration(response.duration || 0);
        toast({
          title: "음성 생성 완료!",
          description: "고품질 음성이 성공적으로 생성되었습니다.",
        });
      } else {
        toast({
          title: "음성 생성 실패",
          description: response.error || "음성 생성 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("음성 생성 오류:", error);
      toast({
        title: "음성 생성 오류",
        description: "음성 생성 중 오류가 발생했습니다.",
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
      const filename = `advanced_voice_${Date.now()}.wav`;
      await voiceGenerationService.downloadAudio(generatedAudio, filename);
    } catch (error) {
      console.error("다운로드 오류:", error);
      toast({
        title: "다운로드 오류",
        description: "다운로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const addPauseSegment = () => {
    setVoiceSettings(prev => ({
      ...prev,
      pause: {
        ...prev.pause,
        segments: [...prev.pause.segments, { start: 0, end: 0, duration: 0.5 }]
      }
    }));
  };

  const updateEmotionPreset = (preset: string) => {
    setVoiceSettings(prev => ({
      ...prev,
      emotion: {
        ...prev.emotion,
        preset
      }
    }));
  };

  const updateReadingSpeedPreset = (preset: string) => {
    setVoiceSettings(prev => ({
      ...prev,
      readingSpeed: {
        ...prev.readingSpeed,
        preset
      }
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold gradient-text">고급 음성 생성</h1>
              <p className="text-muted-foreground mt-1">세밀한 음성 조절로 완벽한 음성 생성</p>
              {user && (
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Settings className="w-4 h-4" />
                  <span>{user.organization}</span>
                  {user.department && <span>• {user.department}</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <HomeButton />
              <Badge variant="outline" className="px-3 py-1">
                <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                고급 기능
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 메인 음성 생성 영역 */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mic2 className="w-5 h-5" />
                  음성 생성
                </CardTitle>
                <CardDescription>
                  텍스트를 입력하고 고급 설정으로 음성을 생성하세요
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 텍스트 입력 */}
                <div className="space-y-2">
                  <Label htmlFor="text">변환할 텍스트</Label>
                  <Textarea
                    id="text"
                    placeholder="여기에 텍스트를 입력하세요..."
                    className="min-h-32 resize-none"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                  <div className="text-xs text-muted-foreground text-right">
                    {text.length} / 5000자
                  </div>
                </div>

                {/* 화자 선택 */}
                <div className="space-y-2">
                  <Label htmlFor="voice">화자 선택</Label>
                  <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                    <SelectTrigger>
                      <SelectValue placeholder="화자를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {voices.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                              <span className="text-lg">{voice.avatar}</span>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{voice.name}</span>
                                {voice.isPro && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Lock className="w-3 h-3 mr-1" />
                                    PRO
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">{voice.description}</div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 생성 버튼 */}
                <Button 
                  onClick={handleGenerateVoice}
                  disabled={isGenerating || !text.trim() || !selectedVoice}
                  className="w-full h-12"
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
                  <AudioPlayer
                    audioUrl={generatedAudio}
                    title="생성된 음성"
                    duration={generatedDuration}
                    onDownload={handleDownload}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* 고급 설정 사이드바 */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  고급 설정
                </CardTitle>
                <CardDescription>
                  음성의 세부적인 특성을 조절하세요
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Tabs defaultValue="voice" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="voice">음성</TabsTrigger>
                    <TabsTrigger value="apply">전체 적용</TabsTrigger>
                  </TabsList>

                  <TabsContent value="voice" className="space-y-6 mt-4">
                    {/* 감정 설정 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium">PRO 감정</Label>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">선택 입력</span>
                          <Info className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">일반</span>
                          <div className="flex gap-1">
                            {["A", "B", "C", "D"].map((preset) => (
                              <Button
                                key={preset}
                                size="sm"
                                variant={voiceSettings.emotion.preset === preset ? "default" : "outline"}
                                className="w-8 h-8 p-0"
                                onClick={() => updateEmotionPreset(preset)}
                              >
                                {preset}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">프롬프트</span>
                          <Info className="w-4 h-4 text-muted-foreground" />
                          <Badge variant="secondary" className="text-xs">Beta</Badge>
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
                    </div>

                    {/* 읽는 속도 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium">PRO 읽는 속도</Label>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">읽는 속도 선택</span>
                          <Info className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex gap-2">
                          {["느림", "보통", "빠름"].map((speed) => (
                            <Button
                              key={speed}
                              size="sm"
                              variant={voiceSettings.readingSpeed.preset === speed ? "default" : "outline"}
                              onClick={() => updateReadingSpeedPreset(speed)}
                            >
                              {speed}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">읽는 시간 입력</span>
                          <Info className="w-4 h-4 text-muted-foreground" />
                          <Badge variant="secondary" className="text-xs">Beta</Badge>
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
                    </div>

                    {/* 끊어 읽기 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium">끊어 읽기</Label>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </div>
                      
                      <div className="space-y-2">
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
                          <div className="flex items-center gap-2">
                            <span className="text-sm w-12">{voiceSettings.pause.duration}초</span>
                            <Button size="sm">적용</Button>
                          </div>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>0초</span>
                          <span>10.0초</span>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addPauseSegment}
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        구간 추가하기
                      </Button>
                    </div>

                    {/* 끝음 조절 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium">PRO 끝음 조절</Label>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm">자동</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setVoiceSettings(prev => ({
                            ...prev,
                            endingTone: { mode: prev.endingTone.mode === "auto" ? "manual" : "auto" }
                          }))}
                        >
                          직접 조절
                        </Button>
                      </div>
                    </div>

                    {/* 재생 속도 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium">PRO 재생 속도</Label>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </div>
                      
                      <div className="space-y-2">
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
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>0.5배</span>
                          <span>1배</span>
                          <span>1.5배</span>
                          <span>2배</span>
                        </div>
                      </div>
                    </div>

                    {/* 피치 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium">PRO 피치</Label>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </div>
                      
                      <div className="space-y-2">
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
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>낮게</span>
                          <span>보통</span>
                          <span>높게</span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="apply" className="space-y-4 mt-4">
                    <div className="text-center text-muted-foreground">
                      <Settings className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">전체 적용 기능은 준비 중입니다.</p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedVoiceGenerator;
