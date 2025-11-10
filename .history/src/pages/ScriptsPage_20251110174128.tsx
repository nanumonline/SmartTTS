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
import { Search, FileText, Plus, Edit, Trash2, Volume2, ChevronLeft, ChevronRight, Save, X, Filter, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import * as dbService from "@/services/dbService";
import { formatDate, purposeOptions } from "@/lib/pageUtils";
import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";

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
  const itemsPerPage = 10; // 페이지당 문구 개수

  useEffect(() => {
    if (user?.id) {
      loadScripts();
    }
  }, [user?.id]);

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
            {/* 검색 및 필터 - 한 줄로 배치 */}
            <div className="flex flex-wrap items-end gap-4">
              {/* 카테고리 */}
              <div className="space-y-2 flex-1 min-w-[150px]">
                <Label className="text-sm">카테고리</Label>
                <Select value={filterPurpose} onValueChange={setFilterPurpose}>
                  <SelectTrigger>
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 ({scripts.length})</SelectItem>
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
              </div>

              {/* 검색 */}
              <div className="space-y-2 flex-1 min-w-[200px]">
                <Label className="text-sm">검색</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="문구 내용, 목적, 태그로 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* 날짜 필터 */}
              <div className="space-y-2 flex-1 min-w-[150px]">
                <Label className="text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  날짜
                </Label>
                <Select value={filterDate} onValueChange={setFilterDate}>
                  <SelectTrigger>
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="today">오늘</SelectItem>
                    <SelectItem value="week">이번 주</SelectItem>
                    <SelectItem value="month">이번 달</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 정렬 */}
              <div className="space-y-2 flex-1 min-w-[150px]">
                <Label className="text-sm">정렬</Label>
                <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "newest" | "oldest")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">최신순</SelectItem>
                    <SelectItem value="oldest">오래된순</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 통계 */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-sm text-muted-foreground">
                총 {filteredScripts.length}개 문구
                {filterPurpose !== "all" && ` (${getPurposeLabel(filterPurpose)})`}
                {filterDate !== "all" && ` (${filterDate === "today" ? "오늘" : filterDate === "week" ? "이번 주" : "이번 달"})`}
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
          <div className="flex flex-col h-[70vh]">
            <Card className="flex-1 flex flex-col overflow-hidden">
              <CardHeader className="flex-shrink-0">
                <CardTitle className="text-lg">문구 목록</CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
                <div className="divide-y overflow-y-auto flex-1">
                  {paginatedScripts.map((script) => (
                    <div
                      key={script.id}
                      className="p-4 hover:bg-muted/50 transition-colors min-h-[120px] flex flex-col"
                    >
                      {editingId === script.id ? (
                        // 편집 모드
                        <div className="space-y-3 flex-1 flex flex-col">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              {getPurposeLabel(script.purpose)}
                            </Badge>
                            {script.tags && script.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {script.tags.slice(0, 3).map((tag, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                                {script.tags.length > 3 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{script.tags.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">
                              {formatDate(script.createdAt)}
                            </span>
                          </div>
                          <Textarea
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="min-h-[80px] flex-1"
                            placeholder="문구 내용을 입력하세요..."
                          />
                          <div className="flex items-center gap-2 mt-auto">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={handleSaveEdit}
                            >
                              <Save className="w-4 h-4 mr-2" />
                              저장
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEdit}
                            >
                              <X className="w-4 h-4 mr-2" />
                              취소
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // 읽기 모드
                        <div className="flex flex-col flex-1 min-h-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              {getPurposeLabel(script.purpose)}
                            </Badge>
                            {script.tags && script.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {script.tags.slice(0, 3).map((tag, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                                {script.tags.length > 3 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{script.tags.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">
                              {formatDate(script.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-foreground mb-3 whitespace-pre-wrap flex-1 line-clamp-3 overflow-hidden">
                            {script.text}
                          </p>
                          <div className="flex items-center gap-2 mt-auto">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => navigate(`/audio/tts?loadMessage=${script.id}`)}
                            >
                              <Volume2 className="w-4 h-4 mr-2" />
                              음원 생성
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(script)}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              편집
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => script.id && handleDelete(script.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              삭제
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 페이지네이션 - 항상 표시 */}
            <div className="flex justify-center pt-4 flex-shrink-0">
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
                      className="gap-1"
                    >
                      다음
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>문구 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말 이 문구를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
