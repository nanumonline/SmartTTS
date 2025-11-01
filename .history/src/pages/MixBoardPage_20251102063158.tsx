import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Play, Square, Download, Music2, Volume2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import * as dbService from "@/services/dbService";
import AudioPlayer from "@/components/AudioPlayer";
import MixingTimeline from "@/components/MixingTimeline";
import { exportMixToWav, MixingSettings } from "@/lib/audioMixer";
import { useToast } from "@/components/ui/use-toast";

export default function MixBoardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [generations, setGenerations] = useState<dbService.GenerationEntry[]>([]);
  const [selectedGeneration, setSelectedGeneration] = useState<string | null>(null);
  const [mixingStates, setMixingStates] = useState<Map<string, any>>(new Map());
  const [isMixing, setIsMixing] = useState(false);
  const [mixedAudioUrl, setMixedAudioUrl] = useState<string | null>(null);

  // 믹싱 설정
  const [mixingSettings, setMixingSettings] = useState<MixingSettings>({
    ttsGain: 1.0,
    bgmGain: 0.5,
    effectGain: 0,
    masterGain: 1.0,
    fadeIn: 2,
    fadeOut: 2,
    fadeInRatio: 50,
    fadeOutRatio: 50,
    lowShelf: 0,
    midShelf: 0,
    highShelf: 0,
    bgmStartOffset: 0,
    bgmOffsetAfterTts: 0,
  });

  useEffect(() => {
    if (user?.id) {
      loadGenerations();
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id && selectedGeneration) {
      loadMixingState(selectedGeneration);
    }
  }, [user?.id, selectedGeneration]);

  const loadGenerations = async () => {
    if (!user?.id) return;
    try {
      const data = await dbService.loadGenerations(user.id, 100);
      setGenerations(data.filter((g) => g.hasAudio && g.audioUrl));
    } catch (error) {
      console.error("생성 내역 로드 실패:", error);
    }
  };

  const loadMixingState = async (generationId: string) => {
    if (!user?.id) return;
    try {
      const states = await dbService.loadMixingStates(user.id);
      setMixingStates(states);
      const state = states.get(generationId);
      if (state && state.settings) {
        const settings = state.settings;
        setMixingSettings({
          ttsGain: (settings.voiceTrackVolume || 100) / 100,
          bgmGain: (settings.backgroundTrackVolume || 50) / 100,
          effectGain: 0,
          masterGain: (settings.masterGain || 100) / 100,
          fadeIn: settings.fadeIn || 2,
          fadeOut: settings.fadeOut || 2,
          fadeInRatio: settings.fadeInRatio || 50,
          fadeOutRatio: settings.fadeOutRatio || 50,
          lowShelf: settings.lowShelf || 0,
          midShelf: settings.midPeaking || 0,
          highShelf: settings.highShelf || 0,
          bgmStartOffset: settings.bgmOffset || 0,
          bgmOffsetAfterTts: settings.bgmOffsetAfterTts || 0,
        });
      }
    } catch (error) {
      console.error("믹싱 상태 로드 실패:", error);
    }
  };

  const saveMixingState = async () => {
    if (!user?.id || !selectedGeneration) return;
    try {
      await dbService.saveMixingState(user.id, {
        generationId: selectedGeneration,
        settings: {
          voiceTrackVolume: mixingSettings.ttsGain * 100,
          backgroundTrackVolume: mixingSettings.bgmGain * 100,
          masterGain: mixingSettings.masterGain * 100,
          fadeIn: mixingSettings.fadeIn,
          fadeOut: mixingSettings.fadeOut,
          fadeInRatio: mixingSettings.fadeInRatio,
          fadeOutRatio: mixingSettings.fadeOutRatio,
          lowShelf: mixingSettings.lowShelf,
          midPeaking: mixingSettings.midShelf,
          highShelf: mixingSettings.highShelf,
          bgmOffset: mixingSettings.bgmStartOffset,
          bgmOffsetAfterTts: mixingSettings.bgmOffsetAfterTts,
        },
      });
      toast({
        title: "저장 완료",
        description: "믹싱 설정이 저장되었습니다.",
      });
    } catch (error) {
      console.error("믹싱 상태 저장 실패:", error);
      toast({
        title: "저장 실패",
        description: "믹싱 설정 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleMix = async () => {
    if (!selectedGeneration) {
      toast({
        title: "음원 선택 필요",
        description: "믹싱할 음원을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    const generation = generations.find((g) => g.id === selectedGeneration);
    if (!generation || !generation.audioUrl) {
      toast({
        title: "오류",
        description: "선택한 음원의 오디오를 찾을 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    setIsMixing(true);
    try {
      // TODO: BGM 파일 선택 기능 추가 필요
      // 현재는 TTS만 표시
      const audioBlob = await fetch(generation.audioUrl).then((r) => r.blob());
      const wavBlob = await exportMixToWav(audioBlob, null, mixingSettings, 0);
      const url = URL.createObjectURL(wavBlob);
      setMixedAudioUrl(url);
      toast({
        title: "믹싱 완료",
        description: "음원 믹싱이 완료되었습니다.",
      });
    } catch (error) {
      console.error("믹싱 실패:", error);
      toast({
        title: "믹싱 실패",
        description: "믹싱 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsMixing(false);
    }
  };

  const selectedGen = generations.find((g) => g.id === selectedGeneration);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">믹스 보드</h1>
          <p className="text-muted-foreground mt-1">
            생성된 음원에 배경음악을 추가하여 믹싱합니다.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 음원 선택 및 미리듣기 */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>음원 선택</CardTitle>
              <CardDescription>믹싱할 음원을 선택하세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={selectedGeneration || ""}
                onValueChange={setSelectedGeneration}
              >
                <SelectTrigger>
                  <SelectValue placeholder="음원을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {generations.map((gen) => (
                    <SelectItem key={gen.id} value={gen.id || ""}>
                      {gen.savedName || `음원 ${gen.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedGen && selectedGen.audioUrl && (
                <div className="space-y-2">
                  <Label>원본 음원 미리듣기</Label>
                  <AudioPlayer
                    audioUrl={selectedGen.audioUrl}
                    title={selectedGen.savedName || "선택된 음원"}
                    duration={selectedGen.duration || 0}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 중앙: 타임라인 및 믹싱 컨트롤 */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>믹싱 타임라인</CardTitle>
              <CardDescription>BGM과 TTS의 위치 및 페이드를 조정합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {selectedGen && selectedGen.duration ? (
                <MixingTimeline
                  ttsDuration={selectedGen.duration}
                  bgmDuration={selectedGen.duration + (mixingSettings.bgmOffsetAfterTts || 0)}
                  bgmStartOffset={mixingSettings.bgmStartOffset || 0}
                  fadeIn={mixingSettings.fadeIn || 2}
                  fadeOut={mixingSettings.fadeOut || 2}
                  bgmOffsetAfterTts={mixingSettings.bgmOffsetAfterTts || 0}
                  fadeInRatio={mixingSettings.fadeInRatio || 50}
                  fadeOutRatio={mixingSettings.fadeOutRatio || 50}
                  onBgmStartOffsetChange={(offset) =>
                    setMixingSettings({ ...mixingSettings, bgmStartOffset: offset })
                  }
                  onFadeInChange={(fade) =>
                    setMixingSettings({ ...mixingSettings, fadeIn: fade })
                  }
                  onFadeOutChange={(fade) =>
                    setMixingSettings({ ...mixingSettings, fadeOut: fade })
                  }
                  onBgmOffsetAfterTtsChange={(offset) =>
                    setMixingSettings({ ...mixingSettings, bgmOffsetAfterTts: offset })
                  }
                  onFadeInRatioChange={(ratio) =>
                    setMixingSettings({ ...mixingSettings, fadeInRatio: ratio })
                  }
                  onFadeOutRatioChange={(ratio) =>
                    setMixingSettings({ ...mixingSettings, fadeOutRatio: ratio })
                  }
                />
              ) : (
                <div className="h-32 flex items-center justify-center text-muted-foreground">
                  음원을 선택하면 타임라인이 표시됩니다.
                </div>
              )}

              <Separator />

              {/* 볼륨 조정 */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>TTS 볼륨</Label>
                    <span className="text-sm text-muted-foreground">
                      {Math.round(mixingSettings.ttsGain * 100)}%
                    </span>
                  </div>
                  <Slider
                    value={[mixingSettings.ttsGain * 100]}
                    onValueChange={([value]) =>
                      setMixingSettings({ ...mixingSettings, ttsGain: value / 100 })
                    }
                    min={0}
                    max={200}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>BGM 볼륨</Label>
                    <span className="text-sm text-muted-foreground">
                      {Math.round(mixingSettings.bgmGain * 100)}%
                    </span>
                  </div>
                  <Slider
                    value={[mixingSettings.bgmGain * 100]}
                    onValueChange={([value]) =>
                      setMixingSettings({ ...mixingSettings, bgmGain: value / 100 })
                    }
                    min={0}
                    max={200}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>마스터 볼륨</Label>
                    <span className="text-sm text-muted-foreground">
                      {Math.round(mixingSettings.masterGain * 100)}%
                    </span>
                  </div>
                  <Slider
                    value={[mixingSettings.masterGain * 100]}
                    onValueChange={([value]) =>
                      setMixingSettings({ ...mixingSettings, masterGain: value / 100 })
                    }
                    min={0}
                    max={200}
                    step={1}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 믹싱 결과 */}
          {mixedAudioUrl && (
            <Card>
              <CardHeader>
                <CardTitle>믹싱 결과</CardTitle>
              </CardHeader>
              <CardContent>
                <AudioPlayer
                  audioUrl={mixedAudioUrl}
                  title="믹싱된 음원"
                  duration={0}
                />
              </CardContent>
            </Card>
          )}

          {/* 액션 버튼 */}
          <div className="flex items-center gap-4">
            <Button
              onClick={handleMix}
              disabled={!selectedGeneration || isMixing}
              className="flex-1"
            >
              {isMixing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  믹싱 중...
                </>
              ) : (
                <>
                  <Music2 className="w-4 h-4 mr-2" />
                  믹싱 실행
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={saveMixingState}
              disabled={!selectedGeneration}
            >
              설정 저장
            </Button>
            {mixedAudioUrl && (
              <Button
                variant="outline"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = mixedAudioUrl;
                  a.download = `mixed-${Date.now()}.wav`;
                  a.click();
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                다운로드
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
