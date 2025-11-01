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
    // TODO: 전송 채널 목록 로드
    // 현재는 하드코딩된 채널 목록
    setChannels([
      { id: "radio1", name: "방송국 A", type: "radio", enabled: true },
      { id: "tablet1", name: "태블릿 방송 장비", type: "tablet", enabled: true },
      { id: "pc1", name: "PC 방송 장비", type: "pc", enabled: true },
    ]);
  }, []);

  const handleSave = async () => {
    if (!channelSettings.name || !channelSettings.endpoint) {
      toast({
        title: "입력 필요",
        description: "채널 이름과 엔드포인트를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    // TODO: DB에 채널 설정 저장
    toast({
      title: "저장 완료",
      description: "전송 채널 설정이 저장되었습니다.",
    });
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
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedChannel === channel.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted"
                  }`}
                  onClick={() => {
                    setSelectedChannel(channel.id);
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
                </div>
              ))}
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
                <Label>엔드포인트 URL</Label>
                <Input
                  value={channelSettings.endpoint}
                  onChange={(e) =>
                    setChannelSettings({ ...channelSettings, endpoint: e.target.value })
                  }
                  placeholder="https://example.com/api/broadcast"
                />
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
