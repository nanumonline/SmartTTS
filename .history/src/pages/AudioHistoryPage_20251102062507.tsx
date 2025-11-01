import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, Trash2, Play, Filter } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import * as dbService from "@/services/dbService";
import AudioPlayer from "@/components/AudioPlayer";

// formatDateTime 함수 정의 (PublicVoiceGenerator에서 참조)
const formatDateTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch {
    return dateString;
  }
};

export default function AudioHistoryPage() {
  const { user } = useAuth();
  const [generations, setGenerations] = useState<dbService.GenerationEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPurpose, setFilterPurpose] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedGeneration, setSelectedGeneration] = useState<string | null>(null);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">생성 내역</h1>
          <p className="text-muted-foreground mt-1">
            생성된 음원 목록을 확인하고 관리합니다.
          </p>
        </div>
      </div>

      {/* 필터 및 검색 */}
      <div className="flex items-center gap-4">
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
                    <CardDescription className="flex items-center gap-2 flex-wrap">
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
                    </CardDescription>
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
                    {gen.audioUrl && (
                      <Button variant="ghost" size="icon" asChild>
                        <a href={gen.audioUrl} download>
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
              {selectedGeneration === gen.id && gen.audioUrl && (
                <CardContent>
                  <AudioPlayer
                    audioUrl={gen.audioUrl}
                    title={gen.savedName || "생성된 음원"}
                    duration={gen.duration || 0}
                  />
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
