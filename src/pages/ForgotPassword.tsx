import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic2, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setIsSubmitting(true);
    
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError(resetError.message || "비밀번호 재설정 요청 중 오류가 발생했습니다.");
        toast({
          title: "요청 실패",
          description: resetError.message || "비밀번호 재설정 요청 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      } else {
        setSuccess(true);
        toast({
          title: "이메일 전송 완료",
          description: "비밀번호 재설정 링크가 이메일로 전송되었습니다.",
        });
      }
    } catch (err) {
      setError("비밀번호 재설정 요청 중 오류가 발생했습니다.");
      toast({
        title: "요청 실패",
        description: "비밀번호 재설정 요청 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse-glow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Mic2 className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold gradient-text">Smart TTS</span>
          </div>
          <p className="text-muted-foreground">AI 기반 음성 방송 시스템</p>
        </div>

        {/* Forgot Password Form */}
        <Card className="border-border/50 shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">비밀번호 찾기</CardTitle>
            <CardDescription className="text-center">
              등록된 이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center p-6 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold">이메일 전송 완료</h3>
                    <p className="text-sm text-muted-foreground">
                      {email}로 비밀번호 재설정 링크를 전송했습니다.
                      <br />
                      이메일을 확인하고 링크를 클릭하여 비밀번호를 재설정해주세요.
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Button 
                    onClick={() => navigate("/login")}
                    className="w-full h-11" 
                    variant="gradient"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    로그인 페이지로 돌아가기
                  </Button>
                  
                  <Button 
                    onClick={() => {
                      setSuccess(false);
                      setEmail("");
                    }}
                    className="w-full h-11" 
                    variant="outline"
                  >
                    다른 이메일로 다시 시도
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">이메일 주소</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11 pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    가입 시 사용한 이메일 주소를 입력해주세요.
                  </p>
                </div>

                {error && (
                  <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                    {error}
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full h-11" 
                  variant="gradient"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "전송 중..." : "비밀번호 재설정 링크 보내기"}
                </Button>

                <div className="text-center">
                  <Link 
                    to="/login" 
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    로그인 페이지로 돌아가기
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            계정이 없으신가요?{" "}
            <Link to="/register" className="text-primary hover:underline font-medium">
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

