import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, FileText, Edit, Trash2, Copy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import * as dbService from "@/services/dbService";

interface Template {
  id: string;
  name: string;
  text: string;
  purpose: string;
  variables: string[];
  createdAt: string;
}

export default function ScriptsTemplatesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    text: "",
    purpose: "announcement",
  });

  useEffect(() => {
    if (user?.id) {
      loadTemplates();
    }
  }, [user?.id]);

  const loadTemplates = async () => {
    if (!user?.id) return;
    try {
      // 템플릿은 메시지 이력에서 변수를 포함한 텍스트를 기반으로 생성 가능
      const messages = await dbService.loadMessages(user.id);
      const templateList: Template[] = messages
        .filter((msg) => {
          // {변수} 패턴이 있는 메시지만 템플릿으로 인식
          return /\{[^}]+\}/.test(msg.text);
        })
        .map((msg, index) => {
          const variables = (msg.text.match(/\{([^}]+)\}/g) || []).map((v) =>
            v.replace(/[{}]/g, "")
          );
          return {
            id: `template_${msg.id || index}`,
            name: `템플릿 ${index + 1}`,
            text: msg.text,
            purpose: msg.purpose,
            variables,
            createdAt: msg.createdAt || new Date().toISOString(),
          };
        });

      setTemplates(templateList);
    } catch (error) {
      console.error("템플릿 로드 실패:", error);
    }
  };

  const handleCreateTemplate = () => {
    if (!newTemplate.name.trim() || !newTemplate.text.trim()) {
      toast({
        title: "입력 필요",
        description: "템플릿 이름과 내용을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    const variables = (newTemplate.text.match(/\{([^}]+)\}/g) || []).map((v) =>
      v.replace(/[{}]/g, "")
    );

    const template: Template = {
      id: `template_${Date.now()}`,
      name: newTemplate.name,
      text: newTemplate.text,
      purpose: newTemplate.purpose,
      variables,
      createdAt: new Date().toISOString(),
    };

    setTemplates([...templates, template]);
    setIsCreateDialogOpen(false);
    setNewTemplate({ name: "", text: "", purpose: "announcement" });

    toast({
      title: "템플릿 생성 완료",
      description: "새 템플릿이 생성되었습니다.",
    });
  };

  const handleDeleteTemplate = (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    setTemplates(templates.filter((t) => t.id !== id));
    toast({
      title: "삭제 완료",
      description: "템플릿이 삭제되었습니다.",
    });
  };

  const handleCopyTemplate = (template: Template) => {
    navigator.clipboard.writeText(template.text);
    toast({
      title: "복사 완료",
      description: "템플릿이 클립보드에 복사되었습니다.",
    });
  };

  const purposes = [
    { value: "announcement", label: "공지사항" },
    { value: "emergency", label: "긴급 안내" },
    { value: "weather", label: "날씨" },
    { value: "news", label: "뉴스" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">템플릿</h1>
          <p className="text-muted-foreground mt-1">
            자주 사용하는 문구 템플릿을 관리합니다.
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          새 템플릿
        </Button>
      </div>

      {/* 템플릿 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">등록된 템플릿이 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          templates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{template.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Badge variant="outline">{template.purpose}</Badge>
                      {template.variables.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {template.variables.length}개 변수
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => handleCopyTemplate(template)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteTemplate(template.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {template.text}
                </p>
                {template.variables.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {template.variables.map((varName) => (
                      <Badge key={varName} variant="secondary" className="text-xs">
                        {`{${varName}}`}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 템플릿 생성 다이얼로그 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>새 템플릿 생성</DialogTitle>
            <DialogDescription>
              자주 사용하는 문구를 템플릿으로 저장합니다. 변수는 {`{변수명}`} 형식으로 사용하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>템플릿 이름 *</Label>
              <Input
                value={newTemplate.name}
                onChange={(e) =>
                  setNewTemplate({ ...newTemplate, name: e.target.value })
                }
                placeholder="예: 신년 인사말"
              />
            </div>
            <div className="space-y-2">
              <Label>용도</Label>
              <select
                value={newTemplate.purpose}
                onChange={(e) =>
                  setNewTemplate({ ...newTemplate, purpose: e.target.value })
                }
                className="w-full px-3 py-2 border border-input bg-background rounded-md"
              >
                {purposes.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>템플릿 내용 *</Label>
              <Textarea
                value={newTemplate.text}
                onChange={(e) =>
                  setNewTemplate({ ...newTemplate, text: e.target.value })
                }
                placeholder="예: {기관명}에서 {내용}을 안내드립니다..."
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                변수는 {`{변수명}`} 형식으로 사용하세요. 예: {`{기관명}`, `{담당자명}`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleCreateTemplate}>생성</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
