import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Save, Trash2, Copy, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

interface MixingPreset {
  id: string;
  name: string;
  description?: string;
  settings: {
    ttsGain: number;
    bgmGain: number;
    masterGain: number;
    fadeIn: number;
    fadeOut: number;
    fadeInRatio: number;
    fadeOutRatio: number;
  };
  createdAt: string;
}

export default function MixPresetsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [presets, setPresets] = useState<MixingPreset[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newPreset, setNewPreset] = useState({
    name: "",
    description: "",
    settings: {
      ttsGain: 100,
      bgmGain: 50,
      masterGain: 100,
      fadeIn: 2,
      fadeOut: 2,
      fadeInRatio: 50,
      fadeOutRatio: 50,
    },
  });

  useEffect(() => {
    // TODO: DB에서 프리셋 로드
    // 현재는 localStorage 기반
    const saved = localStorage.getItem(`mix_presets_${user?.id}`);
    if (saved) {
      try {
        setPresets(JSON.parse(saved));
      } catch {
        setPresets([]);
      }
    }
  }, [user?.id]);

  const savePresets = (newPresets: MixingPreset[]) => {
    localStorage.setItem(`mix_presets_${user?.id}`, JSON.stringify(newPresets));
    setPresets(newPresets);
  };

  const handleCreatePreset = () => {
    if (!newPreset.name.trim()) {
      toast({
        title: "입력 필요",
        description: "프리셋 이름을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    const preset: MixingPreset = {
      id: Date.now().toString(),
      name: newPreset.name,
      description: newPreset.description,
      settings: newPreset.settings,
      createdAt: new Date().toISOString(),
    };

    savePresets([...presets, preset]);
    setIsCreateDialogOpen(false);
    setNewPreset({
      name: "",
      description: "",
      settings: {
        ttsGain: 100,
        bgmGain: 50,
        masterGain: 100,
        fadeIn: 2,
        fadeOut: 2,
        fadeInRatio: 50,
        fadeOutRatio: 50,
      },
    });

    toast({
      title: "프리셋 생성 완료",
      description: "새 프리셋이 생성되었습니다.",
    });
  };

  const handleDeletePreset = (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    savePresets(presets.filter((p) => p.id !== id));
    toast({
      title: "삭제 완료",
      description: "프리셋이 삭제되었습니다.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">믹싱 프리셋</h1>
          <p className="text-muted-foreground mt-1">
            자주 사용하는 믹싱 설정을 프리셋으로 저장합니다.
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          새 프리셋
        </Button>
      </div>

      {/* 프리셋 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {presets.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Settings className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">등록된 프리셋이 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          presets.map((preset) => (
            <Card key={preset.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{preset.name}</CardTitle>
                    {preset.description && (
                      <CardDescription>{preset.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeletePreset(preset.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">TTS 볼륨:</span>
                    <span>{preset.settings.ttsGain}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">BGM 볼륨:</span>
                    <span>{preset.settings.bgmGain}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">페이드 인:</span>
                    <span>{preset.settings.fadeIn}초</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">페이드 아웃:</span>
                    <span>{preset.settings.fadeOut}초</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 프리셋 생성 다이얼로그 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>새 프리셋 생성</DialogTitle>
            <DialogDescription>
              믹싱 설정을 프리셋으로 저장합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>프리셋 이름 *</Label>
              <Input
                value={newPreset.name}
                onChange={(e) =>
                  setNewPreset({ ...newPreset, name: e.target.value })
                }
                placeholder="예: 뉴스 스타일"
              />
            </div>
            <div className="space-y-2">
              <Label>설명 (선택사항)</Label>
              <Input
                value={newPreset.description}
                onChange={(e) =>
                  setNewPreset({ ...newPreset, description: e.target.value })
                }
                placeholder="프리셋 설명"
              />
            </div>
            <div className="p-4 bg-muted rounded-lg space-y-2 text-sm">
              <p className="font-medium">설정 정보:</p>
              <div className="grid grid-cols-2 gap-2">
                <div>TTS: {newPreset.settings.ttsGain}%</div>
                <div>BGM: {newPreset.settings.bgmGain}%</div>
                <div>페이드 인: {newPreset.settings.fadeIn}초</div>
                <div>페이드 아웃: {newPreset.settings.fadeOut}초</div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                * 프리셋 설정은 믹스 보드에서 현재 설정을 사용합니다.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleCreatePreset}>
              <Save className="w-4 h-4 mr-2" />
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
