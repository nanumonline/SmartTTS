/**
 * 샘플 오디오 생성 페이지
 * 브라우저에서 직접 샘플 오디오를 생성하여 다운로드할 수 있습니다
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { Download, Loader2, CheckCircle2, XCircle, Star } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { getVoiceDisplayNameKo } from "@/lib/voiceNames";
const SUPABASE_PROXY_BASE_URL = "https://gxxralruivyhdxyftsrg.supabase.co/functions/v1/supertone-proxy";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4eHJhbHJ1aXZ5aGR4eWZ0c3JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NDM0MzQsImV4cCI6MjA3NzIxOTQzNH0.6lJjJq15spXWrktl-8d5qXI3L5FHkyaEArWiH2R5AjA";
interface SampleConfig {
  id: string;
  filename: string;
  text: string;
  voiceId: string;
  description: string;
  model?: string;
  style?: string;
  speed?: number;
  pitchShift?: number;
}
const defaultSamples: SampleConfig[] = [{
  id: "sample1",
  filename: "sample1-policy.mp3",
  text: "안녕하세요. 오늘은 새로운 정책 발표를 안내드리겠습니다. 본 정책은 시민 여러분의 편의를 위해 마련되었으며, 효과적인 시행을 위해 지속적으로 개선해 나가겠습니다. 많은 관심과 협조 부탁드립니다.",
  voiceId: "00ff2ed19b23dcbb75b00d",
  // 정책 발표용 음성
  description: "정책 발표 샘플"
}, {
  id: "sample2",
  filename: "sample2-announcement.mp3",
  text: "안녕하세요. 중요한 공지사항을 전달드립니다. 내일부터 새로운 서비스가 시작됩니다. 자세한 내용은 홈페이지를 참고해 주시기 바랍니다. 문의사항이 있으시면 언제든지 연락 주시기 바랍니다.",
  voiceId: "e5f6fb1a53d0add87afb4f",
  // 공지사항용 음성
  description: "공지사항 샘플"
}, {
  id: "sample3",
  filename: "sample3-presentation.mp3",
  text: "안녕하세요. 오늘 발표할 내용은 연구 결과에 대한 것입니다. 본 연구는 지난 1년간의 데이터를 분석하여 도출된 결과입니다. 주요 내용은 다음과 같습니다. 첫째, 환경 개선 효과가 확인되었습니다. 둘째, 시민 만족도가 향상되었습니다.",
  voiceId: "6ef0f6a6d40450da09c52f",
  // 전문 발표용 음성
  description: "전문 발표 샘플"
}];
export default function GenerateSamplesPage() {
  const {
    toast
  } = useToast();
  const {
    user
  } = useAuth();
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(true);
  const [samples, setSamples] = useState<SampleConfig[]>(defaultSamples);
  const [voiceNameMap, setVoiceNameMap] = useState<Record<string, string>>({});
  const [favoriteGenerations, setFavoriteGenerations] = useState<any[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
  const [favoriteVoiceIds, setFavoriteVoiceIds] = useState<string[]>([]);

  // 즐겨찾기 음성 ID 목록 로드
  useEffect(() => {
    const saved = localStorage.getItem("favoriteVoiceIds");
    if (saved) {
      try {
        setFavoriteVoiceIds(JSON.parse(saved));
      } catch (e) {
        console.error("즐겨찾기 로드 실패:", e);
      }
    }
  }, []);

  // 즐겨찾기 추가/제거 함수
  const toggleFavoriteVoiceId = (voiceId: string) => {
    setFavoriteVoiceIds(prev => {
      const newFavorites = prev.includes(voiceId) ? prev.filter(id => id !== voiceId) : [...prev, voiceId];
      localStorage.setItem("favoriteVoiceIds", JSON.stringify(newFavorites));
      return newFavorites;
    });
  };

  // 음성 ID로 한글 이름 가져오기
  const getVoiceNameKo = (voiceId: string): string => {
    if (voiceNameMap[voiceId]) {
      return voiceNameMap[voiceId];
    }

    // availableVoices에서 찾기
    const voice = availableVoices.find((v: any) => {
      const id = v.voice_id || v.voice_data?.voice_id;
      return id === voiceId;
    });
    if (voice) {
      const voiceData = voice.voice_data || voice;
      const nameKo = voiceData.name_ko || getVoiceDisplayNameKo(voiceData.name, voiceId, voiceData.name_ko);
      return nameKo || voiceId;
    }
    return getVoiceDisplayNameKo("", voiceId, "") || voiceId;
  };

  // 사용 가능한 음성 목록 로드 (모든 음성 가져오기)
  useEffect(() => {
    let isMounted = true; // 컴포넌트가 마운트되어 있는지 추적
    let timeoutId: NodeJS.Timeout | null = null; // 타임아웃 ID

    const loadVoices = async (forceReload: boolean = false) => {
      // 이미 로딩 중이면 중복 실행 방지
      if (isLoadingVoices && !forceReload) {
        console.log("[GenerateSamplesPage] 이미 로딩 중이므로 건너뜀");
        return;
      }
      console.log("[GenerateSamplesPage] 음성 목록 로드 시작");
      setIsLoadingVoices(true);

      // 기존 타임아웃 클리어
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // 타임아웃 설정 (5초 후 자동 해제)
      timeoutId = setTimeout(() => {
        if (isMounted && isLoadingVoices) {
          console.warn("[GenerateSamplesPage] 음성 목록 로드 타임아웃 (5초) - 기본 음성 사용");
          setIsLoadingVoices(false);
          // 기본 음성 설정
          const defaultVoices = [{
            voice_id: "2cd6c38c7087106be21888",
            name: "Default Voice 1",
            name_ko: "기본 음성 1",
            gender: "female",
            styles: ["neutral"],
            model: "sona_speech_1",
            language: ["ko"],
            use_case: "",
            voice_data: {}
          }];
          setAvailableVoices(defaultVoices);
          toast({
            title: "기본 음성으로 시작",
            description: "음성 목록 로드가 지연되어 기본 음성을 사용합니다."
          });
        }
      }, 5000);
      try {
        // 먼저 DB에서 로드 시도 (빠른 로드) - 3초 타임아웃
        let dbVoices: any[] = [];
        try {
          const {
            loadVoiceCatalog
          } = await import("@/services/dbService");
          const dbLoadPromise = loadVoiceCatalog();
          const timeoutPromise = new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error("DB load timeout")), 3000));
          dbVoices = await Promise.race([dbLoadPromise, timeoutPromise]);
          console.log("[GenerateSamplesPage] DB에서 음성 로드:", dbVoices.length);
        } catch (dbError) {
          console.warn("[GenerateSamplesPage] DB 로드 실패 또는 타임아웃:", dbError);
          dbVoices = [];
        }

        // DB에서 음성이 있고 강제 재로드가 아니면 사용
        if (dbVoices && dbVoices.length > 0 && !forceReload) {
          console.log("[GenerateSamplesPage] DB에서 음성 로드 성공:", dbVoices.length);

          // 음성 데이터 정규화
          const normalizedVoices = dbVoices.map((v: any) => {
            const voiceData = v.voice_data || v;
            const voiceId = voiceData.voice_id;
            if (!voiceId) {
              return null;
            }
            return {
              voice_id: voiceId,
              name: voiceData.name || "",
              name_ko: voiceData.name_ko || "",
              gender: (voiceData.gender || "").toLowerCase(),
              styles: Array.isArray(voiceData.styles) ? voiceData.styles : voiceData.styles ? [voiceData.styles] : [],
              model: voiceData.model || "",
              language: Array.isArray(voiceData.language) ? voiceData.language : voiceData.language ? [voiceData.language] : [],
              use_case: voiceData.use_case || "",
              voice_data: voiceData
            };
          }).filter((v: any) => v !== null);
          if (normalizedVoices.length > 0) {
            // 타임아웃 클리어
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            setAvailableVoices(normalizedVoices);

            // 음성 이름 맵 생성
            const nameMap: Record<string, string> = {};
            normalizedVoices.forEach((v: any) => {
              if (v.voice_id) {
                nameMap[v.voice_id] = v.name_ko || getVoiceDisplayNameKo(v.name, v.voice_id, v.name_ko) || v.voice_id;
              }
            });
            setVoiceNameMap(nameMap);
            console.log(`[GenerateSamplesPage] DB 로드 완료: ${normalizedVoices.length}개 음성`);
            if (isMounted) {
              setIsLoadingVoices(false);
            }
            return;
          }
          console.warn("[GenerateSamplesPage] DB 음성 없음, 기본 음성 사용");
        }

        // DB에 없으면 기본 음성 사용
        console.log("[GenerateSamplesPage] 기본 음성으로 폴백");
        const defaultVoices = [{
          voice_id: "2cd6c38c7087106be21888",
          name: "Voice 1",
          name_ko: "정책 발표용 음성",
          gender: "female",
          styles: ["neutral"],
          model: "sona_speech_1",
          language: ["ko"],
          use_case: "",
          voice_data: {}
        }, {
          voice_id: "fd15ad31caa16bd021f01d",
          name: "Voice 2",
          name_ko: "공지사항용 음성",
          gender: "female",
          styles: ["neutral"],
          model: "sona_speech_1",
          language: ["ko"],
          use_case: "",
          voice_data: {}
        }, {
          voice_id: "6ef0f6a6d40450da09c52f",
          name: "Voice 3",
          name_ko: "전문 발표용 음성",
          gender: "male",
          styles: ["neutral"],
          model: "sona_speech_1",
          language: ["ko"],
          use_case: "",
          voice_data: {}
        }];
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        setAvailableVoices(defaultVoices);
        const nameMap: Record<string, string> = {};
        defaultVoices.forEach((v: any) => {
          nameMap[v.voice_id] = v.name_ko;
        });
        setVoiceNameMap(nameMap);
        if (isMounted) {
          setIsLoadingVoices(false);
        }
        toast({
          title: "음성 로드 완료",
          description: `${defaultVoices.length}개의 음성을 사용할 수 있습니다.`
        });
      } catch (error) {
        console.error("[GenerateSamplesPage] 음성 목록 로드 실패:", error);

        // 타임아웃 클리어
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        toast({
          title: "음성 목록 로드 실패",
          description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
          variant: "destructive"
        });

        // 에러 발생 시 빈 배열이라도 설정하여 UI가 멈추지 않도록 함
        if (isMounted) {
          setAvailableVoices([]);
          setIsLoadingVoices(false);
        }
      }
    };

    // 컴포넌트 마운트 시 한 번만 실행
    loadVoices();

    // cleanup 함수
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []); // 의존성 배열을 빈 배열로 변경하여 마운트 시 한 번만 실행

  // 즐겨찾기 음원 스타일 로드
  useEffect(() => {
    const loadFavoriteGenerations = async () => {
      if (!user?.id) return;
      setIsLoadingFavorites(true);
      try {
        const {
          loadGenerations
        } = await import("@/services/dbService");
        const allGenerations = await loadGenerations(user.id, 200);

        // 즐겨찾기로 표시된 음원만 필터링
        const favorites = allGenerations.filter((gen: any) => gen.isFavorite === true);
        console.log("[GenerateSamplesPage] 즐겨찾기 음원 로드:", favorites.length);
        setFavoriteGenerations(favorites);

        // 즐겨찾기 음원이 있으면 샘플에 할당
        if (favorites.length > 0) {
          const updatedSamples = defaultSamples.map((sample, index) => {
            const favorite = favorites[index % favorites.length]; // 순환 할당
            if (favorite) {
              return {
                ...sample,
                voiceId: favorite.voiceId || sample.voiceId,
                model: favorite.model,
                style: favorite.style,
                speed: favorite.speed ?? 1.0,
                pitchShift: favorite.pitchShift ?? 0
              };
            }
            return sample;
          });
          setSamples(updatedSamples);
          console.log("[GenerateSamplesPage] 샘플에 즐겨찾기 음원 스타일 할당 완료");
        } else {
          console.log("[GenerateSamplesPage] 즐겨찾기 음원이 없어 기본 설정 사용");
        }
      } catch (error) {
        console.error("[GenerateSamplesPage] 즐겨찾기 음원 로드 실패:", error);
        toast({
          title: "즐겨찾기 음원 로드 실패",
          description: "기본 설정으로 샘플을 생성합니다.",
          variant: "default"
        });
      } finally {
        setIsLoadingFavorites(false);
      }
    };
    if (user?.id) {
      loadFavoriteGenerations();
    }
  }, [user?.id, toast]);
  const generateSample = async (sample: SampleConfig) => {
    setGenerating(prev => new Set(prev).add(sample.id));
    setProgress(prev => ({
      ...prev,
      [sample.id]: 0
    }));
    try {
      // PublicVoiceGenerator 방식 참고 - 즐겨찾기 음원 스타일 포함
      const requestBody: any = {
        text: sample.text,
        language: "ko"
      };

      // 즐겨찾기 음원 스타일이 있으면 추가
      if (sample.model) {
        requestBody.model = sample.model;
      }
      if (sample.style) {
        requestBody.style = sample.style;
      }
      if (sample.speed !== undefined) {
        requestBody.speed = sample.speed;
      }
      if (sample.pitchShift !== undefined) {
        requestBody.pitchShift = sample.pitchShift;
      }

      // voiceId가 없으면 생성 불가
      if (!sample.voiceId) {
        throw new Error("음성이 선택되지 않았습니다. 음성 목록을 먼저 로드해주세요.");
      }
      setProgress(prev => ({
        ...prev,
        [sample.id]: 30
      }));
      const response = await fetch(`${SUPABASE_PROXY_BASE_URL}/text-to-speech/${sample.voiceId}?output_format=mp3`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify(requestBody)
      });
      setProgress(prev => ({
        ...prev,
        [sample.id]: 60
      }));
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`음원 생성 실패 (${response.status}): ${errorText}`);
      }

      // 응답 처리
      const contentType = response.headers?.get("content-type")?.toLowerCase() || "";
      let audioBlob: Blob;
      if (contentType.includes("application/json")) {
        const json = await response.json();

        // supertone-proxy 응답 형식: { audioData: base64, contentType: "audio/mpeg", audioLength: ... }
        const base64Audio = json?.audioData ?? json?.data?.audio_base64 ?? json?.audio_base64 ?? json?.audioBase64 ?? json?.audio ?? json?.audio_data ?? null;
        const mimeType = json?.contentType ?? json?.content_type ?? json?.data?.mime_type ?? json?.mime_type ?? "audio/mpeg";
        if (!base64Audio) {
          console.error("[GenerateSamplesPage] JSON 응답:", json);
          throw new Error("오디오 데이터가 응답에 포함되어 있지 않습니다.");
        }

        // base64를 blob으로 변환
        const cleanBase64 = base64Audio.includes(",") ? base64Audio.split(",").pop() || "" : base64Audio;
        const decoded = atob(cleanBase64);
        const bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) {
          bytes[i] = decoded.charCodeAt(i);
        }
        audioBlob = new Blob([bytes], {
          type: mimeType
        });
      } else {
        audioBlob = await response.blob();
      }
      setProgress(prev => ({
        ...prev,
        [sample.id]: 90
      }));

      // 오디오 Blob 크기 검증
      const blobSize = audioBlob.size;
      if (blobSize < 1024) {
        throw new Error(`생성된 오디오 파일이 너무 작습니다 (${blobSize} bytes). 유효한 오디오 파일이 아닙니다.`);
      }
      console.log(`[GenerateSamplesPage] 샘플 생성 완료: ${sample.description}, 크기: ${(blobSize / 1024).toFixed(2)} KB, 타입: ${audioBlob.type}`);

      // 파일 다운로드
      const url = window.URL.createObjectURL(audioBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = sample.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setProgress(prev => ({
        ...prev,
        [sample.id]: 100
      }));
      setGenerating(prev => {
        const next = new Set(prev);
        next.delete(sample.id);
        return next;
      });
      setCompleted(prev => new Set(prev).add(sample.id));
      toast({
        title: "생성 완료",
        description: `${sample.description}이(가) 생성되어 다운로드되었습니다.`
      });
    } catch (error: any) {
      console.error(`[${sample.description}] 생성 실패:`, error);
      setGenerating(prev => {
        const next = new Set(prev);
        next.delete(sample.id);
        return next;
      });
      setProgress(prev => ({
        ...prev,
        [sample.id]: 0
      }));
      toast({
        title: "생성 실패",
        description: `${sample.description} 생성 중 오류가 발생했습니다: ${error.message}`,
        variant: "destructive"
      });
    }
  };
  const generateAll = async () => {
    if (generating.size > 0) return; // 이미 생성 중이면 중복 실행 방지

    toast({
      title: "샘플 생성 시작",
      description: "모든 샘플을 생성하고 다운로드합니다."
    });
    for (const sample of samples) {
      if (completed.has(sample.id)) {
        console.log(`[${sample.description}] 이미 생성 완료됨, 건너뜀`);
        continue; // 이미 생성된 샘플은 건너뛰기
      }
      await generateSample(sample);
      // 각 샘플 생성 간격 (2초)
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    if (completed.size === samples.length) {
      toast({
        title: "모든 샘플 생성 완료",
        description: "모든 샘플이 생성되어 다운로드되었습니다. 다운로드 폴더를 확인하고 public/samples/ 폴더로 이동해주세요."
      });
    }
  };
  return <PageContainer maxWidth="wide">
      <PageHeader title="샘플 오디오 생성" description={favoriteGenerations.length > 0 ? `즐겨찾기 음원 스타일 ${favoriteGenerations.length}개를 불러왔습니다. 각 샘플에 자동 할당됩니다.` : "홈페이지용 샘플 오디오를 생성하고 다운로드합니다. 각 샘플에 자동 할당됩니다."} />

      {/* 모든 음성 가져오기 버튼 */}
      

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              각 샘플을 개별 생성하거나 모두 한 번에 생성할 수 있습니다.
            </p>
          </div>
          <Button onClick={generateAll} disabled={generating.size > 0 || isLoadingVoices}>
            {generating.size > 0 ? <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                생성 중...
              </> : "전체 생성"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {samples.map(sample => {
          const isGenerating = generating.has(sample.id);
          const isCompleted = completed.has(sample.id);
          const currentProgress = progress[sample.id] || 0;
          return <Card key={sample.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{sample.description}</CardTitle>
                  <CardDescription>
                    음성: {getVoiceNameKo(sample.voiceId)}
                    {sample.model && <span className="ml-2 text-xs">
                        ({sample.model}
                        {sample.style && `, ${sample.style}`}
                        {sample.speed !== undefined && `, 속도: ${sample.speed}`}
                        {sample.pitchShift !== undefined && sample.pitchShift !== 0 && `, 피치: ${sample.pitchShift}`}
                        )
                      </span>}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-2 font-medium">텍스트:</p>
                    <p className="line-clamp-3">{sample.text}</p>
                  </div>

                  {/* 음성 ID 입력 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`voice-${sample.id}`} className="text-sm font-medium">
                        음성 ID 입력
                      </Label>
                      {sample.voiceId && <Button type="button" variant="ghost" size="sm" onClick={() => toggleFavoriteVoiceId(sample.voiceId)} className="h-7 px-2" disabled={isGenerating}>
                          <Star className={`h-4 w-4 ${favoriteVoiceIds.includes(sample.voiceId) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                        </Button>}
                    </div>
                    
                    {/* 즐겨찾기 목록 */}
                    {favoriteVoiceIds.length > 0 && <div className="flex flex-wrap gap-1 mb-2">
                        {favoriteVoiceIds.map(voiceId => <Button key={voiceId} type="button" variant="outline" size="sm" onClick={() => {
                    setSamples(prev => prev.map(s => s.id === sample.id ? {
                      ...s,
                      voiceId: voiceId,
                      model: "sona_speech_1",
                      style: "neutral",
                      speed: 1.0,
                      pitchShift: 0
                    } : s));
                  }} disabled={isGenerating} className="h-7 px-2 text-xs">
                            <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                            {getVoiceNameKo(voiceId)}
                          </Button>)}
                      </div>}
                    
                    <Input id={`voice-${sample.id}`} value={sample.voiceId} onChange={e => {
                  const newVoiceId = e.target.value;
                  setSamples(prev => prev.map(s => s.id === sample.id ? {
                    ...s,
                    voiceId: newVoiceId,
                    model: "sona_speech_1",
                    style: "neutral",
                    speed: 1.0,
                    pitchShift: 0
                  } : s));
                }} placeholder="음성 ID를 입력하세요 (예: 2cd6c38c7087106be21888)" disabled={isGenerating} className="font-mono text-sm" />
                    {sample.voiceId}
                  </div>

                  {isGenerating && <div className="space-y-2">
                      <Progress value={currentProgress} />
                      <p className="text-xs text-center text-muted-foreground">
                        {currentProgress}%
                      </p>
                    </div>}

                  <div className="flex items-center gap-2">
                    <Button onClick={() => generateSample(sample)} disabled={isGenerating || isLoadingVoices || isLoadingFavorites} className="flex-1">
                      {isGenerating ? <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          생성 중...
                        </> : isCompleted ? <>
                          <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                          생성 완료
                        </> : <>
                          <Download className="w-4 h-4 mr-2" />
                          생성 및 다운로드
                        </>}
                    </Button>
                  </div>

                  {isCompleted && <p className="text-xs text-center text-green-600">
                      ✓ {sample.filename} 다운로드 완료
                    </p>}
                </CardContent>
              </Card>;
        })}
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>사용 방법</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. 각 샘플의 "생성 및 다운로드" 버튼을 클릭합니다.</p>
            <p>2. 생성된 MP3 파일이 다운로드됩니다.</p>
            <p>3. 다운로드된 파일을 <code className="bg-muted px-1 rounded">public/samples/</code> 폴더에 저장합니다.</p>
            <p>4. 파일명은 각 샘플의 filename과 동일해야 합니다.</p>
          </CardContent>
        </Card>
      </div>
    </PageContainer>;
}