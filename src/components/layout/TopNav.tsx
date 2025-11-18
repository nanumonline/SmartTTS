import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, User, LogOut, Settings as SettingsIcon, Menu, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TopNavProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export default function TopNav({ onToggleSidebar, isSidebarOpen }: TopNavProps) {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  if (!isAuthenticated) {
    return null;
  }

  const userInitials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "U";

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6 w-full">
      <div className="flex flex-1 items-center gap-3">
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "text-muted-foreground transition-colors hover:text-foreground",
              isSidebarOpen && "text-primary"
            )}
            onClick={onToggleSidebar}
            aria-label={isSidebarOpen ? "사이드바 닫기" : "사이드바 열기"}
            aria-expanded={isSidebarOpen}
            aria-pressed={isSidebarOpen}
          >
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            <span className="sr-only">
              {isSidebarOpen ? "사이드바 닫기" : "사이드바 열기"}
            </span>
          </Button>
        )}
        {/* Breadcrumb 등 추가 공간 */}
      </div>
      
      <div className="flex items-center gap-4">
        {/* 알림 버튼 */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
          >
            3
          </Badge>
        </Button>

        {/* 사용자 메뉴 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name || "사용자"}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email || ""}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/dashboard")}>
              <User className="mr-2 h-4 w-4" />
              <span>대시보드</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <SettingsIcon className="mr-2 h-4 w-4" />
              <span>설정</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>로그아웃</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
