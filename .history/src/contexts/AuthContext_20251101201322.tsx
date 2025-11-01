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

  // Supabase 세션 확인 및 로컬 스토리지에서 사용자 정보 로드
  useEffect(() => {
    const loadUser = async () => {
      try {
        // Supabase 세션 확인
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // 실제 Supabase 인증된 사용자
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

          const user: User = {
            id: session.user.id,
            email: session.user.email || "",
            name: profile?.full_name || session.user.email?.split("@")[0] || "",
            organizationType: "public",
            organization: profile?.organization || "",
            department: profile?.department || "",
            position: "",
            plan: "standard",
            isActive: true,
          };

          setUser(user);
          localStorage.setItem("user", JSON.stringify(user));
        } else {
          // 로컬 스토리지에서 사용자 정보 로드
          const savedUser = localStorage.getItem("user");
          if (savedUser) {
            try {
              const parsed = JSON.parse(savedUser);
              // UUID 형식 확인 및 수정
              if (!parsed.id || !parsed.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                let userId = localStorage.getItem("test_user_id");
                if (!userId || !userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                  userId = crypto.randomUUID();
                  localStorage.setItem("test_user_id", userId);
                }
                parsed.id = userId;
                localStorage.setItem("user", JSON.stringify(parsed));
              }
              setUser(parsed);
            } catch (error) {
              console.error("Failed to parse saved user:", error);
              localStorage.removeItem("user");
            }
          }
        }
      } catch (error) {
        console.error("Failed to load user:", error);
        // 폴백: 로컬 스토리지에서 로드
        const savedUser = localStorage.getItem("user");
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch (e) {
            localStorage.removeItem("user");
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      // 실제 Supabase Auth 사용 시도
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authData?.user && !authError) {
        // 실제 인증 성공 - Supabase에서 사용자 정보 가져오기
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authData.user.id)
          .single();

        const user: User = {
          id: authData.user.id, // UUID 형식
          email: authData.user.email || email,
          name: profile?.full_name || email.split("@")[0],
          organizationType: "public",
          organization: profile?.organization || "",
          department: profile?.department || "",
          position: "",
          plan: "standard",
          isActive: true,
        };

        setUser(user);
        localStorage.setItem("user", JSON.stringify(user));
        setIsLoading(false);
        return true;
      }

      // 인증 실패 시 더미 사용자 생성 (UUID 형식)
      if (email && password) {
        // localStorage에서 기존 UUID 가져오기 또는 새로 생성
        let userId = localStorage.getItem("test_user_id");
        if (!userId || !userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          userId = crypto.randomUUID();
          localStorage.setItem("test_user_id", userId);
        }

        const mockUser: User = {
          id: userId, // UUID 형식
          email,
          name: "홍길동",
          organizationType: "public",
          organization: "춘천시청",
          department: "시민안전과",
          position: "과장",
          plan: "standard",
          isActive: true
        };
        
        setUser(mockUser);
        localStorage.setItem("user", JSON.stringify(mockUser));
        setIsLoading(false);
        return true;
      }
      
      setIsLoading(false);
      return false;
    } catch (error) {
      console.error("Login error:", error);
      setIsLoading(false);
      return false;
    }
  };

  const register = async (userData: any): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      // 실제 Supabase Auth 사용 시도
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            full_name: userData.name,
            organization: userData.organization,
            department: userData.department,
          },
        },
      });

      if (authData?.user && !authError) {
        // 실제 회원가입 성공
        const user: User = {
          id: authData.user.id, // UUID 형식
          email: authData.user.email || userData.email,
          name: userData.name,
          organizationType: userData.organizationType,
          organization: userData.organization,
          department: userData.department,
          position: userData.position,
          plan: userData.plan || "public_basic",
          isActive: true,
        };

        setUser(user);
        localStorage.setItem("user", JSON.stringify(user));
        setIsLoading(false);
        return true;
      }

      // 더미 회원가입 (UUID 형식)
      let userId = localStorage.getItem("test_user_id");
      if (!userId || !userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        userId = crypto.randomUUID();
        localStorage.setItem("test_user_id", userId);
      }

      const mockUser: User = {
        id: userId, // UUID 형식
        email: userData.email,
        name: userData.name,
        organizationType: userData.organizationType,
        organization: userData.organization,
        department: userData.department,
        position: userData.position,
        plan: userData.plan || "public_basic",
        isActive: true
      };
      
      setUser(mockUser);
      localStorage.setItem("user", JSON.stringify(mockUser));
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("Register error:", error);
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
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
