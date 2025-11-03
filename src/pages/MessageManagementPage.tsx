import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, 
  Edit, 
  Trash2, 
  History, 
  Plus,
  Save,
  MessageSquare,
  Sparkles
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import * as dbService from "@/services/dbService";
import { supabase } from "@/integrations/supabase/client";
import { correctKoreanPostpositions } from "@/lib/koreanPostposition";
import { formatDateTime, purposeOptions, getPurposeMeta } from "@/lib/pageUtils";
import { removeMarkdown } from "@/lib/textUtils";
import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";
import { useNavigate } from "react-router-dom";

// 텍스트를 300자 단위로 분할 (문장 단위로 분할하여 자연스럽게)
const splitTextIntoChunks = (text: string, maxLength: number = 300): string[] => {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return [trimmed];
  }

  const chunks: string[] = [];
  const sentences = trimmed.split(/([.!?。！？\n]+)/);
  let currentChunk = "";

  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i] + (sentences[i + 1] || "");
    const testChunk = currentChunk + sentence;

    if (testChunk.length <= maxLength) {
      currentChunk = testChunk;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      // 현재 문장이 maxLength보다 크면 강제로 자름
      if (sentence.length > maxLength) {
        let remaining = sentence;
        while (remaining.length > maxLength) {
          chunks.push(remaining.substring(0, maxLength).trim());
          remaining = remaining.substring(maxLength);
        }
        currentChunk = remaining;
      } else {
        currentChunk = sentence;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
};

export default function MessageManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  // 목적 설정은 TTS 생성 페이지에서 관리하고, DB에서 가져옴
  const [selectedPurpose, setSelectedPurpose] = useState<string>("announcement");
  const [messageHistory, setMessageHistory] = useState<Array<{ id: string; text: string; purpose: string; createdAt: string; updatedAt: string }>>([]);
  const [customText, setCustomText] = useState("");
  const [isMessageHistoryOpen, setIsMessageHistoryOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [filterPurpose, setFilterPurpose] = useState<string>("all"); // 목적 필터
  const [showMessageList, setShowMessageList] = useState(true); // 메시지 목록 표시 여부
  
  // OpenAI 관련
  const [openAIPrompt, setOpenAIPrompt] = useState("");
  const [openAIInstruction, setOpenAIInstruction] = useState("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiMode, setAiMode] = useState<"generate" | "edit">("generate");

  useEffect(() => {
    if (user?.id) {
      loadMessages();
      // DB에서 저장된 목적 설정 로드
      dbService.loadUserSettings(user.id).then((settings) => {
        if (settings?.selectedPurpose) {
          setSelectedPurpose(settings.selectedPurpose);
        }
      }).catch(err => console.error("설정 로드 실패:", err));
    }
  }, [user?.id]);

  const loadMessages = async () => {
    if (!user?.id) return;
    try {
      const messages = await dbService.loadMessages(user.id);
      setMessageHistory(messages.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()));
    } catch (error) {
      console.error("메시지 로드 실패:", error);
    }
  };

  const generateWithOpenAI = async (prompt: string): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke("openai-text-generation", {
        body: {
          type: "generate",
          prompt,
          organization: user?.organization,
          department: user?.department,
        },
      });
      if (error) throw error;
      if (!data?.text) throw new Error("생성된 텍스트가 없습니다.");
      // 마크다운 기호 제거
      return removeMarkdown(data.text);
    } catch (error: any) {
      console.error("OpenAI 생성 실패:", error);
      throw new Error(error?.message || "OpenAI 텍스트 생성 중 오류가 발생했습니다.");
    }
  };

  const editWithOpenAI = async (text: string, instruction: string): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke("openai-text-generation", {
        body: {
          type: "edit",
          original: text,
          instruction,
        },
      });
      if (error) throw error;
      if (!data?.text) throw new Error("수정된 텍스트가 없습니다.");
      // 마크다운 기호 제거
      return removeMarkdown(data.text);
    } catch (error: any) {
      console.error("OpenAI 수정 실패:", error);
      throw new Error(error?.message || "OpenAI 텍스트 수정 중 오류가 발생했습니다.");
    }
  };

  const handleSaveMessage = async () => {
    if (!customText.trim()) {
      toast({
        title: "입력 필요",
        description: "메시지 내용을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      let messageId: string;
      if (editingMessageId) {
        // 수정
        if (user?.id) {
          await dbService.updateMessage(user.id, editingMessageId, customText);
        }
        const updated = messageHistory.map((m) =>
          m.id === editingMessageId
            ? { ...m, text: customText, updatedAt: new Date().toISOString() }
            : m
        );
        setMessageHistory(updated);
        toast({
          title: "수정 완료",
          description: "메시지가 수정되었습니다.",
        });
      } else {
        // 새로 저장
        if (user?.id) {
          const dbId = await dbService.saveMessage(user.id, {
            text: customText,
            purpose: selectedPurpose,
          });
          messageId = dbId || `msg_${Date.now()}`;
        } else {
          messageId = `msg_${Date.now()}`;
        }

        const newMessage = {
          id: messageId,
          text: customText,
          purpose: selectedPurpose,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setMessageHistory([newMessage, ...messageHistory]);
        toast({
          title: "저장 완료",
          description: "메시지가 저장되었습니다.",
        });
      }

      setIsEditing(false);
      setEditingMessageId(null);
      setCustomText("");
    } catch (error) {
      console.error("메시지 저장 실패:", error);
      toast({
        title: "저장 실패",
        description: "메시지 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMessage = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      if (user?.id) {
        await dbService.deleteMessage(user.id, id);
      }
      const updated = messageHistory.filter((m) => m.id !== id);
      setMessageHistory(updated);
      toast({
        title: "삭제 완료",
        description: "메시지가 삭제되었습니다.",
      });
    } catch (error) {
      console.error("메시지 삭제 실패:", error);
      toast({
        title: "삭제 실패",
        description: "메시지 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleLoadMessage = (msg: typeof messageHistory[0]) => {
    setCustomText(msg.text);
    setSelectedPurpose(msg.purpose);
    setIsEditing(true);
    setEditingMessageId(msg.id);
    setIsMessageHistoryOpen(false);
    toast({
      title: "메시지 불러오기 완료",
      description: "메시지가 편집 영역에 로드되었습니다.",
    });
  };

  const purposeMeta = getPurposeMeta(selectedPurpose);

  // 필터링된 메시지 목록
  const filteredMessages = messageHistory.filter((msg) => 
    filterPurpose === "all" || msg.purpose === filterPurpose
  );

  // 목적별 그룹화
  const messagesByPurpose = purposeOptions.reduce((acc, option) => {
    acc[option.id] = filteredMessages.filter((msg) => msg.purpose === option.id);
    return acc;
  }, {} as Record<string, typeof messageHistory>);

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        title="문구 관리"
        description="메시지를 작성, 저장하고 음원 생성 시 불러올 수 있습니다"
        icon={MessageSquare}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 메시지 작성 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 목적 선택 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">문구 목적 설정</CardTitle>
              <CardDescription>
                방송 목적을 선택하세요. 선택한 목적은 음원 생성 페이지와 동기화됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Select
                  value={selectedPurpose}
                  onValueChange={async (value) => {
                    setSelectedPurpose(value);
                    // DB에 저장
                    if (user?.id) {
                      try {
                        await dbService.saveUserSettings(user.id, { selectedPurpose: value });
                        toast({
                          title: "목적 변경 완료",
                          description: "목적이 저장되었습니다.",
                        });
                      } catch (error) {
                        console.error("목적 저장 실패:", error);
                      }
                    }
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {purposeOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="default" className="text-sm px-3 py-1">
                  {purposeMeta?.label || "안내방송"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {purposeMeta?.description || ""}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 검수 체크리스트 및 프롬프트 가이드 */}
          {(purposeMeta?.checklist || purposeMeta?.optimizedPrompt) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">검수 체크리스트 및 프롬프트 가이드</CardTitle>
                <CardDescription>
                  선택된 목적에 맞는 검수 체크리스트와 최적 프롬프트를 확인하세요.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-dashed p-4 bg-muted/30">
                  <Accordion type="multiple" defaultValue={["checklist", "prompt"]}>
                    {purposeMeta.checklist && (
                      <AccordionItem value="checklist" className="border-none">
                        <AccordionTrigger className="text-sm font-semibold">
                          검수 체크리스트
                        </AccordionTrigger>
                        <AccordionContent>
                          <ul className="space-y-1 text-xs text-muted-foreground">
                            {purposeMeta.checklist.map((item, idx) => (
                              <li key={idx}>• {item}</li>
                            ))}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    )}
                    {purposeMeta.optimizedPrompt && (
                      <AccordionItem value="prompt" className="border-none">
                        <AccordionTrigger className="text-sm font-semibold">
                          최적 프롬프트 가이드
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">{purposeMeta.optimizedPrompt}</p>
                            <p className="text-[10px] text-muted-foreground/70 italic">
                              💡 작성 중인 메시지를 보강하는 지침으로 사용됩니다.
                            </p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => {
                                // 메시지 내용은 유지하고, 지침에만 추가
                                const currentInstruction = openAIInstruction.trim();
                                const newGuide = purposeMeta.optimizedPrompt || "";
                                
                                if (aiMode === "edit") {
                                  // 수정 모드: 기존 지침 뒤에 추가 (구분자 포함)
                                  if (currentInstruction) {
                                    setOpenAIInstruction(`${currentInstruction}\n\n[추가 지침] ${newGuide}`);
                                  } else {
                                    setOpenAIInstruction(newGuide);
                                  }
                                  toast({
                                    title: "지침 추가 완료",
                                    description: "수정 지침에 프롬프트 가이드가 추가되었습니다.",
                                  });
                                } else {
                                  // 작성 모드: 사용자에게 안내
                                  toast({
                                    title: "지침 추가 안내",
                                    description: "메시지 작성 후 '수정' 탭에서 지침으로 사용할 수 있습니다.",
                                    variant: "default",
                                  });
                                }
                              }}
                            >
                              지침으로 추가
                            </Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )}
                  </Accordion>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 메시지 작성 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                메시지 작성
              </CardTitle>
              <CardDescription>
                직접 작성하거나 OpenAI를 활용하여 메시지를 생성합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Tabs defaultValue="manual" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="manual">직접 작성</TabsTrigger>
                  <TabsTrigger value="ai-assist">OpenAI 작성</TabsTrigger>
                </TabsList>

                <TabsContent value="manual" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>메시지 내용 *</Label>
                    <Textarea
                      placeholder="메시지를 입력하세요..."
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      className="min-h-[200px]"
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{customText.length}자</span>
                      <div className="flex items-center gap-2">
                        {customText.trim() && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // 먼저 마크다운 제거
                              let cleaned = removeMarkdown(customText);
                              // 조사 교정
                              const corrected = correctKoreanPostpositions(cleaned);
                              if (corrected !== customText) {
                                setCustomText(corrected);
                                toast({
                                  title: "조사 교정 완료",
                                  description: "마크다운 기호 제거 및 한국어 조사가 자동으로 교정되었습니다.",
                                });
                              } else if (cleaned !== customText) {
                                // 마크다운만 제거된 경우
                                setCustomText(cleaned);
                                toast({
                                  title: "마크다운 제거 완료",
                                  description: "마크다운 기호가 제거되었습니다.",
                                });
                              }
                            }}
                          >
                            조사 교정
                          </Button>
                        )}
                        {customText.length > 300 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              // 300자 초과 처리 다이얼로그
                              const choice = window.confirm(
                                `현재 ${customText.length}자입니다.\n\n` +
                                `확인: 300자 이내로 축약 (AI 활용)\n` +
                                `취소: 300자 단위로 자동 분리`
                              );
                              
                              if (choice) {
                                // 300자 이내로 축약
                                try {
                                  setIsLoadingAI(true);
                                  const out = await editWithOpenAI(
                                    customText,
                                    `300자 이내로 간결하게 축약하세요. 핵심 내용은 유지하되 불필요한 설명은 생략하세요.`
                                  );
                                  setCustomText(out);
                                  toast({
                                    title: "축약 완료",
                                    description: `문구가 ${out.length}자로 축약되었습니다.`,
                                  });
                                } catch (e: any) {
                                  toast({
                                    title: "축약 실패",
                                    description: e?.message || "문구 축약 중 오류가 발생했습니다.",
                                    variant: "destructive",
                                  });
                                } finally {
                                  setIsLoadingAI(false);
                                }
                              } else {
                                // 300자 단위로 분리
                                const chunks = splitTextIntoChunks(customText, 300);
                                if (chunks.length > 1) {
                                  const combined = chunks.map((chunk, idx) => 
                                    `[${idx + 1}]\n${chunk}`
                                  ).join('\n\n');
                                  setCustomText(combined);
                                  toast({
                                    title: "분리 완료",
                                    description: `${chunks.length}개로 분리되었습니다.`,
                                  });
                                }
                              }
                            }}
                            disabled={isLoadingAI}
                          >
                            {customText.length}자 → 처리
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="ai-assist" className="space-y-4 mt-4">
                  <div className="flex gap-2">
                    <Button
                      variant={aiMode === "generate" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAiMode("generate")}
                    >
                      작성
                    </Button>
                    <Button
                      variant={aiMode === "edit" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setAiMode("edit")}
                    >
                      수정
                    </Button>
                  </div>

                  {aiMode === "generate" ? (
                    <div className="space-y-2">
                      <Label>요청 내용</Label>
                      <Textarea
                        placeholder="예: 폭염 대비 시민 행동요령을 20초 분량으로 작성"
                        value={openAIPrompt}
                        onChange={(e) => setOpenAIPrompt(e.target.value)}
                      />
                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            setIsLoadingAI(true);
                            const org = user?.organization || "귀 기관";
                            const dept = user?.department || "관계 부서";
                            const purposeLabel = purposeMeta?.label || "공지";
                            const basePrompt = `${org} ${dept} 방송문 (${purposeLabel}): ${openAIPrompt}. ${purposeMeta?.optimizedPrompt || ""}`;
                            const out = await generateWithOpenAI(basePrompt);
                            // 마크다운 제거된 텍스트 적용
                            setCustomText(out);
                            toast({
                              title: "작성 완료",
                              description: "OpenAI로 메시지가 생성되었습니다.",
                            });
                          } catch (e: any) {
                            toast({
                              title: "OpenAI 작성 실패",
                              description: e?.message || "OpenAI 작성 중 오류가 발생했습니다.",
                              variant: "destructive",
                            });
                          } finally {
                            setIsLoadingAI(false);
                          }
                        }}
                        disabled={isLoadingAI || !openAIPrompt.trim()}
                      >
                        {isLoadingAI ? "작성 중..." : "OpenAI로 작성"}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>수정 지침</Label>
                      <Textarea
                        placeholder="예: 20초 분량으로 단문으로 작성하고, 숫자를 명확히 발음할 수 있도록 수정"
                        value={openAIInstruction}
                        onChange={(e) => setOpenAIInstruction(e.target.value)}
                        className="min-h-[100px]"
                      />
                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            if (!customText.trim()) {
                              toast({
                                title: "텍스트 없음",
                                description: "수정할 텍스트를 입력해주세요.",
                                variant: "destructive",
                              });
                              return;
                            }
                            setIsLoadingAI(true);
                            const checklistGuide = purposeMeta?.checklist?.join(", ") || "";
                            const instructionWithChecklist = `${openAIInstruction}. ${purposeMeta?.optimizedPrompt || ""} ${checklistGuide ? `검수 체크리스트: ${checklistGuide}` : ""}`;
                            const out = await editWithOpenAI(customText, instructionWithChecklist);
                            // 마크다운 제거된 텍스트 적용
                            setCustomText(out);
                            toast({
                              title: "수정 완료",
                              description: "OpenAI로 메시지가 수정되었습니다.",
                            });
                          } catch (e: any) {
                            toast({
                              title: "OpenAI 수정 실패",
                              description: e?.message || "OpenAI 수정 중 오류가 발생했습니다.",
                              variant: "destructive",
                            });
                          } finally {
                            setIsLoadingAI(false);
                          }
                        }}
                        disabled={isLoadingAI || !openAIInstruction.trim()}
                      >
                        {isLoadingAI ? "수정 중..." : "OpenAI로 수정"}
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="flex items-center gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCustomText("");
                    setIsEditing(false);
                    setEditingMessageId(null);
                  }}
                >
                  초기화
                </Button>
                <Button onClick={handleSaveMessage} disabled={!customText.trim()}>
                  <Save className="w-4 h-4 mr-2" />
                  {isEditing ? "수정 저장" : "저장"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 오른쪽: 저장된 메시지 목록 */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="w-4 h-4" />
                  저장된 문구 ({filteredMessages.length})
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMessageList(!showMessageList)}
                >
                  {showMessageList ? "접기" : "펼치기"}
                </Button>
              </div>
              <CardDescription className="text-xs mt-2">
                음원 생성 시 불러올 수 있습니다
              </CardDescription>
            </CardHeader>
            {showMessageList && (
              <CardContent className="space-y-4">
                {/* 목적 필터 */}
                <div className="space-y-2">
                  <Label className="text-xs">목적 필터</Label>
                  <Select value={filterPurpose} onValueChange={setFilterPurpose}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">전체 ({messageHistory.length})</SelectItem>
                      {purposeOptions.map((option) => {
                        const count = messageHistory.filter((m) => m.purpose === option.id).length;
                        return (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label} ({count})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {/* 메시지 목록 */}
                <ScrollArea className="h-[calc(100vh-400px)]">
                  {filteredMessages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-xs">
                      저장된 문구가 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filterPurpose === "all" ? (
                        // 목적별 그룹화 표시
                        purposeOptions.map((option) => {
                          const messages = messagesByPurpose[option.id] || [];
                          if (messages.length === 0) return null;
                          return (
                            <div key={option.id} className="space-y-2">
                              <div className="flex items-center gap-2 px-2 py-1 bg-muted/50 rounded">
                                <Badge variant="outline" className="text-xs">
                                  {option.label}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  ({messages.length})
                                </span>
                              </div>
                              {messages.map((msg) => (
                                <Card
                                  key={msg.id}
                                  className="cursor-pointer hover:bg-muted/50 transition-colors p-3"
                                  onClick={() => handleLoadMessage(msg)}
                                >
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] text-muted-foreground">
                                        {formatDateTime(msg.updatedAt || msg.createdAt)}
                                      </span>
                                      <div className="flex gap-1">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleLoadMessage(msg);
                                          }}
                                        >
                                          <Edit className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteMessage(msg.id);
                                          }}
                                        >
                                          <Trash2 className="w-3 h-3 text-red-400" />
                                        </Button>
                                      </div>
                                    </div>
                                    <p className="text-xs line-clamp-3">{msg.text}</p>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          );
                        })
                      ) : (
                        // 선택된 목적만 표시
                        filteredMessages.map((msg) => (
                          <Card
                            key={msg.id}
                            className="cursor-pointer hover:bg-muted/50 transition-colors p-3"
                            onClick={() => handleLoadMessage(msg)}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-muted-foreground">
                                  {formatDateTime(msg.updatedAt || msg.createdAt)}
                                </span>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleLoadMessage(msg);
                                    }}
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteMessage(msg.id);
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3 text-red-400" />
                                  </Button>
                                </div>
                              </div>
                              <p className="text-xs line-clamp-3">{msg.text}</p>
                            </div>
                          </Card>
                        ))
                      )}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
