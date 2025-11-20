import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Save, Trash2, Copy, Settings, Edit2, Play, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { MixingSettings, DEFAULT_MIXING_SETTINGS } from "@/lib/audioMixer";
import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MixingPreset {
  id: string;
  name: string;
  description?: string;
  settings: MixingSettings;
  createdAt: string;
  updatedAt?: string;
  isDefault?: boolean; // 기본 제공 프리셋인지 여부
}

// 기본 제공 프리셋들
const DEFAULT_PRESETS: Omit<MixingPreset, "id" | "createdAt">[] = [
  {
    name: "부드러운 믹싱",
    description: "BGM이 TTS 전 5초부터 자연스럽게 페이드인되며, TTS 송출 시 BGM이 50%로 줄어들고, TTS 종료 후 BGM이 다시 커지며 5초 플레이 후 2.5초 페이드아웃으로 부드럽게 종료됩니다.",
    isDefault: true,
    settings: {
      ...DEFAULT_MIXING_SETTINGS,
      ttsGain: 1.0,
      bgmGain: 0.5,
      masterGain: 1.0,
      fadeIn: 2.5, // 부드러운 2.5초 페이드인
      fadeOut: 2.5, // 부드러운 2.5초 페이드아웃
      fadeInRatio: 100,
      fadeOutRatio: 100,
      duckingEnabled: true, // TTS 송출 시 BGM 자동 감소
      duckDb: -10, // BGM을 50%로 감소 (약 -6dB)
      duckThreshold: -42,
      duckRelease: 0.5,
      bgmOffset: 5.0, // TTS 전 5초
      ttsOffset: 0,
      bgmOffsetAfterTts: 5.0, // TTS 종료 후 BGM 5초 연장
      trimEndSec: null,
    },
  },
  {
    name: "뉴스 스타일",
    description: "뉴스 방송 스타일의 깔끔한 믹싱. BGM이 TTS 전 5초부터 빠르게 페이드인되고, TTS가 명확하게 전달되며, TTS 종료 후 5초 연장 후 빠르게 페이드아웃됩니다.",
    isDefault: true,
    settings: {
      ...DEFAULT_MIXING_SETTINGS,
      ttsGain: 1.2,
      bgmGain: 0.3,
      masterGain: 1.0,
      fadeIn: 1.5, // 빠른 1.5초 페이드인
      fadeOut: 1.5, // 빠른 1.5초 페이드아웃
      fadeInRatio: 100,
      fadeOutRatio: 100,
      duckingEnabled: true,
      duckDb: -15,
      duckThreshold: -40,
      duckRelease: 0.3,
      bgmOffset: 5.0, // TTS 전 5초
      ttsOffset: 0,
      bgmOffsetAfterTts: 5.0, // TTS 종료 후 BGM 5초 연장
      trimEndSec: null,
    },
  },
  {
    name: "배경음악 중심",
    description: "BGM이 주가 되는 믹싱. BGM이 TTS 전 5초부터 긴 페이드인으로 시작되고, TTS는 배경에서 자연스럽게 흐르며, TTS 종료 후 5초 연장 후 긴 페이드아웃으로 마무리됩니다.",
    isDefault: true,
    settings: {
      ...DEFAULT_MIXING_SETTINGS,
      ttsGain: 0.8,
      bgmGain: 0.7,
      masterGain: 1.0,
      fadeIn: 3.5, // 긴 3.5초 페이드인
      fadeOut: 3.5, // 긴 3.5초 페이드아웃
      fadeInRatio: 100,
      fadeOutRatio: 100,
      duckingEnabled: false, // 덕킹 비활성화
      duckDb: -10,
      duckThreshold: -42,
      duckRelease: 0.5,
      bgmOffset: 5.0, // TTS 전 5초
      ttsOffset: 0,
      bgmOffsetAfterTts: 5.0, // TTS 종료 후 BGM 5초 연장
      trimEndSec: null,
    },
  },
  {
    name: "자연스러운 전환",
    description: "BGM이 TTS 전 5초부터 3.5초 페이드인으로 부드럽게 시작되고, TTS 송출 시 BGM이 자연스럽게 감소하며, TTS 종료 후 5초 연장 후 3.5초 페이드아웃으로 자연스럽게 마무리됩니다.",
    isDefault: true,
    settings: {
      ...DEFAULT_MIXING_SETTINGS,
      ttsGain: 1.0,
      bgmGain: 0.55,
      masterGain: 1.0,
      fadeIn: 3.5, // 부드러운 3.5초 페이드인
      fadeOut: 3.5, // 부드러운 3.5초 페이드아웃
      fadeInRatio: 100,
      fadeOutRatio: 100,
      duckingEnabled: true,
      duckDb: -8, // 약간 덜 감소 (자연스러운 전환)
      duckThreshold: -42,
      duckRelease: 0.8, // 더 느린 릴리즈로 자연스러운 복귀
      bgmOffset: 5.0, // TTS 전 5초
      ttsOffset: 0,
      bgmOffsetAfterTts: 5.0, // TTS 종료 후 BGM 5초 연장
      trimEndSec: null,
    },
  },
  {
    name: "편안한 안내",
    description: "BGM이 TTS 전 5초부터 부드럽게 페이드인되며, 낮은 BGM 볼륨으로 편안한 분위기를 연출하고, 자연스러운 덕킹으로 안내 메시지가 명확하게 전달되며, TTS 종료 후 5초 연장 후 부드럽게 페이드아웃됩니다.",
    isDefault: true,
    settings: {
      ...DEFAULT_MIXING_SETTINGS,
      ttsGain: 1.1,
      bgmGain: 0.4, // 낮은 BGM 볼륨
      masterGain: 1.0,
      fadeIn: 3.0, // 부드러운 3초 페이드인
      fadeOut: 3.0, // 부드러운 3초 페이드아웃
      fadeInRatio: 100,
      fadeOutRatio: 100,
      duckingEnabled: true,
      duckDb: -12, // TTS 송출 시 BGM을 더 많이 감소
      duckThreshold: -42,
      duckRelease: 0.6,
      bgmOffset: 5.0, // TTS 전 5초
      ttsOffset: 0,
      bgmOffsetAfterTts: 5.0, // TTS 종료 후 BGM 5초 연장
      trimEndSec: null,
    },
  },
  {
    name: "균형잡힌 믹싱",
    description: "TTS와 BGM의 균형이 잘 맞춰진 믹싱. BGM이 TTS 전 5초부터 2.8초 페이드인으로 시작되고, 자연스러운 전환과 함께 TTS 종료 후 5초 연장 후 2.8초 페이드아웃으로 여유롭게 마무리됩니다.",
    isDefault: true,
    settings: {
      ...DEFAULT_MIXING_SETTINGS,
      ttsGain: 1.0,
      bgmGain: 0.5,
      masterGain: 1.0,
      fadeIn: 2.8, // 균형잡힌 2.8초 페이드인
      fadeOut: 2.8, // 균형잡힌 2.8초 페이드아웃
      fadeInRatio: 100,
      fadeOutRatio: 100,
      duckingEnabled: true,
      duckDb: -9, // 적절한 덕킹
      duckThreshold: -42,
      duckRelease: 0.5,
      bgmOffset: 5.0, // TTS 전 5초
      ttsOffset: 0,
      bgmOffsetAfterTts: 5.0, // TTS 종료 후 BGM 5초 연장
      trimEndSec: null,
    },
  },
  {
    name: "따뜻한 톤",
    description: "BGM이 TTS 전 5초부터 부드럽게 페이드인되며, 저음대를 약간 강조하여 따뜻하고 포근한 느낌의 믹싱. 자연스러운 덕킹으로 편안한 분위기를 연출하고, TTS 종료 후 5초 연장 후 부드럽게 페이드아웃됩니다.",
    isDefault: true,
    settings: {
      ...DEFAULT_MIXING_SETTINGS,
      ttsGain: 1.0,
      bgmGain: 0.52,
      masterGain: 1.0,
      fadeIn: 3.2, // 따뜻한 느낌의 3.2초 페이드인
      fadeOut: 3.2, // 따뜻한 느낌의 3.2초 페이드아웃
      fadeInRatio: 100,
      fadeOutRatio: 100,
      lowShelf: 2.0, // 저음대 약간 강조
      midPeaking: 0,
      highShelf: -1.0,
      duckingEnabled: true,
      duckDb: -9,
      duckThreshold: -42,
      duckRelease: 0.7, // 부드러운 릴리즈
      bgmOffset: 5.0, // TTS 전 5초
      ttsOffset: 0,
      bgmOffsetAfterTts: 5.0, // TTS 종료 후 BGM 5초 연장
      trimEndSec: null,
    },
  },
  {
    name: "부드러운 마무리",
    description: "BGM이 TTS 전 5초부터 부드럽게 페이드인되며, TTS 종료 후 5초 연장 후 긴 4.5초 페이드아웃으로 여유롭고 부드럽게 마무리되는 믹싱.",
    isDefault: true,
    settings: {
      ...DEFAULT_MIXING_SETTINGS,
      ttsGain: 1.0,
      bgmGain: 0.5,
      masterGain: 1.0,
      fadeIn: 3.0, // 부드러운 3초 페이드인
      fadeOut: 4.5, // 긴 4.5초 페이드아웃
      fadeInRatio: 100,
      fadeOutRatio: 100,
      duckingEnabled: true,
      duckDb: -10,
      duckThreshold: -42,
      duckRelease: 0.6,
      bgmOffset: 5.0, // TTS 전 5초
      ttsOffset: 0,
      bgmOffsetAfterTts: 5.0, // TTS 종료 후 BGM 5초 연장
      trimEndSec: null,
    },
  },
];

