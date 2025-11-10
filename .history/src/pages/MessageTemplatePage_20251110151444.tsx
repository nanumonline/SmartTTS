import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, Edit, Trash2, Copy, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import * as dbService from "@/services/dbService";
import { correctKoreanPostpositions } from "@/lib/koreanPostposition";
import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";

export default function MessageTemplatePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<dbService.TemplateEntry[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<dbService.TemplateEntry | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [selectedTemplate, setSelectedTemplate] = useState<dbService.TemplateEntry | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [resolvedText, setResolvedText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    text: "",
    purpose: "announcement",
    category: "greeting",
  });

  useEffect(() => {
    if (user?.id) {
      loadTemplates();
    }
  }, [user?.id, selectedCategory]);

  const loadTemplates = async () => {
    if (!user?.id) return;
    try {
      const category = selectedCategory === "all" ? undefined : selectedCategory;
      const data = await dbService.loadTemplates(user.id, category);
      setTemplates(data);
      
      // 템플릿이 없으면 초기 템플릿 생성
      if (data.length === 0 && selectedCategory === "all") {
        await createInitialTemplates();
        await loadTemplates(); // 재로드
      }
    } catch (error) {
      console.error("템플릿 로드 실패:", error);
    }
  };

  const createInitialTemplates = async () => {
    if (!user?.id) return;
    
    const initialTemplates = [
      {
        text: "안녕하세요. {기관명}입니다. {날짜} {내용}을 안내드립니다.",
        purpose: "greeting",
        templateName: "기본 인사말",
        templateCategory: "greeting",
      },
      {
        text: "{기관명}에서 {내용}을 안내드립니다. 자세한 사항은 {연락처}로 문의해주시기 바랍니다.",
        purpose: "announcement",
        templateName: "기본 안내방송",
        templateCategory: "announcement",
      },
      {
        text: "{기관명}의 {정책명} 정책에 대해 안내드립니다. {내용}",
        purpose: "policy",
        templateName: "기본 정책안내",
        templateCategory: "policy",
      },
    ];

    for (const template of initialTemplates) {
      await dbService.saveTemplate(user.id, {
        ...template,
        isTemplate: true,
      } as dbService.TemplateEntry);
    }
    
    toast({
      title: "초기 템플릿 생성 완료",
      description: "기본 템플릿이 생성되었습니다.",
    });
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.name.trim() || !newTemplate.text.trim()) {
      toast({
        title: "입력 필요",
        description: "템플릿 이름과 내용을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "로그인 필요",
        description: "템플릿을 생성하려면 로그인이 필요합니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      const templateEntry: dbService.TemplateEntry = {
        text: newTemplate.text,
        purpose: newTemplate.purpose,
        isTemplate: true,
        templateName: newTemplate.name,
        templateCategory: newTemplate.category,
      };

      await dbService.saveTemplate(user.id, templateEntry);
      
      setIsCreateDialogOpen(false);
      setNewTemplate({ name: "", text: "", purpose: "announcement", category: "greeting" });
      
      await loadTemplates();

      toast({
        title: "템플릿 생성 완료",
        description: "새 템플릿이 생성되었습니다.",
      });
    } catch (error) {
      console.error("템플릿 생성 실패:", error);
      toast({
        title: "템플릿 생성 실패",
        description: "템플릿 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    setDeleteDialog({ open: true, id });
  };

  const confirmDeleteTemplate = async () => {
    if (!user?.id || !deleteDialog.id) return;
    
    try {
      await dbService.deleteTemplate(user.id, deleteDialog.id);
      await loadTemplates();
      if (selectedTemplate?.id === deleteDialog.id) {
        setSelectedTemplate(null);
        setTemplateVariables({});
        setResolvedText("");
      }
      setDeleteDialog({ open: false, id: null });
      toast({
        title: "삭제 완료",
        description: "템플릿이 삭제되었습니다.",
      });
    } catch (error) {
      console.error("템플릿 삭제 실패:", error);
      toast({
        title: "삭제 실패",
        description: "템플릿 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleEditTemplate = (template: dbService.TemplateEntry) => {
    setEditingTemplate({ ...template });
    setIsEditDialogOpen(true);
  };

  const handleSaveEditTemplate = async () => {
    if (!user?.id || !editingTemplate || !editingTemplate.id) return;
    
    if (!editingTemplate.templateName?.trim() || !editingTemplate.text.trim()) {
      toast({
        title: "입력 필요",
        description: "템플릿 이름과 내용을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      await dbService.updateTemplate(user.id, editingTemplate.id, {
        text: editingTemplate.text,
        purpose: editingTemplate.purpose,
        templateName: editingTemplate.templateName,
        templateCategory: editingTemplate.templateCategory,
      });
      
      setIsEditDialogOpen(false);
      setEditingTemplate(null);
      await loadTemplates();
      
      // 편집된 템플릿이 선택되어 있으면 업데이트
      if (selectedTemplate?.id === editingTemplate.id) {
        const updated = templates.find(t => t.id === editingTemplate.id);
        if (updated) {
          setSelectedTemplate(updated);
        }
      }
      
      toast({
        title: "템플릿 수정 완료",
        description: "템플릿이 수정되었습니다.",
      });
    } catch (error) {
      console.error("템플릿 수정 실패:", error);
      toast({
        title: "템플릿 수정 실패",
        description: "템플릿 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleApplyTemplate = (template: dbService.TemplateEntry) => {
    setSelectedTemplate(template);
    // 변수 초기화
    const vars: Record<string, string> = {};
    (template.variables || []).forEach((v) => {
      vars[v] = "";
    });
    setTemplateVariables(vars);
    // 텍스트에 변수 적용 (초기에는 변수명 그대로 표시)
    setResolvedText(template.text);
  };

  const handleVariableChange = (varName: string, value: string) => {
    const updated = { ...templateVariables, [varName]: value };
    setTemplateVariables(updated);

    if (!selectedTemplate) return;

    // 변수 교체 (한국어 조사 교정 포함)
    let resolved = selectedTemplate.text;
    Object.keys(updated).forEach((key) => {
      const regex = new RegExp(`\\{${key}\\}`, "g");
      resolved = resolved.replace(regex, updated[key] || `{${key}}`);
    });

    // 한국어 조사 교정
    const corrected = correctKoreanPostpositions(resolved);
    setResolvedText(corrected);
  };

  const handleUpdateTemplate = async (id: string) => {
    if (!user?.id || !selectedTemplate) return;
    
    try {
      await dbService.updateTemplate(user.id, id, {
        text: selectedTemplate.text,
        purpose: selectedTemplate.purpose,
        templateName: selectedTemplate.templateName,
        templateCategory: selectedTemplate.templateCategory,
      });
      
      await loadTemplates();
      
      toast({
        title: "템플릿 업데이트 완료",
        description: "템플릿이 업데이트되었습니다.",
      });
    } catch (error) {
      console.error("템플릿 업데이트 실패:", error);
      toast({
        title: "템플릿 업데이트 실패",
        description: "템플릿 업데이트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleCopyResolved = () => {
    if (!resolvedText) {
      toast({
        title: "복사할 내용 없음",
        description: "변수를 먼저 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    navigator.clipboard.writeText(resolvedText);
    toast({
      title: "복사 완료",
      description: "변수가 적용된 텍스트가 클립보드에 복사되었습니다.",
    });
  };

  const purposes = [
    { value: "announcement", label: "안내방송" },
    { value: "emergency", label: "긴급 안내" },
    { value: "greeting", label: "인사말" },
    { value: "policy", label: "정책안내" },
  ];

  const categories = [
    { value: "all", label: "전체" },
    { value: "greeting", label: "인사말" },
    { value: "announcement", label: "안내방송" },
    { value: "policy", label: "정책안내" },
  ];

  // 카테고리별 예시 템플릿 텍스트
  const getTemplateExample = (category: string): string => {
    const examples: Record<string, string> = {
      greeting: "안녕하세요. {기관명}입니다. {날짜} {내용}을 안내드립니다. 시민 여러분의 건강과 행복을 기원합니다. 감사합니다.",
      announcement: "{기관명}에서 {내용}을 안내드립니다. 자세한 사항은 {연락처}로 문의해주시기 바랍니다. 많은 관심과 참여 부탁드립니다.",
      policy: "{기관명}의 {정책명} 정책에 대해 안내드립니다. {내용}으로 운영되며, {적용대상}에게 혜택이 제공됩니다. 자세한 사항은 {연락처}로 문의해주시기 바랍니다.",
    };
    return examples[category] || "{기관명}에서 {내용}을 안내드립니다.";
  };


  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        title="메시지 템플릿"
        description="자주 사용하는 문구 템플릿을 관리하고 변수를 적용합니다"
        icon={FileText}
        action={{
          label: "새 템플릿",
          onClick: () => {
            setNewTemplate({
              name: "",
              text: getTemplateExample("greeting"), // 기본 카테고리 예시 텍스트 자동 입력
              purpose: "announcement",
              category: "greeting",
            });
            setIsCreateDialogOpen(true);
          },
          icon: Plus,
        }}
      />

      <div className="space-y-6">
        {/* 카테고리 필터 */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">카테고리:</span>
          {categories.map((cat) => (
            <Button
              key={cat.value}
              variant={selectedCategory === cat.value ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.value)}
            >
              {cat.label}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 템플릿 목록 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              템플릿 목록 ({templates.length}개)
            </CardTitle>
            <CardDescription>
              저장된 템플릿을 선택하여 변수를 적용합니다. TTS 생성 페이지에서도 사용됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {templates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                등록된 템플릿이 없습니다.
                <br />
                <Button
                  variant="link"
                  className="mt-2"
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  첫 템플릿 만들기
                </Button>
              </div>
            ) : (
              templates.map((template) => (
                <div
                  key={template.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedTemplate?.id === template.id
                      ? "border-primary bg-primary/10"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => handleApplyTemplate(template)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium">{template.templateName}</h3>
                        <Badge variant="outline">{template.templateCategory}</Badge>
                        <Badge variant="secondary" className="text-xs">{template.purpose}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {template.text}
                      </p>
                      {(template.variables || []).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(template.variables || []).map((varName) => (
                            <Badge key={varName} variant="secondary" className="text-xs">
                              {`{${varName}}`}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (template.id) handleEditTemplate(template);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (template.id) handleDeleteTemplate(template.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* 변수 입력 및 결과 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              변수 적용
            </CardTitle>
            <CardDescription>
              선택한 템플릿에 변수를 입력하여 완성된 메시지를 생성합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedTemplate ? (
              <div className="text-center py-12 text-muted-foreground">
                템플릿을 선택해주세요.
              </div>
            ) : (
              <>
                <div className="p-3 bg-muted rounded-lg">
                  <Label className="text-xs text-muted-foreground mb-2 block">템플릿 원문</Label>
                  <p className="text-sm">{selectedTemplate.text}</p>
                </div>

                <div className="space-y-3">
                  <Label>변수 입력</Label>
                  {(selectedTemplate.variables || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">이 템플릿에는 변수가 없습니다.</p>
                  ) : (
                    (selectedTemplate.variables || []).map((varName) => {
                      const isRequired = ["기관명", "담당자명", "부서명"].includes(varName);
                      return (
                        <div key={varName} className="space-y-1">
                          <Label htmlFor={`var-${varName}`} className="text-sm">
                            {varName} {isRequired && <span className="text-red-500">*</span>}
                          </Label>
                          <Input
                            id={`var-${varName}`}
                            value={templateVariables[varName] || ""}
                            onChange={(e) => handleVariableChange(varName, e.target.value)}
                            placeholder={`예: ${varName === "기관명" ? "강원특별자치도청" : varName === "담당자명" ? "김철수" : ""}`}
                          />
                        </div>
                      );
                    })
                  )}
                </div>

                {resolvedText && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>적용된 메시지</Label>
                      <Button variant="ghost" size="sm" onClick={handleCopyResolved}>
                        <Copy className="w-4 h-4 mr-2" />
                        복사
                      </Button>
                    </div>
                    <Textarea
                      value={resolvedText}
                      readOnly
                      className="min-h-[150px] bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      💡 변수를 모두 입력하면 자동으로 조사가 교정됩니다.
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
        </div>
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
              <Label>카테고리 *</Label>
              <Select
                value={newTemplate.category}
                onValueChange={(value) => {
                  const exampleText = getTemplateExample(value);
                  setNewTemplate({ 
                    ...newTemplate, 
                    category: value,
                    // 텍스트가 비어있거나 기본 예시 텍스트인 경우에만 자동 입력
                    text: (!newTemplate.text.trim() || newTemplate.text === getTemplateExample(newTemplate.category)) 
                      ? exampleText 
                      : newTemplate.text,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.filter(c => c.value !== "all").map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>용도</Label>
              <Select
                value={newTemplate.purpose}
                onValueChange={(value) =>
                  setNewTemplate({ ...newTemplate, purpose: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {purposes.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                변수는 {"{변수명}"} 형식으로 사용하세요. 예: {"{기관명}, {담당자명}"}
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

      {/* 템플릿 편집 다이얼로그 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>템플릿 수정</DialogTitle>
            <DialogDescription>
              템플릿 내용을 수정합니다. 변수는 {`{변수명}`} 형식으로 사용하세요.
            </DialogDescription>
          </DialogHeader>
          {editingTemplate && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>템플릿 이름 *</Label>
                <Input
                  value={editingTemplate.templateName || ""}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate, templateName: e.target.value })
                  }
                  placeholder="예: 신년 인사말"
                />
              </div>
              <div className="space-y-2">
                <Label>카테고리 *</Label>
                <Select
                  value={editingTemplate.templateCategory || "greeting"}
                  onValueChange={(value) => {
                    const exampleText = getTemplateExample(value);
                    const currentExample = getTemplateExample(editingTemplate.templateCategory || "greeting");
                    setEditingTemplate({ 
                      ...editingTemplate, 
                      templateCategory: value,
                      // 텍스트가 비어있거나 현재 카테고리의 예시 텍스트인 경우에만 자동 입력
                      text: (!editingTemplate.text.trim() || editingTemplate.text === currentExample) 
                        ? exampleText 
                        : editingTemplate.text,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.filter(c => c.value !== "all").map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>용도</Label>
                <Select
                  value={editingTemplate.purpose || "announcement"}
                  onValueChange={(value) =>
                    setEditingTemplate({ ...editingTemplate, purpose: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {purposes.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>템플릿 내용 *</Label>
                <Textarea
                  value={editingTemplate.text}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate, text: e.target.value })
                  }
                  placeholder="예: {기관명}에서 {내용}을 안내드립니다..."
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  변수는 {"{변수명}"} 형식으로 사용하세요. 예: {"{기관명}, {담당자명}"}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false);
              setEditingTemplate(null);
            }}>
              취소
            </Button>
            <Button onClick={handleSaveEditTemplate}>수정</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, id: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>템플릿 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말 이 템플릿을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTemplate}
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
