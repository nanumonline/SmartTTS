import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface User {
  id: string;
  email: string;
  name: string;
  organizationType?: string;
  organization?: string;
  department?: string;
  position?: string;
  plan: string;
  isActive: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (userData: any) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Supabase 인증 상태 관리
  useEffect(() => {
    // 초기 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserProfile(session.user);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    // 인증 상태 변경 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          await loadUserProfile(session.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsLoading(false);
          setIsLoggingIn(false);
          localStorage.removeItem("user");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (authUser: any, skipLoadingState = false) => {
    if (!skipLoadingState) {
      setIsLoading(true);
    }
    try {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();

      // 프로필이 없어도 기본 사용자 정보로 생성
      const user: User = {
        id: authUser.id,
        email: authUser.email || "",
        name: profile?.full_name || authUser.email?.split("@")[0] || "",
        organizationType: "public",
        organization: profile?.organization || "",
        department: profile?.department || "",
        position: "",
        plan: "standard",
        isActive: true,
      };

      setUser(user);
      localStorage.setItem("user", JSON.stringify(user));
    } catch (error) {
      console.error("Failed to load profile:", error);
      // 프로필 로드 실패해도 기본 사용자 정보는 설정
      const user: User = {
        id: authUser.id,
        email: authUser.email || "",
        name: authUser.email?.split("@")[0] || "",
        organizationType: "public",
        organization: "",
        department: "",
        position: "",
        plan: "standard",
        isActive: true,
      };
      setUser(user);
      localStorage.setItem("user", JSON.stringify(user));
    } finally {
      if (!skipLoadingState) {
        setIsLoading(false);
        setIsLoggingIn(false);
      }
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoggingIn(true);
    setIsLoading(true);
    
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData?.user) {
        console.error("Login failed:", authError?.message);
        setIsLoading(false);
        setIsLoggingIn(false);
        return false;
      }

      // 인증 성공 - 프로필 로드 완료까지 대기
      await loadUserProfile(authData.user);
      return true;
    } catch (error) {
      console.error("Login error:", error);
      setIsLoading(false);
      setIsLoggingIn(false);
      return false;
    }
  };

  const register = async (userData: any): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: userData.name,
            organization: userData.organization,
            department: userData.department,
          },
        },
      });

      if (authError || !authData?.user) {
        console.error("Register failed:", authError?.message);
        setIsLoading(false);
        return false;
      }

      // 회원가입 성공 - 프로필 로드는 onAuthStateChange에서 처리됨
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("Register error:", error);
      setIsLoading(false);
      return false;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    localStorage.removeItem("user");
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    register
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
