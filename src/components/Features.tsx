import { Mic, Calendar, Zap, Shield, Clock, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Mic,
    title: "실감나는 AI 음성",
    description: "다양한 목소리 스타일과 보이스 클로닝으로 자연스럽고 감정이 풍부한 음성을 생성합니다.",
  },
  {
    icon: Calendar,
    title: "스마트 스케줄링",
    description: "원하는 날짜와 시간에 자동 송출. 반복 방송 설정과 우선순위 관리를 지원합니다.",
  },
  {
    icon: Zap,
    title: "빠른 음성 생성",
    description: "최신 AI 기술로 몇 초 만에 고품질 음성을 생성하고 즉시 미리듣기가 가능합니다.",
  },
  {
    icon: Shield,
    title: "안정적인 송출",
    description: "99.9% 송출 정확도로 중요한 안내방송을 놓치지 않고 정확하게 전달합니다.",
  },
  {
    icon: Clock,
    title: "24/7 자동 운영",
    description: "수동 작업 없이 설정된 시간에 자동으로 방송이 송출되어 업무 효율을 높입니다.",
  },
  {
    icon: Users,
    title: "다중 사용자 지원",
    description: "팀 협업과 권한 관리로 여러 담당자가 효율적으로 방송을 관리할 수 있습니다.",
  },
];

const Features = () => {
  return (
    <section className="py-24 px-4 bg-muted/30">
      <div className="container mx-auto">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-3xl md:text-5xl font-bold">
            <span className="gradient-text">핵심 기능</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            전문적인 방송 제작과 관리를 위한 모든 기능을 제공합니다
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <Card 
              key={index}
              className="border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg group"
            >
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
