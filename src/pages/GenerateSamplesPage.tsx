/**
 * 샘플 오디오 생성 페이지
 * 브라우저에서 직접 샘플 오디오를 생성하여 다운로드할 수 있습니다
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from "@/components/ui/select";
import { Download, Loader2, CheckCircle2, XCircle } from "lucide-react";
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

const defaultSamples: SampleConfig[] = [
  {
    id: "sample1",
    filename: "sample1-policy.mp3",
    text: "안녕하세요. 오늘은 새로운 정책 발표를 안내드리겠습니다. 본 정책은 시민 여러분의 편의를 위해 마련되었으며, 효과적인 시행을 위해 지속적으로 개선해 나가겠습니다. 많은 관심과 협조 부탁드립니다.",
    voiceId: "00ff2ed19b23dcbb75b00d", // 정책 발표용 음성
    description: "정책 발표 샘플"
  },
  {
    id: "sample2",
    filename: "sample2-announcement.mp3",
    text: "안녕하세요. 중요한 공지사항을 전달드립니다. 내일부터 새로운 서비스가 시작됩니다. 자세한 내용은 홈페이지를 참고해 주시기 바랍니다. 문의사항이 있으시면 언제든지 연락 주시기 바랍니다.",
    voiceId: "e5f6fb1a53d0add87afb4f", // 공지사항용 음성
    description: "공지사항 샘플"
  },
  {
    id: "sample3",
    filename: "sample3-presentation.mp3",
    text: "안녕하세요. 오늘 발표할 내용은 연구 결과에 대한 것입니다. 본 연구는 지난 1년간의 데이터를 분석하여 도출된 결과입니다. 주요 내용은 다음과 같습니다. 첫째, 환경 개선 효과가 확인되었습니다. 둘째, 시민 만족도가 향상되었습니다.",
    voiceId: "6ef0f6a6d40450da09c52f", // 전문 발표용 음성
    description: "전문 발표 샘플"
  }
];

export default function GenerateSamplesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [availableVoices, setAvailableVoices] = useState<any[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(true);
  const [samples, setSamples] = useState<SampleConfig[]>(defaultSamples);
  const [voiceNameMap, setVoiceNameMap] = useState<Record<string, string>>({});
  const [favoriteGenerations, setFavoriteGenerations] = useState<any[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);

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
      
      // 타임아웃 설정 (20초 후 자동 해제)
      timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn("[GenerateSamplesPage] 음성 목록 로드 타임아웃 (20초) - 로딩 상태 해제");
          setIsLoadingVoices(false);
          toast({
            title: "음성 목록 로드 타임아웃",
            description: "음성 목록을 불러오는 데 시간이 오래 걸립니다. '모든 음성 가져오기' 버튼을 클릭해주세요.",
            variant: "destructive",
          });
        }
      }, 20000);
      
      try {
        // 먼저 DB에서 로드 시도 (빠른 로드)
        let dbVoices: any[] = [];
        try {
          const { loadVoiceCatalog, syncVoiceCatalog } = await import("@/services/dbService");
          dbVoices = await loadVoiceCatalog();
          console.log("[GenerateSamplesPage] DB에서 음성 로드 시도:", dbVoices.length);
        } catch (dbError) {
          console.warn("[GenerateSamplesPage] DB에서 음성 로드 실패 (API에서 가져오기):", dbError);
          // DB 로드 실패해도 API에서 가져오면 되므로 계속 진행
        }
        
        // DB에서 음성이 있고 강제 재로드가 아니면 사용
        if (dbVoices && dbVoices.length > 0 && !forceReload) {
          console.log("[GenerateSamplesPage] DB에서 음성 로드 성공:", dbVoices.length);
          
          // 음성 데이터 정규화
          const normalizedVoices = dbVoices
            .map((v: any) => {
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
                styles: Array.isArray(voiceData.styles) ? voiceData.styles : (voiceData.styles ? [voiceData.styles] : []),
                model: voiceData.model || "",
                language: Array.isArray(voiceData.language) ? voiceData.language : (voiceData.language ? [voiceData.language] : []),
                use_case: voiceData.use_case || "",
                voice_data: voiceData,
              };
            })
            .filter((v: any) => v !== null);
          
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
          
          console.warn("[GenerateSamplesPage] DB 음성 정규화 실패, API에서 가져오기");
        }

        // DB에 없거나 강제 재로드인 경우 API에서 모든 음성 가져오기
        console.log("[GenerateSamplesPage] API에서 모든 음성 가져오기 시도");
        
        // 토스트는 한 번만 표시 (너무 많이 표시되지 않도록)
        if (forceReload || dbVoices.length === 0) {
          toast({
            title: "모든 음성 가져오는 중...",
            description: "API에서 음성 목록을 가져오는 중입니다.",
          });
        }

        let allVoicesData: any[] = [];
        let nextToken: string | null = null;
        let hasMore = true;
        let totalFetched = 0;
        let maxIterations = 50; // 최대 50번 반복 (5000개 음성 제한)
        let iterationCount = 0;

        while (hasMore && iterationCount < maxIterations) {
          iterationCount++;
          const url = nextToken 
            ? `${SUPABASE_PROXY_BASE_URL}/voices?limit=100&next_token=${nextToken}`
            : `${SUPABASE_PROXY_BASE_URL}/voices?limit=100`;
          
          console.log(`[GenerateSamplesPage] API 호출 ${iterationCount}회:`, url);
          
          let response: Response;
          try {
            response = await fetch(url, {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            });

            if (!response.ok) {
              const errorText = await response.text().catch(() => "");
              throw new Error(`API 오류 (${response.status}): ${errorText.substring(0, 100)}`);
            }
          } catch (fetchError) {
            console.error("[GenerateSamplesPage] API 호출 실패:", fetchError);
            throw new Error(`API 호출 실패: ${fetchError instanceof Error ? fetchError.message : "알 수 없는 오류"}`);
          }

          let apiData: any;
          try {
            apiData = await response.json();
          } catch (jsonError) {
            console.error("[GenerateSamplesPage] JSON 파싱 실패:", jsonError);
            throw new Error("API 응답을 파싱할 수 없습니다.");
          }

          const voices = Array.isArray(apiData.voices) 
            ? apiData.voices 
            : (Array.isArray(apiData.data) ? apiData.data : []);
          
          console.log(`[GenerateSamplesPage] ${iterationCount}회차: ${voices.length}개 음성 로드`);
          
          allVoicesData = [...allVoicesData, ...voices];
          totalFetched += voices.length;
          
          // 다음 페이지 확인
          nextToken = apiData.next_token || null;
          hasMore = !!nextToken && voices.length === 100;
          
          // voices가 비어있으면 루프 종료
          if (voices.length === 0) {
            hasMore = false;
          }
        }

        if (iterationCount >= maxIterations) {
          console.warn("[GenerateSamplesPage] 최대 반복 횟수 도달, 루프 종료");
        }

        console.log("[GenerateSamplesPage] 모든 음성 로드 완료:", allVoicesData.length);
        
        // DB에 동기화 (에러가 발생해도 계속 진행)
        if (allVoicesData.length > 0) {
          try {
            const { syncVoiceCatalog } = await import("@/services/dbService");
            await syncVoiceCatalog(allVoicesData, true);
            console.log("[GenerateSamplesPage] DB 동기화 완료");
          } catch (syncError) {
            console.error("[GenerateSamplesPage] DB 동기화 실패 (계속 진행):", syncError);
            // DB 동기화 실패해도 음성 목록은 사용 가능하므로 계속 진행
          }
        } else {
          throw new Error("음성 목록이 비어있습니다. API 응답을 확인해주세요.");
        }

        // 음성 데이터 정규화
        const normalizedVoices = allVoicesData
          .map((v: any) => {
            const voiceData = v.voice_data || v;
            const voiceId = v.voice_id || voiceData.voice_id;
            
            // voice_id가 없으면 스킵
            if (!voiceId) {
              console.warn("[GenerateSamplesPage] voice_id가 없는 음성 데이터:", v);
              return null;
            }
            
            return {
              voice_id: voiceId,
              name: voiceData.name || v.name || "",
              name_ko: voiceData.name_ko || v.name_ko || "",
              gender: (voiceData.gender || v.gender || "").toLowerCase(),
              styles: Array.isArray(voiceData.styles) ? voiceData.styles : (voiceData.styles ? [voiceData.styles] : []),
              model: voiceData.model || v.model || "",
              language: Array.isArray(voiceData.language) ? voiceData.language : (voiceData.language ? [voiceData.language] : []),
              use_case: voiceData.use_case || v.use_case || "",
              voice_data: voiceData, // 원본 데이터 보존
            };
          })
          .filter((v: any) => v !== null); // null 제거

        if (normalizedVoices.length === 0) {
          throw new Error("음성 목록이 비어있습니다. API 응답을 확인해주세요.");
        }
        
        setAvailableVoices(normalizedVoices);
        
        // 음성 이름 맵 생성
        const nameMap: Record<string, string> = {};
        normalizedVoices.forEach((v: any) => {
          const id = v.voice_id;
          if (id) {
            const nameKo = v.name_ko || getVoiceDisplayNameKo(v.name, id, v.name_ko) || id;
            nameMap[id] = nameKo;
            console.log(`[GenerateSamplesPage] API 음성 이름 맵 추가: ${id} -> ${nameKo}`);
          }
        });
        setVoiceNameMap(nameMap);
        console.log(`[GenerateSamplesPage] API 음성 이름 맵 생성 완료: ${Object.keys(nameMap).length}개`);
        
        // 타임아웃 클리어
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        toast({
          title: "음성 목록 로드 완료",
          description: `${normalizedVoices.length}개의 음성을 불러왔습니다.`,
        });
        
        // 로딩 상태 해제
        if (isMounted) {
          setIsLoadingVoices(false);
        }
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
          variant: "destructive",
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
        const { loadGenerations } = await import("@/services/dbService");
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
                pitchShift: favorite.pitchShift ?? 0,
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
          variant: "default",
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
    setProgress(prev => ({ ...prev, [sample.id]: 0 }));

    try {
      // PublicVoiceGenerator 방식 참고 - 즐겨찾기 음원 스타일 포함
      const requestBody: any = {
        text: sample.text,
        language: "ko",
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

      setProgress(prev => ({ ...prev, [sample.id]: 30 }));

      const response = await fetch(
        `${SUPABASE_PROXY_BASE_URL}/text-to-speech/${sample.voiceId}?output_format=mp3`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      setProgress(prev => ({ ...prev, [sample.id]: 60 }));

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
        audioBlob = new Blob([bytes], { type: mimeType });
      } else {
        audioBlob = await response.blob();
      }

      setProgress(prev => ({ ...prev, [sample.id]: 90 }));

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

      setProgress(prev => ({ ...prev, [sample.id]: 100 }));
      setGenerating(prev => {
        const next = new Set(prev);
        next.delete(sample.id);
        return next;
      });
      setCompleted(prev => new Set(prev).add(sample.id));

      toast({
        title: "생성 완료",
        description: `${sample.description}이(가) 생성되어 다운로드되었습니다.`,
      });
    } catch (error: any) {
      console.error(`[${sample.description}] 생성 실패:`, error);
      setGenerating(prev => {
        const next = new Set(prev);
        next.delete(sample.id);
        return next;
      });
      setProgress(prev => ({ ...prev, [sample.id]: 0 }));

      toast({
        title: "생성 실패",
        description: `${sample.description} 생성 중 오류가 발생했습니다: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const generateAll = async () => {
    if (generating.size > 0) return; // 이미 생성 중이면 중복 실행 방지
    
    toast({
      title: "샘플 생성 시작",
      description: "모든 샘플을 생성하고 다운로드합니다.",
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
        description: "모든 샘플이 생성되어 다운로드되었습니다. 다운로드 폴더를 확인하고 public/samples/ 폴더로 이동해주세요.",
      });
    }
  };

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        title="샘플 오디오 생성"
        description={
          isLoadingFavorites 
            ? "즐겨찾기 음원 스타일을 불러오는 중..." 
            : favoriteGenerations.length > 0
            ? `즐겨찾기 음원 스타일 ${favoriteGenerations.length}개를 불러왔습니다. 각 샘플에 자동 할당됩니다.`
            : "홈페이지용 샘플 오디오를 생성하고 다운로드합니다. 즐겨찾기 음원이 없으면 기본 설정을 사용합니다."
        }
      />

      {/* 모든 음성 가져오기 버튼 */}
      <div className="mt-4 flex justify-end">
        <Button
          onClick={async () => {
            setIsLoadingVoices(true);
            try {
              const { syncVoiceCatalog } = await import("@/services/dbService");
              
              toast({
                title: "모든 음성 가져오는 중...",
                description: "API에서 모든 음성을 가져오는 중입니다.",
              });

              let allVoicesData: any[] = [];
              let nextToken: string | null = null;
              let hasMore = true;
              let maxIterations = 50; // 최대 50번 반복 (5000개 음성 제한)
              let iterationCount = 0;

              while (hasMore && iterationCount < maxIterations) {
                iterationCount++;
                const url = nextToken 
                  ? `${SUPABASE_PROXY_BASE_URL}/voices?limit=100&next_token=${nextToken}`
                  : `${SUPABASE_PROXY_BASE_URL}/voices?limit=100`;
                
                console.log(`[GenerateSamplesPage] 버튼 클릭 - API 호출 ${iterationCount}회:`, url);
                
                let response: Response;
                try {
                  response = await fetch(url, {
                    method: "GET",
                    headers: {
                      "Content-Type": "application/json",
                    },
                  });

                  if (!response.ok) {
                    const errorText = await response.text().catch(() => "");
                    throw new Error(`API 오류 (${response.status}): ${errorText.substring(0, 100)}`);
                  }
                } catch (fetchError) {
                  console.error("[GenerateSamplesPage] API 호출 실패:", fetchError);
                  throw new Error(`API 호출 실패: ${fetchError instanceof Error ? fetchError.message : "알 수 없는 오류"}`);
                }

                let apiData: any;
                try {
                  apiData = await response.json();
                } catch (jsonError) {
                  console.error("[GenerateSamplesPage] JSON 파싱 실패:", jsonError);
                  throw new Error("API 응답을 파싱할 수 없습니다.");
                }

                const voices = Array.isArray(apiData.voices) 
                  ? apiData.voices 
                  : (Array.isArray(apiData.data) ? apiData.data : []);
                
                console.log(`[GenerateSamplesPage] 버튼 클릭 - ${iterationCount}회차: ${voices.length}개 음성 로드`);
                
                allVoicesData = [...allVoicesData, ...voices];
                
                nextToken = apiData.next_token || null;
                hasMore = !!nextToken && voices.length === 100;
                
                // voices가 비어있으면 루프 종료
                if (voices.length === 0) {
                  hasMore = false;
                }
              }

              if (iterationCount >= maxIterations) {
                console.warn("[GenerateSamplesPage] 최대 반복 횟수 도달, 루프 종료");
              }

              // DB에 동기화 (에러가 발생해도 계속 진행)
              if (allVoicesData.length > 0) {
                try {
                  await syncVoiceCatalog(allVoicesData, true);
                  console.log("[GenerateSamplesPage] 버튼 클릭 - DB 동기화 완료");
                } catch (syncError) {
                  console.error("[GenerateSamplesPage] DB 동기화 실패 (계속 진행):", syncError);
                  // DB 동기화 실패해도 음성 목록은 사용 가능하므로 계속 진행
                }
              } else {
                throw new Error("음성 목록이 비어있습니다. API 응답을 확인해주세요.");
              }

              // 음성 데이터 정규화
              const normalizedVoices = allVoicesData.map((v: any) => {
                const voiceData = v.voice_data || v;
                return {
                  voice_id: v.voice_id || voiceData.voice_id,
                  name: voiceData.name || v.name,
                  name_ko: voiceData.name_ko || v.name_ko,
                  gender: voiceData.gender || v.gender || "",
                  styles: Array.isArray(voiceData.styles) ? voiceData.styles : (voiceData.styles ? [voiceData.styles] : []),
                  model: voiceData.model || v.model || "",
                  language: Array.isArray(voiceData.language) ? voiceData.language : (voiceData.language ? [voiceData.language] : []),
                  use_case: voiceData.use_case || v.use_case || "",
                  voice_data: voiceData,
                };
              }).filter((v: any) => v.voice_id);

              setAvailableVoices(normalizedVoices);
              
              // 음성 이름 맵 생성
              const nameMap: Record<string, string> = {};
              normalizedVoices.forEach((v: any) => {
                const id = v.voice_id;
                if (id) {
                  nameMap[id] = v.name_ko || getVoiceDisplayNameKo(v.name, id, v.name_ko) || id;
                }
              });
              setVoiceNameMap(nameMap);
              
              toast({
                title: "음성 목록 로드 완료",
                description: `${normalizedVoices.length}개의 음성을 불러왔습니다.`,
              });
            } catch (error) {
              console.error("[GenerateSamplesPage] 음성 목록 로드 실패:", error);
              toast({
                title: "음성 목록 로드 실패",
                description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.",
                variant: "destructive",
              });
            } finally {
              setIsLoadingVoices(false);
            }
          }}
          disabled={isLoadingVoices}
          variant="outline"
        >
          {isLoadingVoices ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              가져오는 중...
            </>
          ) : (
            "모든 음성 가져오기"
          )}
        </Button>
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              각 샘플을 개별 생성하거나 모두 한 번에 생성할 수 있습니다.
            </p>
            {isLoadingVoices && (
              <p className="text-xs text-blue-500 flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                음성 목록을 불러오는 중...
              </p>
            )}
          </div>
          <Button 
            onClick={generateAll} 
            disabled={generating.size > 0 || isLoadingVoices}
          >
            {isLoadingVoices ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                음성 로딩 중...
              </>
            ) : generating.size > 0 ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                생성 중...
              </>
            ) : (
              "전체 생성"
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {samples.map((sample) => {
            const isGenerating = generating.has(sample.id);
            const isCompleted = completed.has(sample.id);
            const currentProgress = progress[sample.id] || 0;

            return (
              <Card key={sample.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{sample.description}</CardTitle>
                  <CardDescription>
                    음성: {getVoiceNameKo(sample.voiceId)}
                    {sample.model && (
                      <span className="ml-2 text-xs">
                        ({sample.model}
                        {sample.style && `, ${sample.style}`}
                        {sample.speed !== undefined && `, 속도: ${sample.speed}`}
                        {sample.pitchShift !== undefined && sample.pitchShift !== 0 && `, 피치: ${sample.pitchShift}`}
                        )
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    <p className="mb-2 font-medium">텍스트:</p>
                    <p className="line-clamp-3">{sample.text}</p>
                  </div>

                  {/* 음성 스타일 선택 */}
                  <div className="space-y-2">
                    <Label htmlFor={`voice-${sample.id}`} className="text-sm font-medium">
                      음성 스타일 선택
                    </Label>
                    <Select
                      value={sample.voiceId}
                      onValueChange={(value) => {
                        // 선택한 즐겨찾기 음원 찾기
                        const selectedFavorite = favoriteGenerations.find(
                          (fav: any) => fav.voiceId === value
                        );
                        
                        // 선택한 일반 음원 찾기
                        const selectedVoice = availableVoices.find((v: any) => {
                          const id = v.voice_id || v.voice_data?.voice_id;
                          return id === value;
                        });
                        
                        // 음성 데이터 정규화
                        const voiceData = selectedVoice?.voice_data || selectedVoice || {};
                        const styles = Array.isArray(voiceData.styles) 
                          ? voiceData.styles 
                          : (voiceData.styles ? [voiceData.styles] : []);
                        const firstStyle = styles.length > 0 ? styles[0] : (voiceData.style || "");
                        
                        // 샘플 업데이트
                        setSamples((prev) =>
                          prev.map((s) =>
                            s.id === sample.id
                              ? {
                                  ...s,
                                  voiceId: selectedFavorite?.voiceId || value,
                                  model: selectedFavorite?.model || voiceData.model || "",
                                  style: selectedFavorite?.style || firstStyle || "",
                                  speed: selectedFavorite?.speed ?? 1.0,
                                  pitchShift: selectedFavorite?.pitchShift ?? 0,
                                }
                              : s
                          )
                        );
                      }}
                      disabled={isGenerating || isLoadingFavorites || isLoadingVoices || (availableVoices.length === 0 && favoriteGenerations.length === 0)}
                    >
                      <SelectTrigger id={`voice-${sample.id}`}>
                        <SelectValue placeholder="음성 스타일을 선택하세요" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {/* 즐겨찾기 음원 */}
                        {favoriteGenerations.length > 0 && (
                          <>
                            <SelectGroup>
                              <SelectLabel>⭐ 즐겨찾기</SelectLabel>
                              {favoriteGenerations.map((fav: any, index: number) => {
                                const voice = availableVoices.find((v: any) => {
                                  const id = v.voice_id || v.voice_data?.voice_id;
                                  return id === fav.voiceId;
                                });
                                const voiceData = voice?.voice_data || voice || {};
                                const gender = voiceData.gender || fav.gender || "";
                                const genderLabel = gender === "female" ? "여성" : gender === "male" ? "남성" : "";
                                
                                return (
                                  <SelectItem key={`fav-${fav.id || index}`} value={fav.voiceId}>
                                    {getVoiceNameKo(fav.voiceId)}
                                    {genderLabel && <span className="ml-2 text-xs text-muted-foreground">({genderLabel})</span>}
                                    {fav.model && (
                                      <span className="ml-2 text-xs text-muted-foreground">
                                        - {fav.model}
                                        {fav.style && `, ${fav.style}`}
                                      </span>
                                    )}
                                  </SelectItem>
                                );
                              })}
                            </SelectGroup>
                            <SelectSeparator />
                          </>
                        )}
                        
                        {/* 모든 음원 (남녀 구분) */}
                        {availableVoices.length > 0 && (() => {
                          // 음성 데이터 정규화 및 필터링
                          const normalizedVoices = availableVoices.map((v: any) => {
                            // voice_data 구조 처리
                            const voiceData = v.voice_data || v;
                            return {
                              voice_id: v.voice_id || voiceData.voice_id,
                              name: voiceData.name || v.name,
                              name_ko: voiceData.name_ko || v.name_ko,
                              gender: (voiceData.gender || v.gender || "").toLowerCase(),
                              styles: Array.isArray(voiceData.styles) ? voiceData.styles : (voiceData.styles ? [voiceData.styles] : []),
                              model: voiceData.model || v.model || "",
                              style: voiceData.style || v.style || "",
                              language: voiceData.language || v.language || [],
                              use_case: voiceData.use_case || v.use_case || "",
                              voice_data: voiceData,
                            };
                          }).filter((v: any) => v.voice_id); // voice_id가 있는 것만 필터링
                          
                          // 남성 음성 필터링
                          const maleVoices = normalizedVoices.filter((v: any) => v.gender === "male");
                          // 여성 음성 필터링
                          const femaleVoices = normalizedVoices.filter((v: any) => v.gender === "female");
                          // 기타 음성 필터링
                          const otherVoices = normalizedVoices.filter((v: any) => 
                            !v.gender || (v.gender !== "male" && v.gender !== "female")
                          );
                          
                          return (
                            <>
                              {/* 남성 음성 */}
                              {maleVoices.length > 0 && (
                                <>
                                  <SelectGroup>
                                    <SelectLabel>👨 남성 음성 ({maleVoices.length})</SelectLabel>
                                    {maleVoices.map((v: any, index: number) => {
                                      const stylesText = v.styles && v.styles.length > 0 
                                        ? `, 스타일: ${v.styles.join(", ")}`
                                        : (v.style ? `, 스타일: ${v.style}` : "");
                                      return (
                                        <SelectItem key={`male-${v.voice_id || index}`} value={v.voice_id}>
                                          {getVoiceNameKo(v.voice_id)}
                                          {(v.model || stylesText) && (
                                            <span className="ml-2 text-xs text-muted-foreground">
                                              ({v.model || ""}{stylesText})
                                            </span>
                                          )}
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectGroup>
                                  <SelectSeparator />
                                </>
                              )}
                              
                              {/* 여성 음성 */}
                              {femaleVoices.length > 0 && (
                                <>
                                  <SelectGroup>
                                    <SelectLabel>👩 여성 음성 ({femaleVoices.length})</SelectLabel>
                                    {femaleVoices.map((v: any, index: number) => {
                                      const stylesText = v.styles && v.styles.length > 0 
                                        ? `, 스타일: ${v.styles.join(", ")}`
                                        : (v.style ? `, 스타일: ${v.style}` : "");
                                      return (
                                        <SelectItem key={`female-${v.voice_id || index}`} value={v.voice_id}>
                                          {getVoiceNameKo(v.voice_id)}
                                          {(v.model || stylesText) && (
                                            <span className="ml-2 text-xs text-muted-foreground">
                                              ({v.model || ""}{stylesText})
                                            </span>
                                          )}
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectGroup>
                                  {otherVoices.length > 0 && <SelectSeparator />}
                                </>
                              )}
                              
                              {/* 기타 음성 */}
                              {otherVoices.length > 0 && (
                                <SelectGroup>
                                  <SelectLabel>🔊 기타 음성 ({otherVoices.length})</SelectLabel>
                                  {otherVoices.map((v: any, index: number) => {
                                    const stylesText = v.styles && v.styles.length > 0 
                                      ? `, 스타일: ${v.styles.join(", ")}`
                                      : (v.style ? `, 스타일: ${v.style}` : "");
                                    return (
                                      <SelectItem key={`other-${v.voice_id || index}`} value={v.voice_id}>
                                        {getVoiceNameKo(v.voice_id)}
                                        {(v.model || stylesText) && (
                                          <span className="ml-2 text-xs text-muted-foreground">
                                            ({v.model || ""}{stylesText})
                                          </span>
                                        )}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectGroup>
                              )}
                            </>
                          );
                        })()}
                        
                        {/* 로딩 중이거나 음원이 없을 때는 아무것도 렌더링하지 않음 (placeholder가 표시됨) */}
                      </SelectContent>
                    </Select>
                    {isLoadingVoices && (
                      <p className="text-xs text-muted-foreground">
                        음성 목록을 불러오는 중...
                      </p>
                    )}
                    {!isLoadingVoices && availableVoices.length === 0 && favoriteGenerations.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        사용 가능한 음성이 없습니다. 상단의 "모든 음성 가져오기" 버튼을 클릭하세요.
                      </p>
                    )}
                  </div>

                  {isGenerating && (
                    <div className="space-y-2">
                      <Progress value={currentProgress} />
                      <p className="text-xs text-center text-muted-foreground">
                        {currentProgress}%
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => generateSample(sample)}
                      disabled={isGenerating || isLoadingVoices || isLoadingFavorites}
                      className="flex-1"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          생성 중...
                        </>
                      ) : isCompleted ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                          생성 완료
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          생성 및 다운로드
                        </>
                      )}
                    </Button>
                  </div>

                  {isCompleted && (
                    <p className="text-xs text-center text-green-600">
                      ✓ {sample.filename} 다운로드 완료
                    </p>
                  )}
                </CardContent>
              </Card>
            );
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
    </PageContainer>
  );
}

