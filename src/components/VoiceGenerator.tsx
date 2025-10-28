import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Play, Download, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const VoiceGenerator = () => {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("female-1");
  const [speed, setSpeed] = useState([1]);
  const { toast } = useToast();

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
              <label className="text-sm font-medium">음성 선택</label>
              <Select value={voice} onValueChange={setVoice}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female-1">여성 - 밝은 톤</SelectItem>
                  <SelectItem value="female-2">여성 - 차분한 톤</SelectItem>
                  <SelectItem value="male-1">남성 - 신뢰감 있는 톤</SelectItem>
                  <SelectItem value="male-2">남성 - 친근한 톤</SelectItem>
                  <SelectItem value="custom">커스텀 음성 (보이스 클로닝)</SelectItem>
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
