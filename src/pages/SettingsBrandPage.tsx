import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Save, FileText, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

export default function SettingsBrandPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [brandSettings, setBrandSettings] = useState({
    organizationName: user?.organization || "",
    logoUrl: "",
    primaryColor: "#3b82f6",
    secondaryColor: "#8b5cf6",
    footerText: "",
    termsOfService: "",
    privacyPolicy: "",
    enableBranding: true,
  });

  const handleSave = () => {
    // TODO: 브랜드 설정 저장
    toast({
      title: "저장 완료",
      description: "브랜드 정책이 저장되었습니다.",
    });
  };

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

          <div className="space-y-2">
            <Label>로고 URL</Label>
            <Input
              value={brandSettings.logoUrl}
              onChange={(e) =>
                setBrandSettings({ ...brandSettings, logoUrl: e.target.value })
              }
              placeholder="https://example.com/logo.png"
            />
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