export default function MixPresetsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [presets, setPresets] = useState<MixingPreset[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<MixingPreset | null>(null);
  const [newPreset, setNewPreset] = useState<{
    name: string;
    description: string;
    settings: MixingSettings;
  }>({
    name: "",
    description: "",
    settings: { ...DEFAULT_MIXING_SETTINGS },
  });

  // 프리셋 로드
  useEffect(() => {
    if (!user?.id) return;
    
    // 기본 프리셋 생성
    const defaultPresets: MixingPreset[] = DEFAULT_PRESETS.map((preset, index) => ({
      ...preset,
      id: `default_${index}`,
      createdAt: new Date().toISOString(),
    }));

    // 사용자 프리셋 로드
    const saved = localStorage.getItem(`mix_presets_${user.id}`);
    let userPresets: MixingPreset[] = [];
    if (saved) {
      try {
        userPresets = JSON.parse(saved);
      } catch {
        userPresets = [];
      }
    }

    // 기본 프리셋과 사용자 프리셋 병합
    setPresets([...defaultPresets, ...userPresets]);
  }, [user?.id]);

  const savePresets = useCallback((newPresets: MixingPreset[]) => {
    if (!user?.id) return;
    
    // 기본 프리셋과 사용자 프리셋 분리
    const defaultPresets = newPresets.filter((p) => p.isDefault);
    const userPresets = newPresets.filter((p) => !p.isDefault);
    
    localStorage.setItem(`mix_presets_${user.id}`, JSON.stringify(userPresets));
    setPresets(newPresets);
  }, [user?.id]);

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
      isDefault: false,
    };

    savePresets([...presets, preset]);
    setIsCreateDialogOpen(false);
    setNewPreset({
      name: "",
      description: "",
      settings: { ...DEFAULT_MIXING_SETTINGS },
    });

    toast({
      title: "프리셋 생성 완료",
      description: "새 프리셋이 생성되었습니다.",
    });
  };

  const handleEditPreset = (preset: MixingPreset) => {
    if (preset.isDefault) {
      // 기본 프리셋은 복사하여 편집
      setNewPreset({
        name: `${preset.name} (복사본)`,
        description: preset.description || "",
        settings: { ...preset.settings },
      });
      setIsCreateDialogOpen(true);
      return;
    }
    setEditingPreset(preset);
    setNewPreset({
      name: preset.name,
      description: preset.description || "",
      settings: { ...preset.settings },
    });
    setIsCreateDialogOpen(true);
  };

  const handleUpdatePreset = () => {
    if (!editingPreset || !newPreset.name.trim()) {
      toast({
        title: "입력 필요",
        description: "프리셋 이름을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    const updated: MixingPreset = {
      ...editingPreset,
      name: newPreset.name,
      description: newPreset.description,
      settings: newPreset.settings,
      updatedAt: new Date().toISOString(),
    };

    savePresets(presets.map((p) => (p.id === editingPreset.id ? updated : p)));
    setIsCreateDialogOpen(false);
    setEditingPreset(null);
    setNewPreset({
      name: "",
      description: "",
      settings: { ...DEFAULT_MIXING_SETTINGS },
    });

    toast({
      title: "프리셋 수정 완료",
      description: "프리셋이 수정되었습니다.",
    });
  };

  const handleDeletePreset = (id: string) => {
    const preset = presets.find((p) => p.id === id);
    if (preset?.isDefault) {
      toast({
        title: "삭제 불가",
        description: "기본 제공 프리셋은 삭제할 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    if (!confirm("정말 삭제하시겠습니까?")) return;
    savePresets(presets.filter((p) => p.id !== id));
    toast({
      title: "삭제 완료",
      description: "프리셋이 삭제되었습니다.",
    });
  };

  const handleCopyPreset = (preset: MixingPreset) => {
    setNewPreset({
      name: `${preset.name} (복사본)`,
      description: preset.description || "",
      settings: { ...preset.settings },
    });
    setIsCreateDialogOpen(true);
  };

  const handleUsePreset = (preset: MixingPreset) => {
    // localStorage에 프리셋 저장 (믹스 보드에서 읽어옴)
    if (user?.id) {
      // 저장된 믹스보드 상태 확인 (선택된 음원 유지)
      const savedStateKey = `mixboard_state_${user.id}`;
      const savedStateStr = localStorage.getItem(savedStateKey);
      let savedState = null;
      
      if (savedStateStr) {
        try {
          savedState = JSON.parse(savedStateStr);
        } catch {
          savedState = null;
        }
      }
      
      // 프리셋과 함께 현재 선택 상태도 저장 (음원 선택 유지)
      localStorage.setItem(`pending_preset_${user.id}`, JSON.stringify({
        id: preset.id,
        name: preset.name,
        settings: preset.settings,
        timestamp: Date.now(),
        // 현재 선택된 음원 정보도 함께 저장
        preserveSelection: true,
        selectedGeneration: savedState?.selectedGeneration || null,
        selectedBgmFileName: savedState?.selectedBgmFileName || null,
      }));
    }
    // 믹스 보드로 이동
    navigate("/mix/board");
    toast({
      title: "프리셋 적용",
      description: "믹스 보드로 이동합니다.",
    });
  };

  const resetDialog = () => {
    setIsCreateDialogOpen(false);
    setEditingPreset(null);
    setNewPreset({
      name: "",
      description: "",
      settings: { ...DEFAULT_MIXING_SETTINGS },
    });
  };

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        title="믹싱 프리셋"
        description="자주 사용하는 믹싱 설정을 프리셋으로 저장하고 관리합니다"
        icon={Settings}
      />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              프리셋을 선택하면 믹스 보드에서 바로 사용할 수 있습니다.
            </p>
          </div>
          <Button onClick={() => {
            resetDialog();
            setIsCreateDialogOpen(true);
          }}>
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
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg">{preset.name}</CardTitle>
                        {preset.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            <Sparkles className="w-3 h-3 mr-1" />
                            기본
                          </Badge>
                        )}
                      </div>
                      {preset.description && (
                        <CardDescription className="text-sm line-clamp-2">
                          {preset.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">TTS 볼륨:</span>
                        <span className="font-medium">{Math.round(preset.settings.ttsGain * 100)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">BGM 볼륨:</span>
                        <span className="font-medium">{Math.round(preset.settings.bgmGain * 100)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">페이드 인:</span>
                        <span className="font-medium">{preset.settings.fadeIn}초</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">페이드 아웃:</span>
                        <span className="font-medium">{preset.settings.fadeOut}초</span>
                      </div>
                    </div>
                    {preset.settings.duckingEnabled && (
                      <div className="pt-2 border-t">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>오토덕킹:</span>
                          <span className="font-medium">활성화 (BGM {Math.round((1 - Math.pow(10, preset.settings.duckDb / 20)) * 100)}% 감소)</span>
                        </div>
                      </div>
                    )}
                    {preset.settings.bgmOffsetAfterTts && preset.settings.bgmOffsetAfterTts > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>TTS 종료 후 BGM 연장:</span>
                        <span className="font-medium">{preset.settings.bgmOffsetAfterTts}초</span>
                      </div>
                    )}
                  </div>
                  <Separator />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleUsePreset(preset)}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      사용하기
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopyPreset(preset)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    {!preset.isDefault && (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleEditPreset(preset)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDeletePreset(preset.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* 프리셋 생성/편집 다이얼로그 */}
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          if (!open) resetDialog();
        }}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPreset ? "프리셋 수정" : "새 프리셋 생성"}</DialogTitle>
              <DialogDescription>
                {editingPreset
                  ? "프리셋 설정을 수정합니다."
                  : "믹싱 설정을 프리셋으로 저장합니다. 모든 설정을 세밀하게 조정할 수 있습니다."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>프리셋 이름 *</Label>
                  <Input
                    value={newPreset.name}
                    onChange={(e) =>
                      setNewPreset({ ...newPreset, name: e.target.value })
                    }
                    placeholder="예: 부드러운 믹싱, 뉴스 스타일"
                  />
                </div>
                <div className="space-y-2">
                  <Label>설명 (선택사항)</Label>
                  <Textarea
                    value={newPreset.description}
                    onChange={(e) =>
                      setNewPreset({ ...newPreset, description: e.target.value })
                    }
                    placeholder="프리셋에 대한 상세 설명을 입력하세요. 예: BGM이 자연스럽게 페이드인되며, TTS 송출 시 BGM이 50%로 줄어들고..."
                    rows={3}
                  />
                </div>
              </div>

              <Separator />

              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">기본 설정</TabsTrigger>
                  <TabsTrigger value="fade">페이드</TabsTrigger>
                  <TabsTrigger value="ducking">덕킹</TabsTrigger>
                  <TabsTrigger value="advanced">고급</TabsTrigger>
                </TabsList>

                {/* 기본 설정 */}
                <TabsContent value="basic" className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      기본 볼륨 및 마스터 설정입니다.
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>TTS 볼륨: {Math.round(newPreset.settings.ttsGain * 100)}%</Label>
                      </div>
                      <Slider
                        value={[newPreset.settings.ttsGain * 100]}
                        onValueChange={([value]) =>
                          setNewPreset({
                            ...newPreset,
                            settings: { ...newPreset.settings, ttsGain: value / 100 },
                          })
                        }
                        min={0}
                        max={200}
                        step={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>BGM 볼륨: {Math.round(newPreset.settings.bgmGain * 100)}%</Label>
                      </div>
                      <Slider
                        value={[newPreset.settings.bgmGain * 100]}
                        onValueChange={([value]) =>
                          setNewPreset({
                            ...newPreset,
                            settings: { ...newPreset.settings, bgmGain: value / 100 },
                          })
                        }
                        min={0}
                        max={200}
                        step={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>마스터 볼륨: {Math.round(newPreset.settings.masterGain * 100)}%</Label>
                      </div>
                      <Slider
                        value={[newPreset.settings.masterGain * 100]}
                        onValueChange={([value]) =>
                          setNewPreset({
                            ...newPreset,
                            settings: { ...newPreset.settings, masterGain: value / 100 },
                          })
                        }
                        min={0}
                        max={200}
                        step={1}
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* 페이드 설정 */}
                <TabsContent value="fade" className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      BGM 페이드인/아웃 설정입니다. BGM이 시작될 때와 종료될 때의 페이드 시간을 설정합니다.
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>BGM 페이드인 시간: {newPreset.settings.fadeIn}초</Label>
                      </div>
                      <Slider
                        value={[newPreset.settings.fadeIn]}
                        onValueChange={([value]) =>
                          setNewPreset({
                            ...newPreset,
                            settings: { ...newPreset.settings, fadeIn: value },
                          })
                        }
                        min={0}
                        max={10}
                        step={0.1}
                      />
                      <p className="text-xs text-muted-foreground">
                        BGM이 시작될 때 소리가 서서히 커지는 시간입니다.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>종료 페이드아웃 시간: {newPreset.settings.fadeOut}초</Label>
                      </div>
                      <Slider
                        value={[newPreset.settings.fadeOut]}
                        onValueChange={([value]) =>
                          setNewPreset({
                            ...newPreset,
                            settings: { ...newPreset.settings, fadeOut: value },
                          })
                        }
                        min={0}
                        max={10}
                        step={0.1}
                      />
                      <p className="text-xs text-muted-foreground">
                        종료 전 소리가 서서히 작아지는 시간입니다. 예: 2초 설정 시 종료 2초 전부터 페이드아웃이 시작됩니다.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>페이드인 비율: {newPreset.settings.fadeInRatio}%</Label>
                      </div>
                      <Slider
                        value={[newPreset.settings.fadeInRatio || 100]}
                        onValueChange={([value]) =>
                          setNewPreset({
                            ...newPreset,
                            settings: { ...newPreset.settings, fadeInRatio: value },
                          })
                        }
                        min={0}
                        max={100}
                        step={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>페이드아웃 비율: {newPreset.settings.fadeOutRatio}%</Label>
                      </div>
                      <Slider
                        value={[newPreset.settings.fadeOutRatio || 100]}
                        onValueChange={([value]) =>
                          setNewPreset({
                            ...newPreset,
                            settings: { ...newPreset.settings, fadeOutRatio: value },
                          })
                        }
                        min={0}
                        max={100}
                        step={1}
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* 덕킹 설정 */}
                <TabsContent value="ducking" className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      오토덕킹 설정입니다. TTS 음원이 재생될 때 BGM 볼륨을 자동으로 줄여 TTS가 명확하게 들리도록 합니다.
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>오토덕킹 활성화</Label>
                        <p className="text-xs text-muted-foreground">
                          TTS 송출 시 BGM 볼륨을 자동으로 감소시킵니다.
                        </p>
                      </div>
                      <Switch
                        checked={newPreset.settings.duckingEnabled}
                        onCheckedChange={(checked) =>
                          setNewPreset({
                            ...newPreset,
                            settings: { ...newPreset.settings, duckingEnabled: checked },
                          })
                        }
                      />
                    </div>
                    {newPreset.settings.duckingEnabled && (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>덕킹 감소량: {newPreset.settings.duckDb}dB</Label>
                          </div>
                          <Slider
                            value={[newPreset.settings.duckDb]}
                            onValueChange={([value]) =>
                              setNewPreset({
                                ...newPreset,
                                settings: { ...newPreset.settings, duckDb: value },
                              })
                            }
                            min={-30}
                            max={0}
                            step={1}
                          />
                          <p className="text-xs text-muted-foreground">
                            TTS 송출 시 BGM이 감소하는 양입니다. -10dB는 약 50% 감소를 의미합니다.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>덕킹 임계값: {newPreset.settings.duckThreshold}dBFS</Label>
                          </div>
                          <Slider
                            value={[newPreset.settings.duckThreshold]}
                            onValueChange={([value]) =>
                              setNewPreset({
                                ...newPreset,
                                settings: { ...newPreset.settings, duckThreshold: value },
                              })
                            }
                            min={-60}
                            max={-20}
                            step={1}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>덕킹 릴리즈: {newPreset.settings.duckRelease}초</Label>
                          </div>
                          <Slider
                            value={[newPreset.settings.duckRelease]}
                            onValueChange={([value]) =>
                              setNewPreset({
                                ...newPreset,
                                settings: { ...newPreset.settings, duckRelease: value },
                              })
                            }
                            min={0.1}
                            max={2.0}
                            step={0.1}
                          />
                          <p className="text-xs text-muted-foreground">
                            TTS 종료 후 BGM이 원래 볼륨으로 복원되는 시간입니다.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </TabsContent>

                {/* 고급 설정 */}
                <TabsContent value="advanced" className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      고급 설정입니다. TTS 종료 후 BGM 연장 시간 등을 설정할 수 있습니다.
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>TTS 종료 후 BGM 연장 시간: {newPreset.settings.bgmOffsetAfterTts || 0}초</Label>
                      </div>
                      <Slider
                        value={[newPreset.settings.bgmOffsetAfterTts || 0]}
                        onValueChange={([value]) =>
                          setNewPreset({
                            ...newPreset,
                            settings: { ...newPreset.settings, bgmOffsetAfterTts: value },
                          })
                        }
                        min={0}
                        max={30}
                        step={0.5}
                      />
                      <p className="text-xs text-muted-foreground">
                        TTS 종료 후 BGM이 계속 재생되는 시간입니다. 예: 5초 설정 시 TTS 종료 후 BGM이 5초 더 재생되고, 그 후 페이드아웃이 시작됩니다.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>BGM 시작 오프셋: {newPreset.settings.bgmOffset}초</Label>
                      </div>
                      <Slider
                        value={[newPreset.settings.bgmOffset]}
                        onValueChange={([value]) =>
                          setNewPreset({
                            ...newPreset,
                            settings: { ...newPreset.settings, bgmOffset: value },
                          })
                        }
                        min={0}
                        max={10}
                        step={0.1}
                      />
                      <p className="text-xs text-muted-foreground">
                        TTS 시작 전 BGM이 먼저 시작되는 시간입니다.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>TTS 시작 오프셋: {newPreset.settings.ttsOffset}초</Label>
                      </div>
                      <Slider
                        value={[newPreset.settings.ttsOffset]}
                        onValueChange={([value]) =>
                          setNewPreset({
                            ...newPreset,
                            settings: { ...newPreset.settings, ttsOffset: value },
                          })
                        }
                        min={0}
                        max={10}
                        step={0.1}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetDialog}>
                취소
              </Button>
              <Button onClick={editingPreset ? handleUpdatePreset : handleCreatePreset}>
                <Save className="w-4 h-4 mr-2" />
                {editingPreset ? "수정" : "저장"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  );
}
