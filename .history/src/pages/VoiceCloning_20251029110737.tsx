import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
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
    if (!uploadedFile) {
      alert("음성 파일을 업로드해주세요.");
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
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

                    <div className="space-y-2">
                      <Label htmlFor="style">스타일 설명</Label>
                      <Input
                        id="style"
                        placeholder="예: 뉴스 앵커처럼 정중하고 신뢰감 있는 톤"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="age">연령대</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="연령대를 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="20s">20대</SelectItem>
                          <SelectItem value="30s">30대</SelectItem>
                          <SelectItem value="40s">40대</SelectItem>
                          <SelectItem value="50s">50대</SelectItem>
                          <SelectItem value="60s">60대</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tone">톤</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="톤을 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="warm">따뜻한</SelectItem>
                          <SelectItem value="cool">차분한</SelectItem>
                          <SelectItem value="energetic">활기찬</SelectItem>
                          <SelectItem value="calm">평온한</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="speed">말하기 속도</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="말하기 속도를 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="slow">느린</SelectItem>
                          <SelectItem value="normal">보통</SelectItem>
                          <SelectItem value="fast">빠른</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

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
