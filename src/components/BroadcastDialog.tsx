import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import * as dbService from "@/services/dbService";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface BroadcastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  generationId: string;
  generationName?: string;
  onSuccess?: () => void;
}

interface ChannelDeviceConfig {
  id: string;
  name: string;
  token: string;
}

export default function BroadcastDialog({
  open,
  onOpenChange,
  generationId,
  generationName,
  onSuccess,
}: BroadcastDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [channels, setChannels] = useState<dbService.ChannelEntry[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>("");
  const [scheduleType, setScheduleType] = useState<"immediate" | "delayed" | "scheduled">("immediate");
  const [delayMinutes, setDelayMinutes] = useState<number>(10);
  const [scheduleName, setScheduleName] = useState<string>("");
  const [isPlayerBroadcast, setIsPlayerBroadcast] = useState<boolean>(false);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [customerInfo, setCustomerInfo] = useState<dbService.CustomerInfo>({
    customerId: "",
    customerName: "",
    categoryCode: "",
    memo: "",
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const currentChannel = channels.find((channel) => channel.id === selectedChannelId || channel.type === selectedChannelId);
  const registeredDevices = useMemo<ChannelDeviceConfig[]>(() => {
    if (!currentChannel?.config) return [];
    const rawDevices = Array.isArray((currentChannel as any).config?.devices)
      ? (currentChannel as any).config.devices
      : [];
    return rawDevices
      .map((device: any) => ({
        id: device?.id,
        name: device?.name || "출력 장치",
        token: device?.token,
      }))
      .filter(
        (device: ChannelDeviceConfig) =>
          typeof device.id === "string" && device.id.length > 0 && typeof device.token === "string" && device.token.length > 0
      );
  }, [currentChannel]);
  const channelCode =
    typeof (currentChannel as any)?.config?.channelCode === "string"
      ? ((currentChannel as any).config.channelCode as string)
      : "";

  // 채널 목록 로드 및 사용자 정보로 기본값 설정
  useEffect(() => {
    const loadChannels = async () => {
      if (!user?.id) return;
      
      try {
        const channelsList = await dbService.loadChannels(user.id);
        setChannels(channelsList);
        
        // 첫 번째 채널을 기본 선택
        if (channelsList.length > 0 && !selectedChannelId) {
          setSelectedChannelId(channelsList[0].id || channelsList[0].type);
        }
      } catch (error) {
        console.error("Failed to load channels:", error);
        toast({
          title: "채널 로드 실패",
          description: "채널 목록을 불러오는 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    };
    
    if (open && user?.id) {
      loadChannels();
      setScheduleName(generationName || "Broadcast");
      
      // 플레이어 송출 체크 시, 사용자 정보로 기본값 설정
      if (isPlayerBroadcast && (!customerInfo.customerId || !customerInfo.customerName || !customerInfo.categoryCode)) {
        const loginId = user.email?.split("@")[0] || user.id.substring(0, 8) || "";
        const userName = user.name || user.email?.split("@")[0] || "";
        const userDept = user.department || user.organization || "";
        
        setCustomerInfo({
          customerId: loginId, // 이메일의 @ 앞부분 (로그인 ID)
          customerName: userName,
          categoryCode: userDept,
          memo: customerInfo.memo || "",
        });
      }
    }
  }, [open, generationName, user?.id, user?.email, user?.name, user?.department, user?.organization, isPlayerBroadcast]);

  useEffect(() => {
    if (!isPlayerBroadcast) {
      setSelectedDeviceIds([]);
      return;
    }
    if (registeredDevices.length === 0) {
      setSelectedDeviceIds([]);
      return;
    }

    setSelectedDeviceIds((prev) => {
      const availableIds = registeredDevices.map((device) => device.id);
      const intersection = prev.filter((id) => availableIds.includes(id));
      if (intersection.length > 0) {
        return intersection;
      }
      return availableIds;
    });
  }, [isPlayerBroadcast, registeredDevices]);

  const handleSubmit = async () => {
    // 전송 전 유효성 검사 (더 엄격하게)
    if (!generationId || generationId.trim() === "") {
      toast({
        title: "음원 선택 필요",
        description: "송출할 음원이 선택되지 않았습니다.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedChannelId || selectedChannelId.trim() === "") {
      toast({
        title: "채널 선택 필요",
        description: "송출할 채널을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (!scheduleName || scheduleName.trim() === "") {
      toast({
        title: "스케줄 이름 입력 필요",
        description: "스케줄 이름을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (scheduleType === "delayed" && delayMinutes <= 0) {
      toast({
        title: "지연 시간 오류",
        description: "지연 시간은 0보다 커야 합니다.",
        variant: "destructive",
      });
      return;
    }

    if (isPlayerBroadcast) {
      if (!channelCode) {
        toast({
          title: "채널 ID 필요",
          description: "전송 설정 페이지에서 채널 ID를 먼저 설정해주세요.",
          variant: "destructive",
        });
        return;
      }

      if (registeredDevices.length === 0) {
        toast({
          title: "등록된 디바이스 없음",
          description: "전송 설정 페이지에서 디바이스를 등록한 뒤 다시 시도하세요.",
          variant: "destructive",
        });
        return;
      }

      if (selectedDeviceIds.length === 0) {
        toast({
          title: "디바이스 선택 필요",
          description: "송출할 디바이스를 최소 1개 이상 선택해주세요.",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!customerInfo.customerId?.trim() || !customerInfo.customerName?.trim() || !customerInfo.categoryCode?.trim()) {
        toast({
          title: "고객 정보 입력 필요",
          description: "플레이어 송출 비활성화 시 고객 정보를 모두 입력해주세요.",
          variant: "destructive",
        });
        return;
      }
    }

    // 디버깅: 전달되는 값 확인
    console.log("[BroadcastDialog] handleSubmit called with:", {
      generationId,
      selectedChannelId,
      scheduleName,
      scheduleType,
      delayMinutes,
      isPlayerBroadcast,
      customerInfo,
      selectedDeviceIds,
    });

    setIsSubmitting(true);

    try {
      const options: dbService.BroadcastOptions = {
        generationId: generationId.trim(),
        channelId: selectedChannelId.trim(),
        scheduleName: scheduleName.trim() || generationName || "Broadcast",
      };
      
      console.log("[BroadcastDialog] Sending options:", options);

      if (isPlayerBroadcast) {
        options.deviceIds = selectedDeviceIds;
      } else {
        options.customerInfo = customerInfo;
      }

      let result;

      switch (scheduleType) {
        case "immediate":
          result = await dbService.broadcastImmediately(options);
          break;
        case "delayed":
          result = await dbService.broadcastDelayed(options, delayMinutes);
          break;
        case "scheduled":
          // 스케줄 송출은 별도 페이지에서 처리하므로 여기서는 안 함
          toast({
            title: "스케줄 송출",
            description: "스케줄 송출은 스케줄 관리 페이지에서 설정해주세요.",
            variant: "default",
          });
          setIsSubmitting(false);
          return;
        default:
          result = { success: false, error: "Invalid schedule type" };
      }

      if (result.success) {
        const successMessage = scheduleType === "immediate" 
          ? "즉시 송출이 시작되었습니다." 
          : scheduleType === "delayed"
          ? `${delayMinutes}분 후 송출이 예약되었습니다.`
          : "스케줄이 생성되었습니다.";
        
        toast({
          title: "송출 성공",
          description: successMessage,
        });
        
        // 즉시 송출인 경우, 스케줄 목록 즉시 새로고침
        if (scheduleType === "immediate") {
          // 잠시 후 스케줄 목록 새로고침 (상태 업데이트 확인을 위해)
          setTimeout(() => {
            onSuccess?.();
          }, 2000);
        } else {
          // 지연/스케줄 송출인 경우 즉시 새로고침
          onSuccess?.();
        }
        
        onOpenChange(false);
      } else {
        console.error("[BroadcastDialog] Broadcast failed:", result);
        toast({
          title: "송출 실패",
          description: result.error || "송출 중 오류가 발생했습니다.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Broadcast error:", error);
      toast({
        title: "송출 실패",
        description: error.message || "송출 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleDevice = (deviceId: string) => {
    setSelectedDeviceIds((prev) => {
      if (prev.includes(deviceId)) {
        return prev.filter((id) => id !== deviceId);
      }
      return [...prev, deviceId];
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>음원 송출</DialogTitle>
          <DialogDescription>
            생성된 음원을 선택한 채널로 송출합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 스케줄 이름 */}
          <div className="space-y-2">
            <Label htmlFor="schedule-name">스케줄 이름</Label>
            <Input
              id="schedule-name"
              value={scheduleName}
              onChange={(e) => setScheduleName(e.target.value)}
              placeholder="스케줄 이름을 입력하세요"
            />
          </div>

          {/* 채널 선택 */}
          <div className="space-y-2">
            <Label htmlFor="channel">송출 채널</Label>
            <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
              <SelectTrigger id="channel">
                <SelectValue placeholder="채널을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id || channel.type}>
                    {channel.name} ({channel.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 송출 방식 선택 */}
          <div className="space-y-2">
            <Label>송출 방식</Label>
            <RadioGroup value={scheduleType} onValueChange={(value: any) => setScheduleType(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="immediate" id="immediate" />
                <Label htmlFor="immediate" className="cursor-pointer">
                  즉시 송출
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="delayed" id="delayed" />
                <Label htmlFor="delayed" className="cursor-pointer">
                  지연 송출
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 지연 시간 입력 (지연 송출 선택 시) */}
          {scheduleType === "delayed" && (
            <div className="space-y-2">
              <Label htmlFor="delay-minutes">지연 시간 (분)</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDelayMinutes(10)}
                  className={delayMinutes === 10 ? "bg-primary text-primary-foreground" : ""}
                >
                  10분
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDelayMinutes(30)}
                  className={delayMinutes === 30 ? "bg-primary text-primary-foreground" : ""}
                >
                  30분
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDelayMinutes(60)}
                  className={delayMinutes === 60 ? "bg-primary text-primary-foreground" : ""}
                >
                  60분
                </Button>
              </div>
              <Input
                id="delay-minutes"
                type="number"
                min="1"
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)}
                placeholder="직접 입력"
              />
            </div>
          )}

          {/* 플레이어 송출 옵션 */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="player-broadcast"
                checked={isPlayerBroadcast}
                onCheckedChange={(checked) => {
                  const enabled = checked === true;
                  setIsPlayerBroadcast(enabled);
                  if (enabled) {
                    setSelectedDeviceIds(registeredDevices.map((device) => device.id));
                  }
                }}
              />
              <Label htmlFor="player-broadcast" className="cursor-pointer">
                플레이어 송출
              </Label>
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              체크 시 등록된 디바이스에 멀티 송출이 가능합니다.
            </p>
          </div>

          {/* 플레이어 송출 선택 시 디바이스 목록 */}
          {isPlayerBroadcast ? (
            <div className="space-y-3 pl-6 border-l-2 border-primary/20">
              <div className="space-y-1">
                <p className="text-sm font-medium">채널 ID: <span className="font-mono text-primary">{channelCode || "미설정"}</span></p>
                {currentChannel && (
                  <p className="text-xs text-muted-foreground">
                    /send/setup 페이지에서 채널별 디바이스를 관리할 수 있습니다.
                  </p>
                )}
              </div>
              {registeredDevices.length === 0 ? (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  등록된 디바이스가 없습니다. <a href={`/send/setup?channel=${currentChannel?.id || ""}`} className="text-primary underline">전송 설정 페이지</a>에서 디바이스를 추가해주세요.
                </div>
              ) : (
                <div className="space-y-2">
                  {registeredDevices.map((device) => (
                    <label
                      key={device.id}
                      className="flex items-center justify-between rounded-lg border p-3 text-sm"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{device.name}</span>
                        <span className="text-xs text-muted-foreground">ID: {device.id}</span>
                      </div>
                      <Checkbox
                        checked={selectedDeviceIds.includes(device.id)}
                        onCheckedChange={() => handleToggleDevice(device.id)}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 pl-6 border-l-2 border-primary/20">
              <div className="space-y-2">
                <Label htmlFor="customer-id">고객 ID *</Label>
                <Input
                  id="customer-id"
                  value={customerInfo.customerId}
                  onChange={(e) =>
                    setCustomerInfo({ ...customerInfo, customerId: e.target.value })
                  }
                  placeholder={user?.email?.split("@")[0] ? `${user.email.split("@")[0]} (로그인 ID)` : "고객 ID를 입력하세요"}
                />
                <p className="text-xs text-muted-foreground">
                  현재 로그인 ID: {user?.email?.split("@")[0] || "-"} {user?.email?.split("@")[0] && "(자동 입력됨, 수정 가능)"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-name">고객명 *</Label>
                <Input
                  id="customer-name"
                  value={customerInfo.customerName}
                  onChange={(e) =>
                    setCustomerInfo({ ...customerInfo, customerName: e.target.value })
                  }
                  placeholder={user?.name || user?.email?.split("@")[0] ? `${user?.name || user?.email?.split("@")[0]} (프로필 이름)` : "고객명을 입력하세요"}
                />
                <p className="text-xs text-muted-foreground">
                  현재 프로필명: {user?.name || user?.email?.split("@")[0] || "-"} {(user?.name || user?.email?.split("@")[0]) && "(자동 입력됨, 수정 가능)"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category-code">구분 코드 *</Label>
                <Input
                  id="category-code"
                  value={customerInfo.categoryCode}
                  onChange={(e) =>
                    setCustomerInfo({ ...customerInfo, categoryCode: e.target.value })
                  }
                  placeholder={user?.department || user?.organization ? `${user?.department || user?.organization} (부서/조직명)` : "구분 코드를 입력하세요 (예: VIP, 일반, 직원)"}
                />
                <p className="text-xs text-muted-foreground">
                  현재 부서/조직: {user?.department || user?.organization || "-"} {(user?.department || user?.organization) && "(자동 입력됨, 수정 가능)"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer-memo">메모</Label>
                <Input
                  id="customer-memo"
                  value={customerInfo.memo || ""}
                  onChange={(e) =>
                    setCustomerInfo({ ...customerInfo, memo: e.target.value })
                  }
                  placeholder="메모를 입력하세요 (선택사항)"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "송출 중..." : "송출"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
