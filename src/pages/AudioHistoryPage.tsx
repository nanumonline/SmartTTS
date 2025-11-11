import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, Trash2, Play, Filter, Music2, Calendar, FileSearch, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import * as dbService from "@/services/dbService";
import AudioPlayer from "@/components/AudioPlayer";
import { formatDateTime, purposeOptions } from "@/lib/pageUtils";
import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
    setDeleteDialog({ open: true, id });
  };

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
      {filteredGenerations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Play className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">생성된 음원이 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="space-y-2 p-4">
              {filteredGenerations.map((gen) => (
                <div
                  key={gen.id}
                  className="rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {/* 왼쪽 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1 text-sm text-muted-foreground">
                        <Badge variant="outline">{gen.purpose}</Badge>
                        <span>{gen.voiceName}</span>
                        {gen.duration && (
                          <span className="text-xs">
                            {Math.floor(gen.duration / 60)}:{Math.floor(gen.duration % 60).toString().padStart(2, "0")}
                          </span>
                        )}
                        <span className="text-xs">{formatDateTime(gen.createdAt || new Date().toISOString())}</span>
                      </div>
                      <p className="font-medium truncate">
                        {gen.savedName || formatDateTime(gen.createdAt || new Date().toISOString())}
                      </p>
                      {gen.textPreview && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-2 mt-1">
                          {gen.textPreview}
                        </p>
                      )}
                    </div>

                    {/* 오른쪽 액션 */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setSelectedGeneration(selectedGeneration === gen.id ? null : gen.id || null)
                        }
                        title={selectedGeneration === gen.id ? "미리듣기 닫기" : "미리듣기"}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigate(`/mix/board?generation=${gen.id}`);
                          toast({ title: "믹싱 페이지로 이동", description: "선택한 음원을 믹싱할 수 있습니다." });
                        }}
                      >
                        <Music2 className="w-4 h-4 mr-2" />
                        믹싱
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigate(`/send/schedule?generation=${gen.id}`);
                          toast({ title: "스케줄 관리로 이동", description: "선택한 음원을 예약할 수 있습니다." });
                        }}
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        예약
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async () => {
                          let downloadUrl = gen.audioUrl;
                          if (!downloadUrl && user?.id && gen.id) {
                            try {
                              const res = await dbService.loadGenerationBlob(user.id, String(gen.id));
                              if (res?.audioBlob) {
                                const blob = dbService.arrayBufferToBlob(
                                  res.audioBlob,
                                  res.mimeType || (gen as any).mimeType || "audio/mpeg"
                                );
                                downloadUrl = URL.createObjectURL(blob);
                                setGenerations((prev) =>
                                  prev.map((g) => (g.id === gen.id ? { ...g, audioUrl: downloadUrl! } : g))
                                );
                              }
                            } catch (e) {
                              console.error("다운로드용 blob URL 생성 실패:", e);
                              toast({ title: "다운로드 실패", description: "음원 데이터를 불러올 수 없습니다.", variant: "destructive" });
                              return;
                            }
                          }
                          if (downloadUrl) {
                            const link = document.createElement('a');
                            link.href = downloadUrl;
                            link.download = `${gen.savedName || formatDateTime(gen.createdAt)}.${resolveFormat(gen)}`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }
                        }}
                        title="다운로드"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => gen.id && handleDelete(gen.id)}
                        title="삭제"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {selectedGeneration === gen.id && (
                    <div className="pt-3">
                      <AudioPlayer
                        audioUrl={gen.audioUrl || ""}
                        title={gen.savedName || "생성된 음원"}
                        duration={gen.duration || 0}
                        mimeType={(gen as any).mimeType || "audio/mpeg"}
                        cacheKey={(gen as any).cacheKey}
                        onError={async () => {
                          try {
                            const uid = (gen as any).userId || user?.id;
                            if (!uid || !gen.id) return;
                            const res = await dbService.loadGenerationBlob(uid, String(gen.id));
                            if (res?.audioBlob) {
                              const blob = dbService.arrayBufferToBlob(
                                res.audioBlob,
                                res.mimeType || (gen as any).mimeType || "audio/mpeg"
                              );
                              const newUrl = URL.createObjectURL(blob);
                              setGenerations((prev) => prev.map((g) => (g.id === gen.id ? { ...g, audioUrl: newUrl } : g)));
                            }
                          } catch (e) {
                            console.error("생성내역 미리듣기 복원 실패:", e);
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
                            <Badge variant="outline" className="text-xs">
                              {purposeOptions.find(p => p.id === entry.purpose)?.label || entry.purpose}
                            </Badge>
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
    </PageContainer>
  );
}
