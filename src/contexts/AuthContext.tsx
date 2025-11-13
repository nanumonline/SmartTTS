import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
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
  const isLoggingInRef = useRef(false);

  // Supabase 인증 상태 관리
  useEffect(() => {
    // 초기 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // 즉시 기본 사용자 정보 설정 (프로필 로드 기다리지 않음)
        const defaultUser: User = {
          id: session.user.id,
          email: session.user.email || "",
          name: session.user.email?.split("@")[0] || "",
          organizationType: "public",
          organization: "",
          department: "",
          position: "",
          plan: "standard",
          isActive: true,
        };
        setUser(defaultUser);
        setIsLoading(false);
        
        // 프로필은 백그라운드에서 비동기로 로드
        loadUserProfile(session.user, true).catch(err => {
          console.warn("Background profile load failed:", err);
        });
      } else {
        setUser(null);
        setIsLoading(false);
      }
    }).catch((error) => {
      console.error("Session check failed:", error);
      setUser(null);
      setIsLoading(false);
    });

    // 인증 상태 변경 리스너 (CRITICAL: async 사용 금지 - 데드락 방지)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          // login 함수에서 이미 처리했으므로 중복 방지
          if (!isLoggingInRef.current) {
            // 즉시 기본 사용자 정보 설정 (동기 작업만)
            const defaultUser: User = {
              id: session.user.id,
              email: session.user.email || "",
              name: session.user.email?.split("@")[0] || "",
              organizationType: "public",
              organization: "",
              department: "",
              position: "",
              plan: "standard",
              isActive: true,
            };
            setUser(defaultUser);
            localStorage.setItem("user", JSON.stringify(defaultUser));
            
            // 프로필 로드는 setTimeout으로 지연하여 데드락 방지
            setTimeout(() => {
              loadUserProfile(session.user, true).catch(err => {
                console.warn("Background profile load failed:", err);
              });
            }, 0);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsLoading(false);
          isLoggingInRef.current = false;
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
      // 프로필 조회 시도 (Promise.race로 타임아웃 구현)
      const profilePromise = supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 2000)
      );
      
      // 2초 타임아웃으로 프로필 조회
      const { data: profile, error: profileError } = await Promise.race([
        profilePromise,
        timeoutPromise
      ]) as any;

      if (profileError) {
        console.warn("Profile query error:", profileError);
      }

      // 프로필이 없거나 에러가 발생해도 기본 사용자 정보로 생성
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
      console.warn("Profile load failed, using default user info:", error);
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
      // 항상 로딩 상태 해제
      if (!skipLoadingState) {
        setIsLoading(false);
        isLoggingInRef.current = false;
      }
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    isLoggingInRef.current = true;
    setIsLoading(true);
    
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData?.user) {
        console.error("Login failed:", authError?.message);
        setIsLoading(false);
        isLoggingInRef.current = false;
        return false;
      }

      // 인증 성공 - 즉시 기본 사용자 정보 설정
      const defaultUser: User = {
        id: authData.user.id,
        email: authData.user.email || "",
        name: authData.user.email?.split("@")[0] || "",
        organizationType: "public",
        organization: "",
        department: "",
        position: "",
        plan: "standard",
        isActive: true,
      };
      setUser(defaultUser);
      localStorage.setItem("user", JSON.stringify(defaultUser));
      
      // 로그인 성공 - 즉시 로딩 상태 해제
      setIsLoading(false);
      isLoggingInRef.current = false;
      
      // 프로필 로드는 백그라운드에서 비동기로 처리 (로딩 상태에 영향 없음)
      // 약간의 지연을 두어 onAuthStateChange와의 충돌 방지
      setTimeout(() => {
        loadUserProfile(authData.user, true).catch(err => {
          console.warn("Background profile load failed:", err);
        });
      }, 100);
      
      return true;
    } catch (error) {
      console.error("Login error:", error);
      setIsLoading(false);
      isLoggingInRef.current = false;
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

      if (authError) {
        console.error("Register failed:", authError?.message);
        setIsLoading(false);
        return false;
      }

      // 회원가입 성공 - 사용자가 생성되었는지 확인
      if (authData?.user) {
        // 즉시 기본 사용자 정보 설정
        const defaultUser: User = {
          id: authData.user.id,
          email: authData.user.email || "",
          name: userData.name || authData.user.email?.split("@")[0] || "",
          organizationType: userData.organizationType || "public",
          organization: userData.organization || "",
          department: userData.department || "",
          position: userData.position || "",
          plan: userData.plan || "standard",
          isActive: true,
        };
        setUser(defaultUser);
        localStorage.setItem("user", JSON.stringify(defaultUser));
        
        // 프로필 로드는 백그라운드에서 비동기로 처리 (로딩 상태에 영향 없음)
        loadUserProfile(authData.user, true).catch(err => {
          console.warn("Background profile load failed:", err);
        });
        
        setIsLoading(false);
        return true;
      }

      // 이메일 확인이 필요한 경우
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
