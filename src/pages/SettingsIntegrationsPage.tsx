import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Link as LinkIcon, Save, TestTube, Radio, Trash2, Plus, Edit } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import * as dbService from "@/services/dbService";
import { formatDateTime } from "@/lib/pageUtils";

interface IntegrationSettings {
  slack: { enabled: boolean; webhook: string };
  email: { enabled: boolean };
  sms: { enabled: boolean; apiKey: string };
}

export default function SettingsIntegrationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [channels, setChannels] = useState<dbService.ChannelEntry[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationSettings>({
    slack: { enabled: false, webhook: "" },
    email: { enabled: false },
    sms: { enabled: false, apiKey: "" },
  });
  const [deleteChannelId, setDeleteChannelId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadChannels();
      loadIntegrationSettings();
    }
  }, [user?.id]);

  const loadChannels = async () => {
    if (!user?.id) return;
    try {
      const data = await dbService.loadChannels(user.id);
      setChannels(data);
    } catch (error) {
      console.error("채널 로드 실패:", error);
      toast({
        title: "로드 실패",
        description: "채널 목록을 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const loadIntegrationSettings = async () => {
    if (!user?.id) return;
    try {
      const settings = await dbService.loadUserSettings(user.id);
      if (settings?.preferences?.integrations) {
        setIntegrations({
          ...integrations,
          ...settings.preferences.integrations,
        });
      }
    } catch (error) {
      console.error("통합 설정 로드 실패:", error);
    }
  };

  const handleSaveIntegrationSettings = async () => {
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
      const currentSettings = await dbService.loadUserSettings(user.id);
      const success = await dbService.saveUserSettings(user.id, {
        ...currentSettings,
        preferences: {
          ...currentSettings?.preferences,
          integrations,
        },
      });

      if (success) {
        toast({
          title: "저장 완료",
          description: "통합 설정이 저장되었습니다.",
        });
      } else {
        throw new Error("설정 저장 실패");
      }
    } catch (error) {
      console.error("통합 설정 저장 실패:", error);
      toast({
        title: "저장 실패",
        description: "통합 설정 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async (service: string) => {
    if (!user?.id) {
      toast({
        title: "오류",
        description: "로그인이 필요합니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      // TODO: 실제 테스트 전송 구현
      toast({
        title: "테스트 전송",
        description: `${service} 연동 테스트를 실행했습니다.`,
      });
    } catch (error) {
      console.error("테스트 전송 실패:", error);
      toast({
        title: "테스트 실패",
        description: `${service} 연동 테스트 중 오류가 발생했습니다.`,
        variant: "destructive",
      });
    }
  };

  const handleDeleteChannel = async () => {
    if (!user?.id || !deleteChannelId) return;

    try {
      const success = await dbService.deleteChannel(user.id, deleteChannelId);
      if (success) {
        toast({
          title: "삭제 완료",
          description: "채널이 삭제되었습니다.",
        });
        await loadChannels();
      } else {
        throw new Error("채널 삭제 실패");
      }
    } catch (error) {
      console.error("채널 삭제 실패:", error);
      toast({
        title: "삭제 실패",
        description: "채널 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setDeleteChannelId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">통합 관리</h1>
          <p className="text-muted-foreground mt-1">
            전송 채널 및 외부 서비스 연동을 관리합니다.
          </p>
        </div>
      </div>

      {/* 전송 채널 관리 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="w-5 h-5" />
            전송 채널 관리
          </CardTitle>
          <CardDescription>
            음원을 전송할 채널을 등록하고 관리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {channels.length === 0 ? (
              <div className="text-center py-8 border border-dashed rounded-lg">
                <Radio className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">등록된 채널이 없습니다.</p>
                <Button variant="outline" onClick={() => window.location.href = "/settings/setup"}>
                  <Plus className="w-4 h-4 mr-2" />
                  새 채널 등록
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {channels.map((channel) => (
                  <div
                    key={channel.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Radio className="w-5 h-5 text-muted-foreground" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-base">{channel.name}</p>
                            <Badge variant={channel.enabled ? "default" : "secondary"} className="text-xs">
                              {channel.enabled ? "활성" : "비활성"}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {channel.type === "radio" && "라디오"}
                              {channel.type === "tablet" && "태블릿"}
                              {channel.type === "pc" && "PC"}
                              {!["radio", "tablet", "pc"].includes(channel.type) && channel.type}
                            </Badge>
                          </div>
                          {channel.endpoint && (
                            <p className="text-sm text-muted-foreground mt-1 truncate">
                              {channel.endpoint}
                            </p>
                          )}
                          {channel.createdAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              생성: {formatDateTime(channel.createdAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.location.href = `/settings/setup?channel=${channel.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteChannelId(channel.id || null)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.location.href = "/settings/setup"}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  새 채널 추가
                </Button>
              </div>
            )}
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

      {/* 저장 버튼 */}
      <div className="flex justify-end">
        <Button onClick={handleSaveIntegrationSettings} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "저장 중..." : "통합 설정 저장"}
        </Button>
      </div>

      {/* 채널 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteChannelId !== null} onOpenChange={(open) => !open && setDeleteChannelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>채널 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 채널을 삭제하시겠습니까? 삭제된 채널은 복구할 수 없으며, 해당 채널로 설정된 스케줄도 영향을 받을 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteChannel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
