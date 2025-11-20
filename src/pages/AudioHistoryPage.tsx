import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, Trash2, Play, Filter, Music2, Calendar, FileSearch, AlertCircle, Loader2, Star, Waves } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import * as dbService from "@/services/dbService";
import AudioPlayer from "@/components/AudioPlayer";
import { formatDateTime, purposeOptions } from "@/lib/pageUtils";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// 믹싱 음원인지 확인
const isMixedAudio = (gen: dbService.GenerationEntry): boolean => {
  return (
    gen.purpose === "mixed" ||
    gen.purposeLabel === "믹싱음원" ||
    gen.model === "mixed" ||
    (gen.savedName && gen.savedName.includes("믹싱"))
  );
};

// 카테고리별 색상 매핑
const getPurposeColor = (purposeId: string): string => {
  const colorMap: Record<string, string> = {
    announcement: "bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30",
    emergency: "bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30",
    greeting: "bg-purple-500/10 text-purple-600 border-purple-500/20 hover:bg-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/30",
    policy: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 hover:bg-indigo-500/20 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/30",
    event: "bg-pink-500/10 text-pink-600 border-pink-500/20 hover:bg-pink-500/20 dark:bg-pink-500/20 dark:text-pink-400 dark:border-pink-500/30",
    promotion: "bg-orange-500/10 text-orange-600 border-orange-500/20 hover:bg-orange-500/20 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/30",
    service: "bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20 dark:bg-green-500/20 dark:text-green-400 dark:border-green-500/30",
    welfare: "bg-teal-500/10 text-teal-600 border-teal-500/20 hover:bg-teal-500/20 dark:bg-teal-500/20 dark:text-teal-400 dark:border-teal-500/30",
    traffic: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/20 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30",
    environment: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30",
    culture: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20 hover:bg-cyan-500/20 dark:bg-cyan-500/20 dark:text-cyan-400 dark:border-cyan-500/30",
    facility: "bg-sky-500/10 text-sky-600 border-sky-500/20 hover:bg-sky-500/20 dark:bg-sky-500/20 dark:text-sky-400 dark:border-sky-500/30",
    civil: "bg-slate-500/10 text-slate-600 border-slate-500/20 hover:bg-slate-500/20 dark:bg-slate-500/20 dark:text-slate-400 dark:border-slate-500/30",
    disaster: "bg-rose-500/10 text-rose-600 border-rose-500/20 hover:bg-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30",
    celebration: "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30",
    health: "bg-lime-500/10 text-lime-600 border-lime-500/20 hover:bg-lime-500/20 dark:bg-lime-500/20 dark:text-lime-400 dark:border-lime-500/30",
    education: "bg-violet-500/10 text-violet-600 border-violet-500/20 hover:bg-violet-500/20 dark:bg-violet-500/20 dark:text-violet-400 dark:border-violet-500/30",
    mixed: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20 hover:bg-fuchsia-500/20 dark:bg-fuchsia-500/20 dark:text-fuchsia-400 dark:border-fuchsia-500/30",
  };
  return colorMap[purposeId] || "bg-gray-500/10 text-gray-600 border-gray-500/20 hover:bg-gray-500/20 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/30";
};

