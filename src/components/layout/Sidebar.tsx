import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Mic2,
  Music2,
  Send,
  Settings,
  BarChart3,
  FolderOpen,
  ClipboardList,
  Shield,
  FileSearch,
  Play,
  Calendar,
  Database,
  CheckCircle2,
  BookOpen,
  X,
  ChevronRight,
  Radio,
  Zap,
  Activity,
  Download,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { loadBrandSettings, getLogoUrl } from "@/lib/brandSettings";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  children?: NavItem[];
}

export const navItems: NavItem[] = [
  {
    title: "대시보드",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "긴급 방송",
    href: "/emergency",
    icon: Zap,
    badge: "긴급",
  },
  {
    title: "문구·대본",
    href: "/scripts",
    icon: FileText,
    children: [
      { title: "문구 목록", href: "/scripts", icon: ClipboardList },
      { title: "문구 관리", href: "/scripts/messages", icon: FileText },
      { title: "템플릿", href: "/scripts/templates", icon: BookOpen },
    ],
  },
  {
    title: "음원 생성",
    href: "/audio",
    icon: Mic2,
    children: [
      { title: "TTS 생성", href: "/audio/tts", icon: Play },
      // 클로닝 기능은 현재 제공하지 않습니다
      // { title: "클로닝", href: "/audio/cloning", icon: Mic2 },
      { title: "생성 내역", href: "/audio/history", icon: FileSearch },
      { title: "샘플 생성", href: "/generate-samples", icon: Download },
    ],
  },
  {
    title: "믹싱",
    href: "/mix",
    icon: Music2,
    children: [
      { title: "믹스 보드", href: "/mix/board", icon: Music2 },
      { title: "프리셋", href: "/mix/presets", icon: Database },
    ],
  },
  {
    title: "전송·스케줄",
    href: "/send",
    icon: Send,
    children: [
      { title: "즉시 송출", href: "/send/broadcast", icon: Radio },
      { title: "스케줄 관리", href: "/send/schedule", icon: Calendar },
      { title: "작업 큐", href: "/manage/jobs", icon: ClipboardList },
    ],
  },
  {
    title: "리포트",
    href: "/reports",
    icon: BarChart3,
    children: [
      { title: "요약 대시보드", href: "/reports", icon: BarChart3 },
      { title: "전송 리포트", href: "/reports/sends", icon: Send },
      { title: "품질 리포트", href: "/reports/quality", icon: CheckCircle2 },
    ],
  },
  {
    title: "설정",
    href: "/settings",
    icon: Settings,
    children: [
      { title: "통합 관리", href: "/settings/integrations", icon: Settings },
      { title: "권한 설정", href: "/settings/roles", icon: Shield },
      { title: "전송 설정", href: "/settings/setup", icon: Radio },
      { title: "브랜드 정책", href: "/settings/brand", icon: FileText },
    ],
  },
  {
    title: "시스템 헬스체크",
    href: "/health",
    icon: Activity,
  },
];

