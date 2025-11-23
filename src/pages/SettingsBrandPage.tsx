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
  applyBrandColors,
  type BrandSettings 
} from "@/lib/brandSettings";
import * as dbService from "@/services/dbService";
import PageContainer from "@/components/layout/PageContainer";

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
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 저장된 브랜드 설정 로드
  useEffect(() => {
    if (user?.id) {
      loadBrandSettingsFromDB();
    } else {
      // 사용자 정보가 없으면 localStorage에서 로드 (하위 호환성)
      const saved = loadBrandSettings();
      setBrandSettings({
        ...saved,
        organizationName: saved.organizationName || user?.organization || "",
      });
      // 색상 적용
      applyBrandColors(saved.primaryColor, saved.secondaryColor);
    }
  }, [user?.id, user?.organization]);

  // 색상 변경 시 즉시 적용
  useEffect(() => {
    applyBrandColors(brandSettings.primaryColor, brandSettings.secondaryColor);
  }, [brandSettings.primaryColor, brandSettings.secondaryColor]);

  const loadBrandSettingsFromDB = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      // 데이터베이스에서 브랜드 설정 로드
      const settings = await dbService.loadUserSettings(user.id);
      const brandData = settings?.preferences?.brand || {};

      // 브랜드 설정 병합 (localStorage도 확인하여 하위 호환성 유지)
      const localBrand = loadBrandSettings();
      const mergedSettings: BrandSettings = {
        organizationName: brandData.organizationName || localBrand.organizationName || user?.organization || "",
        logoUrl: brandData.logoUrl || localBrand.logoUrl || "",
        logoDataUrl: brandData.logoDataUrl || localBrand.logoDataUrl,
        primaryColor: brandData.primaryColor || localBrand.primaryColor || "#3b82f6",
        secondaryColor: brandData.secondaryColor || localBrand.secondaryColor || "#8b5cf6",
        footerText: brandData.footerText || localBrand.footerText || "",
        termsOfService: brandData.termsOfService || localBrand.termsOfService || "",
        privacyPolicy: brandData.privacyPolicy || localBrand.privacyPolicy || "",
        enableBranding: brandData.enableBranding !== undefined ? brandData.enableBranding : (localBrand.enableBranding !== undefined ? localBrand.enableBranding : true),
      };

      setBrandSettings(mergedSettings);
      
      // 색상 적용
      applyBrandColors(mergedSettings.primaryColor, mergedSettings.secondaryColor);
    } catch (error) {
      console.error("브랜드 설정 로드 실패:", error);
      // 에러 발생 시 localStorage에서 로드
      const saved = loadBrandSettings();
      setBrandSettings({
        ...saved,
        organizationName: saved.organizationName || user?.organization || "",
      });
      applyBrandColors(saved.primaryColor, saved.secondaryColor);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) {
      toast({
        title: "오류",
        description: "로그인이 필요합니다.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // localStorage에도 저장 (하위 호환성)
      saveBrandSettings(brandSettings);

      // 데이터베이스에 저장
      const currentSettings = await dbService.loadUserSettings(user.id);
      const success = await dbService.saveUserSettings(user.id, {
        ...currentSettings,
        preferences: {
          ...currentSettings?.preferences,
          brand: {
            organizationName: brandSettings.organizationName,
            logoUrl: brandSettings.logoUrl,
            logoDataUrl: brandSettings.logoDataUrl,
            primaryColor: brandSettings.primaryColor,
            secondaryColor: brandSettings.secondaryColor,
            footerText: brandSettings.footerText,
            termsOfService: brandSettings.termsOfService,
            privacyPolicy: brandSettings.privacyPolicy,
            enableBranding: brandSettings.enableBranding,
          },
        },
      });

      if (success) {
        // 색상 적용
        applyBrandColors(brandSettings.primaryColor, brandSettings.secondaryColor);
        
        toast({
          title: "저장 완료",
          description: "브랜드 정책이 저장되었습니다.",
        });
      } else {
        throw new Error("설정 저장 실패");
      }
    } catch (error: any) {
      console.error("브랜드 설정 저장 실패:", error);
      toast({
        title: "저장 실패",
        description: "브랜드 정책 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
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
    <PageContainer maxWidth="wide">
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
              <Label>주요 색상 (Primary)</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="color"
                  value={brandSettings.primaryColor}
                  onChange={(e) =>
                    setBrandSettings({
                      ...brandSettings,
                      primaryColor: e.target.value,
                    })
                  }
                  className="w-20 h-10 cursor-pointer"
                />
                <div className="flex-1">
                  <Input
                    type="text"
                    value={brandSettings.primaryColor}
                    onChange={(e) => {
                      const color = e.target.value;
                      if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                        setBrandSettings({
                          ...brandSettings,
                          primaryColor: color,
                        });
                      }
                    }}
                    placeholder="#3b82f6"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">버튼, 링크, 강조 요소에 사용</p>
                </div>
              </div>
              {/* 색상 미리보기 */}
              <div className="flex items-center gap-2 mt-2">
                <div 
                  className="w-12 h-12 rounded-lg border-2 border-border shadow-sm"
                  style={{ backgroundColor: brandSettings.primaryColor }}
                />
                <Button 
                  style={{ backgroundColor: brandSettings.primaryColor }}
                  className="text-white hover:opacity-90"
                >
                  색상 미리보기
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>보조 색상 (Secondary)</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="color"
                  value={brandSettings.secondaryColor}
                  onChange={(e) =>
                    setBrandSettings({
                      ...brandSettings,
                      secondaryColor: e.target.value,
                    })
                  }
                  className="w-20 h-10 cursor-pointer"
                />
                <div className="flex-1">
                  <Input
                    type="text"
                    value={brandSettings.secondaryColor}
                    onChange={(e) => {
                      const color = e.target.value;
                      if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                        setBrandSettings({
                          ...brandSettings,
                          secondaryColor: color,
                        });
                      }
                    }}
                    placeholder="#8b5cf6"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">액센트, 그라데이션에 사용</p>
                </div>
              </div>
              {/* 색상 미리보기 */}
              <div className="flex items-center gap-2 mt-2">
                <div 
                  className="w-12 h-12 rounded-lg border-2 border-border shadow-sm"
                  style={{ backgroundColor: brandSettings.secondaryColor }}
                />
                <div 
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ 
                    background: `linear-gradient(135deg, ${brandSettings.primaryColor}, ${brandSettings.secondaryColor})`
                  }}
                >
                  그라데이션 미리보기
                </div>
              </div>
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
        <Button onClick={handleSave} disabled={isSaving || isLoading}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "저장 중..." : isLoading ? "로딩 중..." : "저장"}
        </Button>
      </div>
      </div>
    </PageContainer>
  );
}
