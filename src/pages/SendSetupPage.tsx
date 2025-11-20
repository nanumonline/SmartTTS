import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Radio, Settings, Save, TestTube } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import * as dbService from "@/services/dbService";
import { useToast } from "@/components/ui/use-toast";

export default function SendSetupPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [channelSettings, setChannelSettings] = useState({
    name: "",
    type: "radio",
    endpoint: "",
    enabled: true,
    testMode: false,
  });

  useEffect(() => {
    if (user?.id) {
      loadChannels();
    }
  }, [user?.id]);

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

    try {
      const channelData: dbService.ChannelEntry = {
        id: selectedChannel || undefined,
        name: channelSettings.name,
        type: channelSettings.type,
        endpoint: channelSettings.endpoint || undefined,
        enabled: channelSettings.enabled,
        config: {},
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">전송 설정</h1>
          <p className="text-muted-foreground mt-1">
            전송 채널 및 설정을 관리합니다.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                      setChannelSettings({
                        name: channel.name,
                        type: channel.type,
                        endpoint: channel.endpoint || "",
                        enabled: channel.enabled,
                        testMode: false,
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
    </div>
  );
}
