import Navigation from "@/components/Navigation";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import AudioPlayer from "@/components/AudioPlayer";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Mic2, Building2, Users, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";

const Index = () => {
  const { isAuthenticated } = useAuth();
  const [selectedSample, setSelectedSample] = useState<string | null>(null);
  const [sampleAvailability, setSampleAvailability] = useState<Record<string, boolean>>({});
  const [checkingSamples, setCheckingSamples] = useState(true);

  // 샘플 음원 데이터
  // 각 샘플은 실제 TTS로 생성된 오디오를 사용합니다
  // public/samples/ 폴더에 샘플 오디오 파일이 저장됩니다
  const sampleVoices = [
    {
      id: "sample1",
      title: "정책 발표 샘플",
      description: "공공기관 정책 발표용 음성",
      duration: 42, // 초 단위
      voice: "앵커 스타일 남성",
      category: "정책 발표",
      // public 폴더의 샘플 오디오 파일 사용
      audioUrl: "/samples/sample1-policy.mp3",
      organization: "공공기관"
    },
    {
      id: "sample2", 
      title: "공지사항 샘플",
      description: "일반 공지사항 안내 음성",
      duration: 35, // 초 단위
      voice: "아나운서 스타일 여성",
      category: "공지사항",
      // public 폴더의 샘플 오디오 파일 사용
      audioUrl: "/samples/sample2-announcement.mp3",
      organization: "공공기관"
    },
    {
      id: "sample3",
      title: "전문 발표 샘플",
      description: "전문 분야 발표용 음성",
      duration: 48, // 초 단위
      voice: "전문가 스타일 남성",
      category: "전문 발표",
      // public 폴더의 샘플 오디오 파일 사용
      audioUrl: "/samples/sample3-presentation.mp3",
      organization: "공공기관"
    }
  ];

  // 샘플 파일 존재 여부 확인
  const checkSampleAvailability = async () => {
    setCheckingSamples(true);
    const availability: Record<string, boolean> = {};
    
    for (const sample of sampleVoices) {
      try {
        // HEAD 요청으로 파일 존재 여부 확인
        const response = await fetch(sample.audioUrl, { 
          method: 'HEAD',
          cache: 'no-cache' // 캐시 무시
        });
        // 200-299 범위의 상태 코드면 파일 존재
        availability[sample.id] = response.ok && response.status >= 200 && response.status < 300;
        
        // 파일이 없으면 로그 출력
        if (!availability[sample.id]) {
          console.warn(`[Index] 샘플 파일이 없습니다: ${sample.audioUrl} (${response.status})`);
        }
      } catch (error) {
        // 네트워크 오류나 CORS 오류 등
        console.warn(`[Index] 샘플 파일 확인 실패: ${sample.audioUrl}`, error);
        availability[sample.id] = false;
      }
    }
    
    setSampleAvailability(availability);
    setCheckingSamples(false);
    console.log('[Index] 샘플 파일 확인 완료:', availability);
  };

  // 컴포넌트 마운트 시 샘플 파일 확인
  useEffect(() => {
    if (!isAuthenticated) {
      checkSampleAvailability();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const handlePlaySample = (sampleId: string) => {
    const sample = sampleVoices.find(s => s.id === sampleId);
    // 파일이 확인되었고 존재하는 경우에만 재생
    if (sample && sampleAvailability[sampleId] === true) {
      setSelectedSample(sampleId);
    } else if (sample && sampleAvailability[sampleId] === false) {
      // 파일이 없는 경우 안내
      console.warn(`[Index] 샘플 파일이 없습니다: ${sample.audioUrl}`);
    } else {
      // 아직 확인 중인 경우
      console.log(`[Index] 샘플 파일 확인 중: ${sample?.audioUrl}`);
    }
  };

  const handleDownloadSample = async (sampleId: string) => {
    const sample = sampleVoices.find(s => s.id === sampleId);
    if (sample) {
      try {
        const response = await fetch(sample.audioUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // 파일 확장자 추출 (URL에서)
        const extension = sample.audioUrl.split('.').pop() || 'mp3';
        a.download = `${sample.title}.${extension}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error("다운로드 오류:", error);
        alert("샘플 오디오를 다운로드할 수 없습니다. 파일이 존재하는지 확인해주세요.");
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
              <div className="flex items-center justify-center gap-4">
                <h2 className="text-3xl md:text-4xl font-bold">
                  <span className="gradient-text">샘플 음원 체험</span>
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={checkSampleAvailability}
                  disabled={checkingSamples}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${checkingSamples ? 'animate-spin' : ''}`} />
                  {checkingSamples ? '확인 중...' : '새로고침'}
                </Button>
              </div>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                실제 공공기관에서 사용되는 AI 음성의 품질을 직접 확인해보세요
              </p>
              {Object.values(sampleAvailability).some(v => v === false) && (
                <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg max-w-2xl mx-auto">
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    💡 <strong>샘플 파일이 없습니다.</strong> 로그인 후 "샘플 생성" 페이지에서 파일을 생성하고, 
                    다운로드된 파일을 <code className="bg-background px-1 py-0.5 rounded">public/samples/</code> 폴더에 복사해주세요.
                  </p>
                </div>
              )}
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
                        <span>{formatDuration(sample.duration)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {sampleAvailability[sample.id] === false ? (
                        <div className="flex-1 text-sm text-muted-foreground text-center py-2 px-2">
                          샘플 파일이 없습니다. 로그인 후 "샘플 생성" 페이지에서 생성해주세요.
                        </div>
                      ) : (
                        <>
                          <Button
                            variant="gradient"
                            size="sm"
                            className="flex-1"
                            onClick={() => handlePlaySample(sample.id)}
                            disabled={checkingSamples || sampleAvailability[sample.id] === false}
                          >
                            {checkingSamples ? "확인 중..." : "미리듣기"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadSample(sample.id)}
                            disabled={checkingSamples || sampleAvailability[sample.id] === false}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 선택된 샘플 재생기 */}
            {selectedSample && (
              <div className="mt-8">
                <Card className="max-w-2xl mx-auto">
                  <CardContent className="p-6">
                    {sampleAvailability[selectedSample] === false || 
                     (sampleAvailability[selectedSample] === undefined && !checkingSamples) ? (
                      <div className="text-center py-8 space-y-4">
                        <p className="text-muted-foreground">
                          샘플 오디오 파일이 없습니다.
                        </p>
                        <p className="text-sm text-muted-foreground">
                          로그인 후 사이드바의 "샘플 생성" 메뉴에서 파일을 생성해주세요.
                        </p>
                      </div>
                    ) : sampleAvailability[selectedSample] === true ? (
                      <AudioPlayer
                        audioUrl={sampleVoices.find(s => s.id === selectedSample)?.audioUrl || ""}
                        title={sampleVoices.find(s => s.id === selectedSample)?.title || ""}
                        duration={sampleVoices.find(s => s.id === selectedSample)?.duration || 0}
                        onDownload={() => handleDownloadSample(selectedSample)}
                        onError={() => {
                          // 파일이 없거나 로드 실패 시 availability 업데이트
                          console.warn(`[Index] 오디오 로드 실패, availability 업데이트: ${selectedSample}`);
                          setSampleAvailability(prev => ({ ...prev, [selectedSample]: false }));
                          setSelectedSample(null); // 재생기 숨기기
                        }}
                      />
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">파일 확인 중...</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

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
