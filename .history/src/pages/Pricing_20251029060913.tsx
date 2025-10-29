import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Mic2, 
  Check, 
  Star, 
  Crown, 
  Building2,
  Zap,
  Shield,
  Headphones,
  Clock,
  Users,
  HardDrive,
  BarChart3
} from "lucide-react";

const Pricing = () => {
  const [isAnnual, setIsAnnual] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("standard");

  const plans = [
    {
      id: "basic",
      name: "베이직",
      description: "개인 사용자를 위한 기본 플랜",
      icon: Mic2,
      monthlyPrice: 50000,
      annualPrice: 500000,
      features: [
        "월 50시간 방송",
        "10가지 음성 스타일",
        "기본 스케줄링",
        "5GB 스토리지",
        "이메일 지원",
        "기본 분석 리포트"
      ],
      limitations: [
        "동시 방송 1개",
        "커스텀 음성 없음"
      ],
      popular: false,
      color: "border-blue-200",
      buttonColor: "bg-blue-500 hover:bg-blue-600"
    },
    {
      id: "standard",
      name: "스탠다드",
      description: "소규모 사업체를 위한 추천 플랜",
      icon: Star,
      monthlyPrice: 100000,
      annualPrice: 1000000,
      features: [
        "월 200시간 방송",
        "30가지 음성 스타일",
        "고급 스케줄링",
        "20GB 스토리지",
        "우선 지원",
        "상세 분석 리포트",
        "동시 방송 5개",
        "API 접근"
      ],
      limitations: [
        "커스텀 음성 제한"
      ],
      popular: true,
      color: "border-primary",
      buttonColor: "bg-primary hover:bg-primary/90"
    },
    {
      id: "premium",
      name: "프리미엄",
      description: "중대형 사업체를 위한 고급 플랜",
      icon: Crown,
      monthlyPrice: 200000,
      annualPrice: 2000000,
      features: [
        "월 500시간 방송",
        "무제한 음성 스타일",
        "완전 자동화 스케줄링",
        "100GB 스토리지",
        "전화 지원",
        "실시간 분석 대시보드",
        "동시 방송 20개",
        "전체 API 접근",
        "커스텀 음성 생성",
        "우선 처리"
      ],
      limitations: [],
      popular: false,
      color: "border-purple-200",
      buttonColor: "bg-purple-500 hover:bg-purple-600"
    },
    {
      id: "enterprise",
      name: "엔터프라이즈",
      description: "대기업을 위한 맞춤형 솔루션",
      icon: Building2,
      monthlyPrice: 0,
      annualPrice: 0,
      features: [
        "무제한 방송 시간",
        "무제한 음성 스타일",
        "완전 맞춤형 솔루션",
        "무제한 스토리지",
        "전담 계정 매니저",
        "실시간 모니터링",
        "무제한 동시 방송",
        "전체 시스템 통합",
        "커스텀 음성 개발",
        "SLA 보장",
        "온사이트 지원"
      ],
      limitations: [],
      popular: false,
      color: "border-gray-200",
      buttonColor: "bg-gray-800 hover:bg-gray-900",
      isCustom: true
    }
  ];

  const features = [
    {
      icon: Zap,
      title: "빠른 음성 생성",
      description: "AI 기술로 몇 초 만에 자연스러운 음성을 생성합니다"
    },
    {
      icon: Shield,
      title: "안전한 서비스",
      description: "엔터프라이즈급 보안으로 데이터를 안전하게 보호합니다"
    },
    {
      icon: Headphones,
      title: "24/7 지원",
      description: "언제든지 전문가의 도움을 받을 수 있습니다"
    },
    {
      icon: BarChart3,
      title: "상세한 분석",
      description: "방송 성과를 실시간으로 모니터링하고 분석합니다"
    }
  ];

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId);
  };

  const handleSubscribe = (planId: string) => {
    if (planId === "enterprise") {
      // 엔터프라이즈 플랜은 문의 페이지로 이동
      window.location.href = "/contact";
    } else {
      // 결제 페이지로 이동
      window.location.href = `/checkout?plan=${planId}&billing=${isAnnual ? 'annual' : 'monthly'}`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border shadow-lg mb-6">
            <Star className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">요금제 선택</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            <span className="gradient-text">맞춤형 요금제</span>
            <br />
            <span className="text-foreground">선택하세요</span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8">
            사용 규모에 맞는 최적의 플랜을 선택하여
            <br />
            AI 음성 방송 서비스를 시작하세요
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <span className={`text-sm font-medium ${!isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
              월간 결제
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isAnnual ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isAnnual ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${isAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
              연간 결제
            </span>
            {isAnnual && (
              <Badge variant="secondary" className="ml-2">
                20% 할인
              </Badge>
            )}
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative transition-all duration-200 hover:shadow-xl ${
                plan.popular ? 'ring-2 ring-primary shadow-lg scale-105' : ''
              } ${plan.color}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-white px-4 py-1">
                    가장 인기
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center pb-4">
                <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                  <plan.icon className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription className="text-sm">
                  {plan.description}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Price */}
                <div className="text-center">
                  {plan.isCustom ? (
                    <div className="text-2xl font-bold">문의</div>
                  ) : (
                    <>
                      <div className="text-3xl font-bold">
                        ₩{(isAnnual ? plan.annualPrice : plan.monthlyPrice).toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {isAnnual ? '연간' : '월간'}
                      </div>
                    </>
                  )}
                </div>

                {/* Features */}
                <div className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Limitations */}
                {plan.limitations.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">제한사항</div>
                    {plan.limitations.map((limitation, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <div className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0">×</div>
                        <span className="text-sm text-muted-foreground">{limitation}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Select Button */}
                <div className="space-y-2">
                  <Button
                    className={`w-full ${plan.buttonColor} text-white`}
                    onClick={() => handleSubscribe(plan.id)}
                  >
                    {plan.isCustom ? '문의하기' : '선택하기'}
                  </Button>
                  
                  {!plan.isCustom && (
                    <div className="text-center">
                      <Checkbox
                        checked={selectedPlan === plan.id}
                        onCheckedChange={() => handlePlanSelect(plan.id)}
                        className="mr-2"
                      />
                      <span className="text-sm text-muted-foreground">이 플랜 선택</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Features Section */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">왜 Smart TTS를 선택해야 할까요?</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            업계 최고의 AI 음성 기술과 안정적인 서비스로 
            방송 품질을 한 단계 업그레이드하세요
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {features.map((feature, index) => (
            <Card key={index} className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="w-12 h-12 mx-auto mb-4 bg-primary/10 rounded-lg flex items-center justify-center">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">자주 묻는 질문</h2>
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">요금제를 언제든지 변경할 수 있나요?</h3>
                <p className="text-sm text-muted-foreground">
                  네, 언제든지 상위 요금제로 업그레이드하거나 하위 요금제로 다운그레이드할 수 있습니다. 
                  변경은 다음 결제 주기부터 적용됩니다.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">무료 체험 기간이 있나요?</h3>
                <p className="text-sm text-muted-foreground">
                  모든 요금제에 14일 무료 체험 기간이 제공됩니다. 
                  체험 기간 중 언제든지 취소할 수 있으며, 결제는 발생하지 않습니다.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">환불 정책은 어떻게 되나요?</h3>
                <p className="text-sm text-muted-foreground">
                  첫 달 결제 후 30일 이내에 100% 환불이 가능합니다. 
                  연간 결제의 경우 사용한 기간을 제외하고 비례 환불됩니다.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
