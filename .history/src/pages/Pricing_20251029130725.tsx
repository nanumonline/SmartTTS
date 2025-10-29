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
      name: "기본",
      description: "소규모 공공기관을 위한 기본 플랜",
      icon: Mic2,
      monthlyPrice: 99000,
      annualPrice: 990000,
      credits: 20000,
      creditsDescription: "약 30분",
      tagline: "매일 공지사항 1개씩! 만들 수 있어요!",
      features: [
        "모든 음성 이용 가능",
        "보이스 클로닝 무제한 사용",
        "무제한 다운로드",
        "상업적 이용 가능"
      ],
      limitations: [],
      apiFeatures: [
        "Cloned Voice",
        "Text-to-Speech"
      ],
      requestLimit: "분당 20회 요청",
      popular: false,
      color: "border-blue-200",
      buttonColor: "bg-blue-500 hover:bg-blue-600",
      targetOrg: "소규모 공공기관"
    },
    {
      id: "standard",
      name: "표준",
      description: "시·군청을 위한 표준 플랜",
      icon: Star,
      monthlyPrice: 299000,
      annualPrice: 2990000,
      credits: 100000,
      creditsDescription: "약 150분",
      tagline: "공지사항과 정책발표 모두 만드는 공공기관들에게 인기!",
      features: [
        "모든 음성 이용 가능",
        "보이스 클로닝 무제한 사용",
        "무제한 다운로드",
        "단어 및 문장 간격 조절 가능",
        "상업적 이용 가능"
      ],
      limitations: [],
      apiFeatures: [
        "Cloned Voice",
        "Text-to-Speech"
      ],
      requestLimit: "분당 30회 요청",
      popular: true,
      color: "border-primary",
      buttonColor: "bg-primary hover:bg-primary/90",
      targetOrg: "시·군청"
    },
    {
      id: "premium",
      name: "프리미엄",
      description: "도청급 기관을 위한 프리미엄 플랜",
      icon: Crown,
      monthlyPrice: 499000,
      annualPrice: 4990000,
      credits: 500000,
      creditsDescription: "약 800분",
      tagline: "본격 전문 공공기관을 위한 추천",
      features: [
        "모든 음성 이용 가능",
        "보이스 클로닝 무제한 사용",
        "무제한 다운로드",
        "단어 및 문장 간격 조절 가능",
        "상업적 이용 가능"
      ],
      limitations: [],
      apiFeatures: [
        "Cloned Voice",
        "Text-to-Speech"
      ],
      requestLimit: "분당 60회 요청",
      popular: false,
      color: "border-purple-200",
      buttonColor: "bg-purple-500 hover:bg-purple-600",
      targetOrg: "도청급 기관"
    },
    {
      id: "custom",
      name: "맞춤형",
      description: "대규모 공공기관을 위한 맞춤형 솔루션",
      icon: Building2,
      monthlyPrice: 999000,
      annualPrice: 9990000,
      credits: 1000000,
      creditsDescription: "무제한",
      tagline: "대규모 공공기관을 위한 완전 맞춤형 솔루션",
      features: [
        "무제한 방송 시간",
        "완전 맞춤형 음성 스타일",
        "기관별 전용 템플릿 개발",
        "무제한 스토리지",
        "전담 계정 매니저",
        "실시간 모니터링 시스템",
        "무제한 동시 방송",
        "기관 내부 시스템 통합",
        "고위직 음성 클로닝",
        "SLA 보장 (99.9%)",
        "온사이트 지원",
        "공공기관 보안 인증"
      ],
      limitations: [],
      apiFeatures: [
        "Cloned Voice",
        "Text-to-Speech",
        "Custom API"
      ],
      requestLimit: "무제한",
      popular: false,
      color: "border-gray-200",
      buttonColor: "bg-gray-800 hover:bg-gray-900",
      isCustom: true,
      targetOrg: "대규모 공공기관"
    }
  ];

  const features = [
    {
      icon: Zap,
      title: "즉시 음성 생성",
      description: "긴급상황 발생 시 몇 초 만에 공지사항 음성을 생성합니다"
    },
    {
      icon: Shield,
      title: "공공기관 보안",
      description: "공공기관 보안 인증을 받은 안전한 서비스로 데이터를 보호합니다"
    },
    {
      icon: Headphones,
      title: "전담 지원팀",
      description: "공공기관 전담 지원팀이 업무시간 내 신속한 지원을 제공합니다"
    },
    {
      icon: BarChart3,
      title: "서비스 성과 분석",
      description: "시민 서비스 만족도와 방송 효과를 실시간으로 분석합니다"
    }
  ];

  const handlePlanSelect = (planId: string) => {
    setSelectedPlan(planId);
  };

  const handleSubscribe = (planId: string) => {
    if (planId === "custom") {
      handleInquiry(planId);
    } else {
      // 결제 페이지로 이동
      window.location.href = `/checkout?plan=${planId}&billing=${isAnnual ? 'annual' : 'monthly'}`;
    }
  };

  const handleInquiry = (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (plan) {
      const subject = encodeURIComponent(`[Smart TTS] ${plan.name} 플랜 문의`);
      const body = encodeURIComponent(`
안녕하세요.

${plan.name} 플랜에 대해 문의드립니다.

기관명: 
담당자명: 
연락처: 
이메일: 
문의사항: 

감사합니다.
      `);
      
      const mailtoLink = `mailto:admin@smarttts.co.kr?subject=${subject}&body=${body}`;
      window.open(mailtoLink);
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
            <span className="gradient-text">공공기관 전용</span>
            <br />
            <span className="text-foreground">요금제</span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-8">
            공공기관 규모에 맞는 최적의 플랜으로
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
                {plan.tagline && (
                  <div className="text-sm text-green-600 font-medium mt-2">
                    {plan.tagline}
                  </div>
                )}
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Price */}
                <div className="text-center">
                  {plan.isCustom ? (
                    <>
                      <div className="text-3xl font-bold">
                        ₩{(isAnnual ? plan.annualPrice : plan.monthlyPrice).toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {isAnnual ? '연간' : '월간'}
                      </div>
                      <div className="text-sm text-primary font-medium">
                        {plan.credits.toLocaleString()} 크레딧 ({plan.creditsDescription})
                      </div>
                      <div className="text-xs text-muted-foreground">
                        *크레딧은 매월 초기화되며 이월이 불가합니다
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-3xl font-bold">
                        ₩{(isAnnual ? plan.annualPrice : plan.monthlyPrice).toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {isAnnual ? '연간' : '월간'}
                      </div>
                      {plan.credits && (
                        <div className="text-sm text-primary font-medium">
                          {plan.credits.toLocaleString()} 크레딧 ({plan.creditsDescription})
                        </div>
                      )}
                      {plan.credits && (
                        <div className="text-xs text-muted-foreground">
                          *크레딧은 매월 초기화되며 이월이 불가합니다
                        </div>
                      )}
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

                {/* API Features */}
                {plan.apiFeatures && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">이용 가능한 API</div>
                    {plan.apiFeatures.map((apiFeature, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <div className="w-1 h-1 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                        <span className="text-sm">{apiFeature}</span>
                      </div>
                    ))}
                    {plan.requestLimit && (
                      <div className="text-xs text-muted-foreground mt-2">
                        요청 제한: {plan.requestLimit}
                      </div>
                    )}
                  </div>
                )}

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
                    {plan.isCustom ? '문의하기' : '구독하기'}
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
                  
                  {!plan.isCustom && plan.id !== "basic" && plan.id !== "custom" && (
                    <div className="text-center mt-2">
                      <a href="#" className="text-sm text-green-600 hover:text-green-700">
                        연간 결제가 필요하신가요?
                      </a>
                    </div>
                  )}
                  
                  <div className="text-center mt-2">
                    <div className="text-xs text-muted-foreground">
                      * 모든 가격은 부가세별도입니다
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Features Section */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">왜 공공기관이 Smart TTS를 선택해야 할까요?</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            공공기관 전용 기능과 안정적인 서비스로 
            시민 서비스 품질을 한 단계 업그레이드하세요
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
          <h2 className="text-3xl font-bold text-center mb-8">공공기관 자주 묻는 질문</h2>
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">공공기관 할인이 있나요?</h3>
                <p className="text-sm text-muted-foreground">
                  공공기관은 연간 결제 시 20% 할인 혜택을 받을 수 있습니다. 
                  또한 대규모 계약 시 추가 할인 및 맞춤형 조건을 제공합니다.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">공공기관 보안 인증은 받았나요?</h3>
                <p className="text-sm text-muted-foreground">
                  네, 공공기관 보안 인증을 받았으며, 개인정보보호법 및 정보통신망법을 준수합니다. 
                  모든 데이터는 국내 서버에서 관리되며, 정부 보안 가이드라인을 충족합니다.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">긴급상황 시 지원이 가능한가요?</h3>
                <p className="text-sm text-muted-foreground">
                  긴급상황 발생 시 24시간 긴급 지원 서비스를 제공합니다. 
                  자연재해, 보안사고 등 공공기관 긴급상황에 즉시 대응할 수 있습니다.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">기관 내부 시스템과 연동이 가능한가요?</h3>
                <p className="text-sm text-muted-foreground">
                  네, 기관 내부 시스템과의 연동을 지원합니다. 
                  API를 통해 기존 방송 시스템, 홈페이지, 모바일 앱 등과 연동하여 통합 관리가 가능합니다.
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
