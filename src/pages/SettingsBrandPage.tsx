import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Save, FileText, Shield, Upload, Clipboard, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { 
  saveBrandSettings, 
  loadBrandSettings, 
  fileToDataUrl, 
  clipboardToDataUrl,
  type BrandSettings 
} from "@/lib/brandSettings";

export default function SettingsBrandPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [brandSettings, setBrandSettings] = useState<BrandSettings>({
    organizationName: user?.organization || "",
    logoUrl: "",
    logoDataUrl: undefined,
    primaryColor: "#3b82f6",
    secondaryColor: "#8b5cf6",
    footerText: "",
    termsOfService: "",
    privacyPolicy: "",
    enableBranding: true,
  });
  const [isUploading, setIsUploading] = useState(false);

  // 저장된 브랜드 설정 로드
  useEffect(() => {
    const saved = loadBrandSettings();
    setBrandSettings({
      ...saved,
      organizationName: saved.organizationName || user?.organization || "",
    });
  }, [user?.organization]);

  const handleSave = () => {
    saveBrandSettings(brandSettings);
    toast({
      title: "저장 완료",
      description: "브랜드 정책이 저장되었습니다.",
    });
  };

  // 파일 업로드 처리
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 이미지 파일 검증
    if (!file.type.startsWith("image/")) {
      toast({
        title: "잘못된 파일 형식",
        description: "이미지 파일만 업로드 가능합니다.",
        variant: "destructive",
      });
      return;
    }

    // 파일 크기 제한 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "파일 크기 초과",
        description: "로고 파일은 5MB 이하만 업로드 가능합니다.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setBrandSettings({
        ...brandSettings,
        logoDataUrl: dataUrl,
        logoUrl: "", // 파일 업로드 시 URL 초기화
      });
      toast({
        title: "업로드 완료",
        description: "로고가 업로드되었습니다.",
      });
    } catch (error) {
      console.error("파일 업로드 실패:", error);
      toast({
        title: "업로드 실패",
        description: "파일 업로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // 붙여넣기 처리
  const handlePaste = async () => {
    // 사용자 제스처 확인 (클립보드 API는 사용자 제스처가 필요)
    try {
      const dataUrl = await clipboardToDataUrl();
      if (dataUrl) {
        setBrandSettings({
          ...brandSettings,
          logoDataUrl: dataUrl,
          logoUrl: "", // 붙여넣기 시 URL 초기화
        });
        toast({
          title: "붙여넣기 완료",
          description: "클립보드의 이미지가 로고로 설정되었습니다.",
        });
      } else {
        toast({
          title: "이미지 없음",
          description: "클립보드에 이미지가 없습니다. 이미지를 복사한 후 다시 시도해주세요.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("붙여넣기 실패:", error);
      
      let errorMessage = "클립보드 접근 권한이 필요합니다.";
      if (error.name === "NotAllowedError" || error.name === "SecurityError") {
        errorMessage = "클립보드 접근 권한이 거부되었습니다. 브라우저 설정에서 권한을 허용해주세요.";
      } else if (error.name === "NotFoundError") {
        errorMessage = "클립보드에 이미지가 없습니다.";
      } else if (error.message?.includes("HTTPS")) {
        errorMessage = "HTTPS 환경에서만 클립보드 접근이 가능합니다.";
      }
      
      toast({
        title: "붙여넣기 실패",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // 로고 삭제
  const handleRemoveLogo = () => {
    setBrandSettings({
      ...brandSettings,
      logoDataUrl: undefined,
      logoUrl: "",
    });
    toast({
      title: "로고 삭제",
      description: "로고가 제거되었습니다.",
    });
  };

  const currentLogoUrl = brandSettings.logoDataUrl || brandSettings.logoUrl;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">브랜드 정책</h1>
          <p className="text-muted-foreground mt-1">
            조직의 브랜드 정책을 설정합니다.
          </p>
        </div>
      </div>

      {/* 브랜드 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            브랜드 정보
          </CardTitle>
          <CardDescription>
            조직의 브랜드 정보를 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>조직명</Label>
            <Input
              value={brandSettings.organizationName}
              onChange={(e) =>
                setBrandSettings({
                  ...brandSettings,
                  organizationName: e.target.value,
                })
              }
              placeholder="조직명을 입력하세요"
            />
          </div>

          <div className="space-y-4">
            <Label>로고 설정</Label>
            
            {/* 로고 미리보기 */}
            {currentLogoUrl && (
              <div className="relative inline-block">
                <div className="relative w-32 h-32 border-2 border-border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                  <img
                    src={currentLogoUrl}
                    alt="로고 미리보기"
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                  onClick={handleRemoveLogo}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* 로고 업로드 옵션 */}
            <div className="space-y-3">
              {/* 파일 업로드 */}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="logo-file-input"
                />
                <label htmlFor="logo-file-input">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isUploading}
                    className="cursor-pointer"
                    asChild
                  >
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      {isUploading ? "업로드 중..." : "파일 업로드"}
                    </span>
                  </Button>
                </label>

                {/* 붙여넣기 버튼 */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePaste}
                >
                  <Clipboard className="w-4 h-4 mr-2" />
                  붙여넣기
                </Button>
              </div>

              {/* URL 입력 */}
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">또는 로고 URL 입력</Label>
                <Input
                  value={brandSettings.logoUrl}
                  onChange={(e) => {
                    setBrandSettings({ 
                      ...brandSettings, 
                      logoUrl: e.target.value,
                      logoDataUrl: undefined, // URL 입력 시 파일 데이터 초기화
                    });
                  }}
                  placeholder="https://example.com/logo.png"
                  disabled={!!brandSettings.logoDataUrl}
                />
                {brandSettings.logoDataUrl && (
                  <p className="text-xs text-muted-foreground">
                    파일이 업로드되어 있습니다. URL을 입력하려면 먼저 로고를 삭제하세요.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>주요 색상</Label>
              <Input
                type="color"
                value={brandSettings.primaryColor}
                onChange={(e) =>
                  setBrandSettings({
                    ...brandSettings,
                    primaryColor: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>보조 색상</Label>
              <Input
                type="color"
                value={brandSettings.secondaryColor}
                onChange={(e) =>
                  setBrandSettings({
                    ...brandSettings,
                    secondaryColor: e.target.value,
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>푸터 텍스트</Label>
            <Textarea
              value={brandSettings.footerText}
              onChange={(e) =>
                setBrandSettings({ ...brandSettings, footerText: e.target.value })
              }
              placeholder="푸터에 표시될 텍스트"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* 정책 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            정책 문서
          </CardTitle>
          <CardDescription>
            이용약관 및 개인정보처리방침을 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>이용약관</Label>
            <Textarea
              value={brandSettings.termsOfService}
              onChange={(e) =>
                setBrandSettings({
                  ...brandSettings,
                  termsOfService: e.target.value,
                })
              }
              placeholder="이용약관을 입력하세요..."
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <Label>개인정보처리방침</Label>
            <Textarea
              value={brandSettings.privacyPolicy}
              onChange={(e) =>
                setBrandSettings({
                  ...brandSettings,
                  privacyPolicy: e.target.value,
                })
              }
              placeholder="개인정보처리방침을 입력하세요..."
              rows={6}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>브랜딩 활성화</Label>
              <p className="text-sm text-muted-foreground">
                브랜드 정책을 적용합니다
              </p>
            </div>
            <Switch
              checked={brandSettings.enableBranding}
              onCheckedChange={(checked) =>
                setBrandSettings({
                  ...brandSettings,
                  enableBranding: checked,
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          저장
        </Button>
      </div>
    </div>
  );
}
