import { Button } from "@/components/ui/button";
import { Mic2, Radio, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import heroBg from "@/assets/hero-bg.jpg";

const Hero = () => {
  const { isAuthenticated } = useAuth();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-background/95 via-background/90 to-background"></div>
      </div>

      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse-glow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8 animate-slide-up">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border shadow-lg">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">AI 기반 음성 합성 기술</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            <span className="gradient-text">스마트 TTS</span>
            <br />
            <span className="text-foreground">방송 시스템</span>
          </h1>

          {/* Description */}
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            AI 음성 합성으로 자연스러운 안내방송을 제작하고
            <br />
            원하는 시간에 자동으로 송출하세요
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            {isAuthenticated ? (
              <>
                <Link to="/dashboard">
                  <Button size="xl" variant="gradient" className="group">
                    <Mic2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    대시보드로 이동
                  </Button>
                </Link>
                <Link to="/voice-generator">
                  <Button size="xl" variant="outline">
                    <Radio className="w-5 h-5" />
                    음성 생성하기
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/register">
                  <Button size="xl" variant="gradient" className="group">
                    <Mic2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    음성 생성 시작하기
                  </Button>
                </Link>
                <Link to="/pricing">
                  <Button size="xl" variant="outline">
                    <Radio className="w-5 h-5" />
                    요금제 보기
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 pt-12 max-w-2xl mx-auto">
            <div className="space-y-2">
              <div className="text-3xl md:text-4xl font-bold text-primary">50+</div>
              <div className="text-sm text-muted-foreground">음성 스타일</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl md:text-4xl font-bold text-primary">99.9%</div>
              <div className="text-sm text-muted-foreground">송출 정확도</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl md:text-4xl font-bold text-primary">24/7</div>
              <div className="text-sm text-muted-foreground">자동 운영</div>
            </div>
          </div>
        </div>
      </div>

      {/* Audio Wave Visualization */}
      <div className="absolute bottom-0 left-0 right-0 h-32 flex items-end justify-center gap-1 opacity-30">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="w-1 bg-gradient-to-t from-primary to-accent rounded-t audio-wave"
            style={{
              height: `${Math.random() * 100 + 20}%`,
              animationDelay: `${i * 0.05}s`,
            }}
          />
        ))}
      </div>
    </section>
  );
};

export default Hero;
