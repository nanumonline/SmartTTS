import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, Trash2, Play, Filter, Music2, Calendar, FileSearch } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import * as dbService from "@/services/dbService";
import AudioPlayer from "@/components/AudioPlayer";
import { formatDateTime } from "@/lib/pageUtils";
import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";

export default function AudioHistoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [generations, setGenerations] = useState<dbService.GenerationEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPurpose, setFilterPurpose] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedGeneration, setSelectedGeneration] = useState<string | null>(null);

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

  useEffect(() => {
    if (user?.id) {
      loadGenerations();
    }
  }, [user?.id]);

  const loadGenerations = async () => {
    if (!user?.id) return;
    try {
      const data = await dbService.loadGenerations(user.id, 100);
      setGenerations(data);
    } catch (error) {
      console.error("생성 내역 로드 실패:", error);
    }
  };

  const filteredGenerations = generations.filter((gen) => {
    const matchesSearch =
      gen.textPreview?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gen.savedName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gen.voiceName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPurpose = filterPurpose === "all" || gen.purpose === filterPurpose;
    const matchesStatus = filterStatus === "all" || gen.status === filterStatus;
    return matchesSearch && matchesPurpose && matchesStatus;
  });

  const handleDelete = async (id: string) => {
    if (!user?.id || !confirm("정말 삭제하시겠습니까?")) return;
    try {
      await dbService.deleteGeneration(user.id, id);
      await loadGenerations();
    } catch (error) {
      console.error("삭제 실패:", error);
    }
  };

  const purposes = Array.from(new Set(generations.map((g) => g.purpose)));

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        title="생성 내역"
        description="생성된 음원 목록을 확인하고 관리합니다"
        icon={FileSearch}
      />

      <div className="space-y-6">
        {/* 필터 및 검색 */}
        <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="음원 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterPurpose} onValueChange={setFilterPurpose}>
          <SelectTrigger className="w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="용도" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 용도</SelectItem>
            {purposes.map((purpose) => (
              <SelectItem key={purpose} value={purpose}>
                {purpose}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="상태" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="ready">완료</SelectItem>
            <SelectItem value="processing">처리 중</SelectItem>
            <SelectItem value="failed">실패</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 생성 내역 목록 */}
      <div className="grid gap-4">
        {filteredGenerations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Play className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">생성된 음원이 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          filteredGenerations.map((gen) => (
            <Card key={gen.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">
                      {gen.savedName || formatDateTime(gen.createdAt || new Date().toISOString())}
                    </CardTitle>
                    <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                      <Badge variant="outline">{gen.purpose}</Badge>
                      <span>{gen.voiceName}</span>
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
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setSelectedGeneration(
                          selectedGeneration === gen.id ? null : gen.id || null
                        )
                      }
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigate(`/mix/board?generation=${gen.id}`);
                        toast({
                          title: "믹싱 페이지로 이동",
                          description: "선택한 음원을 믹싱할 수 있습니다.",
                        });
                      }}
                      title="믹싱"
                    >
                      <Music2 className="w-4 h-4 mr-2" />
                      믹싱
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigate(`/send/schedule?generation=${gen.id}`);
                        toast({
                          title: "스케줄 관리로 이동",
                          description: "선택한 음원을 예약할 수 있습니다.",
                        });
                      }}
                      title="예약"
                    >
                      <Calendar className="w-4 h-4 mr-2" />
                      예약
                    </Button>
                    {gen.audioUrl && (
                      <Button variant="ghost" size="icon" asChild>
                        <a href={gen.audioUrl} download={`${gen.savedName || formatDateTime(gen.createdAt)}.${resolveFormat(gen)}`}>
                          <Download className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => gen.id && handleDelete(gen.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {selectedGeneration === gen.id && (
                <CardContent>
                  <AudioPlayer
                    audioUrl={gen.audioUrl || ""}
                    title={gen.savedName || "생성된 음원"}
                    duration={gen.duration || 0}
                    mimeType={(gen as any).mimeType || "audio/mpeg"}
                    cacheKey={(gen as any).cacheKey}
                    onError={async () => {
                      try {
                        // 단건 blob로 복원
                        const uid = (gen as any).userId || user?.id;
                        if (!uid || !gen.id) return;
                        const res = await dbService.loadGenerationBlob(uid, String(gen.id));
                        if (res?.audioBlob) {
                          const blob = dbService.arrayBufferToBlob(res.audioBlob, res.mimeType || (gen as any).mimeType || "audio/mpeg");
                          const newUrl = URL.createObjectURL(blob);
                          // 로컬 상태에 반영하여 AudioPlayer가 새 URL을 받도록 함
                          setGenerations((prev) =>
                            prev.map((g) =>
                              g.id === gen.id ? { ...g, audioUrl: newUrl } : g
                            )
                          );
                        }
                      } catch (e) {
                        console.error("생성내역 미리듣기 복원 실패:", e);
                      }
                    }}
                  />
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
      </div>
    </PageContainer>
  );
}
