import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return true;
    }
    const stored = window.localStorage.getItem("appShell.sidebar");
    if (stored === "closed") return false;
    if (stored === "open") return true;
    return window.innerWidth >= 1024;
  });
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.innerWidth < 1024;
  });

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === "undefined") return;
      const mobile = window.innerWidth < 1024;
      setIsMobileViewport(mobile);
      if (mobile) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (isMobileViewport) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname, isMobileViewport]);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("appShell.sidebar", next ? "open" : "closed");
      }
      return next;
    });
  };

  // 비로그인 상태에서는 기본 레이아웃 사용
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />
      {isSidebarOpen && isMobileViewport && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          role="presentation"
          onClick={toggleSidebar}
        />
      )}
      <div
        className={cn(
          "flex flex-1 flex-col overflow-hidden transition-all duration-300",
          "ml-0",
          !isMobileViewport && (isSidebarOpen ? "lg:ml-64" : "lg:ml-20")
        )}
      >
        <TopNav onToggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
