import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BreadcrumbItem {
  label: string;
  href?: string;
  description?: string;
  progress?: {
    current: number;
    total: number;
    steps?: string[];
  };
}

interface BreadcrumbNavProps {
  items?: BreadcrumbItem[];
  className?: string;
}

const routeMap: Record<string, BreadcrumbItem[]> = {
  "/dashboard": [{ label: "대시보드", description: "전체 서비스 요약 및 통계" }],
  "/scripts": [{ label: "문구·대본", href: "/scripts", description: "저장된 문구 목록" }],
  "/scripts/messages": [
    { label: "문구·대본", href: "/scripts", description: "문구 목록으로 돌아가기" },
    { label: "문구 관리", description: "메시지 작성 및 편집" },
  ],
  "/scripts/templates": [
    { label: "문구·대본", href: "/scripts", description: "문구 목록으로 돌아가기" },
    { label: "템플릿", description: "메시지 템플릿 관리" },
  ],
  "/audio/tts": [
    { label: "음원 생성", href: "/audio", description: "음원 생성 메뉴" },
    { 
      label: "TTS 생성",
      description: "텍스트를 음성으로 변환하여 생성합니다",
      progress: {
        current: 0,
        total: 5,
        steps: ["목적 선택", "문구 작성", "음성 선택", "음원 생성", "저장 완료"]
      }
    },
  ],
  "/audio/cloning": [
    { label: "음원 생성", href: "/audio", description: "음원 생성 메뉴" },
    { label: "클로닝", description: "기존 음성을 기반으로 클론 음성을 생성합니다" },
  ],
  "/audio/history": [
    { label: "음원 생성", href: "/audio", description: "음원 생성 메뉴" },
    { label: "생성 내역", description: "생성된 음원 목록 및 관리" },
  ],
  "/mix/board": [
    { label: "믹싱", href: "/mix" },
    { label: "믹스 보드" },
  ],
  "/mix/presets": [
    { label: "믹싱", href: "/mix" },
    { label: "프리셋" },
  ],
  "/send/schedule": [
    { label: "전송·스케줄", href: "/send" },
    { label: "스케줄 관리" },
  ],
  "/send/setup": [
    { label: "전송·스케줄", href: "/send" },
    { label: "전송 설정" },
  ],
  "/send/audience": [
    { label: "전송·스케줄", href: "/send" },
    { label: "대상자 관리" },
  ],
  "/manage/assets": [
    { label: "관리", href: "/manage" },
    { label: "자산 관리" },
  ],
  "/manage/jobs": [
    { label: "관리", href: "/manage" },
    { label: "작업 큐" },
  ],
  "/manage/compliance": [
    { label: "관리", href: "/manage" },
    { label: "승인·컴플라이언스" },
  ],
  "/manage/audit": [
    { label: "관리", href: "/manage" },
    { label: "감사로그" },
  ],
  "/reports": [{ label: "리포트" }],
  "/reports/sends": [
    { label: "리포트", href: "/reports" },
    { label: "전송 리포트" },
  ],
  "/reports/quality": [
    { label: "리포트", href: "/reports" },
    { label: "품질 리포트" },
  ],
  "/settings/integrations": [
    { label: "설정", href: "/settings" },
    { label: "통합 관리" },
  ],
  "/settings/roles": [
    { label: "설정", href: "/settings" },
    { label: "권한 설정" },
  ],
  "/settings/brand": [
    { label: "설정", href: "/settings" },
    { label: "브랜드 정책" },
  ],
};

export default function BreadcrumbNav({ items, className }: BreadcrumbNavProps) {
  const location = useLocation();
  const defaultItems = routeMap[location.pathname] || [];

  const breadcrumbItems: BreadcrumbItem[] = items || defaultItems;

  if (breadcrumbItems.length === 0) {
    return null;
  }

  return (
    <nav
      className={cn("flex items-center space-x-1 text-sm text-muted-foreground mb-4", className)}
      aria-label="Breadcrumb"
    >
      <Link
        to="/dashboard"
        className="flex items-center hover:text-foreground transition-colors"
      >
        <Home className="w-4 h-4" />
      </Link>
      {breadcrumbItems.map((item, index) => {
        const isLast = index === breadcrumbItems.length - 1;
        const breadcrumbContent = isLast || !item.href ? (
          <span className="text-foreground font-medium">{item.label}</span>
        ) : (
          <Link
            to={item.href}
            className="hover:text-foreground transition-colors"
          >
            {item.label}
          </Link>
        );

        return (
          <React.Fragment key={index}>
            <ChevronRight className="w-4 h-4 mx-1" />
            {item.description || item.progress ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-flex items-center gap-1">
                      {breadcrumbContent}
                      <Info className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-2">
                      {item.description && (
                        <p className="text-sm">{item.description}</p>
                      )}
                      {item.progress && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium">
                            진행 상태: {item.progress.current} / {item.progress.total}
                          </p>
                          {item.progress.steps && (
                            <ul className="text-xs space-y-1">
                              {item.progress.steps.map((step, idx) => (
                                <li key={idx} className={idx < item.progress.current ? "text-green-500" : "text-muted-foreground"}>
                                  {idx < item.progress.current ? "✓" : "○"} {step}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              breadcrumbContent
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