const guessExtensionFromMime = (mime?: string | null) => {
  if (!mime) return null;
  const normalized = mime.toLowerCase();
  if (normalized.includes("mpeg")) return "mp3";
  if (normalized.includes("wav") || normalized.includes("wave")) return "wav";
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("flac")) return "flac";
  if (normalized.includes("aac")) return "aac";
  if (normalized.includes("m4a")) return "m4a";
  if (normalized.includes("opus")) return "opus";
  const parts = normalized.split("/");
  if (parts.length === 2) {
    return parts[1].split(";")[0];
  }
  return null;
};

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / 1024).toFixed(2)} KB`;
};

export default function AudioHistoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [generations, setGenerations] = useState<dbService.GenerationEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPurpose, setFilterPurpose] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedGeneration, setSelectedGeneration] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const previewUrlsRef = useRef<Record<string, string>>({});
  const [loadingPreviewIds, setLoadingPreviewIds] = useState<Set<string>>(new Set());
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [favoriteLoadingIds, setFavoriteLoadingIds] = useState<Set<string>>(new Set());

  const preloadHistoryRef = useRef<Set<string>>(new Set());

  const markPreviewLoading = useCallback((id: string, isLoading: boolean) => {
    setLoadingPreviewIds((prev) => {
      const next = new Set(prev);
      if (isLoading) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

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

  useEffect(() => {
    previewUrlsRef.current = previewUrls;
  }, [previewUrls]);

  useEffect(() => {
    return () => {
      Object.values(previewUrlsRef.current).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore revoke errors
        }
      });
    };
  }, []);

  useEffect(() => {
    const validIds = new Set(generations.map((g) => String(g.id)));
    setPreviewUrls((prev) => {
      const next: Record<string, string> = {};
      Object.entries(prev).forEach(([id, url]) => {
        if (validIds.has(id)) {
          next[id] = url;
        } else {
          try {
            URL.revokeObjectURL(url);
          } catch {
            // ignore revoke errors
          }
        }
      });
      return next;
    });
  }, [generations]);

  const [localSaveDialog, setLocalSaveDialog] = useState<{
    open: boolean;
    entry: dbService.GenerationEntry | null;
    isPreparing: boolean;
    fileName: string;
    downloadUrl: string | null;
    sizeLabel: string;
    error: string | null;
    mimeType: string | null;
    fileSize: number | null;
  }>({
    open: false,
    entry: null,
    isPreparing: false,
    fileName: "",
    downloadUrl: null,
    sizeLabel: "",
    error: null,
    mimeType: null,
    fileSize: null,
  });
  const localSaveUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (localSaveUrlRef.current) {
        try {
          URL.revokeObjectURL(localSaveUrlRef.current);
        } catch {
          // ignore revoke errors
        }
      }
    };
  }, []);

  useEffect(() => {
    if (localSaveUrlRef.current && localSaveUrlRef.current !== localSaveDialog.downloadUrl) {
      try {
        URL.revokeObjectURL(localSaveUrlRef.current);
      } catch {
        // ignore revoke errors
      }
    }
    localSaveUrlRef.current = localSaveDialog.downloadUrl;
  }, [localSaveDialog.downloadUrl]);

  const resolveFormat = (entry: dbService.GenerationEntry) => {
    if (entry.format) return entry.format;
    const mime = entry.mimeType?.toLowerCase() || "";
    if (mime.includes("wav") || mime.includes("wave")) return "wav";
    if (mime.includes("ogg")) return "ogg";
    if (mime.includes("flac")) return "flac";
    if (mime.includes("aac")) return "aac";
    if (mime.includes("m4a")) return "m4a";
    return "mp3";
  };

  const loadGenerations = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await dbService.loadGenerations(user.id, 100);
      setGenerations(data);
    } catch (error) {
      console.error("생성 내역 로드 실패:", error);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      loadGenerations();
    }
  }, [user?.id, loadGenerations]);

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
  }, [user?.id, loadGenerations]);

  const filteredGenerations = generations.filter((gen) => {
    const matchesSearch =
      gen.textPreview?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gen.savedName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gen.voiceName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPurpose = filterPurpose === "all" || gen.purpose === filterPurpose;
    const matchesStatus = filterStatus === "all" || gen.status === filterStatus;
    const matchesFavorite = !favoriteOnly || gen.isFavorite;
    return matchesSearch && matchesPurpose && matchesStatus && matchesFavorite;
  });

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredGenerations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedGenerations = filteredGenerations.slice(startIndex, endIndex);

  // 검색어 또는 필터 변경 시 첫 페이지로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterPurpose, filterStatus, favoriteOnly]);

  const handleDelete = async (id: string) => {
    setDeleteDialog({ open: true, id });
  };

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
        console.error("생성 이력 즐겨찾기 업데이트 실패:", error);
        const message = error instanceof Error ? error.message : "Supabase 테이블에 'is_favorite' 컬럼이 있는지 확인해주세요.";
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
    [favoriteLoadingIds, setFavoriteLoading, setGenerations, toast, user?.id]
  );


  const confirmDelete = async () => {
    if (!user?.id || !deleteDialog.id) return;
    try {
      await dbService.deleteGeneration(user.id, deleteDialog.id);
      await loadGenerations();
      setDeleteDialog({ open: false, id: null });
      toast({
        title: "삭제 완료",
        description: "음원이 삭제되었습니다.",
      });
    } catch (error) {
      console.error("삭제 실패:", error);
      toast({
        title: "삭제 실패",
        description: "음원 삭제에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const purposes = Array.from(new Set(generations.map((g) => g.purpose)));

  const ensureGenerationAudio = useCallback(
    async (gen: dbService.GenerationEntry, options: { forceReload?: boolean } = {}) => {
      if (!gen?.id) return null;
      const idStr = String(gen.id);
      const forceReload = options.forceReload ?? false;

      if (!forceReload) {
        const existing = previewUrlsRef.current[idStr];
        if (existing) {
          return existing;
        }
      }

      if (!forceReload && gen.audioUrl && (gen.audioUrl.startsWith("data:") || gen.audioUrl.startsWith("blob:"))) {
        setPreviewUrls((prev) => ({ ...prev, [idStr]: gen.audioUrl! }));
        return gen.audioUrl;
      }

      let blob: Blob | null = null;
      let mimeType = gen.mimeType || "audio/mpeg";

      if (user?.id) {
        try {
          const result = await dbService.loadGenerationBlob(user.id, idStr);
          if (result?.audioBlob) {
            mimeType = result.mimeType || mimeType;
            blob = dbService.arrayBufferToBlob(result.audioBlob, mimeType);
          }
        } catch (error) {
          console.error("생성내역 음원 로드 실패:", error);
        }
      }

      if (!blob && gen.audioUrl && !gen.audioUrl.startsWith("data:")) {
        try {
          const response = await fetch(gen.audioUrl);
          if (response.ok) {
            blob = await response.blob();
            mimeType = blob.type || mimeType;
          }
        } catch (error) {
          console.warn("음원 fetch 실패:", error);
        }
      }

      if (!blob) {
        return null;
      }

      const newUrl = URL.createObjectURL(blob);
      setPreviewUrls((prev) => {
        const prevUrl = prev[idStr];
        if (prevUrl && prevUrl !== newUrl && prevUrl.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(prevUrl);
          } catch {
            // ignore
          }
        }
        return { ...prev, [idStr]: newUrl };
      });

      return newUrl;
    },
    [user?.id]
  );

  const closeLocalSaveDialog = useCallback(() => {
    setLocalSaveDialog((prev) => {
      if (prev.downloadUrl) {
        try {
          URL.revokeObjectURL(prev.downloadUrl);
        } catch {
          // ignore revoke errors
        }
      }
      return {
        open: false,
        entry: null,
        isPreparing: false,
        fileName: "",
        downloadUrl: null,
        sizeLabel: "",
        error: null,
        mimeType: null,
        fileSize: null,
      };
    });
    localSaveUrlRef.current = null;
  }, []);

  const handleLocalSaveClick = useCallback(async (entry: dbService.GenerationEntry) => {
    if (!entry) return;

    setLocalSaveDialog((prev) => {
      if (prev.downloadUrl && prev.downloadUrl !== localSaveUrlRef.current) {
        try {
          URL.revokeObjectURL(prev.downloadUrl);
        } catch {
          // ignore revoke errors
        }
      }
      return {
        open: true,
        entry,
        isPreparing: true,
        fileName: "",
        downloadUrl: null,
        sizeLabel: "",
        error: null,
        mimeType: entry.mimeType || null,
        fileSize: null,
      };
    });

    try {
      const ensuredUrl = await ensureGenerationAudio(entry);

      if (!ensuredUrl) {
        throw new Error("음원 데이터를 찾을 수 없습니다.");
      }

      const response = await fetch(ensuredUrl);
      if (!response.ok) {
        throw new Error("음원 데이터를 가져올 수 없습니다.");
      }

      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error("음원 데이터가 비어 있습니다.");
      }

      const sanitizedName = (entry.savedName?.trim() || formatDateTime(entry.createdAt || new Date().toISOString()))
        .replace(/[\\/:*?"<>|]+/g, "_");
      const extension =
        entry.format ||
        guessExtensionFromMime(blob.type || entry.mimeType) ||
        resolveFormat({ ...entry, mimeType: blob.type || entry.mimeType });
      const fileName = `${sanitizedName}.${extension}`;
      const sizeLabel = formatFileSize(blob.size);
      const downloadUrl = URL.createObjectURL(blob);

      localSaveUrlRef.current = downloadUrl;

      setLocalSaveDialog((prev) => ({
        ...prev,
        isPreparing: false,
        downloadUrl,
        fileName,
        sizeLabel,
        error: null,
        mimeType: blob.type || entry.mimeType || "audio/mpeg",
        fileSize: blob.size,
      }));

      setGenerations((prev) =>
        prev.map((g) =>
          g.id === entry.id
            ? {
                ...g,
                audioUrl: ensuredUrl,
                mimeType: blob.type || entry.mimeType || g.mimeType,
                hasAudio: true,
              }
            : g
        )
      );
    } catch (error) {
      console.error("로컬 저장 준비 실패:", error);
      const message = error instanceof Error ? error.message : "음원을 준비하는 중 문제가 발생했습니다.";
      setLocalSaveDialog((prev) => ({
        ...prev,
        isPreparing: false,
        error: message,
      }));
      toast({
        title: "로컬 저장 실패",
        description: message,
        variant: "destructive",
      });
    }
  }, [ensureGenerationAudio, toast]);

  const handleConfirmLocalSave = useCallback(() => {
    if (!localSaveDialog.downloadUrl || !localSaveDialog.fileName) {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = localSaveDialog.downloadUrl;
    anchor.download = localSaveDialog.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    toast({
      title: "로컬 저장 완료",
      description: `"${localSaveDialog.fileName}" 파일이 저장되었습니다.`,
    });

    closeLocalSaveDialog();
  }, [closeLocalSaveDialog, localSaveDialog.downloadUrl, localSaveDialog.fileName, toast]);


  const handlePreviewRequest = useCallback(async (gen: dbService.GenerationEntry) => {
    if (!gen?.id) return;
    const idStr = String(gen.id);

    if (loadingPreviewIds.has(idStr)) return;

    if (selectedGeneration === gen.id) {
      setSelectedGeneration(null);
      return;
    }

    markPreviewLoading(idStr, true);
    try {
      const ensured = await ensureGenerationAudio(gen);
      if (!ensured) {
        toast({
          title: "음원을 불러올 수 없습니다",
          description: "저장된 음원 데이터가 없습니다.",
          variant: "destructive",
        });
        return;
      }
      setSelectedGeneration(gen.id);
    } catch (error) {
      console.error("미리듣기 준비 실패:", error);
      toast({
        title: "미리듣기 준비 실패",
        description: "음원을 복원하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      markPreviewLoading(idStr, false);
    }
  }, [ensureGenerationAudio, loadingPreviewIds, markPreviewLoading, selectedGeneration, toast]);

  useEffect(() => {
    if (!user?.id || generations.length === 0) return;

    let cancelled = false;
    const PRELOAD_LIMIT = 3;

    const candidates = generations
      .filter((gen) => {
        const idStr = String(gen.id);
        if (preloadHistoryRef.current.has(idStr)) return false;
        if (previewUrls[idStr]) return false;
        return true;
      })
      .slice(0, PRELOAD_LIMIT);

    if (candidates.length === 0) return;

    (async () => {
      for (const gen of candidates) {
        if (cancelled) break;
        const idStr = String(gen.id);
        preloadHistoryRef.current.add(idStr);
        markPreviewLoading(idStr, true);
        try {
          await ensureGenerationAudio(gen);
        } catch (error) {
          console.warn("미리 로드 실패:", error);
        } finally {
          markPreviewLoading(idStr, false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, generations, previewUrls, ensureGenerationAudio, markPreviewLoading]);


  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        title="생성 내역"
        description="생성된 음원 목록을 확인하고 관리합니다"
        icon={FileSearch}
      />

      <div className="space-y-6">
        {/* 필터 및 검색 */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="음원 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filterPurpose} onValueChange={setFilterPurpose}>
              <SelectTrigger className="w-[150px] sm:w-[180px]">
                <Filter className="w-4 h-4 mr-2 hidden sm:inline" />
                <SelectValue placeholder="용도">
                  {filterPurpose === "all" 
                    ? "전체 용도" 
                    : purposeOptions.find((p) => p.id === filterPurpose)?.label || filterPurpose}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 용도</SelectItem>
                {purposes.map((purpose) => {
                  const purposeOption = purposeOptions.find((p) => p.id === purpose);
                  return (
                    <SelectItem key={purpose} value={purpose}>
                      {purposeOption?.label || purpose}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px] sm:w-[180px]">
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                <SelectItem value="ready">완료</SelectItem>
                <SelectItem value="processing">처리 중</SelectItem>
                <SelectItem value="failed">실패</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={String(itemsPerPage)}
              onValueChange={(v) => {
                setItemsPerPage(Number(v));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5개씩</SelectItem>
                <SelectItem value="10">10개씩</SelectItem>
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={favoriteOnly ? "default" : "outline"}
                  size="icon"
                  aria-label={favoriteOnly ? "즐겨찾기만 보기 해제" : "즐겨찾기만 보기"}
                  aria-pressed={favoriteOnly}
                  onClick={() => setFavoriteOnly((prev) => !prev)}
                  className={favoriteOnly ? "border-amber-500 text-amber-500 hover:bg-amber-500/10" : ""}
                >
                  <Star className={`w-4 h-4 ${favoriteOnly ? "fill-current" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>즐겨찾기만 보기</TooltipContent>
            </Tooltip>

          </div>
        </div>

      {/* 생성 내역 목록 */}
        {filteredGenerations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Play className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">생성된 음원이 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="space-y-2 p-4" role="list" aria-label="생성 내역 목록">
                {paginatedGenerations.map((gen) => (
                <div
                  key={gen.id}
                  role="listitem"
                  tabIndex={0}
                  className="rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    {/* 왼쪽 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1 text-sm text-muted-foreground">
                        {/* 카테고리 배지 */}
                        <Badge variant="outline" className={cn("font-medium", getPurposeColor(gen.purpose))}>
                          {purposeOptions.find((p) => p.id === gen.purpose)?.label || gen.purpose}
                        </Badge>
                        {/* 믹싱음원 배지 (믹싱 음원인 경우에만 표시) */}
                        {isMixedAudio(gen) && (
                          <Badge variant="outline" className={cn("font-medium flex items-center gap-1", getPurposeColor("mixed"))}>
                            <Waves className="w-3 h-3" />
                            믹싱음원
                          </Badge>
                        )}
                        {!isMixedAudio(gen) && <span>{gen.voiceName}</span>}
                        {gen.duration && (
                          <span className="text-xs">
                            {Math.floor(gen.duration / 60)}:
                            {Math.floor(gen.duration % 60)
                              .toString()
                              .padStart(2, "0")}
                          </span>
                        )}
                        <span className="text-xs">
                          {formatDateTime(gen.createdAt || new Date().toISOString())}
                        </span>
                      </div>
                      <p className="font-medium truncate flex items-center gap-2">
                        <span className="truncate">
                          {gen.savedName || formatDateTime(gen.createdAt || new Date().toISOString())}
                        </span>
                        {gen.isFavorite && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-500">
                            <Star className="w-3 h-3 fill-current" />
                            즐겨찾기
                          </span>
                        )}
                      </p>
                      {gen.textPreview && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-2 mt-1">
                          {gen.textPreview}
                        </p>
                      )}
                    </div>

                    {/* 오른쪽 액션 */}
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={gen.isFavorite ? "즐겨찾기 해제" : "즐겨찾기에 추가"}
                            onClick={() => toggleFavorite(gen)}
                            disabled={favoriteLoadingIds.has(String(gen.id))}
                            className={gen.isFavorite ? "text-amber-500 hover:text-amber-500" : ""}
                          >
                            {favoriteLoadingIds.has(String(gen.id)) ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Star className={`w-4 h-4 ${gen.isFavorite ? "fill-current" : ""}`} />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{gen.isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={selectedGeneration === gen.id ? "secondary" : "ghost"}
                            size="icon"
                            aria-label={selectedGeneration === gen.id ? "미리듣기 닫기" : "미리듣기"}
                            onClick={() => handlePreviewRequest(gen)}
                            disabled={loadingPreviewIds.has(String(gen.id))}
                          >
                            {loadingPreviewIds.has(String(gen.id)) ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {loadingPreviewIds.has(String(gen.id)) ? "복원 중..." : "미리듣기"}
                        </TooltipContent>
                      </Tooltip>

                      {!isMixedAudio(gen) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="믹싱으로 이동"
                              onClick={() => {
                                navigate(`/mix/board?generation=${gen.id}`);
                                toast({
                                  title: "믹싱 페이지로 이동",
                                  description: "선택한 음원을 믹싱할 수 있습니다.",
                                });
                              }}
                            >
                              <Music2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>믹싱</TooltipContent>
                        </Tooltip>
                      )}

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="스케줄 관리로 이동"
                            onClick={() => {
                              navigate(`/send/schedule?generation=${gen.id}`);
                              toast({
                                title: "스케줄 관리로 이동",
                                description: "선택한 음원을 예약할 수 있습니다.",
                              });
                            }}
                          >
                            <Calendar className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>예약</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="로컬로 다운로드"
                            onClick={() => handleLocalSaveClick(gen)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>로컬 저장</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="삭제"
                            onClick={() => gen.id && handleDelete(gen.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>삭제</TooltipContent>
                      </Tooltip>
                    </div>
                </div>

                  {selectedGeneration === gen.id && (
                    <div className="pt-3">
                      {(() => {
                        const genIdStr = String(gen.id);
                        const previewUrl = previewUrls[genIdStr] ?? gen.audioUrl ?? "";
                        const cacheKey = gen.cacheKey || genIdStr;
                        return (
                  <AudioPlayer
                            audioUrl={previewUrl}
                    title={gen.savedName || "생성된 음원"}
                    duration={gen.duration || 0}
                    mimeType={gen.mimeType || "audio/mpeg"}
                            cacheKey={cacheKey}
                    onError={async () => {
                              const newUrl = await ensureGenerationAudio(gen, { forceReload: true });
                              if (!newUrl) {
                                toast({
                                  title: "음원 복원 실패",
                                  description: "음원 데이터를 불러올 수 없습니다. 다시 생성해주세요.",
                                  variant: "destructive",
                                });
                      }
                    }}
                  />
                        );
                      })()}
                    </div>
                  )}
                </div>
              ))}
              </div>
                </CardContent>
          </Card>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      이전
                    </Button>
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <PaginationItem key={page}>
                      <Button
                        variant={currentPage === page ? "outline" : "ghost"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="min-w-[2.5rem]"
                      >
                        {page}
                      </Button>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      다음
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, id: null })}>
        <AlertDialogContent className="sm:max-w-[500px]">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <AlertDialogTitle className="text-xl">음원 삭제 확인</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base pt-2">
              {(() => {
                const entry = deleteDialog.id ? generations.find((g) => g.id === deleteDialog.id) : null;
                if (entry) {
                  return (
                    <div className="space-y-3">
                      <p className="text-muted-foreground">
                        정말 이 음원을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                      </p>
                      <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-sm font-medium text-muted-foreground min-w-[60px]">이름:</span>
                          <span className="text-sm font-semibold flex-1">{entry.savedName || "이름 없음"}</span>
                        </div>
                        {entry.purpose && (
                          <div className="flex items-start gap-2">
                            <span className="text-sm font-medium text-muted-foreground min-w-[60px]">목적:</span>
                            {isMixedAudio(entry) ? (
                              <Badge variant="outline" className={cn("text-xs flex items-center gap-1", getPurposeColor("mixed"))}>
                                <Waves className="w-3 h-3" />
                                믹싱음원
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                {purposeOptions.find(p => p.id === entry.purpose)?.label || entry.purpose}
                              </Badge>
                            )}
                          </div>
                        )}
                        {entry.textPreview && (
                          <div className="flex items-start gap-2">
                            <span className="text-sm font-medium text-muted-foreground min-w-[60px]">내용:</span>
                            <span className="text-sm flex-1 line-clamp-2">{entry.textPreview}</span>
                          </div>
                        )}
                        {entry.voiceName && (
                          <div className="flex items-start gap-2">
                            <span className="text-sm font-medium text-muted-foreground min-w-[60px]">음성:</span>
                            <span className="text-sm flex-1">{entry.voiceName}</span>
                          </div>
                        )}
                        {entry.duration && (
                          <div className="flex items-start gap-2">
                            <span className="text-sm font-medium text-muted-foreground min-w-[60px]">길이:</span>
                            <span className="text-sm flex-1">{entry.duration.toFixed(1)}초</span>
                          </div>
                        )}
                        {entry.createdAt && (
                          <div className="flex items-start gap-2">
                            <span className="text-sm font-medium text-muted-foreground min-w-[60px]">생성일:</span>
                            <span className="text-sm flex-1">{formatDateTime(entry.createdAt)}</span>
                          </div>
        )}
      </div>
      </div>
                  );
                }
                return (
                  <p className="text-muted-foreground">
                    정말 이 음원을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                  </p>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="mt-2 sm:mt-0">
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              삭제하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={localSaveDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            closeLocalSaveDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>로컬 저장</DialogTitle>
            <DialogDescription>선택한 음원을 다운로드하기 전에 정보를 확인하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {localSaveDialog.isPreparing ? (
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <p className="font-medium">음원을 준비하고 있습니다</p>
                  <p className="text-sm text-muted-foreground">잠시만 기다려 주세요. 파일을 복원하고 있습니다.</p>
                </div>
              </div>
            ) : localSaveDialog.error ? (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">음원을 준비할 수 없습니다</p>
                  <p className="text-sm text-destructive/90">{localSaveDialog.error}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm text-muted-foreground">파일명</span>
                  <span className="text-sm font-medium break-all text-right">
                    {localSaveDialog.fileName || "이름을 계산 중입니다"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">파일 크기</span>
                  <span className="font-medium">{localSaveDialog.sizeLabel || "-"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">형식</span>
                  <span className="font-medium">
                    {guessExtensionFromMime(localSaveDialog.mimeType) || (localSaveDialog.entry ? resolveFormat(localSaveDialog.entry) : "mp3")}
                  </span>
                </div>
                {localSaveDialog.entry?.createdAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">생성일</span>
                    <span className="font-medium">
                      {formatDateTime(localSaveDialog.entry.createdAt)}
                    </span>
                  </div>
                )}
                {localSaveDialog.entry && (
                  <>
                    {isMixedAudio(localSaveDialog.entry) ? (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">유형</span>
                        <Badge variant="outline" className={cn("text-xs flex items-center gap-1", getPurposeColor("mixed"))}>
                          <Waves className="w-3 h-3" />
                          믹싱음원
                        </Badge>
                      </div>
                    ) : localSaveDialog.entry.voiceName ? (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">음성</span>
                        <span className="font-medium">{localSaveDialog.entry.voiceName}</span>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            )}

            {localSaveDialog.entry?.textPreview && (
              <div className="rounded-lg border border-border bg-background p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">문구 내용</p>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed line-clamp-4">
                  {localSaveDialog.entry.textPreview}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button variant="outline" onClick={closeLocalSaveDialog} className="sm:min-w-[120px]">
              닫기
            </Button>
            <Button
              onClick={handleConfirmLocalSave}
              className="sm:min-w-[140px]"
              disabled={
                localSaveDialog.isPreparing ||
                !!localSaveDialog.error ||
                !localSaveDialog.downloadUrl ||
                !localSaveDialog.fileName
              }
            >
              {localSaveDialog.isPreparing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              로컬에 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>


  );
}
