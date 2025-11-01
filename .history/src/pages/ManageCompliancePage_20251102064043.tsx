import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, CheckCircle, XCircle, Clock, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import * as dbService from "@/services/dbService";
import { useToast } from "@/components/ui/use-toast";

export default function ManageCompliancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reviewStates, setReviewStates] = useState<Map<string, dbService.ReviewStateEntry>>(new Map());
  const [generations, setGenerations] = useState<dbService.GenerationEntry[]>([]);
  const [selectedGeneration, setSelectedGeneration] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadReviewStates();
      loadGenerations();
    }
  }, [user?.id]);

  const loadReviewStates = async () => {
    if (!user?.id) return;
    try {
      const states = await dbService.loadReviewStates(user.id);
      setReviewStates(states);
    } catch (error) {
      console.error("검수 상태 로드 실패:", error);
    }
  };

  const loadGenerations = async () => {
    if (!user?.id) return;
    try {
      const data = await dbService.loadGenerations(user.id, 100);
      setGenerations(data);
    } catch (error) {
      console.error("생성 내역 로드 실패:", error);
    }
  };

  const handleReview = async (generationId: string, status: "approved" | "rejected") => {
    if (!user?.id) return;

    try {
      await dbService.saveReviewState(user.id, {
        generationId,
        status,
        comments: reviewComment,
      });

      toast({
        title: status === "approved" ? "승인 완료" : "반려 완료",
        description: "검수가 완료되었습니다.",
      });

      setIsReviewDialogOpen(false);
      setReviewComment("");
      setSelectedGeneration(null);
      await loadReviewStates();
    } catch (error) {
      console.error("검수 저장 실패:", error);
      toast({
        title: "저장 실패",
        description: "검수 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const getReviewStatusBadge = (generationId: string) => {
    const state = reviewStates.get(generationId);
    if (!state) {
      return <Badge variant="outline" className="bg-gray-500/10 text-gray-500">대기</Badge>;
    }

    switch (state.status) {
      case "approved":
        return <Badge variant="outline" className="bg-green-500/10 text-green-500">승인됨</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-500/10 text-red-500">반려됨</Badge>;
      case "review":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500">검수 중</Badge>;
      default:
        return <Badge variant="outline" className="bg-gray-500/10 text-gray-500">대기</Badge>;
    }
  };

  const generationsWithReview = generations.map((gen) => ({
    ...gen,
    reviewState: reviewStates.get(gen.id || ""),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">승인·컴플라이언스</h1>
          <p className="text-muted-foreground mt-1">
            생성된 음원을 검수하고 승인합니다.
          </p>
        </div>
      </div>

      {/* 검수 대기 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>검수 대기 목록</CardTitle>
          <CardDescription>
            생성된 음원을 검수하고 승인 또는 반려를 결정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {generationsWithReview.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                검수할 항목이 없습니다.
              </p>
            ) : (
              generationsWithReview.map((gen) => (
                <div
                  key={gen.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="font-medium">{gen.savedName || `음원 ${gen.id}`}</p>
                      {getReviewStatusBadge(gen.id || "")}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {gen.purpose} • {gen.voiceName} • {new Date(gen.createdAt || "").toLocaleDateString()}
                    </p>
                    {gen.reviewState?.comments && (
                      <p className="text-xs text-muted-foreground mt-1">
                        검수 의견: {gen.reviewState.comments}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {(!gen.reviewState || gen.reviewState.status === "draft") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedGeneration(gen.id || null);
                          setIsReviewDialogOpen(true);
                        }}
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        검수
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* 검수 다이얼로그 */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>검수</DialogTitle>
            <DialogDescription>
              음원을 검수하고 승인 또는 반려를 결정합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>검수 의견 (선택사항)</Label>
              <Textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="검수 의견을 입력하세요..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setIsReviewDialogOpen(false);
                setReviewComment("");
              }}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => selectedGeneration && handleReview(selectedGeneration, "rejected")}
            >
              <XCircle className="w-4 h-4 mr-2" />
              반려
            </Button>
            <Button
              className="flex-1"
              onClick={() => selectedGeneration && handleReview(selectedGeneration, "approved")}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              승인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
