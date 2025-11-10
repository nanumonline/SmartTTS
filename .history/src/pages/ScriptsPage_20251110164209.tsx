import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, FileText, Plus, Edit, Trash2, Volume2, ChevronLeft, ChevronRight } from "lucide-react";
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
  const itemsPerPage = 10; // 페이지당 문구 개수

  useEffect(() => {
    if (user?.id) {
      loadScripts();
    }
  }, [user?.id]);

  useEffect(() => {
    // 검색어 변경 시 첫 페이지로 리셋
    setCurrentPage(1);
  }, [searchQuery]);

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

  const filteredScripts = scripts.filter((script) =>
    script.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    script.purpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (script.tags && script.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const getPurposeLabel = (purposeId: string) => {
    return purposeOptions.find(p => p.id === purposeId)?.label || purposeId;
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
        {/* 검색 및 통계 */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="문구 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            총 {filteredScripts.length}개 문구
          </div>
        </div>

        {/* 문구 목록 */}
        {filteredScripts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="w-16 h-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                {searchQuery ? "검색 결과가 없습니다." : "저장된 문구가 없습니다."}
              </p>
              {!searchQuery && (
                <Button onClick={() => navigate("/scripts/messages")} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  첫 문구 작성하기
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">문구 목록</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {paginatedScripts.map((script) => (
                    <div
                      key={script.id}
                      className="p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
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
                          <p className="text-sm text-foreground line-clamp-2 mb-3">
                            {script.text}
                          </p>
                          <div className="flex items-center gap-2">
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
                              onClick={() => navigate(`/scripts/messages?edit=${script.id}`)}
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
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex justify-center">
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
            )}
          </>
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
