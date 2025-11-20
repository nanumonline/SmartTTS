import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Play, Square, Download, Music2, Volume2, Star, Loader2, Settings, RotateCcw, Save, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
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
  const location = useLocation();
  const [generations, setGenerations] = useState<dbService.GenerationEntry[]>([]);
  const [selectedGeneration, setSelectedGeneration] = useState<string | null>(null);
  const [mixingStates, setMixingStates] = useState<Map<string, any>>(new Map());
  const [isMixing, setIsMixing] = useState(false);
  const [mixedAudioUrl, setMixedAudioUrl] = useState<string | null>(null);
  const [isLoadingGenerations, setIsLoadingGenerations] = useState(false);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const previewAudioUrlRef = useRef<string | null>(null);
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

  // 프리셋 적용 (프리셋 페이지에서 전달된 경우)
  const appliedPresetRef = useRef<string | null>(null);
  const [appliedPresetName, setAppliedPresetName] = useState<string | null>(null);
  const lockedPresetRef = useRef<string | null>(null); // 고정된 프리셋 ID

  // 저장 다이얼로그
  const [saveDialog, setSaveDialog] = useState({
    open: false,
    fileName: "",
    isSaving: false,
  });

  // 다운로드 다이얼로그
  const [downloadDialog, setDownloadDialog] = useState({
    open: false,
    format: "wav" as "wav" | "mp3" | "ogg",
  });

  // 믹싱된 오디오 Blob 저장
  const mixedAudioBlobRef = useRef<Blob | null>(null);

  // 프리셋 정보 표시 여부
  const [showPresetDetails, setShowPresetDetails] = useState(false);

  const loadGenerations = useCallback(async () => {
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
  }, [user?.id, toast]);

  // 프리셋 적용 함수
  const applyPendingPreset = useCallback(() => {
    if (!user?.id) return;
    
    // 프리셋 적용 전 현재 선택 상태 저장 (음원 선택 유지)
    const currentSelectedGeneration = selectedGeneration;
    const currentSelectedBgmFile = selectedBgmFile;
    
    const pendingPresetKey = `pending_preset_${user.id}`;
    const pendingPresetStr = localStorage.getItem(pendingPresetKey);
    
    if (pendingPresetStr) {
      try {
        const pendingPreset = JSON.parse(pendingPresetStr);
        // 5분 이내의 프리셋만 적용 (오래된 프리셋 무시)
        const age = Date.now() - (pendingPreset.timestamp || 0);
        if (age < 5 * 60 * 1000 && pendingPreset.settings && pendingPreset.id) {
          // 같은 프리셋이어도 항상 적용 (사용자가 설정을 변경한 후 다시 적용할 수 있도록)
          const previousPresetId = appliedPresetRef.current;
          appliedPresetRef.current = pendingPreset.id;
          setAppliedPresetName(pendingPreset.name);
          
          // 프리셋이 변경되면 고정 해제
          if (previousPresetId !== pendingPreset.id) {
            lockedPresetRef.current = null;
            if (user?.id) {
              localStorage.removeItem(`locked_preset_${user.id}`);
            }
          }
          
          // 프리셋 설정을 먼저 적용 (음원 선택은 항상 유지)
          // 프리셋 설정을 깊은 복사하여 적용
          const presetSettings = { ...pendingPreset.settings };
          setMixingSettings(presetSettings);
          
          // 항상 현재 선택된 음원을 유지 (프리셋 변경 시에도 음원 선택 유지)
          if (currentSelectedGeneration) {
            setSelectedGeneration(currentSelectedGeneration);
          }
          // 현재 선택된 BGM이 있으면 유지
          if (currentSelectedBgmFile) {
            setSelectedBgmFile(currentSelectedBgmFile);
          }
          
          toast({
            title: "프리셋 적용됨",
            description: `"${pendingPreset.name}" 프리셋이 적용되었습니다.`,
          });
          // 프리셋 제거 (한 번만 적용)
          localStorage.removeItem(pendingPresetKey);
        } else {
          // 오래된 프리셋 제거
          localStorage.removeItem(pendingPresetKey);
        }
      } catch (error) {
        console.error("프리셋 적용 실패:", error);
        localStorage.removeItem(pendingPresetKey);
      }
    }
    
    // 저장된 믹스보드 상태 복원 (프리셋 페이지에서 돌아온 경우)
    // 단, 프리셋이 적용된 경우에는 믹싱 설정을 복원하지 않음 (프리셋 설정 우선)
    const savedStateKey = `mixboard_state_${user.id}`;
    const savedStateStr = localStorage.getItem(savedStateKey);
    // 프리셋이 이번 호출에서 적용되었는지 확인
    const presetWasAppliedInThisCall = pendingPresetStr && (() => {
      try {
        const preset = JSON.parse(pendingPresetStr);
        return preset.settings && preset.id && (Date.now() - (preset.timestamp || 0)) < 5 * 60 * 1000;
      } catch {
        return false;
      }
    })();
    
    if (savedStateStr) {
      try {
        const savedState = JSON.parse(savedStateStr);
        const age = Date.now() - (savedState.timestamp || 0);
        // 10분 이내의 상태만 복원
        if (age < 10 * 60 * 1000) {
          // 저장된 선택 상태가 있고, 현재 선택이 없을 때만 복원
          if (savedState.selectedGeneration && !currentSelectedGeneration) {
            setSelectedGeneration(savedState.selectedGeneration);
          }
          // BGM 파일은 복원할 수 없으므로 선택된 BGM 파일 이름만 표시
          if (savedState.selectedBgmFileName && !currentSelectedBgmFile) {
            // BGM 파일 이름만 저장되어 있으므로 사용자에게 알림
            toast({
              title: "BGM 파일 재선택 필요",
              description: `이전에 선택했던 "${savedState.selectedBgmFileName}" 파일을 다시 선택해주세요.`,
            });
          }
          // 프리셋이 이번 호출에서 적용되지 않은 경우에만 믹싱 설정 복원
          // (프리셋이 적용된 경우 프리셋 설정이 우선)
          if (!presetWasAppliedInThisCall && savedState.mixingSettings) {
            setMixingSettings(savedState.mixingSettings);
          }
          // 저장된 상태 제거 (한 번만 복원)
          localStorage.removeItem(savedStateKey);
        } else {
          localStorage.removeItem(savedStateKey);
        }
      } catch (error) {
        console.error("믹스보드 상태 복원 실패:", error);
        localStorage.removeItem(savedStateKey);
      }
    }
  }, [user?.id, toast, selectedGeneration, selectedBgmFile]);
  
  // 프리셋 페이지로 이동할 때 현재 상태 저장
  const handleNavigateToPresets = useCallback(() => {
    if (!user?.id) return;
    
    const stateToSave = {
      selectedGeneration,
      selectedBgmFileName: selectedBgmFile?.name || null,
      mixingSettings,
      timestamp: Date.now(),
    };
    
    localStorage.setItem(`mixboard_state_${user.id}`, JSON.stringify(stateToSave));
    navigate("/mix/presets");
  }, [user?.id, selectedGeneration, selectedBgmFile, mixingSettings, navigate]);
  
  // 프리셋 불러오기 (저장된 프리셋 목록에서 선택)
  const loadPreset = useCallback(() => {
    if (!user?.id) return;
    
    // 프리셋 페이지로 이동 (상태 저장 후)
    handleNavigateToPresets();
  }, [user?.id, handleNavigateToPresets]);

  // 고정된 프리셋 설정 복원 (프리셋이 고정되어 있고 다른 프리셋으로 변경되지 않은 경우)
  const restoreLockedPreset = useCallback((forceRestore: boolean = false) => {
    if (!user?.id) return;
    
    const lockedPresetKey = `locked_preset_${user.id}`;
    const lockedPresetStr = localStorage.getItem(lockedPresetKey);
    
    if (lockedPresetStr) {
      try {
        const lockedPreset = JSON.parse(lockedPresetStr);
        const age = Date.now() - (lockedPreset.timestamp || 0);
        // 1시간 이내의 고정 프리셋만 유효
        if (age < 60 * 60 * 1000 && lockedPreset.settings && lockedPreset.presetId) {
          // forceRestore가 true이거나, 현재 적용된 프리셋이 없거나, 고정된 프리셋과 일치하는 경우
          if (forceRestore || !appliedPresetRef.current || lockedPreset.presetId === appliedPresetRef.current) {
            // 프리셋 정보 복원
            appliedPresetRef.current = lockedPreset.presetId;
            lockedPresetRef.current = lockedPreset.presetId;
            setAppliedPresetName(lockedPreset.presetName || null);
            
            // 설정 복원 (현재 설정과 다를 때만)
            // mixingSettings를 직접 읽지 않고 함수형 업데이트 사용
            setMixingSettings((currentSettings) => {
              const currentSettingsStr = JSON.stringify(currentSettings);
              const lockedSettingsStr = JSON.stringify(lockedPreset.settings);
              if (currentSettingsStr !== lockedSettingsStr) {
                return lockedPreset.settings;
              }
              return currentSettings;
            });
          }
        }
      } catch (error) {
        console.error("고정 프리셋 복원 실패:", error);
      }
    }
  }, [user?.id]);
  
  useEffect(() => {
    if (user?.id) {
      loadGenerations();
    }
  }, [user?.id, loadGenerations]);

  // 컴포넌트 마운트 시 저장된 프리셋 복원
  useEffect(() => {
    if (user?.id) {
      // 먼저 pending preset 확인 (프리셋 페이지에서 새로 적용한 경우)
      applyPendingPreset();
      // 그 다음 locked preset 확인 (이전에 저장된 프리셋)
      restoreLockedPreset(true);
    }
  }, [user?.id, applyPendingPreset, restoreLockedPreset]);

  // 페이지 포커스 시 데이터 새로고침 및 프리셋 확인
  useEffect(() => {
    const handleFocus = () => {
      if (user?.id) {
        loadGenerations();
        // pending preset 확인
        applyPendingPreset();
        // locked preset 복원 (다른 페이지에서 돌아온 경우)
        restoreLockedPreset(true);
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [user?.id, loadGenerations, applyPendingPreset, restoreLockedPreset]);

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
    const filtered = generations.filter((gen) => gen.isFavorite);
    // 선택된 음원이 필터 결과에 없어도 항상 포함시켜서 사라지지 않도록 함
    if (selectedGeneration) {
      const selectedGen = generations.find((g) => String(g.id) === String(selectedGeneration));
      if (selectedGen) {
        // 선택된 음원이 필터 결과에 없으면 맨 앞에 추가
        const existsInFiltered = filtered.some((g) => String(g.id) === String(selectedGeneration));
        if (!existsInFiltered) {
          return [selectedGen, ...filtered];
        }
      }
    }
    return filtered;
  }, [favoriteOnly, generations, selectedGeneration]);

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

  // 미리듣기 URL 정리 헬퍼 함수 (useRef 기반)
  const revokePreviewUrl = useCallback(() => {
    if (previewAudioUrlRef.current) {
      try {
        URL.revokeObjectURL(previewAudioUrlRef.current);
      } catch {
        // ignore revoke errors
      }
      previewAudioUrlRef.current = null;
    }
    setPreviewAudioUrl(null);
  }, []);

  // 컴포넌트 언마운트 시 미리듣기 URL 정리
  useEffect(() => {
    return () => {
      if (previewAudioUrlRef.current) {
        try {
          URL.revokeObjectURL(previewAudioUrlRef.current);
        } catch {
          // ignore revoke errors
        }
        previewAudioUrlRef.current = null;
      }
    };
  }, []);

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
      
      // 적용된 프리셋이 있으면 프리셋 정보를 localStorage에 저장하여 고정
      if (appliedPresetRef.current && appliedPresetName) {
        const lockedPresetKey = `locked_preset_${user.id}`;
        localStorage.setItem(lockedPresetKey, JSON.stringify({
          presetId: appliedPresetRef.current,
          presetName: appliedPresetName,
          settings: mixingSettings,
          timestamp: Date.now(),
        }));
        lockedPresetRef.current = appliedPresetRef.current;
      }
      
      toast({
        title: "저장 완료",
        description: appliedPresetName 
          ? `믹싱 설정이 저장되었습니다. "${appliedPresetName}" 프리셋이 고정되었습니다.`
          : "믹싱 설정이 저장되었습니다.",
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
    if (!generation) {
      toast({
        title: "오류",
        description: "선택한 음원을 찾을 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    // audioUrl이 없으면 ref에서 가져오기
    const audioUrlToUse = generation.audioUrl || selectedGenAudioUrlRef.current;
    if (!audioUrlToUse) {
      toast({
        title: "오류",
        description: "선택한 음원의 오디오를 찾을 수 없습니다.",
        variant: "destructive",
      });
      return;
    }

    setIsMixing(true);
    try {
      const ctx = createAudioContext();
      
      // TTS 음원 디코딩
      let ttsBuffer: AudioBuffer | null = null;
      try {
        const audioBlob = await fetch(audioUrlToUse).then((r) => r.blob());
        ttsBuffer = await decodeFileToBuffer(ctx, audioBlob);
      } catch (err) {
        // blob URL 만료 시 DB에서 복원 후 재시도
        if (user?.id && generation.id) {
          try {
            const res = await dbService.loadGenerationBlob(user.id, String(generation.id));
            if (res?.audioBlob) {
              const mimeType = res.mimeType || (generation as any).mimeType || "audio/mpeg";
              const blob = dbService.arrayBufferToBlob(res.audioBlob, mimeType);
              const newUrl = URL.createObjectURL(blob);
              setGenerations((prev) => prev.map((g) => (g.id === generation.id ? { ...g, audioUrl: newUrl } : g)));
              ttsBuffer = await decodeFileToBuffer(ctx, blob);
            } else {
              throw new Error("음원을 불러올 수 없습니다.");
            }
          } catch (e) {
            console.error("TTS 음원 복원 실패:", e);
            throw e;
          }
        } else {
          throw err;
        }
      }
      
      if (!ttsBuffer) {
        throw new Error("TTS 버퍼를 불러올 수 없습니다.");
      }
      
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
      mixedAudioBlobRef.current = wavBlob;
      const url = URL.createObjectURL(wavBlob);
      setMixedAudioUrl(url);
      toast({
        title: "믹싱 완료",
        description: "음원 믹싱이 완료되었습니다. 저장 또는 다운로드할 수 있습니다.",
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

  // 저장 핸들러
  const handleSaveClick = useCallback(() => {
    if (!mixedAudioBlobRef.current || !selectedGeneration) {
      toast({
        title: "저장 불가",
        description: "믹싱된 음원이 없거나 TTS 음원이 선택되지 않았습니다.",
        variant: "destructive",
      });
      return;
    }

    const selectedGen = generations.find((g) => g.id === selectedGeneration);
    const defaultName = selectedGen?.savedName 
      ? `${selectedGen.savedName}_믹싱`
      : `믹싱음원_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

    setSaveDialog({
      open: true,
      fileName: defaultName,
      isSaving: false,
    });
  }, [mixedAudioBlobRef, selectedGeneration, generations, toast]);

  // 저장 확인
  const handleConfirmSave = useCallback(async () => {
    if (!user?.id || !mixedAudioBlobRef.current || !selectedGeneration) return;

    const fileName = saveDialog.fileName.trim() || `믹싱음원_${Date.now()}`;
    setSaveDialog((prev) => ({ ...prev, isSaving: true }));

    try {
      const selectedGen = generations.find((g) => g.id === selectedGeneration);
      if (!selectedGen) {
        throw new Error("선택한 TTS 음원을 찾을 수 없습니다.");
      }

      // GenerationEntry 생성
      const entry: dbService.GenerationEntry = {
        purpose: selectedGen.purpose || "mixed",
        purposeLabel: selectedGen.purposeLabel || "믹싱음원",
        voiceId: selectedGen.voiceId || "",
        voiceName: selectedGen.voiceName || "Mixed",
        savedName: fileName,
        textPreview: selectedGen.textPreview || "믹싱된 음원",
        textLength: selectedGen.textLength || 0,
        duration: null, // 나중에 계산 가능
        language: selectedGen.language || "ko",
        model: selectedGen.model || "mixed",
        style: selectedGen.style || null,
        speed: selectedGen.speed || 1.0,
        pitchShift: selectedGen.pitchShift || 0,
        mimeType: "audio/wav",
        format: "wav",
      };

      const generationId = await dbService.saveGeneration(
        user.id,
        entry,
        mixedAudioBlobRef.current
      );

      if (generationId) {
        toast({
          title: "저장 완료",
          description: `"${fileName}"이(가) 생성내역에 저장되었습니다.`,
        });
        setSaveDialog({ open: false, fileName: "", isSaving: false });
        // 생성 목록 새로고침
        await loadGenerations();
      } else {
        throw new Error("저장에 실패했습니다.");
      }
    } catch (error: any) {
      console.error("저장 실패:", error);
      toast({
        title: "저장 실패",
        description: error?.message || "음원 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setSaveDialog((prev) => ({ ...prev, isSaving: false }));
    }
  }, [user?.id, mixedAudioBlobRef, selectedGeneration, saveDialog.fileName, generations, toast, loadGenerations]);

  // 다운로드 핸들러
  const handleDownloadClick = useCallback(() => {
    if (!mixedAudioBlobRef.current) {
      toast({
        title: "다운로드 불가",
        description: "믹싱된 음원이 없습니다.",
        variant: "destructive",
      });
      return;
    }

    setDownloadDialog({
      open: true,
      format: "wav",
    });
  }, [mixedAudioBlobRef, toast]);

  // 다운로드 확인
  const handleConfirmDownload = useCallback(() => {
    if (!mixedAudioBlobRef.current) return;

    const format = downloadDialog.format;
    let blob = mixedAudioBlobRef.current;
    let mimeType = "audio/wav";
    let extension = "wav";

    // 현재는 WAV만 지원, 나중에 MP3/OGG 변환 추가 가능
    if (format === "mp3") {
      // TODO: MP3 변환 구현 (서버 API 또는 라이브러리 필요)
      toast({
        title: "준비 중",
        description: "MP3 변환 기능은 준비 중입니다. 현재는 WAV로 다운로드됩니다.",
      });
      mimeType = "audio/wav";
      extension = "wav";
    } else if (format === "ogg") {
      // TODO: OGG 변환 구현 (서버 API 또는 라이브러리 필요)
      toast({
        title: "준비 중",
        description: "OGG 변환 기능은 준비 중입니다. 현재는 WAV로 다운로드됩니다.",
      });
      mimeType = "audio/wav";
      extension = "wav";
    }

    const selectedGen = generations.find((g) => g.id === selectedGeneration);
    const fileName = selectedGen?.savedName 
      ? `${selectedGen.savedName}_믹싱.${extension}`
      : `믹싱음원_${Date.now()}.${extension}`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "다운로드 완료",
      description: `"${fileName}"이(가) 다운로드되었습니다.`,
    });

    setDownloadDialog({ open: false, format: "wav" });
  }, [mixedAudioBlobRef, downloadDialog.format, selectedGeneration, generations, toast]);

  const selectedGen = useMemo(() => {
    if (!selectedGeneration) return null;
    return generations.find((g) => String(g.id) === String(selectedGeneration));
  }, [generations, selectedGeneration]);

  // 선택된 음원의 audioUrl을 안정적으로 유지하기 위한 ref
  const selectedGenAudioUrlRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (selectedGen?.audioUrl) {
      selectedGenAudioUrlRef.current = selectedGen.audioUrl;
    } else if (!selectedGen || !selectedGeneration) {
      // 선택된 음원이 없거나 변경되면 ref 초기화
      selectedGenAudioUrlRef.current = null;
    }
  }, [selectedGen?.audioUrl, selectedGen?.id, selectedGeneration]);

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

              {selectedGen && (selectedGen.audioUrl || selectedGenAudioUrlRef.current) && (
                <div className="space-y-2">
                  <Label>TTS 음원 미리듣기</Label>
                  <AudioPlayer
                    audioUrl={selectedGen.audioUrl || selectedGenAudioUrlRef.current || ""}
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
                          if (!selectedGen || (!selectedGen.audioUrl && !selectedGenAudioUrlRef.current)) return;
                          setIsGeneratingPreview(true);
                          try {
                            // AudioContext 생성 및 TTS 음원 디코딩
                            const ctx = createAudioContext();
                            revokePreviewUrl();
                            let ttsBuffer: AudioBuffer | null = null;
                            const audioUrlToUse = selectedGen.audioUrl || selectedGenAudioUrlRef.current;
                            if (!audioUrlToUse) {
                              throw new Error("TTS 음원 URL을 찾을 수 없습니다.");
                            }
                            try {
                              const audioBlob = await fetch(audioUrlToUse).then((r) => r.blob());
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
                            // 이전 URL 정리
                            revokePreviewUrl();
                            // 새로운 URL 생성 및 저장
                            const url = URL.createObjectURL(wavBlob);
                            previewAudioUrlRef.current = url;
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
                        disabled={isGeneratingPreview || !selectedGen || (!selectedGen.audioUrl && !selectedGenAudioUrlRef.current)}
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
          {/* 프리셋 정보 및 컨트롤 */}
          {appliedPresetName && (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setShowPresetDetails(!showPresetDetails)}
                      className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                    >
                      <Settings className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-medium">적용된 프리셋: {appliedPresetName}</span>
                      {showPresetDetails ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadPreset}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        프리셋 불러오기
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          appliedPresetRef.current = null;
                          setAppliedPresetName(null);
                          lockedPresetRef.current = null;
                          if (user?.id) {
                            localStorage.removeItem(`locked_preset_${user.id}`);
                          }
                          toast({
                            title: "프리셋 해제",
                            description: "프리셋이 해제되었습니다.",
                          });
                        }}
                      >
                        프리셋 해제
                      </Button>
                    </div>
                  </div>
                  
                  {showPresetDetails && (
                    <div className="pt-4 border-t border-amber-500/20 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">BGM 오프셋 (전)</span>
                          <p className="font-medium">{mixingSettings.bgmOffset?.toFixed(1) || 0}초</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">BGM 오프셋 (후)</span>
                          <p className="font-medium">{mixingSettings.bgmOffsetAfterTts?.toFixed(1) || 0}초</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">페이드 인</span>
                          <p className="font-medium">{mixingSettings.fadeIn?.toFixed(1) || 0}초</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">페이드 아웃</span>
                          <p className="font-medium">{mixingSettings.fadeOut?.toFixed(1) || 0}초</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">TTS 볼륨</span>
                          <p className="font-medium">{Math.round((mixingSettings.ttsGain || 1) * 100)}%</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">BGM 볼륨</span>
                          <p className="font-medium">{Math.round((mixingSettings.bgmGain || 0.5) * 100)}%</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">마스터 볼륨</span>
                          <p className="font-medium">{Math.round((mixingSettings.masterGain || 1) * 100)}%</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">덕킹</span>
                          <p className="font-medium">{mixingSettings.duckingEnabled ? `ON (${mixingSettings.duckDb}dB)` : "OFF"}</p>
                        </div>
                      </div>
                      {(mixingSettings.lowShelf !== 0 || mixingSettings.midPeaking !== 0 || mixingSettings.highShelf !== 0) && (
                        <div className="pt-2 border-t border-amber-500/10">
                          <span className="text-xs text-muted-foreground">EQ 설정: </span>
                          <span className="text-xs">
                            Low {mixingSettings.lowShelf > 0 ? "+" : ""}{mixingSettings.lowShelf.toFixed(1)}dB / 
                            Mid {mixingSettings.midPeaking > 0 ? "+" : ""}{mixingSettings.midPeaking.toFixed(1)}dB / 
                            High {mixingSettings.highShelf > 0 ? "+" : ""}{mixingSettings.highShelf.toFixed(1)}dB
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>믹싱 타임라인</CardTitle>
                  <CardDescription>BGM과 TTS의 위치 및 페이드를 조정합니다.</CardDescription>
                </div>
                {!appliedPresetName && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNavigateToPresets}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    프리셋 관리
                  </Button>
                )}
              </div>
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
            <Button
              variant="outline"
              onClick={handleNavigateToPresets}
            >
              <Settings className="w-4 h-4 mr-2" />
              프리셋
            </Button>
            {mixedAudioUrl && (
              <>
                <Button
                  variant="outline"
                  onClick={handleSaveClick}
                >
                  <Save className="w-4 h-4 mr-2" />
                  저장
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadClick}
                >
                  <Download className="w-4 h-4 mr-2" />
                  다운로드
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 저장 다이얼로그 */}
      <Dialog open={saveDialog.open} onOpenChange={(open) => {
        if (!saveDialog.isSaving) {
          setSaveDialog({ ...saveDialog, open });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>믹싱 음원 저장</DialogTitle>
            <DialogDescription>
              생성된 믹싱 음원을 생성내역에 저장합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="saveFileName">저장 이름</Label>
              <Input
                id="saveFileName"
                value={saveDialog.fileName}
                onChange={(e) => setSaveDialog({ ...saveDialog, fileName: e.target.value })}
                placeholder="믹싱음원 이름을 입력하세요"
                disabled={saveDialog.isSaving}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaveDialog({ ...saveDialog, open: false })}
              disabled={saveDialog.isSaving}
            >
              취소
            </Button>
            <Button
              onClick={handleConfirmSave}
              disabled={saveDialog.isSaving || !saveDialog.fileName.trim()}
            >
              {saveDialog.isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  저장
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 다운로드 다이얼로그 */}
      <Dialog open={downloadDialog.open} onOpenChange={(open) => {
        setDownloadDialog({ ...downloadDialog, open });
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>믹싱 음원 다운로드</DialogTitle>
            <DialogDescription>
              다운로드할 파일 포맷을 선택하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="downloadFormat">파일 포맷</Label>
              <Select
                value={downloadDialog.format}
                onValueChange={(value: "wav" | "mp3" | "ogg") => {
                  setDownloadDialog({ ...downloadDialog, format: value });
                }}
              >
                <SelectTrigger id="downloadFormat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wav">WAV (무손실, 권장)</SelectItem>
                  <SelectItem value="mp3">MP3 (준비 중)</SelectItem>
                  <SelectItem value="ogg">OGG (준비 중)</SelectItem>
                </SelectContent>
              </Select>
              {downloadDialog.format !== "wav" && (
                <p className="text-sm text-muted-foreground">
                  {downloadDialog.format.toUpperCase()} 변환 기능은 준비 중입니다. 현재는 WAV로 다운로드됩니다.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDownloadDialog({ ...downloadDialog, open: false })}
            >
              취소
            </Button>
            <Button onClick={handleConfirmDownload}>
              <Download className="w-4 h-4 mr-2" />
              다운로드
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </PageContainer>
  );
}

