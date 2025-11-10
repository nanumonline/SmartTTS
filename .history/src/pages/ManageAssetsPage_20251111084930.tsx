import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, Trash2, Play, Upload, FileAudio } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import * as dbService from "@/services/dbService";
import AudioPlayer from "@/components/AudioPlayer";

export default function ManageAssetsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [generations, setGenerations] = useState<dbService.GenerationEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  useEffect(() => {
    if (user?.id) {
      loadAssets();
    }
  }, [user?.id]);

  const loadAssets = async () => {
    if (!user?.id) return;
    try {
      const data = await dbService.loadGenerations(user.id, 1000);
      setGenerations(data.filter((g) => g.hasAudio));
    } catch (error) {
      console.error("자산 로드 실패:", error);
    }
  };

  const filteredAssets = generations.filter((gen) => {
    const matchesSearch =
      gen.savedName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gen.textPreview?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || gen.purpose === filterType;
    return matchesSearch && matchesType;
  });

  const handleDelete = async (id: string) => {
    setDeleteDialog({ open: true, id });
  };

  const confirmDelete = async () => {
    if (!user?.id || !deleteDialog.id) return;
    try {
      await dbService.deleteGeneration(user.id, deleteDialog.id);
      await loadAssets();
      setDeleteDialog({ open: false, id: null });
      toast({
        title: "삭제 완료",
        description: "자산이 삭제되었습니다.",
      });
    } catch (error) {
      console.error("삭제 실패:", error);
      toast({
        title: "삭제 실패",
        description: "자산 삭제에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const totalSize = filteredAssets.reduce((sum, gen) => {
    // TODO: 실제 파일 크기 계산
    return sum + (gen.duration || 0);
  }, 0);

  const purposes = Array.from(new Set(generations.map((g) => g.purpose)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">자산 관리</h1>
          <p className="text-muted-foreground mt-1">
            생성된 음원 파일을 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            총 {filteredAssets.length}개 파일
          </Badge>
        </div>
      </div>

      {/* 필터 및 검색 */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="자산 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
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
      </div>

      {/* 자산 목록 */}
      <div className="grid gap-4">
        {filteredAssets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileAudio className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">등록된 자산이 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          filteredAssets.map((gen) => (
            <Card key={gen.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">
                      {gen.savedName || `음원 ${gen.id}`}
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
                        {new Date(gen.createdAt || "").toLocaleDateString()}
                      </span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setSelectedAsset(selectedAsset === gen.id ? null : gen.id || null)
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
              {selectedAsset === gen.id && gen.audioUrl && (
                <CardContent>
                  <AudioPlayer
                    audioUrl={gen.audioUrl}
                    title={gen.savedName || "자산"}
                    duration={gen.duration || 0}
                    mimeType={(gen as any).mimeType || "audio/mpeg"}
                    onError={async () => {
                      try {
                        const uid = (gen as any).userId || user?.id;
                        if (!uid || !gen.id) return;
                        const res = await dbService.loadGenerationBlob(uid, String(gen.id));
                        if (res?.audioBlob) {
                          const blob = dbService.arrayBufferToBlob(res.audioBlob, res.mimeType || (gen as any).mimeType || "audio/mpeg");
                          const newUrl = URL.createObjectURL(blob);
                          // 간단히 선택 항목만 갱신
                          if (selectedAsset === gen.id) {
                            // 외부에서 리스트 상태를 관리한다면 setState로 반영 필요
                          }
                        }
                      } catch (e) {
                        console.error("자산 미리듣기 복원 실패:", e);
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
  );
}
