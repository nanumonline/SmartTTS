import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Radio, Settings, Save, TestTube, Plus, Trash2, RefreshCw, Copy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import * as dbService from "@/services/dbService";
import { useToast } from "@/components/ui/use-toast";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";

interface RegisteredDeviceConfig {
  id: string;
  name: string;
  token: string;
}

const generateRandomString = (length = 12) => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateChannelCode = () => `ch-${generateRandomString(10)}`;
const generateDeviceId = () => `dev-${generateRandomString(10)}`;
const generateDeviceToken = () => generateRandomString(24);

export default function SendSetupPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [channelSettings, setChannelSettings] = useState({
    name: "",
    type: "radio",
    endpoint: "",
    enabled: true,
    testMode: false,
    channelCode: generateChannelCode(),
    devices: [] as RegisteredDeviceConfig[],
  });

  useEffect(() => {
    if (user?.id) {
      loadChannels();
    }
  }, [user?.id]);

  // URL 쿼리 파라미터에서 채널 ID 읽기
  useEffect(() => {
    const channelId = searchParams.get("channel");
    if (channelId && channels.length > 0) {
      const channel = channels.find((ch) => ch.id === channelId);
      if (channel) {
        const channelConfig = channel.config || {};
        const devices = Array.isArray(channelConfig.devices) ? channelConfig.devices : [];
        setSelectedChannel(channel.id || "");
        setChannelSettings({
          name: channel.name,
          type: channel.type,
          endpoint: channel.endpoint || "",
          enabled: channel.enabled,
          testMode: false,
          channelCode: channelConfig.channelCode || generateChannelCode(),
          devices: devices.map((device: any) => ({
            id: device.id,
            name: device.name,
            token: device.token || generateDeviceToken(),
          })),
        });
      }
    }
  }, [searchParams, channels]);

  const loadChannels = async () => {
    if (!user?.id) return;
    try {
      const data = await dbService.loadChannels(user.id);
      setChannels(data);
    } catch (error) {
      console.error("채널 목록 로드 실패:", error);
      toast({
        title: "로드 실패",
        description: "채널 목록을 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
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

    if (!channelSettings.name) {
      toast({
        title: "입력 필요",
        description: "채널 이름을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    // 활성화된 채널인 경우에만 엔드포인트 URL 필수
    if (channelSettings.enabled && !channelSettings.endpoint) {
      toast({
        title: "입력 필요",
        description: "활성화된 채널은 엔드포인트 URL이 필요합니다.",
        variant: "destructive",
      });
      return;
    }

    if (!channelSettings.channelCode) {
      toast({
        title: "채널 코드 필요",
        description: "보안을 위해 채널 코드를 생성해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (channelSettings.devices.some((device) => !device.id || !device.token)) {
      toast({
        title: "디바이스 정보 누락",
        description: "모든 디바이스에 ID 및 토큰이 있어야 합니다. 다시 생성해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      const channelData: dbService.ChannelEntry = {
        id: selectedChannel || undefined,
        name: channelSettings.name,
        type: channelSettings.type,
        endpoint: channelSettings.endpoint || undefined,
        enabled: channelSettings.enabled,
        config: {
          channelCode: channelSettings.channelCode,
          devices: channelSettings.devices,
        },
      };

      const savedId = await dbService.saveChannel(user.id, channelData);
      
      if (!savedId) {
        throw new Error("채널 저장 실패");
      }

      // 채널 목록 새로고침
      await loadChannels();
      
      // 저장된 채널 선택
      setSelectedChannel(savedId);

      toast({
        title: "저장 완료",
        description: "전송 채널 설정이 저장되었습니다.",
      });
    } catch (error) {
      console.error("채널 저장 실패:", error);
      toast({
        title: "저장 실패",
        description: "채널 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleTest = async () => {
    // TODO: 테스트 전송 실행
    toast({
      title: "테스트 전송",
      description: "테스트 전송을 실행했습니다.",
    });
  };

  const handleRegenerateChannelCode = () => {
    setChannelSettings((prev) => ({
      ...prev,
      channelCode: generateChannelCode(),
    }));
  };

  const handleAddDevice = () => {
    const newDevice: RegisteredDeviceConfig = {
      id: generateDeviceId(),
      name: `출력 장치 ${channelSettings.devices.length + 1}`,
      token: generateDeviceToken(),
    };
    setChannelSettings((prev) => ({
      ...prev,
      devices: [...prev.devices, newDevice],
    }));
  };

  const handleDeviceChange = (index: number, updates: Partial<RegisteredDeviceConfig>) => {
    setChannelSettings((prev) => {
      const nextDevices = [...prev.devices];
      nextDevices[index] = { ...nextDevices[index], ...updates };
      return { ...prev, devices: nextDevices };
    });
  };

  const handleRemoveDevice = (index: number) => {
    setChannelSettings((prev) => {
      const nextDevices = [...prev.devices];
      nextDevices.splice(index, 1);
      return { ...prev, devices: nextDevices };
    });
  };

  const shareLinkBase = "https://nanum.online/tts/api/broadcast/player-unified.html";

  const buildShareLink = (device: RegisteredDeviceConfig) => {
    return `${shareLinkBase}?channel_id=${encodeURIComponent(channelSettings.channelCode)}&device_id=${encodeURIComponent(device.id)}&device_token=${encodeURIComponent(device.token)}`;
  };

  const copyShareLink = async (device: RegisteredDeviceConfig) => {
    try {
      await navigator.clipboard.writeText(buildShareLink(device));
      toast({
        title: "공유 링크 복사",
        description: `${device.name} 링크가 복사되었습니다.`,
      });
    } catch (error) {
      console.error("링크 복사 실패:", error);
      toast({
        title: "복사 실패",
        description: "클립보드 권한을 확인해주세요.",
        variant: "destructive",
      });
    }
  };

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        title="전송 설정"
        description="전송 채널 및 설정을 관리합니다."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
        {/* 채널 목록 */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>전송 채널</CardTitle>
              <CardDescription>등록된 전송 채널 목록</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {channels.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  등록된 채널이 없습니다. 오른쪽에서 새 채널을 생성하세요.
                </p>
              ) : (
                channels.map((channel) => (
                  <div
                    key={channel.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedChannel === channel.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted"
                    }`}
                    onClick={() => {
                      setSelectedChannel(channel.id || "");
                      const channelConfig = channel.config || {};
                      const devices = Array.isArray(channelConfig.devices) ? channelConfig.devices : [];
                      setChannelSettings({
                        name: channel.name,
                        type: channel.type,
                        endpoint: channel.endpoint || "",
                        enabled: channel.enabled,
                        testMode: false,
                        channelCode: channelConfig.channelCode || generateChannelCode(),
                        devices: devices.map((device: any) => ({
                          id: device.id,
                          name: device.name,
                          token: device.token || generateDeviceToken(),
                        })),
                      });
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Radio className="w-4 h-4" />
                        <span className="font-medium">{channel.name}</span>
                      </div>
                      <Badge variant={channel.enabled ? "default" : "secondary"}>
                        {channel.enabled ? "활성" : "비활성"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {channel.type === "radio" && "라디오 방송"}
                      {channel.type === "tablet" && "태블릿 장비"}
                      {channel.type === "pc" && "PC 장비"}
                    </p>
                    {channel.endpoint && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {channel.endpoint}
                      </p>
                    )}
                  </div>
                ))
              )}
              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={() => {
                  setSelectedChannel("");
                  setChannelSettings({
                    name: "",
                    type: "radio",
                    endpoint: "",
                    enabled: true,
                    testMode: false,
                    channelCode: generateChannelCode(),
                    devices: [],
                  });
                }}
              >
                + 새 채널 추가
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 채널 설정 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>채널 설정</CardTitle>
              <CardDescription>선택한 채널의 설정을 수정합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>채널 이름</Label>
                <Input
                  value={channelSettings.name}
                  onChange={(e) =>
                    setChannelSettings({ ...channelSettings, name: e.target.value })
                  }
                  placeholder="채널 이름을 입력하세요"
                />
              </div>

              <div className="space-y-2">
                <Label>채널 유형</Label>
                <Select
                  value={channelSettings.type}
                  onValueChange={(value) =>
                    setChannelSettings({ ...channelSettings, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="radio">라디오 방송</SelectItem>
                    <SelectItem value="tablet">태블릿 방송 장비</SelectItem>
                    <SelectItem value="pc">PC 방송 장비</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="space-y-1">
                  <Label>엔드포인트 URL</Label>
                  <p className="text-sm text-muted-foreground">
                    생성된 음원을 전송할 외부 시스템의 API 엔드포인트 URL을 입력하세요.
                  </p>
                </div>
                <Input
                  value={channelSettings.endpoint}
                  onChange={(e) =>
                    setChannelSettings({ ...channelSettings, endpoint: e.target.value })
                  }
                  placeholder="https://example.com/api/broadcast"
                />
                <p className="text-xs text-muted-foreground pt-1">
                  <span className="font-medium">참고:</span> 해당 엔드포인트는 POST 요청으로 오디오 파일을 받을 수 있어야 합니다. 채널을 비활성화하면 엔드포인트 URL은 선택사항입니다.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>채널 활성화</Label>
                  <p className="text-sm text-muted-foreground">
                    활성화하면 전송이 가능합니다
                  </p>
                </div>
                <Switch
                  checked={channelSettings.enabled}
                  onCheckedChange={(checked) =>
                    setChannelSettings({ ...channelSettings, enabled: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>테스트 모드</Label>
                  <p className="text-sm text-muted-foreground">
                    실제 전송 없이 테스트만 실행합니다
                  </p>
                </div>
                <Switch
                  checked={channelSettings.testMode}
                  onCheckedChange={(checked) =>
                    setChannelSettings({ ...channelSettings, testMode: checked })
                  }
                />
              </div>

              <div className="space-y-2 border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>채널 ID (channel_id)</Label>
                    <p className="text-sm text-muted-foreground">
                      플레이어 URL에 사용할 고유 식별자입니다.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleRegenerateChannelCode}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
                <Input
                  value={channelSettings.channelCode}
                  onChange={(e) =>
                    setChannelSettings({ ...channelSettings, channelCode: e.target.value })
                  }
                  placeholder="예: ch-municipal-office"
                />
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">예시:</span> https://nanum.online/tts/api/broadcast/player-unified.html?channel_id=
                  <span className="text-primary font-mono">{channelSettings.channelCode || "your-code"}</span>
                </p>
              </div>

              <div className="space-y-3 border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>등록된 디바이스</Label>
                    <p className="text-sm text-muted-foreground">
                      채널에 연결된 물리 장비/브라우저를 등록하면 멀티 출력이 가능합니다.
                    </p>
                  </div>
                  <Button type="button" variant="secondary" size="sm" onClick={handleAddDevice}>
                    <Plus className="w-4 h-4 mr-1" />
                    디바이스 추가
                  </Button>
                </div>

                {channelSettings.devices.length === 0 ? (
                  <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-4">
                    등록된 디바이스가 없습니다. <strong>디바이스 추가</strong> 버튼을 눌러 플레이어 출력 지점을 등록하세요.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {channelSettings.devices.map((device, index) => (
                      <div key={device.id} className="border rounded-lg p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <Input
                            value={device.name}
                            onChange={(e) => handleDeviceChange(index, { name: e.target.value })}
                            placeholder="디바이스 이름"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveDevice(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label>디바이스 ID</Label>
                            <Input value={device.id} readOnly className="font-mono text-sm" />
                            <p className="text-xs text-muted-foreground">
                              플레이어 URL의 `device_id` 파라미터로 사용됩니다.
                            </p>
                          </div>
                          <div className="space-y-1">
                            <Label>디바이스 토큰</Label>
                            <div className="flex items-center gap-2">
                              <Input value={device.token} readOnly className="font-mono text-sm" />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                  handleDeviceChange(index, { token: generateDeviceToken() })
                                }
                              >
                                <RefreshCw className="w-4 h-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => copyShareLink(device)}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              토큰은 플레이어 URL의 `device_token` 파라미터로 사용됩니다.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label>플레이어 공유 링크</Label>
                          <div className="flex flex-col md:flex-row md:items-center gap-2">
                            <Input value={buildShareLink(device)} readOnly className="font-mono text-xs" />
                            <Button type="button" variant="secondary" size="sm" onClick={() => copyShareLink(device)}>
                              링크 복사
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 pt-4">
                <Button onClick={handleSave} className="flex-1">
                  <Save className="w-4 h-4 mr-2" />
                  저장
                </Button>
                <Button variant="outline" onClick={handleTest}>
                  <TestTube className="w-4 h-4 mr-2" />
                  테스트
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
