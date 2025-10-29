import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Volume2, Download, Mic2, Building2, Users } from "lucide-react";
import { useState } from "react";

const Index = () => {
  const { isAuthenticated } = useAuth();
  const [playingSample, setPlayingSample] = useState<string | null>(null);

  // 샘플 음원 데이터
  const sampleVoices = [
    {
      id: "sample1",
      title: "도지사 신년 인사말",
      description: "강원특별자치도 도지사 음성",
      duration: "2:34",
      voice: "앵커 스타일 남성",
      category: "정책 발표",
      audioUrl: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBzqO0fPTgjMGHm7A7+OZURE=",
      organization: "강원특별자치도청"
    },
    {
      id: "sample2", 
      title: "시장 공지사항",
      description: "춘천시 시장 음성",
      duration: "1:45",
      voice: "아나운서 스타일 여성",
      category: "공지사항",
      audioUrl: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBzqO0fPTgjMGHm7A7+OZURE=",
      organization: "춘천시청"
    },
    {
      id: "sample3",
      title: "연구소장 발표",
      description: "강원국립환경연구원 소장 음성",
      duration: "3:12",
      voice: "전문가 스타일 남성",
      category: "연구 발표",
      audioUrl: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBzqO0fPTgjMGHm7A7+OZURE=",
      organization: "강원국립환경연구원"
    }
  ];

  const handlePlaySample = (sampleId: string) => {
    if (playingSample === sampleId) {
      setPlayingSample(null);
    } else {
      setPlayingSample(sampleId);
    }
  };

  const handleDownloadSample = (sampleId: string) => {
    // 샘플 다운로드 로직
    console.log("샘플 다운로드:", sampleId);
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      <Hero />
      
      {/* 핵심 기능 섹션 */}
      <div id="features">
        <Features />
      </div>

      {/* 비로그인 상태에서만 샘플 음원 섹션 표시 */}
      {!isAuthenticated && (
        <section className="py-20 bg-gradient-to-br from-background via-background to-primary/5">
          <div className="container mx-auto px-4">
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-3xl md:text-4xl font-bold">
                <span className="gradient-text">샘플 음원 체험</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                실제 공공기관에서 사용되는 AI 음성의 품질을 직접 확인해보세요
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sampleVoices.map((sample) => (
                <Card key={sample.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2">{sample.title}</CardTitle>
                        <CardDescription className="mb-3">{sample.description}</CardDescription>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Building2 className="w-4 h-4" />
                          <span>{sample.organization}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="ml-2">
                        {sample.category}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Mic2 className="w-4 h-4" />
                        <span>{sample.voice}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4" />
                        <span>{sample.duration}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="gradient"
                        size="sm"
                        className="flex-1"
                        onClick={() => handlePlaySample(sample.id)}
                      >
                        {playingSample === sample.id ? (
                          <>
                            <Pause className="w-4 h-4 mr-2" />
                            재생 중지
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            미리듣기
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadSample(sample.id)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>

                    {playingSample === sample.id && (
                      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                          <span>재생 중...</span>
                        </div>
                        <div className="mt-2 w-full bg-muted rounded-full h-1">
                          <div className="bg-primary h-1 rounded-full animate-pulse" style={{width: '30%'}}></div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="text-center mt-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-sm text-primary">
                <Users className="w-4 h-4" />
                <span>더 많은 음성 스타일과 기능을 체험하려면 회원가입하세요</span>
              </div>
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
};

export default Index;
