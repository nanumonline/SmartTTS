import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import AudioPlayer from "@/components/AudioPlayer";
import { 
  Mic2, 
  Play, 
  Pause, 
  Upload, 
  Download, 
  Volume2, 
  Clock, 
  Users,
  Building2,
  Megaphone,
  FileText,
  Settings,
  Plus,
  Edit,
  Trash2,
  Star,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const VoiceCloning = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("library");
  const [selectedGender, setSelectedGender] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [voiceName, setVoiceName] = useState("");
  const [clonedVoices, setClonedVoices] = useState<any[]>([]);
  const [previewAudio, setPreviewAudio] = useState<string | null>(null);
  
  // 음성학습 관련 상태
  const [learningMethod, setLearningMethod] = useState<"record" | "upload" | "youtube">("record");
  const [recordingText, setRecordingText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isProcessingYoutube, setIsProcessingYoutube] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 화자 카테고리 정의
  const speakerCategories = {
    male: [
      {
        id: "formal_male",
        name: "정중한 남성",
        description: "도지사, 시장 등 지자체장용",
        icon: Building2,
        speakers: [
          { id: "anchor_male_1", name: "앵커 스타일 1", description: "뉴스 앵커 톤", quality: "high", isCustom: false },
          { id: "anchor_male_2", name: "앵커 스타일 2", description: "정치 앵커 톤", quality: "high", isCustom: false },
          { id: "formal_male_1", name: "정중한 남성 1", description: "공식 발표 톤", quality: "high", isCustom: false },
          { id: "custom_male_1", name: "김철수 목소리", description: "강원도지사", quality: "medium", isCustom: true }
        ]
      },
      {
        id: "professional_male",
        name: "전문적인 남성",
        description: "연구원장, 공단 이사장용",
        icon: FileText,
        speakers: [
          { id: "expert_male_1", name: "전문가 스타일 1", description: "학술 발표 톤", quality: "high", isCustom: false },
          { id: "expert_male_2", name: "전문가 스타일 2", description: "연구 발표 톤", quality: "high", isCustom: false },
          { id: "director_male_1", name: "기관장 스타일 1", description: "기관장 발표 톤", quality: "medium", isCustom: false }
        ]
      },
      {
        id: "friendly_male",
        name: "친근한 남성",
        description: "일반 안내방송용",
        icon: Megaphone,
        speakers: [
          { id: "guide_male_1", name: "안내방송 스타일 1", description: "친근한 안내 톤", quality: "high", isCustom: false },
          { id: "guide_male_2", name: "안내방송 스타일 2", description: "명확한 안내 톤", quality: "high", isCustom: false },
          { id: "service_male_1", name: "서비스 안내 스타일", description: "고객 서비스 톤", quality: "medium", isCustom: false }
        ]
      }
    ],
    female: [
      {
        id: "formal_female",
        name: "정중한 여성",
        description: "부시장, 부지사용",
        icon: Users,
        speakers: [
          { id: "anchor_female_1", name: "아나운서 스타일 1", description: "뉴스 아나운서 톤", quality: "high", isCustom: false },
          { id: "anchor_female_2", name: "아나운서 스타일 2", description: "정치 아나운서 톤", quality: "high", isCustom: false },
          { id: "weather_female_1", name: "기상 아나운서 스타일", description: "기상청 아나운서 톤", quality: "high", isCustom: false },
          { id: "formal_female_1", name: "정중한 여성 1", description: "공식 발표 톤", quality: "medium", isCustom: false }
        ]
      },
      {
        id: "professional_female",
        name: "전문적인 여성",
        description: "연구소장, 공사 사장용",
        icon: FileText,
        speakers: [
          { id: "expert_female_1", name: "전문가 스타일 1", description: "학술 발표 톤", quality: "high", isCustom: false },
          { id: "expert_female_2", name: "전문가 스타일 2", description: "연구 발표 톤", quality: "high", isCustom: false },
          { id: "director_female_1", name: "기관장 스타일 1", description: "기관장 발표 톤", quality: "medium", isCustom: false }
        ]
      },
      {
        id: "friendly_female",
        name: "친근한 여성",
        description: "일반 안내방송용",
        icon: Megaphone,
        speakers: [
          { id: "guide_female_1", name: "안내방송 스타일 1", description: "친근한 안내 톤", quality: "high", isCustom: false },
          { id: "guide_female_2", name: "안내방송 스타일 2", description: "명확한 안내 톤", quality: "high", isCustom: false },
          { id: "service_female_1", name: "서비스 안내 스타일", description: "고객 서비스 톤", quality: "medium", isCustom: false }
        ]
      }
    ]
  };

  // 녹음 시작
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudio(audioUrl);
        setPreviewAudio(audioUrl);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      toast({
        title: "녹음 시작",
        description: "텍스트를 읽어주세요. 녹음이 진행 중입니다.",
      });
    } catch (error) {
      console.error("녹음 시작 오류:", error);
      toast({
        title: "녹음 오류",
        description: "마이크 접근 권한을 확인해주세요.",
        variant: "destructive",
      });
    }
  };

  // 녹음 중지
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      toast({
        title: "녹음 완료",
        description: "녹음이 완료되었습니다.",
      });
    }
  };

  // 유튜브 URL 처리
  const handleYoutubeProcess = async () => {
    if (!youtubeUrl.trim()) {
      toast({
        title: "URL을 입력해주세요",
        description: "유튜브 영상 URL을 입력해야 합니다.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingYoutube(true);
    
    try {
      // 실제로는 서버에서 유튜브 영상의 오디오를 추출하는 API 호출
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 시뮬레이션된 오디오 URL
      const extractedAudioUrl = "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBzqO0fPTgjMGHm7A7+OZURE=";
      
      setPreviewAudio(extractedAudioUrl);
      setRecordedAudio(extractedAudioUrl);
      
      toast({
        title: "오디오 추출 완료",
        description: "유튜브 영상에서 오디오가 성공적으로 추출되었습니다.",
      });
    } catch (error) {
      console.error("유튜브 처리 오류:", error);
      toast({
        title: "오디오 추출 실패",
        description: "유튜브 영상 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingYoutube(false);
    }
  };

  // 파일 업로드 처리
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      
      // 파일 미리보기 URL 생성
      const previewUrl = URL.createObjectURL(file);
      setPreviewAudio(previewUrl);
      
      toast({
        title: "파일 업로드 완료",
        description: `${file.name} 파일이 업로드되었습니다.`,
      });
    }
  };

  const handleStartTraining = async () => {
    if (!voiceName || !selectedGender || !selectedCategory) {
      toast({
        title: "필수 정보를 입력해주세요",
        description: "화자 이름, 성별, 카테고리를 모두 입력해야 합니다.",
        variant: "destructive",
      });
      return;
    }

    if (!previewAudio) {
      toast({
        title: "음성 데이터가 없습니다",
        description: "녹음, 파일 업로드, 또는 유튜브 처리를 먼저 완료해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsTraining(true);
    setTrainingProgress(0);

    // TODO: 실제 AI 학습 API 호출
    const interval = setInterval(() => {
      setTrainingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsTraining(false);
          return 100;
        }
        return prev + 10;
      });
    }, 500);
  };

  const handleGenerateSpeaker = async () => {
    setIsGenerating(true);
    
    // TODO: 실제 AI 화자 생성 API 호출
    setTimeout(() => {
      setIsGenerating(false);
    }, 2000);
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case "high": return "text-green-500";
      case "medium": return "text-yellow-500";
      case "low": return "text-red-500";
      default: return "text-gray-500";
    }
  };

  const getQualityIcon = (quality: string) => {
    switch (quality) {
      case "high": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "medium": return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case "low": return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold gradient-text">보이스 클로닝</h1>
              <p className="text-muted-foreground mt-1">AI 화자 생성 및 음성 학습</p>
              {user && (
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="w-4 h-4" />
                  <span>{user.organization}</span>
                  {user.department && <span>• {user.department}</span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="px-3 py-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                AI 화자 생성
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="library">화자 라이브러리</TabsTrigger>
            <TabsTrigger value="create">화자 생성</TabsTrigger>
            <TabsTrigger value="training">음성 학습</TabsTrigger>
          </TabsList>

          {/* 화자 라이브러리 */}
          <TabsContent value="library" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 남성 화자 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    남성 화자
                  </CardTitle>
                  <CardDescription>
                    다양한 남성 화자 스타일을 선택하세요
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {speakerCategories.male.map((category) => (
                    <div key={category.id} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <category.icon className="w-4 h-4 text-primary" />
                        <h3 className="font-medium">{category.name}</h3>
                        <Badge variant="secondary" className="text-xs">
                          {category.speakers.length}개
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {category.speakers.map((speaker) => (
                          <Card 
                            key={speaker.id}
                            className="cursor-pointer hover:shadow-md transition-all"
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                                    <Volume2 className="w-4 h-4 text-blue-500" />
                                  </div>
                                  <div>
                                    <h4 className="font-medium text-sm">{speaker.name}</h4>
                                    <p className="text-xs text-muted-foreground">{speaker.description}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {getQualityIcon(speaker.quality)}
                                  {speaker.isCustom && (
                                    <Badge variant="outline" className="text-xs">
                                      커스텀
                                    </Badge>
                                  )}
                                  <Button size="sm" variant="ghost">
                                    <Play className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* 여성 화자 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-pink-500" />
                    여성 화자
                  </CardTitle>
                  <CardDescription>
                    다양한 여성 화자 스타일을 선택하세요
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {speakerCategories.female.map((category) => (
                    <div key={category.id} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <category.icon className="w-4 h-4 text-primary" />
                        <h3 className="font-medium">{category.name}</h3>
                        <Badge variant="secondary" className="text-xs">
                          {category.speakers.length}개
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {category.speakers.map((speaker) => (
                          <Card 
                            key={speaker.id}
                            className="cursor-pointer hover:shadow-md transition-all"
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-pink-50 rounded-lg flex items-center justify-center">
                                    <Volume2 className="w-4 h-4 text-pink-500" />
                                  </div>
                                  <div>
                                    <h4 className="font-medium text-sm">{speaker.name}</h4>
                                    <p className="text-xs text-muted-foreground">{speaker.description}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {getQualityIcon(speaker.quality)}
                                  {speaker.isCustom && (
                                    <Badge variant="outline" className="text-xs">
                                      커스텀
                                    </Badge>
                                  )}
                                  <Button size="sm" variant="ghost">
                                    <Play className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 화자 생성 */}
          <TabsContent value="create" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  AI 화자 생성
                </CardTitle>
                <CardDescription>
                  AI가 새로운 화자 스타일을 생성합니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 기본 정보 입력 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="voiceName">화자 이름</Label>
                    <Input
                      id="voiceName"
                      placeholder="예: 강원도지사 김철수"
                      value={voiceName}
                      onChange={(e) => setVoiceName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">성별</Label>
                    <Select value={selectedGender} onValueChange={setSelectedGender}>
                      <SelectTrigger>
                        <SelectValue placeholder="성별을 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">남성</SelectItem>
                        <SelectItem value="female">여성</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">카테고리</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="카테고리를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedGender && speakerCategories[selectedGender as keyof typeof speakerCategories]?.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            <div className="flex items-center gap-2">
                              <category.icon className="w-4 h-4" />
                              <div>
                                <div className="font-medium">{category.name}</div>
                                <div className="text-xs text-muted-foreground">{category.description}</div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 음성학습 방법 선택 */}
                <div className="space-y-4">
                  <Label className="text-base font-medium">음성학습 방법</Label>
                  <Tabs value={learningMethod} onValueChange={(value) => setLearningMethod(value as "record" | "upload" | "youtube")}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="record">텍스트 녹음</TabsTrigger>
                      <TabsTrigger value="upload">파일 업로드</TabsTrigger>
                      <TabsTrigger value="youtube">유튜브 영상</TabsTrigger>
                    </TabsList>

                    {/* 텍스트 녹음 */}
                    <TabsContent value="record" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="recordingText">녹음할 텍스트</Label>
                        <Textarea
                          id="recordingText"
                          placeholder="예: 안녕하십니까. 강원특별자치도 도지사 김철수입니다. 시민 여러분의 건강과 행복을 위해 최선을 다하겠습니다."
                          value={recordingText}
                          onChange={(e) => setRecordingText(e.target.value)}
                          className="min-h-24"
                        />
                        <p className="text-xs text-muted-foreground">
                          위 텍스트를 자연스럽게 읽어주세요. 명확하고 일정한 속도로 발음해주시면 더 좋은 결과를 얻을 수 있습니다.
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {!isRecording ? (
                          <Button 
                            onClick={startRecording}
                            disabled={!recordingText.trim()}
                            variant="gradient"
                            className="flex items-center gap-2"
                          >
                            <Mic2 className="w-4 h-4" />
                            녹음 시작
                          </Button>
                        ) : (
                          <Button 
                            onClick={stopRecording}
                            variant="destructive"
                            className="flex items-center gap-2"
                          >
                            <Pause className="w-4 h-4" />
                            녹음 중지
                          </Button>
                        )}
                        
                        {isRecording && (
                          <div className="flex items-center gap-2 text-red-500">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                            <span className="text-sm">녹음 중...</span>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    {/* 파일 업로드 */}
                    <TabsContent value="upload" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="audioFile">음성 파일 업로드</Label>
                        <Input
                          id="audioFile"
                          type="file"
                          accept=".wav,.mp3,.m4a,.aac"
                          onChange={handleFileUpload}
                        />
                        <p className="text-xs text-muted-foreground">
                          지원 형식: WAV, MP3, M4A, AAC (최대 50MB, 최소 10초 이상 권장)
                        </p>
                      </div>
                    </TabsContent>

                    {/* 유튜브 영상 */}
                    <TabsContent value="youtube" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="youtubeUrl">유튜브 영상 URL</Label>
                        <Input
                          id="youtubeUrl"
                          placeholder="https://www.youtube.com/watch?v=..."
                          value={youtubeUrl}
                          onChange={(e) => setYoutubeUrl(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          유튜브 영상에서 음성을 추출하여 학습에 사용합니다. (최대 10분 영상 권장)
                        </p>
                      </div>
                      
                      <Button 
                        onClick={handleYoutubeProcess}
                        disabled={!youtubeUrl.trim() || isProcessingYoutube}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        {isProcessingYoutube ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                            오디오 추출 중...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            오디오 추출하기
                          </>
                        )}
                      </Button>
                    </TabsContent>
                  </Tabs>
                </div>

                {/* 음성 미리보기 */}
                {previewAudio && (
                  <div className="space-y-2">
                    <Label>음성 미리보기</Label>
                    <AudioPlayer
                      audioUrl={previewAudio}
                      title="학습용 음성"
                      duration={0}
                    />
                  </div>
                )}

                {/* 학습 진행률 */}
                {isTraining && (
                  <div className="space-y-2">
                    <Label>AI 학습 진행률</Label>
                    <Progress value={trainingProgress} className="h-2" />
                    <p className="text-sm text-muted-foreground text-center">
                      {trainingProgress}% 완료 (약 5-10분 소요)
                    </p>
                  </div>
                )}

                <Button 
                  onClick={handleGenerateSpeaker}
                  disabled={isGenerating || !selectedGender || !selectedCategory}
                  className="w-full"
                  variant="gradient"
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      AI 화자 생성 중...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      새로운 화자 생성하기
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 음성 학습 */}
          <TabsContent value="training" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  음성 학습
                </CardTitle>
                <CardDescription>
                  음성 샘플을 업로드하여 커스텀 화자를 생성합니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="speakerName">화자 이름</Label>
                    <Input
                      id="speakerName"
                      placeholder="예: 김철수 목소리"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="speakerDescription">화자 설명</Label>
                    <Input
                      id="speakerDescription"
                      placeholder="예: 강원도지사, 정중하고 권위있는 톤"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="audioFile">음성 파일 업로드</Label>
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-2">
                        WAV, MP3 파일을 업로드하세요 (최대 10MB)
                      </p>
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="audioFile"
                      />
                      <Button asChild variant="outline">
                        <label htmlFor="audioFile">
                          파일 선택
                        </label>
                      </Button>
                      {uploadedFile && (
                        <div className="mt-2 text-sm text-green-600">
                          ✓ {uploadedFile.name} 업로드됨
                        </div>
                      )}
                    </div>
                  </div>

                  {isTraining && (
                    <div className="space-y-2">
                      <Label>학습 진행률</Label>
                      <Progress value={trainingProgress} className="w-full" />
                      <p className="text-sm text-muted-foreground">
                        AI가 음성을 분석하고 학습 중입니다... {trainingProgress}%
                      </p>
                    </div>
                  )}

                  <Button 
                    onClick={handleStartTraining}
                    disabled={isTraining || !uploadedFile}
                    className="w-full"
                    variant="gradient"
                  >
                    {isTraining ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        학습 중...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        음성 학습 시작
                      </>
                    )}
                  </Button>
                </div>

                <div className="bg-muted/50 rounded-lg p-4">
                  <h3 className="font-medium mb-2">학습 가이드</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 최소 30초 이상의 깨끗한 음성 파일을 사용하세요</li>
                    <li>• 배경 소음이 적고 명확한 발음을 사용하세요</li>
                    <li>• 다양한 문장과 감정이 포함된 음성을 권장합니다</li>
                    <li>• 학습에는 약 5-10분이 소요됩니다</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default VoiceCloning;
