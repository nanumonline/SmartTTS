import React from "react";
import { Link, useLocation } from "react-router-dom";
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
  Users,
  Database,
  CheckCircle2,
  BookOpen,
  Volume2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

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
    title: "문구·대본",
    href: "/scripts",
    icon: FileText,
    children: [
      { title: "문구 관리", href: "/scripts", icon: ClipboardList },
      { title: "템플릿", href: "/scripts/templates", icon: BookOpen },
    ],
  },
  {
    title: "음원 생성",
    href: "/audio",
    icon: Mic2,
    children: [
      { title: "음성 스타일", href: "/audio/styles", icon: Volume2 },
      { title: "TTS 생성", href: "/audio/tts", icon: Play },
      { title: "클로닝", href: "/audio/cloning", icon: Mic2 },
      { title: "생성 내역", href: "/audio/history", icon: FileSearch },
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
      { title: "전송 설정", href: "/send/setup", icon: Settings },
      { title: "스케줄 관리", href: "/send/schedule", icon: Calendar },
      { title: "대상자 관리", href: "/send/audience", icon: Users },
    ],
  },
  {
    title: "관리",
    href: "/manage",
    icon: FolderOpen,
    children: [
      { title: "자산 관리", href: "/manage/assets", icon: Database },
      { title: "작업 큐", href: "/manage/jobs", icon: ClipboardList },
      { title: "승인·컴플라이언스", href: "/manage/compliance", icon: Shield },
      { title: "감사로그", href: "/manage/audit", icon: FileSearch },
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
      { title: "브랜드 정책", href: "/settings/brand", icon: FileText },
    ],
  },
];

interface SidebarProps {
  className?: string;
}

export default function Sidebar({ className }: SidebarProps) {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [expandedItems, setExpandedItems] = React.useState<Set<string>>(
    new Set([location.pathname.split("/")[1] || "dashboard"])
  );

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
    if (href === location.pathname) return true;
    // 자식 라우트 매칭
    return location.pathname.startsWith(href + "/");
  };

  const isParentActive = (item: NavItem) => {
    if (item.children) {
      return item.children.some((child) => isActive(child.href));
    }
    return isActive(item.href);
  };

  if (!isAuthenticated) {
    return null; // 비로그인 시 사이드바 숨김
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-background transition-transform flex-shrink-0",
        className
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-border px-6">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Mic2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold gradient-text">Smart TTS</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {navItems.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            const itemKey = item.href.split("/")[1] || item.href;
            const isExpanded = expandedItems.has(itemKey);
            const active = isParentActive(item);

            return (
              <div key={item.href}>
                {hasChildren ? (
                  <>
                    <button
                      onClick={() => toggleExpanded(itemKey)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </div>
                      <span
                        className={cn(
                          "h-4 w-4 transition-transform inline-flex items-center justify-center",
                          isExpanded ? "rotate-90" : ""
                        )}
                      >
                        ▶
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="ml-4 mt-1 space-y-1 border-l border-border pl-4">
                        {item.children!.map((child) => (
                          <Link
                            key={child.href}
                            to={child.href}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                              isActive(child.href)
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <child.icon className="h-3.5 w-3.5" />
                            <span>{child.title}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                    {item.badge && (
                      <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
