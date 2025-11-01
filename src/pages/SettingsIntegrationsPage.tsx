import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings, Key, Link as LinkIcon, Save, TestTube } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

export default function SettingsIntegrationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [integrations, setIntegrations] = useState({
    slack: { enabled: false, webhook: "" },
    email: { enabled: false },
    sms: { enabled: false, apiKey: "" },
  });

  const handleSave = () => {
    // TODO: 설정 저장
    toast({
      title: "저장 완료",
      description: "통합 설정이 저장되었습니다.",
    });
  };

  const handleTest = (service: string) => {
    toast({
      title: "테스트 전송",
      description: `${service} 연동 테스트를 실행했습니다.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">통합 관리</h1>
          <p className="text-muted-foreground mt-1">
            API 및 외부 서비스 연동을 관리합니다.
          </p>
        </div>
      </div>

      {/* API 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            API 키 관리
          </CardTitle>
          <CardDescription>
            외부 서비스 연동을 위한 API 키를 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API 키</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="API 키를 입력하세요"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              저장
            </Button>
            <Button variant="outline" onClick={() => handleTest("API")}>
              <TestTube className="w-4 h-4 mr-2" />
              테스트
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 외부 연동 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            외부 서비스 연동
          </CardTitle>
          <CardDescription>
            Slack, 이메일, SMS 등의 알림 서비스를 연동합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Slack */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Slack 알림</Label>
                <p className="text-sm text-muted-foreground">
                  Slack 웹훅을 통해 알림을 받습니다
                </p>
              </div>
              <Switch
                checked={integrations.slack.enabled}
                onCheckedChange={(checked) =>
                  setIntegrations({
                    ...integrations,
                    slack: { ...integrations.slack, enabled: checked },
                  })
                }
              />
            </div>
            {integrations.slack.enabled && (
              <div className="space-y-2 pl-6">
                <Label>Slack Webhook URL</Label>
                <Input
                  value={integrations.slack.webhook}
                  onChange={(e) =>
                    setIntegrations({
                      ...integrations,
                      slack: { ...integrations.slack, webhook: e.target.value },
                    })
                  }
                  placeholder="https://hooks.slack.com/services/..."
                />
                <Button variant="outline" size="sm" onClick={() => handleTest("Slack")}>
                  <TestTube className="w-4 h-4 mr-2" />
                  테스트
                </Button>
              </div>
            )}
            <Separator />
          </div>

          {/* 이메일 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>이메일 알림</Label>
              <p className="text-sm text-muted-foreground">
                이메일로 알림을 받습니다
              </p>
            </div>
            <Switch
              checked={integrations.email.enabled}
              onCheckedChange={(checked) =>
                setIntegrations({
                  ...integrations,
                  email: { ...integrations.email, enabled: checked },
                })
              }
            />
          </div>
          <Separator />

          {/* SMS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>SMS 알림</Label>
                <p className="text-sm text-muted-foreground">
                  SMS를 통해 알림을 받습니다
                </p>
              </div>
              <Switch
                checked={integrations.sms.enabled}
                onCheckedChange={(checked) =>
                  setIntegrations({
                    ...integrations,
                    sms: { ...integrations.sms, enabled: checked },
                  })
                }
              />
            </div>
            {integrations.sms.enabled && (
              <div className="space-y-2 pl-6">
                <Label>SMS API 키</Label>
                <Input
                  type="password"
                  value={integrations.sms.apiKey}
                  onChange={(e) =>
                    setIntegrations({
                      ...integrations,
                      sms: { ...integrations.sms, apiKey: e.target.value },
                    })
                  }
                  placeholder="SMS API 키를 입력하세요"
                />
                <Button variant="outline" size="sm" onClick={() => handleTest("SMS")}>
                  <TestTube className="w-4 h-4 mr-2" />
                  테스트
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          모든 설정 저장
        </Button>
      </div>
    </div>
  );
}
