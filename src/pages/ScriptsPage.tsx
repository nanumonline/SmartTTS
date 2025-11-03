import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, FileText, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import * as dbService from "@/services/dbService";
import { formatDate, purposeOptions } from "@/lib/pageUtils";
import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";

export default function ScriptsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [scripts, setScripts] = useState<any[]>([]);

  useEffect(() => {
    if (user?.id) {
      loadScripts();
    }
  }, [user?.id]);

  const loadScripts = async () => {
    if (!user?.id) return;
    try {
      const messages = await dbService.loadMessages(user.id);
      setScripts(messages.map(msg => ({
        id: msg.id,
        text: msg.text,
        purpose: msg.purpose,
        createdAt: msg.createdAt,
      })));
    } catch (error) {
      console.error("문구 로드 실패:", error);
    }
  };

  const filteredScripts = scripts.filter((script) =>
    script.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPurposeLabel = (purposeId: string) => {
    return purposeOptions.find(p => p.id === purposeId)?.label || purposeId;
  };

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
        {/* 검색 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="문구 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* 문구 목록 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredScripts.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <FileText className="w-16 h-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">저장된 문구가 없습니다.</p>
                <Button onClick={() => navigate("/scripts/messages")} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  첫 문구 작성하기
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredScripts.map((script) => (
              <Card 
                key={script.id} 
                className="hover:shadow-lg transition-all"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <Badge variant="outline">{getPurposeLabel(script.purpose)}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(script.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm line-clamp-4 text-foreground mb-4">
                    {script.text}
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="default"
                      className="flex-1"
                      onClick={() => navigate(`/audio/tts?loadMessage=${script.id}`)}
                    >
                      음원 생성하기
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => navigate(`/scripts/messages?edit=${script.id}`)}
                    >
                      편집
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </PageContainer>
  );
}
