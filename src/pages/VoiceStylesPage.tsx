import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import AudioPlayer from "@/components/AudioPlayer";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { 
  Mic2, 
  Play, 
  Pause, 
  Search,
  Star,
  Volume2,
  Filter,
  Download,
  RefreshCw
} from "lucide-react";
import * as dbService from "@/services/dbService";

// 언어 코드 → 국기 이모지
const languageCodeToFlag = (code: string): string => {
  const map: Record<string, string> = {
    ko: "🇰🇷", en: "🇺🇸", ja: "🇯🇵", zh: "🇨🇳", es: "🇪🇸", fr: "🇫🇷", de: "🇩🇪", pt: "🇵🇹", ru: "🇷🇺"
  };
  return map[code?.toLowerCase()] || "";
};

// 언어 코드 → 한국어 이름
const languageCodeToKo = (code: string): string => {
  const map: Record<string, string> = { ko: "한국어", en: "영어", ja: "일본어", zh: "중국어", es: "스페인어", fr: "프랑스어", de: "독일어", pt: "포르투갈어", ru: "러시아어" };
  return map[code?.toLowerCase()] || code || "";
};

// 성별 코드 → 한국어
const genderCodeToKo = (code: string): string => {
  const map: Record<string, string> = { female: "여성", male: "남성", neutral: "중성", child_male: "남아", child_female: "여아" };
  return map[code?.toLowerCase()] || code || "";
};

// 스타일 코드 → 한국어 (간단 버전)
const formatStylesKo = (styles: any): string => {
  if (!styles) return "-";
  if (typeof styles === "string") return styles;
  if (Array.isArray(styles)) {
    return styles.slice(0, 3).join(", ") + (styles.length > 3 ? "..." : "");
  }
  return "-";
};

// 언어 정규화
const normalizeLanguage = (lang: string): string => {
  if (!lang) return "";
  const normalized = lang.toLowerCase().trim();
  if (normalized.startsWith("ko") || normalized === "kr") return "ko";
  if (normalized.startsWith("en")) return "en";
  if (normalized.startsWith("ja") || normalized === "jp") return "ja";
  return normalized.split("-")[0];
};

// 언어 우선순위 계산
const computeVoiceLanguageRank = (voice: any): number => {
  const langs = Array.isArray(voice.language) ? voice.language : (voice.language ? [voice.language] : []);
  if (!langs || langs.length === 0) return 999;
  const normalized = normalizeLanguage(langs[0]);
  if (normalized === "ko") return 0;
  if (normalized === "en") return 1;
  if (normalized === "ja") return 2;
  return 3;
};

const VoiceStylesPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // 상태 관리
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [allVoices, setAllVoices] = useState<any[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [voiceLoadingProgress, setVoiceLoadingProgress] = useState(0);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [selectedVoiceInfo, setSelectedVoiceInfo] = useState<any | null>(null);
  const [playingSample, setPlayingSample] = useState<string | null>(null);
  const [favoriteVoiceIds, setFavoriteVoiceIds] = useState<Set<string>>(new Set());
  
  // 검색 및 필터링
  const [isVoiceFinderOpen, setIsVoiceFinderOpen] = useState(false);
  const [voiceFilters, setVoiceFilters] = useState({
    language: "",
    style: "",
    name: "",
    gender: "",
    useCase: ""
  });
  const [voiceSearchResults, setVoiceSearchResults] = useState<any[]>([]);
  const [voiceTotalCount, setVoiceTotalCount] = useState<number | null>(null);
  const [isSearchingVoices, setIsSearchingVoices] = useState(false);
  
  // 정렬
  const [voiceSortBy, setVoiceSortBy] = useState<"name" | "language" | "gender" | "none">("none");
  const [voiceSortOrder, setVoiceSortOrder] = useState<"asc" | "desc">("asc");
  const [searchResultSortBy, setSearchResultSortBy] = useState<"name" | "language" | "gender" | "none">("none");
  const [searchResultSortOrder, setSearchResultSortOrder] = useState<"asc" | "desc">("asc");

  const SUPABASE_PROXY_BASE_URL = "https://gxxralruivyhdxyftsrg.supabase.co/functions/v1/supertone-proxy";

  // 즐겨찾기 로드
  useEffect(() => {
    if (!user?.id) {
      console.warn("사용자 정보가 없어 즐겨찾기를 로드할 수 없습니다.");
      return;
    }

    const loadFavorites = async () => {
      try {
        const favorites = await dbService.loadFavorites(user.id);
        if (favorites && Array.isArray(favorites)) {
          const ids = new Set(favorites);
          setFavoriteVoiceIds(ids);
        }
      } catch (error) {
        console.warn("즐겨찾기 로드 실패:", error);
      }
    };
    loadFavorites();
  }, [user?.id]);

  // 음성 목록 로드
  const fetchVoices = useCallback(async (forceReload: boolean = false, showToast: boolean = false) => {
    if (isLoadingVoices && !forceReload) return;

    setIsLoadingVoices(true);
    setVoiceLoadingProgress(0);

    try {
      // 먼저 DB에서 로드 시도
      const catalogCount = await dbService.getVoiceCatalogCount();
      if (catalogCount > 0 && !forceReload) {
        if (showToast) {
          toast({
            title: "음성 목록 로드 중...",
            description: "DB에서 음성 목록을 불러오는 중입니다.",
          });
        }
        
        const { data, error } = await supabase
          .from("tts_voice_catalog")
          .select("*")
          .order("name");

        if (!error && data && data.length > 0) {
          const voices = data.map((row: any) => ({
            voice_id: row.voice_id,
            name: row.name,
            language: row.language || [],
            styles: row.styles || [],
            gender: row.gender || "",
            samples: row.samples || [],
            use_case: row.use_case || row.useCase || "",
          }));
          
          setAvailableVoices(voices);
          setAllVoices(voices);
          setVoiceLoadingProgress(100);
          setIsLoadingVoices(false);
          
          if (showToast) {
            toast({
              title: "음성 목록 로드 완료",
              description: `DB에서 ${voices.length}개의 음성을 불러왔습니다.`,
            });
          }
          return;
        }
      }

      // DB에 없거나 강제 재로드인 경우 API에서 가져오기
      if (showToast) {
        toast({
          title: "모든 음성 가져오는 중...",
          description: "API에서 음성 목록을 가져오는 중입니다.",
        });
      }

      let allVoicesData: any[] = [];
      let nextToken: string | null = null;
      let hasMore = true;
      let totalFetched = 0;

      while (hasMore) {
        const url = nextToken 
          ? `${SUPABASE_PROXY_BASE_URL}/voices?limit=100&next_token=${nextToken}`
          : `${SUPABASE_PROXY_BASE_URL}/voices?limit=100`;

        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`API 요청 실패: ${response.status}`);
        }

        const data = await response.json();
        const voices = data.voices || data.data || [];
        allVoicesData = [...allVoicesData, ...voices];
        
        nextToken = data.next_token || null;
        hasMore = !!nextToken && voices.length > 0;
        
        totalFetched += voices.length;
        setVoiceLoadingProgress(Math.min(95, Math.floor((totalFetched / (data.total_count || totalFetched)) * 100)));
      }

      // DB에 저장
      await dbService.syncVoiceCatalog(allVoicesData, true);

      setAvailableVoices(allVoicesData);
      setAllVoices(allVoicesData);
      setVoiceLoadingProgress(100);
      
      if (showToast) {
        toast({
          title: "모든 음성 로드 완료",
          description: `총 ${allVoicesData.length}개의 음성을 불러왔습니다.`,
        });
      }
    } catch (error) {
      console.error("음성 목록 로드 실패:", error);
      toast({
        title: "음성 목록 로드 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingVoices(false);
    }
  }, [isLoadingVoices, toast]);

  // 초기 로드
  useEffect(() => {
    fetchVoices(false, true);
  }, []);

  // 즐겨찾기 토글
  const toggleFavorite = useCallback(async (voiceId: string) => {
    if (!user?.id) {
      toast({
        title: "로그인 필요",
        description: "즐겨찾기를 사용하려면 로그인이 필요합니다.",
        variant: "destructive",
      });
      return;
    }

    const isFavorite = favoriteVoiceIds.has(voiceId);
    const newFavorites = new Set(favoriteVoiceIds);
    
    try {
      if (isFavorite) {
        newFavorites.delete(voiceId);
        await dbService.removeFavorite(user.id, voiceId);
      } else {
        newFavorites.add(voiceId);
        await dbService.addFavorite(user.id, voiceId);
      }
      
      setFavoriteVoiceIds(newFavorites);
      toast({
        title: isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가",
        description: isFavorite ? "즐겨찾기에서 제거되었습니다." : "즐겨찾기에 추가되었습니다.",
      });
    } catch (error) {
      console.error("즐겨찾기 토글 실패:", error);
      toast({
        title: "오류",
        description: "즐겨찾기 변경 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  }, [favoriteVoiceIds, user?.id, toast]);

  // 음성 검색
  const searchVoices = useCallback(async () => {
    setIsSearchingVoices(true);
    try {
      const filters: any = {};
      if (voiceFilters.language) filters.language = voiceFilters.language;
      if (voiceFilters.style) filters.style = voiceFilters.style;
      if (voiceFilters.gender) filters.gender = voiceFilters.gender;
      if (voiceFilters.useCase) filters.use_case = voiceFilters.useCase;
      if (voiceFilters.name) filters.name = voiceFilters.name;

      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, String(value));
      });

      const url = `${SUPABASE_PROXY_BASE_URL}/voices?${queryParams.toString()}&limit=100`;
      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error(`검색 실패: ${response.status}`);

      const data = await response.json();
      const results = data.voices || data.data || [];
      
      // 클라이언트 사이드 필터링
      let filtered = [...allVoices];
      if (voiceFilters.language) {
        filtered = filtered.filter((v: any) => {
          const langs = Array.isArray(v.language) ? v.language : (v.language ? [v.language] : []);
          return langs.some((l: string) => normalizeLanguage(l) === normalizeLanguage(voiceFilters.language));
        });
      }
      if (voiceFilters.name) {
        const nameLower = voiceFilters.name.toLowerCase();
        filtered = filtered.filter((v: any) => 
          (v.name || "").toLowerCase().includes(nameLower) || 
          (v.voice_id || "").toLowerCase().includes(nameLower)
        );
      }
      if (voiceFilters.gender) {
        filtered = filtered.filter((v: any) => (v.gender || "").toLowerCase() === voiceFilters.gender.toLowerCase());
      }
      if (voiceFilters.useCase) {
        filtered = filtered.filter((v: any) => {
          const uc = v.use_case || v.useCase || "";
          return uc.toLowerCase().includes(voiceFilters.useCase.toLowerCase());
        });
      }
      if (voiceFilters.style) {
        filtered = filtered.filter((v: any) => {
          const styles = Array.isArray(v.styles) ? v.styles : (v.styles ? [v.styles] : []);
          return styles.some((s: string) => s.toLowerCase() === voiceFilters.style.toLowerCase());
        });
      }

      setVoiceSearchResults(filtered);
      setVoiceTotalCount(filtered.length);
    } catch (error) {
      console.error("음성 검색 실패:", error);
      toast({
        title: "검색 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSearchingVoices(false);
    }
  }, [voiceFilters, allVoices, toast]);

  // 사용 가능한 옵션 추출
  const getAvailableLanguages = useCallback(() => {
    const found = new Set<string>();
    allVoices.forEach((v: any) => {
      const langs = Array.isArray(v.language) ? v.language : (v.language ? [v.language] : []);
      langs.forEach((l: string) => found.add(normalizeLanguage(l)));
    });
    return Array.from(found).map(code => ({ value: code, label: `${languageCodeToKo(code)} ${languageCodeToFlag(code)}` }));
  }, [allVoices]);

  const getAvailableGenders = useCallback(() => {
    const found = new Set<string>();
    allVoices.forEach((v: any) => {
      if (v.gender) found.add(v.gender);
    });
    return Array.from(found).map(code => ({ value: code, label: genderCodeToKo(code) }));
  }, [allVoices]);

  const getAvailableUseCases = useCallback(() => {
    const found = new Set<string>();
    allVoices.forEach((v: any) => {
      const uc = v.use_case || v.useCase || "";
      if (uc) found.add(uc.toLowerCase());
    });
    const useCaseMap: Record<string, string> = {
      announcement: "공지",
      "public-service": "공공서비스",
      broadcast: "방송",
      education: "교육",
      marketing: "마케팅",
      narration: "내레이션",
      assistant: "어시스턴트",
      news: "뉴스",
      audiobook: "오디오북",
      gaming: "게임",
      game: "게임",
      advertisement: "광고",
      telephone: "전화",
      documentary: "다큐멘터리",
    };
    return Array.from(found).map(code => ({ value: code, label: useCaseMap[code] || code }));
  }, [allVoices]);

  // 정렬된 음성 목록
  const getSortedVoices = useCallback((voices: any[]) => {
    return [...voices].sort((a: any, b: any) => {
      const fa = favoriteVoiceIds.has(a.voice_id) ? 1 : 0;
      const fb = favoriteVoiceIds.has(b.voice_id) ? 1 : 0;
      if (fa !== fb) return fb - fa;

      if (voiceSortBy === "name") {
        const nameA = (a.name || a.voice_id || "").toLowerCase();
        const nameB = (b.name || b.voice_id || "").toLowerCase();
        return voiceSortOrder === "asc" 
          ? nameA.localeCompare(nameB, "ko") 
          : nameB.localeCompare(nameA, "ko");
      } else if (voiceSortBy === "language") {
        const langA = Array.isArray(a.language) ? a.language[0] || "" : (a.language || "");
        const langB = Array.isArray(b.language) ? b.language[0] || "" : (b.language || "");
        const langRankA = normalizeLanguage(langA) === "ko" ? 0 : normalizeLanguage(langA) === "en" ? 1 : normalizeLanguage(langA) === "ja" ? 2 : 3;
        const langRankB = normalizeLanguage(langB) === "ko" ? 0 : normalizeLanguage(langB) === "en" ? 1 : normalizeLanguage(langB) === "ja" ? 2 : 3;
        return voiceSortOrder === "asc" ? langRankA - langRankB : langRankB - langRankA;
      } else if (voiceSortBy === "gender") {
        const genderA = (a.gender || "").toLowerCase();
        const genderB = (b.gender || "").toLowerCase();
        const genderOrder: Record<string, number> = { female: 0, male: 1, neutral: 2, "": 3 };
        const rankA = genderOrder[genderA] ?? 3;
        const rankB = genderOrder[genderB] ?? 3;
        return voiceSortOrder === "asc" ? rankA - rankB : rankB - rankA;
      } else {
        return computeVoiceLanguageRank(a) - computeVoiceLanguageRank(b);
      }
    });
  }, [voiceSortBy, voiceSortOrder, favoriteVoiceIds]);

  // 음성 선택
  const handleVoiceSelect = useCallback((voiceId: string) => {
    setSelectedVoice(voiceId);
    const voice = allVoices.find((v: any) => v.voice_id === voiceId);
    setSelectedVoiceInfo(voice || null);
  }, [allVoices]);

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        title="음성 스타일"
        description="사용 가능한 음성 스타일을 탐색하고 선택하세요"
        icon={Volume2}
        action={{
          label: "음성 찾기",
          onClick: () => setIsVoiceFinderOpen(true),
          icon: Search,
        }}
      />

      <div className="space-y-6">
        {/* 음성 목록 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>음성 목록</CardTitle>
                <CardDescription>
                  {isLoadingVoices ? "로딩 중..." : `${allVoices.length}개의 음성`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {isLoadingVoices && (
                  <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-300"
                        style={{ width: `${voiceLoadingProgress}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {voiceLoadingProgress}%
                    </span>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchVoices(true, true)}
                  disabled={isLoadingVoices}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingVoices ? "animate-spin" : ""}`} />
                  새로고침
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {getSortedVoices(allVoices).map((voice: any) => {
                  const voiceName = voice.name || voice.voice_id;
                  const flags = (() => {
                    const arr = Array.isArray(voice.language) ? voice.language : (voice.language ? [voice.language] : []);
                    return arr.map((c: string) => languageCodeToFlag(c)).filter(Boolean).join(" ") || "";
                  })();
                  const stylesKo = formatStylesKo(voice.styles);
                  const genderKo = genderCodeToKo(voice.gender);
                  const genderColor = voice.gender === "female" ? "bg-red-500" : voice.gender === "male" ? "bg-blue-500" : "bg-gray-400";
                  const isSelected = selectedVoice === voice.voice_id;
                  const isFavorite = favoriteVoiceIds.has(voice.voice_id);

                  return (
                    <div
                      key={voice.voice_id}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        isSelected 
                          ? "border-primary bg-primary/10" 
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      }`}
                      onClick={() => handleVoiceSelect(voice.voice_id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(voice.voice_id);
                            }}
                            className={`w-5 h-5 inline-flex items-center justify-center rounded ${
                              isFavorite ? 'bg-yellow-400/20' : 'bg-transparent'
                            }`}
                          >
                            <Star className={`w-4 h-4 ${isFavorite ? 'text-yellow-400' : 'text-muted-foreground'}`} />
                          </button>
                          <span className={`inline-block w-3 h-3 rounded-full ${genderColor}`}></span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{voiceName}</span>
                              <span className="text-xs text-muted-foreground">{genderKo}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {flags} {stylesKo}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <Badge variant="default">선택됨</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* 선택된 음성 상세 정보 */}
        {selectedVoiceInfo && (
          <Card>
            <CardHeader>
              <CardTitle>음성 상세 정보</CardTitle>
              <CardDescription>{selectedVoiceInfo.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">언어</Label>
                  <div className="mt-1">
                    {(() => {
                      const langs = Array.isArray(selectedVoiceInfo.language) 
                        ? selectedVoiceInfo.language 
                        : (selectedVoiceInfo.language ? [selectedVoiceInfo.language] : []);
                      return langs.map((l: string) => languageCodeToFlag(l)).join(" ");
                    })()}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">성별</Label>
                  <div className="mt-1">{genderCodeToKo(selectedVoiceInfo.gender)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">스타일</Label>
                  <div className="mt-1">{formatStylesKo(selectedVoiceInfo.styles)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">용도</Label>
                  <div className="mt-1">{selectedVoiceInfo.use_case || selectedVoiceInfo.useCase || "-"}</div>
                </div>
              </div>

              {/* 샘플 오디오 */}
              {selectedVoiceInfo.samples && selectedVoiceInfo.samples.length > 0 && (
                <div className="space-y-3">
                  <Label>샘플 오디오</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["ko", "en", "ja"] as const).map((lang) => {
                      const langSamples = (selectedVoiceInfo.samples || []).filter((s: any) => s?.language === lang);
                      return langSamples.slice(0, 3).map((sample: any, idx: number) => (
                        <Button
                          key={`${lang}-${idx}`}
                          variant="outline"
                          size="sm"
                          onClick={() => setPlayingSample(prev => prev === sample.url ? null : sample.url)}
                          className="justify-between"
                        >
                          <span className="text-xs">
                            {languageCodeToFlag(lang)} {sample.style || "neutral"}
                          </span>
                          {playingSample === sample.url ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        </Button>
                      ));
                    })}
                  </div>
                  {playingSample && (
                    <audio
                      src={playingSample}
                      autoPlay
                      onEnded={() => setPlayingSample(null)}
                      className="hidden"
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* 음성 검색 다이얼로그 */}
      <Dialog open={isVoiceFinderOpen} onOpenChange={setIsVoiceFinderOpen}>
        <DialogContent className="sm:max-w-4xl dark-dialog bg-gray-900/95 border-gray-700">
          <DialogHeader>
            <DialogTitle style={{ color: '#FFFFFF' }}>음성 검색</DialogTitle>
            <DialogDescription style={{ color: '#E5E7EB' }}>
              언어, 스타일, 이름 등을 조합하여 원하는 음성을 검색하고 선택하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
            <div className="md:col-span-2 space-y-3">
              <div>
                <Label className="text-xs" style={{ color: '#E5E7EB' }}>언어</Label>
                <Select 
                  value={voiceFilters.language || "all"} 
                  onValueChange={(v) => setVoiceFilters(prev => ({ ...prev, language: v === "all" ? "" : v }))}
                >
                  <SelectTrigger className="bg-gray-800/50 border-gray-600 text-white">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="all" className="text-white focus:bg-gray-700">전체</SelectItem>
                    {getAvailableLanguages().map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-white focus:bg-gray-700">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs" style={{ color: '#E5E7EB' }}>이름</Label>
                <Input
                  value={voiceFilters.name}
                  onChange={(e) => setVoiceFilters(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="예: Adam"
                  className="bg-gray-800/50 border-gray-600 text-white"
                />
              </div>
              <div>
                <Label className="text-xs" style={{ color: '#E5E7EB' }}>성별</Label>
                <Select 
                  value={voiceFilters.gender || "all"} 
                  onValueChange={(v) => setVoiceFilters(prev => ({ ...prev, gender: v === "all" ? "" : v }))}
                >
                  <SelectTrigger className="bg-gray-800/50 border-gray-600 text-white">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="all" className="text-white focus:bg-gray-700">전체</SelectItem>
                    {getAvailableGenders().map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-white focus:bg-gray-700">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs" style={{ color: '#E5E7EB' }}>용도</Label>
                <Select 
                  value={voiceFilters.useCase || "all"} 
                  onValueChange={(v) => setVoiceFilters(prev => ({ ...prev, useCase: v === "all" ? "" : v }))}
                >
                  <SelectTrigger className="bg-gray-800/50 border-gray-600 text-white">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="all" className="text-white focus:bg-gray-700">전체</SelectItem>
                    {getAvailableUseCases().map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-white focus:bg-gray-700">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={searchVoices} disabled={isSearchingVoices} className="w-full">
                {isSearchingVoices ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    검색 중...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    검색
                  </>
                )}
              </Button>
            </div>
            <div className="md:col-span-3">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {voiceSearchResults.length > 0 ? (
                    voiceSearchResults.map((voice: any) => {
                      const voiceName = voice.name || voice.voice_id;
                      const flags = (() => {
                        const arr = Array.isArray(voice.language) ? voice.language : (voice.language ? [voice.language] : []);
                        return arr.map((c: string) => languageCodeToFlag(c)).filter(Boolean).join(" ") || "";
                      })();
                      const genderColor = voice.gender === "female" ? "bg-red-500" : voice.gender === "male" ? "bg-blue-500" : "bg-gray-400";
                      return (
                        <div
                          key={voice.voice_id}
                          className="p-3 border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/50"
                          onClick={() => {
                            handleVoiceSelect(voice.voice_id);
                            setIsVoiceFinderOpen(false);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`inline-block w-2 h-2 rounded-full ${genderColor}`}></span>
                            <span className="font-medium">{voiceName}</span>
                            <span className="text-xs text-muted-foreground">{flags}</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      검색 결과가 없습니다.
                    </div>
                  )}
                </div>
              </ScrollArea>
              {voiceTotalCount !== null && (
                <div className="mt-2 text-xs text-muted-foreground text-center">
                  총 {voiceTotalCount}개
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
};

export default VoiceStylesPage;

