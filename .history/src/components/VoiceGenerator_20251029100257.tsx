import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Download, Wand2, Building2, Users, Megaphone, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const VoiceGenerator = () => {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("female-1");
  const [speed, setSpeed] = useState([1]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

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

  const handleGenerate = () => {
    if (!text.trim()) {
      toast({
        title: "텍스트를 입력해주세요",
        description: "음성으로 변환할 텍스트를 입력해야 합니다.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "음성 생성 중...",
      description: "AI가 고품질 음성을 생성하고 있습니다.",
    });
  };

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
                  템플릿의 {변수명} 부분을 실제 내용으로 교체해주세요.
                </p>
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
            </div>

            {/* Voice Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">음성 스타일</label>
              <Select value={voice} onValueChange={setVoice}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="formal_male">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      <div>
                        <div className="font-medium">정중한 남성</div>
                        <div className="text-xs text-muted-foreground">도지사, 시장용</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="formal_female">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <div>
                        <div className="font-medium">정중한 여성</div>
                        <div className="text-xs text-muted-foreground">부시장, 부지사용</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="professional_male">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <div>
                        <div className="font-medium">전문적인 남성</div>
                        <div className="text-xs text-muted-foreground">연구원장, 공단 이사장용</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="professional_female">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <div>
                        <div className="font-medium">전문적인 여성</div>
                        <div className="text-xs text-muted-foreground">연구소장, 공사 사장용</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="friendly_male">
                    <div className="flex items-center gap-2">
                      <Megaphone className="w-4 h-4" />
                      <div>
                        <div className="font-medium">친근한 남성</div>
                        <div className="text-xs text-muted-foreground">일반 안내방송용</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="friendly_female">
                    <div className="flex items-center gap-2">
                      <Megaphone className="w-4 h-4" />
                      <div>
                        <div className="font-medium">친근한 여성</div>
                        <div className="text-xs text-muted-foreground">일반 안내방송용</div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
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
              >
                <Wand2 className="w-4 h-4" />
                음성 생성
              </Button>
              <Button variant="outline" size="icon">
                <Play className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon">
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
