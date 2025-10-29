import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Download, Wand2, Building2, Users, Megaphone, FileText, User, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const VoiceGenerator = () => {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("female-1");
  const [speed, setSpeed] = useState([1]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [senderDepartment, setSenderDepartment] = useState("");
  const [senderName, setSenderName] = useState("");
  const [isDifferentSender, setIsDifferentSender] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const [openAIPrompt, setOpenAIPrompt] = useState("");
  const [openAIInstruction, setOpenAIInstruction] = useState("");
  const [lastAIPrompt, setLastAIPrompt] = useState("");
  const [lastAIInstruction, setLastAIInstruction] = useState("");
  const [isLoadingGen, setIsLoadingGen] = useState(false);
  const [isLoadingTTS, setIsLoadingTTS] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 공공기관 특화 템플릿
  const publicTemplates = [
    {
      id: "mayor_greeting",
      title: "시장 신년인사",
      description: "신년 인사말 템플릿",
      template: "안녕하십니까. {기관명} 시장 {담당자명}입니다. 새해를 맞이하여 시민 여러분께 진심으로 인사드립니다. 올해도 시민의 행복과 지역발전을 위해 최선을 다하겠습니다. 새해 복 많이 받으시기 바랍니다. 감사합니다.",
      category: "인사말",
      icon: Users
    },
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
      icon: Megaphone
    },
    {
      id: "policy_announcement",
      title: "정책 발표",
      description: "새로운 정책 및 제도 안내",
      template: "{기관명}에서 새로운 정책을 발표합니다. {정책명}을 통해 {정책목표}를 달성하고자 합니다. {정책내용}으로 운영되며, {적용대상}에게 혜택이 제공됩니다.",
      category: "정책안내",
      icon: FileText
    }
  ];

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template.id);
    setText(template.template);
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      toast({
        title: "텍스트를 입력해주세요",
        description: "음성으로 변환할 텍스트를 입력해야 합니다.",
        variant: "destructive",
      });
      return;
    }

    if (isDifferentSender && (!senderDepartment.trim() || !senderName.trim())) {
      toast({
        title: "담당자 정보를 입력해주세요",
        description: "전송 담당자와 부서 정보를 모두 입력해야 합니다.",
        variant: "destructive",
      });
      return;
    }

    const senderInfo = isDifferentSender 
      ? { department: senderDepartment, name: senderName }
      : { department: user?.department || "", name: user?.name || "" };

    setIsLoadingTTS(true);
    toast({
      title: "음성 생성 중...",
      description: `담당자: ${senderInfo.department} ${senderInfo.name}님의 음성을 생성하고 있습니다.`,
    });

    try {
      const ttsUrl = await synthesizeWithSupertone({
        text,
        voiceId: voice,
        speed: speed[0],
      });
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return ttsUrl;
      });
      toast({ title: "생성이 완료되었습니다", description: "재생 또는 다운로드할 수 있습니다." });
    } catch (err: any) {
      console.error(err);
      toast({ title: "TTS 생성 실패", description: err?.message || "나중에 다시 시도해주세요.", variant: "destructive" });
    } finally {
      setIsLoadingTTS(false);
    }
  };

  async function generateWithOpenAI(prompt: string) {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string;
    if (!apiKey) throw new Error("OpenAI API 키가 설정되지 않았습니다 (VITE_OPENAI_API_KEY)");

    const system = [
      "당신은 대한민국 공공기관 방송 문구 작성 보조 도우미입니다.",
      "톤은 격식과 신뢰감을 유지하며 간결해야 합니다.",
      "방송용으로 호흡이 자연스럽고 발음이 명확하도록 문장을 구성하세요.",
      "TTS 친화적으로 숫자, 단위를 명확히 표기하세요.",
    ].join(" ");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI 오류: ${err}`);
    }
    const data = await response.json();
    // 다양한 응답 포맷 방어적으로 처리
    const outputText =
      data.output_text ||
      data.choices?.[0]?.message?.content?.[0]?.text ||
      data.choices?.[0]?.message?.content ||
      data.output?.[0]?.content?.[0]?.text ||
      "";
    if (!outputText) throw new Error("OpenAI 응답을 해석할 수 없습니다.");
    return typeof outputText === "string" ? outputText : JSON.stringify(outputText);
  }

  async function editWithOpenAI(original: string, instruction: string) {
    const prompt = `다음 방송 원문을 지침에 맞춰 자연스럽게 수정해 주세요.\n\n[원문]\n${original}\n\n[지침]\n${instruction}\n\n요구사항: 방송용 격식, 명확한 발음, 간결한 문장, 숫자/단위 명확화.`;
    return generateWithOpenAI(prompt);
  }

  async function synthesizeWithSupertone({ text, voiceId, speed }: { text: string; voiceId: string; speed: number; }) {
    const apiKey = import.meta.env.VITE_SUPERTONE_API_KEY as string;
    if (!apiKey) throw new Error("Supertone API 키가 설정되지 않았습니다 (VITE_SUPERTONE_API_KEY)");

    // 실제 엔드포인트/스키마는 서비스 문서에 맞게 조정 필요
    const resp = await fetch("https://api.supertone.ai/v1/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        voice_id: voiceId,
        speed,
        format: "mp3",
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Supertone 오류: ${err}`);
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    return url;
  }

  return (
    <section className="py-24 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl md:text-5xl font-bold">
            <span className="gradient-text">음성 생성</span>
          </h2>
          <p className="text-xl text-muted-foreground">
            텍스트를 입력하고 AI 음성으로 변환하세요
          </p>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary" />
              TTS 음성 생성기
            </CardTitle>
            <CardDescription>
              텍스트를 자연스러운 음성으로 변환합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 작성 모드 탭: 직접/생성/수정 */}
            <div className="space-y-3">
              <Tabs defaultValue="manual">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="manual">직접 작성</TabsTrigger>
                  <TabsTrigger value="ai-generate">OpenAI로 작성</TabsTrigger>
                  <TabsTrigger value="ai-edit">OpenAI로 수정</TabsTrigger>
                </TabsList>

                <TabsContent value="manual" className="space-y-2">
                  <div className="text-xs text-muted-foreground">텍스트를 직접 입력하세요.</div>
                </TabsContent>

                <TabsContent value="ai-generate" className="space-y-2">
                  <Label htmlFor="ai-generate-prompt">요청 내용</Label>
                  <Textarea
                    id="ai-generate-prompt"
                    placeholder="예: 춘천시 재난안전 안내방송 – 폭설 대비 시민 행동요령을 20~30초 분량으로 작성"
                    value={openAIPrompt}
                    onChange={(e) => setOpenAIPrompt(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          setIsLoadingGen(true);
                          const org = user?.organization || "귀 기관";
                          const dept = user?.department || "관계 부서";
                          const basePrompt = `${org} ${dept} 방송문: ${openAIPrompt}`;
                          const result = await generateWithOpenAI(basePrompt);
                          setText(result);
                          setLastAIPrompt(openAIPrompt);
                          toast({ title: "작성 완료", description: "OpenAI가 문구를 생성했습니다." });
                        } catch (err: any) {
                          toast({ title: "작성 실패", description: err?.message || "다시 시도해주세요.", variant: "destructive" });
                        } finally {
                          setIsLoadingGen(false);
                        }
                      }}
                      disabled={isLoadingGen || !openAIPrompt.trim()}
                    >
                      {isLoadingGen ? "작성 중..." : "OpenAI로 작성"}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="ai-edit" className="space-y-2">
                  <Label htmlFor="ai-edit-instruction">수정 지침</Label>
                  <Input
                    id="ai-edit-instruction"
                    placeholder="예: 20초 분량으로 단문, 끝맺음 공손하게, 숫자 명확히"
                    value={openAIInstruction}
                    onChange={(e) => setOpenAIInstruction(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          if (!text.trim()) {
                            toast({ title: "수정할 텍스트가 없습니다", variant: "destructive" });
                            return;
                          }
                          setIsLoadingGen(true);
                          const result = await editWithOpenAI(text, openAIInstruction);
                          setText(result);
                          setLastAIInstruction(openAIInstruction);
                          toast({ title: "수정 완료", description: "OpenAI가 문구를 다듬었습니다." });
                        } catch (err: any) {
                          toast({ title: "수정 실패", description: err?.message || "다시 시도해주세요.", variant: "destructive" });
                        } finally {
                          setIsLoadingGen(false);
                        }
                      }}
                      disabled={isLoadingGen || !openAIInstruction.trim()}
                    >
                      {isLoadingGen ? "수정 중..." : "OpenAI로 수정"}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            {/* 공공기관 템플릿 선택 */}
            {user && (
              <div className="space-y-3">
                <label className="text-sm font-medium">공공기관 템플릿</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {publicTemplates.map((template) => (
                    <Card 
                      key={template.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedTemplate === template.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <div className="w-6 h-6 bg-primary/10 rounded flex items-center justify-center">
                            <template.icon className="w-3 h-3 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-medium">{template.title}</h3>
                            <p className="text-xs text-muted-foreground">{template.description}</p>
                            <Badge variant="secondary" className="mt-1 text-xs">
                              {template.category}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  템플릿의 {"{"}변수명{"}"} 부분을 실제 내용으로 교체해주세요.
                </p>
              </div>
            )}

            {/* 담당자 정보 입력 */}
            {user && (
              <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-primary" />
                  <h3 className="font-medium">전송 담당자 정보</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-user">현재 로그인 사용자</Label>
                    <div className="p-3 bg-background border border-border rounded-md">
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {user.organization} • {user.department} • {user.position}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>전송 담당자 선택</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="same-sender"
                          name="sender-type"
                          checked={!isDifferentSender}
                          onChange={() => setIsDifferentSender(false)}
                          className="w-4 h-4 text-primary"
                        />
                        <Label htmlFor="same-sender" className="text-sm">
                          현재 사용자와 동일
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="different-sender"
                          name="sender-type"
                          checked={isDifferentSender}
                          onChange={() => setIsDifferentSender(true)}
                          className="w-4 h-4 text-primary"
                        />
                        <Label htmlFor="different-sender" className="text-sm">
                          다른 담당자 지정
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>

                {isDifferentSender && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border">
                    <div className="space-y-2">
                      <Label htmlFor="sender-department">부서명</Label>
                      <Input
                        id="sender-department"
                        placeholder="예: 시민안전과, 복지정책과"
                        value={senderDepartment}
                        onChange={(e) => setSenderDepartment(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sender-name">담당자명</Label>
                      <Input
                        id="sender-name"
                        placeholder="예: 홍길동, 김철수"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                      />
                    </div>
                  </div>
                )}
                
                <div className="text-xs text-muted-foreground">
                  * 음성 생성 시 전송 담당자 정보가 포함됩니다.
                </div>
              </div>
            )}

            {/* Text Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">변환할 텍스트</label>
              <Textarea
                placeholder="여기에 텍스트를 입력하세요. 예: 안녕하세요, 오늘의 공지사항을 안내드립니다..."
                className="min-h-32 resize-none"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="text-xs text-muted-foreground text-right">
                {text.length} / 5000자
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setText("");
                    setSelectedTemplate("");
                    toast({ title: "초기화", description: "메시지 내용이 초기화되었습니다." });
                  }}
                >
                  내용 초기화
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const prompt = (lastAIPrompt || openAIPrompt).trim();
                      if (!prompt) {
                        toast({ title: "프롬프트가 없습니다", description: "OpenAI 작성 탭에 프롬프트를 입력하세요.", variant: "destructive" });
                        return;
                      }
                      setIsLoadingGen(true);
                      const org = user?.organization || "귀 기관";
                      const dept = user?.department || "관계 부서";
                      const basePrompt = `${org} ${dept} 방송문: ${prompt}`;
                      const result = await generateWithOpenAI(basePrompt);
                      setText(result);
                      setLastAIPrompt(prompt);
                      toast({ title: "다시 생성 완료", description: "OpenAI가 새로 작성했습니다." });
                    } catch (err: any) {
                      toast({ title: "다시 생성 실패", description: err?.message || "다시 시도해주세요.", variant: "destructive" });
                    } finally {
                      setIsLoadingGen(false);
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
                        toast({ title: "수정 지침이 없습니다", description: "OpenAI 수정 탭에 지침을 입력하세요.", variant: "destructive" });
                        return;
                      }
                      if (!text.trim()) {
                        toast({ title: "수정할 텍스트가 없습니다", variant: "destructive" });
                        return;
                      }
                      setIsLoadingGen(true);
                      const result = await editWithOpenAI(text, instruction);
                      setText(result);
                      setLastAIInstruction(instruction);
                      toast({ title: "다시 수정 완료", description: "OpenAI가 다시 다듬었습니다." });
                    } catch (err: any) {
                      toast({ title: "다시 수정 실패", description: err?.message || "다시 시도해주세요.", variant: "destructive" });
                    } finally {
                      setIsLoadingGen(false);
                    }
                  }}
                >
                  다시 수정
                </Button>
              </div>
            </div>

            {/* Voice Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">화자 선택</label>
              <Select value={voice} onValueChange={setVoice}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* 남성 화자 */}
                  <div className="px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-50">남성 화자</div>
                  <SelectItem value="male_anchor_1">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-500" />
                      <div>
                        <div className="font-medium">앵커 스타일 남성 1</div>
                        <div className="text-xs text-muted-foreground">뉴스 앵커 톤 - 도지사, 시장용</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="male_anchor_2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-500" />
                      <div>
                        <div className="font-medium">앵커 스타일 남성 2</div>
                        <div className="text-xs text-muted-foreground">정치 앵커 톤 - 도지사, 시장용</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="male_expert_1">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <div>
                        <div className="font-medium">전문가 스타일 남성 1</div>
                        <div className="text-xs text-muted-foreground">학술 발표 톤 - 연구원장용</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="male_guide_1">
                    <div className="flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-blue-500" />
                      <div>
                        <div className="font-medium">안내방송 스타일 남성 1</div>
                        <div className="text-xs text-muted-foreground">친근한 안내 톤 - 일반 안내방송용</div>
                      </div>
                    </div>
                  </SelectItem>
                  
                  {/* 여성 화자 */}
                  <div className="px-2 py-1 text-xs font-semibold text-pink-600 bg-pink-50 mt-2">여성 화자</div>
                  <SelectItem value="female_anchor_1">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-pink-500" />
                      <div>
                        <div className="font-medium">아나운서 스타일 여성 1</div>
                        <div className="text-xs text-muted-foreground">뉴스 아나운서 톤 - 부시장, 부지사용</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="female_weather_1">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-pink-500" />
                      <div>
                        <div className="font-medium">기상 아나운서 스타일</div>
                        <div className="text-xs text-muted-foreground">기상청 아나운서 톤 - 부시장, 부지사용</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="female_expert_1">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-pink-500" />
                      <div>
                        <div className="font-medium">전문가 스타일 여성 1</div>
                        <div className="text-xs text-muted-foreground">학술 발표 톤 - 연구소장용</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="female_guide_1">
                    <div className="flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-pink-500" />
                      <div>
                        <div className="font-medium">안내방송 스타일 여성 1</div>
                        <div className="text-xs text-muted-foreground">친근한 안내 톤 - 일반 안내방송용</div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>더 많은 화자를 원하시나요?</span>
                <Button variant="link" size="sm" className="p-0 h-auto">
                  보이스 클로닝에서 생성하기
                </Button>
              </div>
            </div>

            {/* Speed Control */}
            <div className="space-y-2">
              <label className="text-sm font-medium">재생 속도: {speed[0]}x</label>
              <Slider
                value={speed}
                onValueChange={setSpeed}
                min={0.5}
                max={2}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button 
                variant="gradient" 
                className="flex-1"
                onClick={handleGenerate}
                disabled={isLoadingTTS}
              >
                <Wand2 className="w-4 h-4" />
                {isLoadingTTS ? "생성 중..." : "음성 생성 (Supertone)"}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={async () => {
                  if (!audioUrl) {
                    toast({ title: "재생할 오디오가 없습니다", variant: "destructive" });
                    return;
                  }
                  if (!audioRef.current) {
                    audioRef.current = new Audio(audioUrl);
                  } else {
                    audioRef.current.src = audioUrl;
                  }
                  try {
                    await audioRef.current.play();
                  } catch (e) {
                    console.error(e);
                  }
                }}
              >
                <Play className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (!audioUrl) {
                    toast({ title: "다운로드할 오디오가 없습니다", variant: "destructive" });
                    return;
                  }
                  const a = document.createElement("a");
                  a.href = audioUrl;
                  a.download = "tts.mp3";
                  a.click();
                }}
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>

            {/* Audio Waveform Placeholder */}
            <div className="h-24 bg-muted rounded-lg flex items-center justify-center">
              <div className="flex items-end gap-1 h-16">
                {Array.from({ length: 40 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-primary/30 rounded-full"
                    style={{ height: `${Math.random() * 100}%` }}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default VoiceGenerator;
