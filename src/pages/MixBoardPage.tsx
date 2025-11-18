import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Play, Square, Download, Music2, Volume2, Star, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import * as dbService from "@/services/dbService";
import AudioPlayer from "@/components/AudioPlayer";
import MixingTimeline from "@/components/MixingTimeline";
import { exportMixToWav, MixingSettings, decodeFileToBuffer } from "@/lib/audioMixer";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function MixBoardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [generations, setGenerations] = useState<dbService.GenerationEntry[]>([]);
  const [selectedGeneration, setSelectedGeneration] = useState<string | null>(null);
  const [mixingStates, setMixingStates] = useState<Map<string, any>>(new Map());
  const [isMixing, setIsMixing] = useState(false);
  const [mixedAudioUrl, setMixedAudioUrl] = useState<string | null>(null);
  const [isLoadingGenerations, setIsLoadingGenerations] = useState(false);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  // 즐겨찾기 관련
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [favoriteLoadingIds, setFavoriteLoadingIds] = useState<Set<string>>(new Set());
  // BGM 파일 선택
  const [selectedBgmFile, setSelectedBgmFile] = useState<File | null>(null);
  const [bgmPreviewUrl, setBgmPreviewUrl] = useState<string | null>(null);
  const bgmPreviewUrlRef = useRef<string | null>(null);

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
    midPeaking: 0,
    highShelf: 0,
    duckingEnabled: false,
    duckDb: -10,
    duckThreshold: -42,
    duckRelease: 0.5,
    bgmOffset: 0, // TTS 시작 전 BGM 시작 오프셋
    ttsOffset: 0,
    bgmOffsetAfterTts: 0,
    trimEndSec: null,
  });

  useEffect(() => {
    if (user?.id) {
      loadGenerations();
    }
  }, [user?.id]);

  // 페이지 포커스 시 데이터 새로고침 (다른 페이지에서 즐겨찾기 변경 시 반영)
  useEffect(() => {
    const handleFocus = () => {
      if (user?.id) {
        loadGenerations();
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [user?.id]);

  const setFavoriteLoading = useCallback((id: string, isLoading: boolean) => {
    setFavoriteLoadingIds((prev) => {
      const next = new Set(prev);
      if (isLoading) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const filteredGenerations = useMemo(() => {
    if (!favoriteOnly) {
      return generations;
    }
    return generations.filter((gen) => gen.isFavorite);
  }, [favoriteOnly, generations]);

  const toggleFavorite = useCallback(
    async (gen: dbService.GenerationEntry) => {
      if (!user?.id || !gen?.id) {
        return;
      }
      const idStr = String(gen.id);
      if (favoriteLoadingIds.has(idStr)) {
        return;
      }

      const previousValue = gen.isFavorite === true;
      const nextValue = !previousValue;

      setFavoriteLoading(idStr, true);
      setGenerations((prev) =>
        prev.map((g) =>
          g.id === gen.id
            ? {
                ...g,
                isFavorite: nextValue,
              }
            : g
        )
      );

      try {
        const success = await dbService.setGenerationFavorite(user.id, idStr, nextValue);
        if (!success) {
          throw new Error("즐겨찾기 정보를 업데이트할 수 없습니다.");
        }
      } catch (error) {
        console.error("믹스보드 즐겨찾기 업데이트 실패:", error);
        const message = error instanceof Error ? error.message : "즐겨찾기 정보를 업데이트할 수 없습니다.";
        setGenerations((prev) =>
          prev.map((g) =>
            g.id === gen.id
              ? {
                  ...g,
                  isFavorite: previousValue,
                }
              : g
          )
        );
        toast({
          title: "즐겨찾기 업데이트 실패",
          description: message,
          variant: "destructive",
        });
      } finally {
        setFavoriteLoading(idStr, false);
      }
    },
    [favoriteLoadingIds, setFavoriteLoading, toast, user?.id]
  );

  // URL 파라미터에서 generation ID 읽기 및 자동 선택
  useEffect(() => {
    const generationId = searchParams.get("generation");
    if (generationId && generations.length > 0) {
      // generations 목록에 해당 ID가 있는지 확인
      const exists = generations.some((g) => String(g.id) === String(generationId));
      if (exists && !selectedGeneration) {
        setSelectedGeneration(generationId);
        // URL 파라미터 제거 (한 번만 사용)
        setSearchParams((prev) => {
          const newParams = new URLSearchParams(prev);
          newParams.delete("generation");
          return newParams;
        }, { replace: true });
        toast({
          title: "음원 자동 선택",
          description: "저장된 음원이 자동으로 선택되었습니다.",
        });
      } else if (exists && selectedGeneration !== generationId) {
        setSelectedGeneration(generationId);
      }
    }
  }, [searchParams, generations, selectedGeneration]);

  useEffect(() => {
    if (user?.id && selectedGeneration) {
      loadMixingState(selectedGeneration);
      // 선택된 음원의 blob URL 복원 (필요시)
      const selectedGen = generations.find((g) => g.id === selectedGeneration);
      if (selectedGen && !selectedGen.audioUrl && selectedGen.id) {
        // audioUrl이 null이고 audioBlob도 없으면 DB에서 로드 시도
        dbService.loadGenerationBlob(user.id, String(selectedGen.id))
          .then((res) => {
            if (res?.audioBlob) {
              const mimeType = res.mimeType || selectedGen.mimeType || "audio/mpeg";
              const blob = dbService.arrayBufferToBlob(res.audioBlob, mimeType);
              const newUrl = URL.createObjectURL(blob);
              setGenerations((prev) => 
                prev.map((g) => (g.id === selectedGen.id ? { ...g, audioUrl: newUrl } : g))
              );
            }
          })
          .catch((e) => {
            // 조용히 실패 처리 (500 에러 등)
            console.warn("선택된 음원 blob 로드 실패:", e);
          });
      }
    }
  }, [user?.id, selectedGeneration]);

  // AudioContext 생성 헬퍼 함수
  type ExtendedWindow = typeof window & {
    webkitAudioContext?: typeof AudioContext;
  };

  function createAudioContext(sampleRate = 44100): AudioContext {
    const globalWindow = window as ExtendedWindow;
    const AudioContextClass = globalWindow.AudioContext || globalWindow.webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error("이 브라우저는 Web Audio API를 지원하지 않습니다.");
    }

    try {
      return new AudioContextClass({ sampleRate });
    } catch {
      return new AudioContextClass();
    }
  }

  // 미리듣기 URL 정리 헬퍼 함수
  const revokePreviewUrl = useCallback(() => {
    if (previewAudioUrl) {
      try {
        URL.revokeObjectURL(previewAudioUrl);
      } catch {
        // ignore revoke errors
      }
      setPreviewAudioUrl(null);
    }
  }, [previewAudioUrl]);

  // 컴포넌트 언마운트 시 미리듣기 URL 정리
  useEffect(() => {
    return () => {
      revokePreviewUrl();
    };
  }, [revokePreviewUrl]);

  // 선택된 음원이 변경되면 기존 미리듣기 무효화
  useEffect(() => {
    revokePreviewUrl();
  }, [revokePreviewUrl, selectedGeneration]);

  // BGM 파일 선택 시 미리듣기 URL 생성 (useRef로 관리하여 blob 에러 방지)
  useEffect(() => {
    if (!selectedBgmFile) {
      if (bgmPreviewUrlRef.current) {
        try {
          URL.revokeObjectURL(bgmPreviewUrlRef.current);
        } catch {
          // ignore revoke errors
        }
        bgmPreviewUrlRef.current = null;
      }
      setBgmPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(selectedBgmFile);
    bgmPreviewUrlRef.current = url;
    setBgmPreviewUrl(url);

    return () => {
      if (bgmPreviewUrlRef.current) {
        try {
          URL.revokeObjectURL(bgmPreviewUrlRef.current);
        } catch {
          // ignore revoke errors
        }
        bgmPreviewUrlRef.current = null;
      }
    };
  }, [selectedBgmFile]);

  const loadGenerations = async () => {
    if (!user?.id) return;
    setIsLoadingGenerations(true);
    try {
      const data = await dbService.loadGenerations(user.id, 100);
      
      // Blob URL 복원 및 만료된 blob URL 처리
      // 초기 로드에서는 DB에서 blob을 로드하지 않음 (500 에러 방지)
      // 필요할 때만 onError 콜백에서 로드
      const processed = data.map((gen) => {
        let audioUrl: string | null = null;
        
        // 1. DB에 audioBlob이 있으면 항상 사용 (가장 확실)
        if (gen.audioBlob) {
          try {
            const blob = dbService.arrayBufferToBlob(gen.audioBlob, gen.mimeType || "audio/mpeg");
            audioUrl = URL.createObjectURL(blob);
          } catch (e) {
            console.warn("Blob URL 생성 실패:", e);
          }
        }
        
        // 2. audioUrl이 blob: URL이 아니면 사용 (외부 URL 등)
        if (!audioUrl && gen.audioUrl && !gen.audioUrl.startsWith('blob:')) {
          audioUrl = gen.audioUrl;
        }
        
        // 3. 만료된 blob URL은 null로 설정 (복원은 onError 콜백에서 수행)
        // 초기 로드에서는 DB에서 blob을 로드하지 않음 (서버 부하 방지)
        if (!audioUrl && gen.audioUrl && gen.audioUrl.startsWith('blob:')) {
          audioUrl = null; // null로 설정하여 브라우저가 접근하지 않도록 함
        }
        
        return { ...gen, audioUrl };
      });
      
      // hasAudio가 true인 항목만 필터링 (audioUrl이 null이어도 포함)
      // 실제 재생은 onError 콜백에서 복원 시도
      const filtered = processed.filter((g) => g.hasAudio !== false);
      setGenerations(filtered);
      
      if (filtered.length === 0 && data.length > 0) {
        toast({
          title: "음원 없음",
          description: "저장된 음원 중 재생 가능한 음원이 없습니다.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("생성 내역 로드 실패:", error);
      toast({
        title: "음원 로드 실패",
        description: "생성 내역을 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingGenerations(false);
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
          midPeaking: settings.midPeaking || 0,
          highShelf: settings.highShelf || 0,
          duckingEnabled: settings.duckingEnabled ?? false,
          duckDb: settings.duckDb ?? -10,
          duckThreshold: settings.duckThreshold ?? -42,
          duckRelease: settings.duckRelease ?? 0.5,
          bgmOffset: settings.bgmOffset || 0,
          ttsOffset: settings.ttsOffset || 0,
          bgmOffsetAfterTts: settings.bgmOffsetAfterTts || 0,
          trimEndSec: settings.trimEndSec ?? null,
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
          midPeaking: mixingSettings.midPeaking,
          highShelf: mixingSettings.highShelf,
          duckingEnabled: mixingSettings.duckingEnabled ?? false,
          duckDb: mixingSettings.duckDb ?? -10,
          duckThreshold: mixingSettings.duckThreshold ?? -42,
          duckRelease: mixingSettings.duckRelease ?? 0.5,
          bgmOffset: mixingSettings.bgmOffset,
          ttsOffset: mixingSettings.ttsOffset || 0,
          bgmOffsetAfterTts: mixingSettings.bgmOffsetAfterTts,
          trimEndSec: mixingSettings.trimEndSec ?? null,
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
        description: "믹싱할 TTS 음원을 선택해주세요.",
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
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
      
      // TTS 음원 디코딩
      const audioBlob = await fetch(generation.audioUrl).then((r) => r.blob());
      const ttsBuffer = await decodeFileToBuffer(ctx, audioBlob);
      
      // BGM 음원 디코딩 (선택된 경우)
      let bgmBuffer: AudioBuffer | null = null;
      if (selectedBgmFile) {
        try {
          bgmBuffer = await decodeFileToBuffer(ctx, selectedBgmFile);
        } catch (error) {
          console.error("BGM 디코딩 실패:", error);
          toast({
            title: "BGM 디코딩 실패",
            description: "BGM 파일을 디코딩하는 중 오류가 발생했습니다.",
            variant: "destructive",
          });
          setIsMixing(false);
          return;
        }
      }
      
      const wavBlob = await exportMixToWav(ttsBuffer, bgmBuffer, null, mixingSettings, 44100);
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

  const selectedGen = useMemo(() => generations.find((g) => g.id === selectedGeneration), [generations, selectedGeneration]);

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        title="믹스 보드"
        description="생성된 음원에 배경음악을 추가하여 믹싱합니다"
        icon={Music2}
      />

      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 음원 선택 및 미리듣기 */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>음원 선택</CardTitle>
              <CardDescription>믹싱할 음원을 선택하세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingGenerations ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  음원 목록을 불러오는 중...
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">TTS 음원 선택</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant={favoriteOnly ? "default" : "outline"}
                          size="icon"
                          aria-label={favoriteOnly ? "즐겨찾기만 보기 해제" : "즐겨찾기만 보기"}
                          aria-pressed={favoriteOnly}
                          onClick={() => setFavoriteOnly((prev) => !prev)}
                          className={favoriteOnly ? "border-amber-500 text-amber-500" : ""}
                        >
                          <Star className={`w-4 h-4 ${favoriteOnly ? "fill-current" : ""}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>즐겨찾기만 보기</TooltipContent>
                    </Tooltip>
                  </div>
                  <Select
                    value={selectedGeneration || ""}
                    onValueChange={(value) => {
                      setSelectedGeneration(value || null);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={filteredGenerations.length === 0 ? (favoriteOnly ? "즐겨찾기한 음원이 없습니다" : "저장된 음원이 없습니다") : "음원을 선택하세요"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {filteredGenerations.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          {favoriteOnly
                            ? "즐겨찾기한 음원이 없습니다. 필터를 해제하거나 즐겨찾기를 추가해 주세요."
                            : "저장된 음원이 없습니다. TTS 생성 페이지에서 음원을 저장해 주세요."}
                        </div>
                      ) : (
                        filteredGenerations.map((gen) => (
                          <SelectItem key={gen.id} value={String(gen.id || "")}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex flex-col text-left">
                                <span className="font-medium">{gen.savedName || `음원 ${String(gen.id || "").slice(0, 8)}...`}</span>
                                {gen.duration && (
                                  <span className="text-xs text-muted-foreground">
                                    {gen.duration.toFixed(1)}초 · {gen.purposeLabel || gen.purpose}
                                  </span>
                                )}
                              </div>
                              {gen.isFavorite && <Star className="w-4 h-4 text-amber-400 fill-current" />}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {selectedGen && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => selectedGen && toggleFavorite(selectedGen)}
                      disabled={!selectedGen || favoriteLoadingIds.has(String(selectedGen.id || ""))}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      {favoriteLoadingIds.has(String(selectedGen.id || "")) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Star className={`w-4 h-4 ${selectedGen?.isFavorite ? "text-amber-500 fill-current" : ""}`} />
                      )}
                      {selectedGen?.isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                    </Button>
                  )}
                </>
              )}

              {selectedGen && selectedGen.audioUrl && (
                <div className="space-y-2">
                  <Label>TTS 음원 미리듣기</Label>
                  <AudioPlayer
                    audioUrl={selectedGen.audioUrl}
                    title={selectedGen.savedName || "TTS 음원"}
                    duration={selectedGen.duration || 0}
                    mimeType={(selectedGen as any).mimeType || "audio/mpeg"}
                    onError={async () => {
                      // blob URL 만료 복원: DB에서 audioBlob을 다시 로드하여 blob URL 재생성
                      try {
                        if (!user?.id || !selectedGen?.id) return;
                        
                        // 500 에러 방지를 위해 재시도 로직 추가
                        let res = null;
                        let retries = 0;
                        const maxRetries = 2;
                        
                        while (retries < maxRetries && !res) {
                          try {
                            res = await dbService.loadGenerationBlob(user.id, String(selectedGen.id));
                            if (res?.audioBlob) break;
                          } catch (e: any) {
                            // 500 에러는 재시도
                            if (e.status === 500 || e.message?.includes("500")) {
                              retries++;
                              if (retries < maxRetries) {
                                await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // 지수 백오프
                                continue;
                              }
                            }
                            // 다른 에러는 즉시 중단
                            throw e;
                          }
                        }
                        
                        if (res?.audioBlob) {
                          const mimeType = res.mimeType || (selectedGen as any).mimeType || "audio/mpeg";
                          const blob = dbService.arrayBufferToBlob(res.audioBlob, mimeType);
                          const newUrl = URL.createObjectURL(blob);
                          // generations 상태 업데이트
                          setGenerations((prev) => prev.map((g) => (g.id === selectedGen.id ? { ...g, audioUrl: newUrl } : g)));
                        } else {
                          // blob이 없으면 null로 설정하여 더 이상 접근하지 않도록 함
                          setGenerations((prev) => prev.map((g) => (g.id === selectedGen.id ? { ...g, audioUrl: null } : g)));
                        }
                      } catch (e) {
                        console.warn("TTS 미리듣기 복원 실패:", e);
                        // 복원 실패 시 null로 설정하여 더 이상 접근하지 않도록 함
                        if (selectedGen?.id) {
                          setGenerations((prev) => prev.map((g) => (g.id === selectedGen.id ? { ...g, audioUrl: null } : g)));
                        }
                      }
                    }}
                  />
                </div>
              )}

              {/* BGM 파일 선택 */}
              <div className="space-y-2">
                <Label>BGM 파일 선택 (선택사항)</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        // 파일 크기 제한 (100MB)
                        if (file.size > 100 * 1024 * 1024) {
                          toast({
                            title: "파일 크기 초과",
                            description: "BGM 파일은 100MB 이하만 업로드 가능합니다.",
                            variant: "destructive",
                          });
                          e.target.value = "";
                          return;
                        }
                        setSelectedBgmFile(file);
                        // 미리듣기 무효화
                        revokePreviewUrl();
                      } else {
                        setSelectedBgmFile(null);
                      }
                    }}
                    className="hidden"
                    id="bgm-file-input"
                  />
                  <label
                    htmlFor="bgm-file-input"
                    className="flex-1 cursor-pointer"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      asChild
                    >
                      <span>
                        {selectedBgmFile ? (
                          <>
                            <Music2 className="w-4 h-4 mr-2" />
                            {selectedBgmFile.name.length > 30
                              ? `${selectedBgmFile.name.substring(0, 30)}...`
                              : selectedBgmFile.name}
                          </>
                        ) : (
                          <>
                            <Music2 className="w-4 h-4 mr-2" />
                            BGM 파일 선택
                          </>
                        )}
                      </span>
                    </Button>
                  </label>
                  {selectedBgmFile && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedBgmFile(null);
                        const input = document.getElementById("bgm-file-input") as HTMLInputElement;
                        if (input) input.value = "";
                        revokePreviewUrl();
                      }}
                      className="text-red-400 hover:text-red-300"
                    >
                      제거
                    </Button>
                  )}
                </div>
                {bgmPreviewUrl && (
                  <div className="space-y-2 mt-2">
                    <Label className="text-xs text-muted-foreground">BGM 미리듣기</Label>
                    <AudioPlayer
                      audioUrl={bgmPreviewUrl}
                      title={selectedBgmFile?.name || "BGM"}
                      duration={0}
                      mimeType={selectedBgmFile?.type}
                    />
                  </div>
                )}
              </div>

              {/* 예상 믹싱 음원 미리듣기 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>예상 믹싱 음원 미리듣기</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (!selectedGen || !selectedGen.audioUrl) return;
                          setIsGeneratingPreview(true);
                          try {
                            // AudioContext 생성 및 TTS 음원 디코딩
                            const ctx = createAudioContext();
                            revokePreviewUrl();
                            let ttsBuffer: AudioBuffer | null = null;
                            try {
                              const audioBlob = await fetch(selectedGen.audioUrl).then((r) => r.blob());
                              ttsBuffer = await decodeFileToBuffer(ctx, audioBlob);
                            } catch (err) {
                              // blob URL 만료 시 DB에서 복원 후 재시도
                              try {
                                if (user?.id && selectedGen.id) {
                                  const res = await dbService.loadGenerationBlob(user.id, String(selectedGen.id));
                                  if (res?.audioBlob) {
                                    const mimeType = res.mimeType || (selectedGen as any).mimeType || "audio/mpeg";
                                    const blob = dbService.arrayBufferToBlob(res.audioBlob, mimeType);
                                    const newUrl = URL.createObjectURL(blob);
                                    setGenerations((prev) => prev.map((g) => (g.id === selectedGen.id ? { ...g, audioUrl: newUrl } : g)));
                                    const restoredBlob = blob;
                                    ttsBuffer = await decodeFileToBuffer(ctx, restoredBlob);
                                  }
                                }
                              } catch (e) {
                                console.error("예상 믹싱용 TTS 복원 실패:", e);
                                throw e;
                              }
                            }
                            if (!ttsBuffer) throw new Error("TTS 버퍼를 불러올 수 없습니다.");
                            
                            // BGM 디코딩 (선택된 경우)
                            let bgmBuffer: AudioBuffer | null = null;
                            if (selectedBgmFile) {
                              try {
                                bgmBuffer = await decodeFileToBuffer(ctx, selectedBgmFile);
                              } catch (error) {
                                console.error("BGM 디코딩 실패:", error);
                                toast({
                                  title: "BGM 디코딩 실패",
                                  description: "BGM 파일을 디코딩하는 중 오류가 발생했습니다.",
                                  variant: "destructive",
                                });
                                setIsGeneratingPreview(false);
                                return;
                              }
                            }
                            
                            // 예상 믹싱 생성
                            const wavBlob = await exportMixToWav(
                              ttsBuffer,
                              bgmBuffer, // 선택된 BGM
                              null, // 효과음 없음
                              mixingSettings,
                              44100
                            );
                            const url = URL.createObjectURL(wavBlob);
                            revokePreviewUrl();
                            setPreviewAudioUrl(url);
                            toast({
                              title: "미리듣기 생성 완료",
                              description: "현재 설정으로 예상 믹싱 음원을 생성했습니다.",
                            });
                          } catch (error) {
                            console.error("미리듣기 생성 실패:", error);
                            toast({
                              title: "미리듣기 생성 실패",
                              description: "예상 믹싱 음원을 생성하는데 실패했습니다.",
                              variant: "destructive",
                            });
                          } finally {
                            setIsGeneratingPreview(false);
                          }
                        }}
                        disabled={isGeneratingPreview || !selectedGen}
                        className="text-xs h-7"
                      >
                        {isGeneratingPreview ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400 mr-1"></div>
                            생성 중...
                          </>
                        ) : (
                          "미리듣기 생성"
                        )}
                      </Button>
                    </div>
                    {previewAudioUrl ? (
                      <AudioPlayer
                        audioUrl={previewAudioUrl}
                        title="예상 믹싱 음원"
                        duration={selectedGen?.duration || 0}
                        mimeType="audio/wav"
                      />
                    ) : (
                      <div className="text-xs text-muted-foreground p-2 bg-gray-800/30 rounded border border-gray-700">
                        "미리듣기 생성" 버튼을 클릭하여 현재 설정으로 예상 믹싱 음원을 생성하세요.
                      </div>
                    )}
                  </div>
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
                  bgmOffset={mixingSettings.bgmOffset || 0}
                  fadeIn={mixingSettings.fadeIn || 2}
                  fadeOut={mixingSettings.fadeOut || 2}
                  bgmOffsetAfterTts={mixingSettings.bgmOffsetAfterTts || 0}
                  fadeInRatio={mixingSettings.fadeInRatio || 50}
                  fadeOutRatio={mixingSettings.fadeOutRatio || 50}
                  onBgmOffsetChange={(offset) => {
                    setMixingSettings({ ...mixingSettings, bgmOffset: Math.abs(offset) });
                    revokePreviewUrl();
                  }}
                  onFadeInChange={(fade) => {
                    setMixingSettings({ ...mixingSettings, fadeIn: fade });
                    revokePreviewUrl();
                  }}
                  onFadeOutChange={(fade) => {
                    setMixingSettings({ ...mixingSettings, fadeOut: fade });
                    revokePreviewUrl();
                  }}
                  onBgmOffsetAfterTtsChange={(offset) => {
                    setMixingSettings({ ...mixingSettings, bgmOffsetAfterTts: offset });
                    revokePreviewUrl();
                  }}
                  onFadeInRatioChange={(ratio) => {
                    setMixingSettings({ ...mixingSettings, fadeInRatio: ratio });
                    revokePreviewUrl();
                  }}
                  onFadeOutRatioChange={(ratio) => {
                    setMixingSettings({ ...mixingSettings, fadeOutRatio: ratio });
                    revokePreviewUrl();
                  }}
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
                    onValueChange={([value]) => {
                      setMixingSettings({ ...mixingSettings, ttsGain: value / 100 });
                      revokePreviewUrl();
                    }}
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
                    onValueChange={([value]) => {
                      setMixingSettings({ ...mixingSettings, bgmGain: value / 100 });
                      revokePreviewUrl();
                    }}
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
                    onValueChange={([value]) => {
                      setMixingSettings({ ...mixingSettings, masterGain: value / 100 });
                      revokePreviewUrl();
                    }}
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
    </PageContainer>
  );
}

