import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Mic2, User, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
    setIsOpen(false);
  };

  const handleMenuClick = () => {
    setIsOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Mic2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">Smart TTS</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/" className="text-sm font-medium hover:text-primary transition-colors">
              홈
            </Link>
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="text-sm font-medium hover:text-primary transition-colors">
                  대시보드
                </Link>
                <Link to="/voice-generator" className="text-sm font-medium hover:text-primary transition-colors">
                  음성 생성
                </Link>
                <Link to="/advanced-voice" className="text-sm font-medium hover:text-primary transition-colors">
                  고급 음성
                </Link>
                <Link to="/voice-cloning" className="text-sm font-medium hover:text-primary transition-colors">
                  보이스 클로닝
                </Link>
                <Link to="/schedule" className="text-sm font-medium hover:text-primary transition-colors">
                  스케줄
                </Link>
                <Link to="/analytics" className="text-sm font-medium hover:text-primary transition-colors">
                  통계
                </Link>
              </>
            ) : (
              <>
                <a href="#features" className="text-sm font-medium hover:text-primary transition-colors">
                  기능
                </a>
                <a href="#generator" className="text-sm font-medium hover:text-primary transition-colors">
                  음성 생성
                </a>
                <a href="#schedule" className="text-sm font-medium hover:text-primary transition-colors">
                  스케줄
                </a>
              </>
            )}
            <Link to="/pricing" className="text-sm font-medium hover:text-primary transition-colors">
              요금제
            </Link>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span>{user?.name}</span>
                </div>
                <Button variant="ghost" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  로그아웃
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost">로그인</Button>
                </Link>
                <Link to="/register">
                  <Button variant="gradient">시작하기</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden py-4 space-y-4 border-t border-border">
            <Link to="/dashboard" className="block py-2 text-sm font-medium hover:text-primary transition-colors" onClick={handleMenuClick}>
              대시보드
            </Link>
            <Link to="/voice-generator" className="block py-2 text-sm font-medium hover:text-primary transition-colors" onClick={handleMenuClick}>
              음성 생성
            </Link>
            <Link to="/advanced-voice" className="block py-2 text-sm font-medium hover:text-primary transition-colors" onClick={handleMenuClick}>
              고급 음성
            </Link>
            <Link to="/voice-cloning" className="block py-2 text-sm font-medium hover:text-primary transition-colors" onClick={handleMenuClick}>
              보이스 클로닝
            </Link>
            <Link to="/schedule" className="block py-2 text-sm font-medium hover:text-primary transition-colors" onClick={handleMenuClick}>
              스케줄
            </Link>
            <Link to="/analytics" className="block py-2 text-sm font-medium hover:text-primary transition-colors" onClick={handleMenuClick}>
              통계
            </Link>
            <Link to="/pricing" className="block py-2 text-sm font-medium hover:text-primary transition-colors" onClick={handleMenuClick}>
              요금제
            </Link>
            
            <div className="flex flex-col gap-2 pt-4">
              {isAuthenticated ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground px-2">
                    <User className="w-4 h-4" />
                    <span>{user?.name}</span>
                  </div>
                  <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    로그아웃
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={handleMenuClick}>
                    <Button variant="ghost" className="w-full">로그인</Button>
                  </Link>
                  <Link to="/register" onClick={handleMenuClick}>
                    <Button variant="gradient" className="w-full">시작하기</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
