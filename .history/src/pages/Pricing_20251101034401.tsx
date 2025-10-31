import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import HomeButton from "@/components/HomeButton";
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
      monthlyPrice: 0,
      annualPrice: 0,
      credits: 0,
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

  const handleSubscribe = (planId: string) => {
    if (planId === "custom") {
      handleInquiry(planId);
    } else {
      // 관공서 특성상 영업담당자 문의 후 세금계산서 발행 후 입금
      handleInquiry(planId);
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
직책: 
연락처: 
이메일: 
예산 승인 여부: 
세금계산서 발행 필요 여부: 
문의사항: 

※ 관공서 특성상 영업담당자와 상담 후 세금계산서 발행 후 입금 형태로 진행됩니다.

감사합니다.
      `);
      
      const mailtoLink = `mailto:june@nanumlab.com?subject=${subject}&body=${body}`;
      window.open(mailtoLink);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F7FA' }}>
      {/* Header */}
      <div className="border-b border-border bg-white/95 backdrop-blur-lg shadow-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center mb-4">
            <HomeButton />
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto landio-fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border/50 shadow-md mb-6">
            <Star className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">요금제 선택</span>
          </div>
          
          <h1 className="landio-text-h1 mb-6">
            <span className="gradient-text">공공기관 전용</span>
            <br />
            <span className="text-gray-900" style={{ color: '#1F2937' }}>요금제</span>
          </h1>
          
          <p className="landio-text-body mb-8" style={{ color: '#4B5563' }}>
            공공기관 규모에 맞는 최적의 플랜으로
            <br />
            AI 음성 방송 서비스를 시작하세요
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <span className={`text-sm font-medium ${!isAnnual ? 'text-gray-900' : 'text-gray-500'}`} style={!isAnnual ? { color: '#1F2937' } : { color: '#6B7280' }}>
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
            <span className={`text-sm font-medium ${isAnnual ? 'text-gray-900' : 'text-gray-500'}`} style={isAnnual ? { color: '#1F2937' } : { color: '#6B7280' }}>
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
        <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {plans.map((plan) => (
            <div key={plan.id} className="relative landio-fade-up">
              <RadioGroupItem value={plan.id} id={plan.id} className="sr-only" />
              <Label htmlFor={plan.id} className="cursor-pointer">
                <Card
                  className={`landio-card relative transition-all duration-300 ${
                    plan.popular ? 'ring-2 ring-primary shadow-xl scale-105' : ''
                  } ${plan.color} ${selectedPlan === plan.id ? 'ring-2 ring-primary shadow-xl' : ''}`}
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
                      <div className="text-2xl font-bold">문의</div>
                      <div className="text-sm text-primary font-medium">
                        무제한 크레딧
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
                    className={`w-full landio-button ${plan.buttonColor} text-white`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInquiry(plan.id);
                    }}
                  >
                    {plan.isCustom ? '문의하기' : '상담 문의'}
                  </Button>
                  
                  {!plan.isCustom && (
                    <div className="text-center">
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
                    <div className="text-xs text-blue-600 mt-1">
                      ※ 관공서 특성상 영업담당자 상담 후 세금계산서 발행 후 입금
                    </div>
                  </div>
                </div>
              </CardContent>
                </Card>
              </Label>
            </div>
          ))}
        </RadioGroup>

        {/* Features Section */}
        <div className="text-center mb-12 landio-fade-up">
          <h2 className="landio-text-h2 mb-4">왜 공공기관이 Smart TTS를 선택해야 할까요?</h2>
          <p className="landio-text-body max-w-2xl mx-auto" style={{ color: '#4B5563' }}>
            공공기관 전용 기능과 안정적인 서비스로 
            시민 서비스 품질을 한 단계 업그레이드하세요
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {features.map((feature, index) => (
            <Card key={index} className="landio-card text-center landio-fade-up" style={{ animationDelay: `${index * 0.1}s` }}>
              <CardContent className="p-6">
                <div className="w-12 h-12 mx-auto mb-4 bg-primary/10 rounded-xl flex items-center justify-center" style={{ borderRadius: '12px' }}>
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2 font-display" style={{ color: '#1F2937' }}>{feature.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto landio-fade-up">
          <h2 className="landio-text-h2 text-center mb-8">공공기관 자주 묻는 질문</h2>
          <div className="space-y-4">
            <Card className="landio-card">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2 font-display" style={{ color: '#1F2937' }}>공공기관 할인이 있나요?</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>
                  공공기관은 연간 결제 시 20% 할인 혜택을 받을 수 있습니다. 
                  또한 대규모 계약 시 추가 할인 및 맞춤형 조건을 제공합니다.
                </p>
              </CardContent>
            </Card>
            
            <Card className="landio-card">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2 font-display" style={{ color: '#1F2937' }}>공공기관 보안 인증은 받았나요?</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>
                  네, 공공기관 보안 인증을 받았으며, 개인정보보호법 및 정보통신망법을 준수합니다. 
                  모든 데이터는 국내 서버에서 관리되며, 정부 보안 가이드라인을 충족합니다.
                </p>
              </CardContent>
            </Card>
            
            <Card className="landio-card">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2 font-display" style={{ color: '#1F2937' }}>긴급상황 시 지원이 가능한가요?</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>
                  긴급상황 발생 시 24시간 긴급 지원 서비스를 제공합니다. 
                  자연재해, 보안사고 등 공공기관 긴급상황에 즉시 대응할 수 있습니다.
                </p>
              </CardContent>
            </Card>
            
            <Card className="landio-card">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2 font-display" style={{ color: '#1F2937' }}>기관 내부 시스템과 연동이 가능한가요?</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#4B5563' }}>
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