interface SidebarProps {
  className?: string;
  isOpen?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ className, isOpen = true, onToggle }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [expandedItems, setExpandedItems] = React.useState<Set<string>>(
    new Set([location.pathname.split("/")[1] || "dashboard"])
  );
  const [logoUrl, setLogoUrl] = useState<string | undefined>();

  // 브랜드 로고 로드
  useEffect(() => {
    const loadLogo = () => {
      const settings = loadBrandSettings();
      const logo = getLogoUrl(settings);
      setLogoUrl(logo);
    };
    
    loadLogo();
    
    // localStorage 변경 감지 (다른 탭에서 설정 변경 시)
    const handleStorageChange = () => {
      loadLogo();
    };
    
    // 커스텀 이벤트 감지 (같은 탭에서 설정 변경 시)
    const handleBrandSettingsChange = () => {
      loadLogo();
    };
    
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("brandSettingsChanged", handleBrandSettingsChange);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("brandSettingsChanged", handleBrandSettingsChange);
    };
  }, []);

  // 현재 경로와 일치하는 부모 아이템 자동 확장
  React.useEffect(() => {
    const pathSegments = location.pathname.split("/").filter(Boolean);
    if (pathSegments.length > 0) {
      const parentKey = pathSegments[0];
      setExpandedItems((prev) => new Set([...prev, parentKey]));
    }
  }, [location.pathname]);

  const toggleExpanded = (key: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const isActive = (href: string) => {
    // 정확한 경로 매칭만 허용
    return href === location.pathname;
  };

  const isParentActive = (item: NavItem) => {
    if (item.children && item.href) {
      return location.pathname.startsWith(item.href);
    }
    return isActive(item.href);
  };

  if (!isAuthenticated) {
    return null; // 비로그인 시 사이드바 숨김
  }

  const isCompact = !isOpen;

  const withTooltip = (label: string, node: React.ReactNode) => {
    if (!isCompact) {
      return node;
    }
    return (
      <Tooltip>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-border bg-background transition-all duration-300 ease-in-out flex-shrink-0",
        isOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full lg:translate-x-0 lg:w-20",
        className
      )}
      aria-hidden={false}
      data-compact={isCompact}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div
          className={cn(
            "flex h-16 items-center gap-3 border-b border-border px-4 cursor-pointer hover:bg-muted/50 transition-colors",
            isCompact && "justify-center"
          )}
          onClick={() => navigate("/")}
        >
          {logoUrl && !isCompact ? (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white flex items-center justify-center border border-border">
                <img
                  src={logoUrl}
                  alt="로고"
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    // 로고 로드 실패 시 기본 아이콘 표시
                    e.currentTarget.style.display = "none";
                    const parent = e.currentTarget.parentElement;
                    if (parent && !parent.querySelector(".fallback-icon")) {
                      const icon = document.createElement("div");
                      icon.className = "fallback-icon w-full h-full flex items-center justify-center";
                      icon.innerHTML = '<svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"></path></svg>';
                      parent.appendChild(icon);
                    }
                  }}
                />
              </div>
              <span className="text-lg font-bold gradient-text truncate">Smart TTS</span>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
                <Mic2 className="w-5 h-5 text-white" />
              </div>
              {!isCompact && (
                <span className="ml-3 text-lg font-bold gradient-text">Smart TTS</span>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav
          className={cn(
            "flex-1 space-y-1 overflow-y-auto",
            isOpen ? "p-4 pb-20" : "p-2 lg:pb-6"
          )}
        >
          {navItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const itemKey = item.href.split("/")[1] || item.href;
            const isExpanded = expandedItems.has(itemKey);
            const active = isParentActive(item);
            const iconClass = cn("h-4 w-4", !isOpen && "h-5 w-5");
            const targetHref = hasChildren && item.children ? item.children[0].href : item.href;

            if (hasChildren) {
              const parentLink = (
                <Link
                  to={targetHref}
                  aria-label={item.title}
                  className={cn(
                    "flex flex-1 items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    isOpen ? "gap-3" : "justify-center"
                  )}
                  onClick={() => {
                    if (typeof window !== "undefined" && window.innerWidth < 1024 && onToggle) {
                      onToggle();
                    }
                  }}
                >
                  <item.icon className={iconClass} />
                  {isOpen && <span className="truncate">{item.title}</span>}
                </Link>
              );

              const expandToggle = isOpen ? (
                <button
                  type="button"
                  onClick={() => toggleExpanded(itemKey)}
                  className={cn(
                    "ml-1 inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors",
                    "hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  )}
                  aria-label={isExpanded ? `${item.title} 접기` : `${item.title} 펼치기`}
                  aria-expanded={isExpanded}
                >
                  <ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
                </button>
              ) : null;

              const parentRow = (
                <div className={cn("flex", isOpen ? "items-center" : "justify-center")}>
                  {parentLink}
                  {expandToggle}
                </div>
              );

              return (
                <div key={item.href}>
                  {withTooltip(item.title, parentRow)}
                  {isOpen && isExpanded && (
                    <div className="ml-4 mt-1 space-y-1 border-l border-border pl-4">
                      {item.children!.map((child) => {
                        const childActive = isActive(child.href);
                        return (
                          <Link
                            key={child.href}
                            to={child.href}
                            onClick={() => {
                              if (typeof window !== "undefined" && window.innerWidth < 1024 && onToggle) {
                                onToggle();
                              }
                            }}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                              childActive
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <child.icon className="h-3.5 w-3.5" />
                            <span>{child.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const link = (
              <Link
                to={item.href}
                aria-label={item.title}
                className={cn(
                  "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  isOpen ? "gap-3" : "justify-center"
                )}
                onClick={() => {
                  if (typeof window !== "undefined" && window.innerWidth < 1024 && onToggle) {
                    onToggle();
                  }
                }}
              >
                <item.icon className={iconClass} />
                {isOpen && <span className="truncate">{item.title}</span>}
                {item.badge && isOpen && (
                  <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {item.badge}
                  </span>
                )}
              </Link>
            );

            return <div key={item.href}>{withTooltip(item.title, link)}</div>;
          })}
        </nav>
      </div>
      {onToggle && (
        <div className="lg:hidden absolute bottom-3 right-3">
          <button
            onClick={onToggle}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm hover:text-foreground hover:bg-muted transition-colors"
            aria-label="사이드바 닫기"
          >
            <span className="sr-only">사이드바 닫기</span>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </aside>
  );
}
