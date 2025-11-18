import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, FileText, Plus, Edit, Trash2, Volume2, ChevronLeft, ChevronRight, Save, X, Filter, Calendar, AlertCircle, Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import * as dbService from "@/services/dbService";
import { formatDate, purposeOptions } from "@/lib/pageUtils";
import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export default function ScriptsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [scripts, setScripts] = useState<dbService.MessageHistoryEntry[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [filterPurpose, setFilterPurpose] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const itemsPerPage = 7; // 페이지당 문구 개수 (7개 단위)
  const [messageFavorites, setMessageFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user?.id) {
      loadScripts();
      loadFavorites();
    }
  }, [user?.id]);

  const loadFavorites = async () => {
    if (!user?.id) return;
    try {
      const favoriteIds = await dbService.loadMessageFavorites(user.id);
      setMessageFavorites(new Set(favoriteIds));
      // scripts에서도 isFavorite 필드를 확인하여 동기화
      setScripts(prev => prev.map(script => ({
        ...script,
        isFavorite: favoriteIds.includes(String(script.id))
      })));
    } catch (error) {
      console.error("즐겨찾기 로드 실패:", error);
    }
  };

  const toggleFavorite = async (messageId: string) => {
    if (!user?.id) return;
    const script = scripts.find(s => String(s.id) === String(messageId));
    const isFavorite = messageFavorites.has(String(messageId)) || script?.isFavorite === true;
    try {
      if (isFavorite) {
        const success = await dbService.removeMessageFavorite(user.id, String(messageId));
        if (success) {
          setMessageFavorites(prev => {
            const next = new Set(prev);
            next.delete(String(messageId));
            return next;
          });
          // scripts 상태도 업데이트
          setScripts(prev => prev.map(s => 
            String(s.id) === String(messageId) ? { ...s, isFavorite: false } : s
          ));
          toast({
            title: "즐겨찾기 제거",
            description: "즐겨찾기에서 제거되었습니다.",
          });
        } else {
          toast({
            title: "즐겨찾기 제거 실패",
            description: "즐겨찾기를 제거하는데 실패했습니다. DB 테이블에 is_favorite 컬럼이 없을 수 있습니다.",
            variant: "destructive",
          });
        }
      } else {
        const success = await dbService.addMessageFavorite(user.id, String(messageId));
        if (success) {
          setMessageFavorites(prev => new Set(prev).add(String(messageId)));
          // scripts 상태도 업데이트
          setScripts(prev => prev.map(s => 
            String(s.id) === String(messageId) ? { ...s, isFavorite: true } : s
          ));
          toast({
            title: "즐겨찾기 추가",
            description: "즐겨찾기에 추가되었습니다.",
          });
        } else {
          toast({
            title: "즐겨찾기 추가 실패",
            description: "즐겨찾기를 추가하는데 실패했습니다. DB 테이블에 is_favorite 컬럼이 없을 수 있습니다.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("즐겨찾기 변경 실패:", error);
      toast({
        title: "즐겨찾기 변경 실패",
        description: "즐겨찾기를 변경하는데 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    // 검색어 또는 필터 변경 시 첫 페이지로 리셋
    setCurrentPage(1);
  }, [searchQuery, filterPurpose, filterDate, sortOrder]);

  const loadScripts = async () => {
    if (!user?.id) return;
    try {
      const messages = await dbService.loadMessages(user.id);
      setScripts(messages);
    } catch (error) {
      console.error("문구 로드 실패:", error);
      toast({
        title: "문구 로드 실패",
        description: "문구 목록을 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 날짜 필터링 함수
  const getDateFilter = (dateStr: string | undefined): boolean => {
    if (!dateStr) return false;
    if (filterDate === "all") return true;
    
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    switch (filterDate) {
      case "today":
        return date >= today;
      case "week":
        return date >= weekAgo;
      case "month":
        return date >= monthAgo;
      default:
        return true;
    }
  };

  // 필터링 및 정렬
  const filteredScripts = scripts
    .filter((script) => {
      // 검색어 필터
      const matchesSearch =
        script.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        script.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (script.tags && script.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));
      
      // 목적 필터
      const matchesPurpose = filterPurpose === "all" || script.purpose === filterPurpose;
      
      // 날짜 필터
      const matchesDate = getDateFilter(script.createdAt);

      return matchesSearch && matchesPurpose && matchesDate;
    })
    .sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

  const getPurposeLabel = (purposeId: string) => {
    return purposeOptions.find(p => p.id === purposeId)?.label || purposeId;
  };

  const handleEdit = (script: dbService.MessageHistoryEntry) => {
    setEditingId(script.id || null);
    setEditingText(script.text);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const handleSaveEdit = async () => {
    if (!user?.id || !editingId || !editingText.trim()) {
      toast({
        title: "저장 실패",
        description: "문구 내용을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      await dbService.updateMessage(user.id, editingId, editingText.trim());
      await loadScripts();
      setEditingId(null);
      setEditingText("");
      toast({
        title: "수정 완료",
        description: "문구가 수정되었습니다.",
      });
    } catch (error) {
      console.error("문구 수정 실패:", error);
      toast({
        title: "수정 실패",
        description: "문구 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = (id: string) => {
    setDeleteDialog({ open: true, id });
  };

  const confirmDelete = async () => {
    if (!user?.id || !deleteDialog.id) return;

    try {
      const success = await dbService.deleteMessage(user.id, deleteDialog.id);
      if (success) {
        await loadScripts();
        setDeleteDialog({ open: false, id: null });
        toast({
          title: "삭제 완료",
          description: "문구가 삭제되었습니다.",
        });
      } else {
        throw new Error("삭제 실패");
      }
    } catch (error) {
      console.error("문구 삭제 실패:", error);
      toast({
        title: "삭제 실패",
        description: "문구 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredScripts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedScripts = filteredScripts.slice(startIndex, endIndex);

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        title="문구 목록"
        description="저장된 모든 문구를 확인하고 관리합니다"
        icon={FileText}
        action={{
          label: "새 문구 작성",
          onClick: () => navigate("/scripts/messages"),
          icon: Plus,
        }}
      />

      <div className="space-y-6">
        {/* 검색 및 필터 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              검색 및 필터
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="문구, 제목, 태그 검색"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={filterPurpose} onValueChange={setFilterPurpose}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {purposeOptions.map((option) => {
                      const count = scripts.filter((s) => s.purpose === option.id).length;
                      return (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label} ({count})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <Select value={filterDate} onValueChange={setFilterDate}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="today">오늘</SelectItem>
                    <SelectItem value="week">이번 주</SelectItem>
                    <SelectItem value="month">이번 달</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "newest" | "oldest")}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="정렬" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">최신순</SelectItem>
                    <SelectItem value="oldest">오래된순</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 문구 목록 */}
          {filteredScripts.length === 0 ? (
          <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <FileText className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                {searchQuery || filterPurpose !== "all" || filterDate !== "all" 
                  ? "검색 결과가 없습니다." 
                  : "저장된 문구가 없습니다."}
              </p>
              {!searchQuery && filterPurpose === "all" && filterDate === "all" && (
                <Button onClick={() => navigate("/scripts/messages")} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  첫 문구 작성하기
                </Button>
              )}
              </CardContent>
            </Card>
          ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-0">
                <div className="space-y-2 p-4">
                  {paginatedScripts.map((script) => {
                    const isFavorite = messageFavorites.has(String(script.id)) || script.isFavorite === true;
                    return (
                      <div
                        key={script.id}
                        className="rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors"
                      >
                        {editingId === script.id ? (
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex-1 min-w-0 space-y-3">
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="outline" className="text-xs">
                                  {getPurposeLabel(script.purpose)}
                                </Badge>
                                {script.tags && script.tags.length > 0 && (
                                  <>
                                    {script.tags.slice(0, 4).map((tag, idx) => (
                                      <Badge key={idx} variant="secondary" className="text-xs">
                                        {tag}
                                      </Badge>
                                    ))}
                                    {script.tags.length > 4 && (
                                      <Badge variant="secondary" className="text-xs">
                                        +{script.tags.length - 4}
                                      </Badge>
                                    )}
                                  </>
                                )}
                              </div>
                              <Textarea
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                className="min-h-[80px]"
                                placeholder="문구 내용을 입력하세요..."
                              />
                            </div>
                            <div className="flex w-full flex-col gap-2 sm:w-40">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={handleSaveEdit}
                                className="w-full"
                              >
                                <Save className="w-4 h-4 mr-2" />
                                저장
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                                className="w-full"
                              >
                                <X className="w-4 h-4 mr-2" />
                                취소
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="outline" className="text-xs">
                                  {getPurposeLabel(script.purpose)}
                                </Badge>
                                {script.tags && script.tags.length > 0 && (
                                  <>
                                    {script.tags.slice(0, 4).map((tag, idx) => (
                                      <Badge key={idx} variant="secondary" className="text-xs">
                                        {tag}
                                      </Badge>
                                    ))}
                                    {script.tags.length > 4 && (
                                      <Badge variant="secondary" className="text-xs">
                                        +{script.tags.length - 4}
                                      </Badge>
                                    )}
                                  </>
                                )}
                              </div>
                              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                                {script.text}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (script.id) toggleFavorite(script.id);
                                    }}
                                    className={cn(
                                      "h-9 w-9 transition-colors",
                                      isFavorite
                                        ? "text-yellow-500 hover:text-yellow-600"
                                        : "text-muted-foreground hover:text-yellow-500"
                                    )}
                                    aria-label={isFavorite ? "즐겨찾기 제거" : "즐겨찾기 추가"}
                                  >
                                    <Star className={cn("w-4 h-4", isFavorite && "fill-current")} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{isFavorite ? "즐겨찾기 제거" : "즐겨찾기 추가"}</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="default"
                                    className="h-9 w-9"
                                    onClick={() => navigate(`/audio/tts?loadMessage=${script.id}`)}
                                    aria-label="음원 생성 페이지로 이동"
                                  >
                                    <Volume2 className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>음원 생성</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-9 w-9"
                                    onClick={() => handleEdit(script)}
                                    aria-label="문구 편집"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>편집</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => script.id && handleDelete(script.id)}
                                    aria-label="문구 삭제"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>삭제</TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </div>
                </CardContent>
              </Card>

            {/* 페이지네이션 - 항상 표시 */}
            <div className="flex justify-center pt-2">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
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
                      className="gap-1"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>
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
              <AlertDialogTitle className="text-xl">문구 삭제 확인</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-base pt-2">
              {(() => {
                const script = deleteDialog.id ? scripts.find((s) => s.id === deleteDialog.id) : null;
                if (script) {
                  return (
                    <div className="space-y-3">
                      <p className="text-muted-foreground">
                        정말 이 문구를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                      </p>
                      <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-2">
                        {script.purpose && (
                          <div className="flex items-start gap-2">
                            <span className="text-sm font-medium text-muted-foreground min-w-[60px]">목적:</span>
                            <Badge variant="outline" className="text-xs">{purposeOptions.find(p => p.id === script.purpose)?.label || script.purpose}</Badge>
                          </div>
                        )}
                        {script.text && (
                          <div className="flex items-start gap-2">
                            <span className="text-sm font-medium text-muted-foreground min-w-[60px]">내용:</span>
                            <span className="text-sm flex-1 line-clamp-3">{script.text}</span>
                          </div>
                        )}
                        {script.tags && script.tags.length > 0 && (
                          <div className="flex items-start gap-2">
                            <span className="text-sm font-medium text-muted-foreground min-w-[60px]">태그:</span>
                            <div className="flex flex-wrap gap-1 flex-1">
                              {script.tags.slice(0, 5).map((tag, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">{tag}</Badge>
                              ))}
                              {script.tags.length > 5 && (
                                <Badge variant="secondary" className="text-xs">+{script.tags.length - 5}</Badge>
                              )}
                            </div>
                          </div>
                        )}
                        {script.createdAt && (
                          <div className="flex items-start gap-2">
                            <span className="text-sm font-medium text-muted-foreground min-w-[60px]">생성일:</span>
                            <span className="text-sm flex-1">{formatDate(script.createdAt)}</span>
                          </div>
          )}
        </div>
      </div>
                  );
                }
                return (
                  <p className="text-muted-foreground">
                    정말 이 문구를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
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
