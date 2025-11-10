// 공통 페이지 유틸리티 함수들

/**
 * 날짜/시간 포맷팅 함수
 */
export const formatDateTime = (iso?: string): string => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR", { 
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

/**
 * 날짜만 포맷팅 (시간 제외)
 */
export const formatDate = (iso?: string): string => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("ko-KR", { 
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
};

/**
 * 용도 옵션 (공통) - PublicVoiceGenerator와 MessageManagementPage 통합 버전
 */
export interface PurposeOption {
  id: string;
  label: string;
  description: string;
  checklist?: string[];
  optimizedPrompt?: string;
}

export const purposeOptions: PurposeOption[] = [
  {
    id: "announcement",
    label: "안내방송",
    description: "일반 공지사항 안내",
    checklist: ["시간, 장소가 명확한가?", "핵심 정보가 앞부분에 있는가?", "행동요령이 구체적인가?"],
    optimizedPrompt: "안내방송 목적에 맞는 방송문을 작성하세요. 시간, 장소를 명확히 하고, 핵심 정보를 앞부분에 배치하며, 구체적인 행동요령을 포함해야 합니다.",
  },
  {
    id: "emergency",
    label: "긴급 안내",
    description: "비상 상황 안내",
    checklist: ["위험 상황이 명확히 설명되었는가?", "즉각적인 행동요령이 있는가?", "반복 안내가 필요한가?"],
    optimizedPrompt: "긴급 안내 목적에 맞는 방송문을 작성하세요. 위험 상황을 명확히 설명하고, 즉각적인 행동요령을 포함하며, 필요시 반복 안내를 해야 합니다.",
  },
  {
    id: "greeting",
    label: "인사말",
    description: "행사 인사말 및 축사",
    checklist: ["행사명/일시/장소를 포함했는가?", "감사 인사와 기대 메시지가 있는가?", "기관 identity가 드러나는가?"],
    optimizedPrompt: "행사 축사 목적에 맞는 방송문을 작성하세요. 행사명, 일시, 장소를 포함하고, 감사 인사와 기대 메시지를 담으며, 기관 identity가 드러나도록 작성해야 합니다.",
  },
  {
    id: "policy",
    label: "정책안내",
    description: "정책 및 제도 안내",
    checklist: ["정책 핵심 내용이 명확한가?", "시행일자 및 대상이 명시되었는가?", "문의처가 포함되었는가?"],
    optimizedPrompt: "정책안내 목적에 맞는 방송문을 작성하세요. 정책 핵심 내용을 명확히 하고, 시행일자 및 대상을 명시하며, 문의처를 포함해야 합니다.",
  },
  {
    id: "event",
    label: "행사 축사",
    description: "시장·도지사 등 주요 인사의 행사 축사",
    checklist: ["행사명/일시/장소를 포함했는가?", "감사 인사와 기대 메시지가 있는가?", "기관 identity가 드러나는가?"],
    optimizedPrompt: "행사 축사 목적에 맞는 방송문을 작성하세요. 행사명, 일시, 장소를 포함하고, 감사 인사와 기대 메시지를 담으며, 기관 identity가 드러나도록 작성해야 합니다.",
  },
  {
    id: "promotion",
    label: "홍보/광고",
    description: "관광·정책·캠페인 홍보 방송",
    checklist: ["핵심 메시지가 3문장 이내로 명확한가?", "콜 투 액션이 있는가?", "대상 채널에 맞는 톤인가?"],
    optimizedPrompt: "홍보/광고 목적에 맞는 방송문을 작성하세요. 핵심 메시지를 3문장 이내로 명확하게 전달하고, 콜 투 액션을 포함하며, 대상 채널에 맞는 톤으로 작성해야 합니다.",
  },
  {
    id: "service",
    label: "서비스 안내",
    description: "민원·공공서비스 이용 안내",
    checklist: ["접수 방법과 운영시간을 포함했는가?", "필수 서류/준비물을 안내했는가?", "문의 경로를 제시했는가?"],
    optimizedPrompt: "서비스 안내 목적에 맞는 방송문을 작성하세요. 접수 방법과 운영시간을 포함하고, 필수 서류/준비물을 안내하며, 문의 경로를 명확하게 제시해야 합니다.",
  },
  // 지자체 및 공공시설 특화 용도 추가
  {
    id: "welfare",
    label: "복지 안내",
    description: "복지 정책 및 수혜 안내",
    checklist: ["수혜 대상이 명확한가?", "신청 방법과 기한이 명시되었는가?", "문의처가 포함되었는가?"],
    optimizedPrompt: "복지 안내 목적에 맞는 방송문을 작성하세요. 수혜 대상을 명확히 하고, 신청 방법과 기한을 명시하며, 문의처를 포함해야 합니다.",
  },
  {
    id: "traffic",
    label: "교통 안내",
    description: "교통 정보 및 통행 안내",
    checklist: ["구간과 시간이 명확한가?", "대체 경로가 제시되었는가?", "주의사항이 포함되었는가?"],
    optimizedPrompt: "교통 안내 목적에 맞는 방송문을 작성하세요. 구간과 시간을 명확히 하고, 대체 경로를 제시하며, 주의사항을 포함해야 합니다.",
  },
  {
    id: "environment",
    label: "환경 안내",
    description: "환경 정책 및 캠페인 안내",
    checklist: ["환경 정책 목적이 명확한가?", "시민 참여 방법이 제시되었는가?", "기대 효과가 설명되었는가?"],
    optimizedPrompt: "환경 안내 목적에 맞는 방송문을 작성하세요. 환경 정책 목적을 명확히 하고, 시민 참여 방법을 제시하며, 기대 효과를 설명해야 합니다.",
  },
  {
    id: "culture",
    label: "문화/관광 안내",
    description: "문화행사 및 관광 정보 안내",
    checklist: ["행사명/일시/장소가 명확한가?", "참여 방법과 비용이 안내되었는가?", "연락처가 포함되었는가?"],
    optimizedPrompt: "문화/관광 안내 목적에 맞는 방송문을 작성하세요. 행사명, 일시, 장소를 명확히 하고, 참여 방법과 비용을 안내하며, 연락처를 포함해야 합니다.",
  },
  {
    id: "facility",
    label: "시설 이용 안내",
    description: "공공시설 이용 및 운영 안내",
    checklist: ["시설명과 위치가 명확한가?", "이용 시간과 방법이 안내되었는가?", "주의사항이 포함되었는가?"],
    optimizedPrompt: "시설 이용 안내 목적에 맞는 방송문을 작성하세요. 시설명과 위치를 명확히 하고, 이용 시간과 방법을 안내하며, 주의사항을 포함해야 합니다.",
  },
  {
    id: "civil",
    label: "민원 안내",
    description: "민원 접수 및 처리 안내",
    checklist: ["민원 종류와 접수 방법이 명확한가?", "처리 기한이 명시되었는가?", "필수 서류가 안내되었는가?"],
    optimizedPrompt: "민원 안내 목적에 맞는 방송문을 작성하세요. 민원 종류와 접수 방법을 명확히 하고, 처리 기한을 명시하며, 필수 서류를 안내해야 합니다.",
  },
  {
    id: "disaster",
    label: "재난 안내",
    description: "재난 대비 및 안전 안내",
    checklist: ["재난 유형과 위험도가 명확한가?", "대피 방법과 장소가 안내되었는가?", "긴급 연락처가 포함되었는가?"],
    optimizedPrompt: "재난 안내 목적에 맞는 방송문을 작성하세요. 재난 유형과 위험도를 명확히 하고, 대피 방법과 장소를 안내하며, 긴급 연락처를 포함해야 합니다.",
  },
  {
    id: "celebration",
    label: "축하 인사",
    description: "기념일 및 축하 인사",
    checklist: ["축하 대상과 이유가 명확한가?", "감사 인사가 포함되었는가?", "기관의 축하 메시지가 있는가?"],
    optimizedPrompt: "축하 인사 목적에 맞는 방송문을 작성하세요. 축하 대상과 이유를 명확히 하고, 감사 인사를 포함하며, 기관의 축하 메시지를 담아야 합니다.",
  },
  {
    id: "health",
    label: "보건 안내",
    description: "보건 정책 및 건강 정보 안내",
    checklist: ["보건 정보가 정확한가?", "행동요령이 구체적인가?", "관련 기관 연락처가 포함되었는가?"],
    optimizedPrompt: "보건 안내 목적에 맞는 방송문을 작성하세요. 보건 정보를 정확히 전달하고, 행동요령을 구체적으로 안내하며, 관련 기관 연락처를 포함해야 합니다.",
  },
  {
    id: "education",
    label: "교육 안내",
    description: "교육 프로그램 및 행사 안내",
    checklist: ["프로그램명과 대상이 명확한가?", "신청 방법과 기한이 안내되었는가?", "문의처가 포함되었는가?"],
    optimizedPrompt: "교육 안내 목적에 맞는 방송문을 작성하세요. 프로그램명과 대상을 명확히 하고, 신청 방법과 기한을 안내하며, 문의처를 포함해야 합니다.",
  },
];

/**
 * 용도별 메타데이터 조회
 */
export const getPurposeMeta = (purposeId: string) => {
  const option = purposeOptions.find((p) => p.id === purposeId) || purposeOptions[0];
  return {
    label: option.label,
    description: option.description,
    checklist: option.checklist || [],
    optimizedPrompt: option.optimizedPrompt || "",
  };
};

/**
 * FHD 와이드 화면 최적화 컨테이너 스타일
 */
export const containerStyles = {
  maxWidth: "1920px",
  margin: "0 auto",
  padding: "0 2rem",
} as const;

