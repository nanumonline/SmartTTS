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
  Sparkles,
  ChevronDown,
  ChevronUp
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
  const [messageHistory, setMessageHistory] = useState<Array<{ id?: string; text: string; purpose: string; createdAt?: string; updatedAt?: string }>>([]);
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
  const [activeTab, setActiveTab] = useState<"manual" | "ai-assist">("manual");
  
  // 태그 관련
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  
  // 검수 체크리스트 관련
  const [customChecklist, setCustomChecklist] = useState<string[] | null>(null);
  const [editingChecklistItem, setEditingChecklistItem] = useState<number | null>(null);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  
  // 수정 지침 토글 상태
  const [isInstructionOpen, setIsInstructionOpen] = useState(false);
  
  // 선택된 샘플 지침 인덱스 추적
  const [selectedSampleInstructions, setSelectedSampleInstructions] = useState<Set<number>>(new Set());
  
  // 샘플 수정 지침 목록
  const sampleInstructions = [
    "20초 분량으로 단문으로 작성하고, 숫자를 명확히 발음할 수 있도록 수정",
    "격식 있는 톤으로 수정하고, 끝맺음을 공손하게 작성",
    "간결하게 핵심만 전달하도록 축약",
    "TTS 친화적으로 숫자와 단위를 명확히 표기",
    "행동요령을 구체적으로 명시하도록 수정",
    "시간과 장소를 앞부분에 배치하도록 재구성",
    "호흡이 자연스럽도록 문장 길이 조절",
    "반복 안내가 필요한 경우 강조하도록 수정",
    "문의처와 연락 방법을 명확히 안내하도록 추가",
    "긴급 상황에 맞는 톤으로 수정",
  ];
  
  // localStorage 키
  const DRAFT_MESSAGE_KEY = `draft_message_${user?.id || 'anonymous'}`;
  const CUSTOM_CHECKLIST_KEY = `custom_checklist_${user?.id || 'anonymous'}`;

  useEffect(() => {
    if (user?.id) {
      loadMessages();
      // DB에서 저장된 목적 설정 로드
      dbService.loadUserSettings(user.id).then((settings) => {
        if (settings?.selectedPurpose) {
          setSelectedPurpose(settings.selectedPurpose);
        }
      }).catch(err => console.error("설정 로드 실패:", err));
      
      // 저장된 초안 메시지 로드
      loadDraftMessage();
      
      // 저장된 커스텀 체크리스트 로드
      loadCustomChecklist();
    }
  }, [user?.id]);
  
  // 초안 메시지 로드
  const loadDraftMessage = () => {
    try {
      const draft = localStorage.getItem(DRAFT_MESSAGE_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.text) setCustomText(parsed.text);
        if (parsed.openAIPrompt) setOpenAIPrompt(parsed.openAIPrompt);
        if (parsed.openAIInstruction) setOpenAIInstruction(parsed.openAIInstruction);
        if (parsed.tags) setTags(parsed.tags);
        if (parsed.activeTab) setActiveTab(parsed.activeTab);
        if (parsed.selectedPurpose) setSelectedPurpose(parsed.selectedPurpose);
      }
    } catch (error) {
      console.error("초안 메시지 로드 실패:", error);
    }
  };
  
  // 초안 메시지 저장
  const saveDraftMessage = () => {
    try {
      const draft = {
        text: customText,
        openAIPrompt,
        openAIInstruction,
        tags,
        activeTab,
        selectedPurpose,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_MESSAGE_KEY, JSON.stringify(draft));
    } catch (error) {
      console.error("초안 메시지 저장 실패:", error);
    }
  };
  
  // 커스텀 체크리스트 로드
  const loadCustomChecklist = () => {
    try {
      const saved = localStorage.getItem(`${CUSTOM_CHECKLIST_KEY}_${selectedPurpose}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setCustomChecklist(parsed);
      } else {
        setCustomChecklist(null);
      }
    } catch (error) {
      console.error("커스텀 체크리스트 로드 실패:", error);
    }
  };
  
  // 커스텀 체크리스트 저장
  const saveCustomChecklist = (checklist: string[]) => {
    try {
      localStorage.setItem(`${CUSTOM_CHECKLIST_KEY}_${selectedPurpose}`, JSON.stringify(checklist));
      setCustomChecklist(checklist);
    } catch (error) {
      console.error("커스텀 체크리스트 저장 실패:", error);
    }
  };
  
  // 초안 메시지 자동 저장 (디바운스)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customText || openAIPrompt || openAIInstruction) {
        saveDraftMessage();
      }
    }, 1000); // 1초 후 저장
    
    return () => clearTimeout(timer);
  }, [customText, openAIPrompt, openAIInstruction, tags, activeTab, selectedPurpose]);
  
  // 목적 변경 시 커스텀 체크리스트 로드
  useEffect(() => {
    if (user?.id) {
      loadCustomChecklist();
    }
  }, [selectedPurpose, user?.id]);

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
          purposeLabel: purposeMeta?.label,
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
          purposeLabel: purposeMeta?.label,
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

  // 자동 태그 생성 함수
  const generateAutoTags = (text: string): string[] => {
    if (!text.trim()) return [];
    
    const tags: string[] = [];
    const lowerText = text.toLowerCase();
    
    // 공공기관 관련 키워드 패턴
    const keywordPatterns = [
      { keywords: ["긴급", "비상", "재난", "재해", "안전"], tag: "긴급안내" },
      { keywords: ["복지", "수혜", "지원", "혜택", "급여"], tag: "복지" },
      { keywords: ["교통", "도로", "교통정체", "통행", "운행"], tag: "교통" },
      { keywords: ["환경", "대기", "미세먼지", "기후", "에너지"], tag: "환경" },
      { keywords: ["문화", "행사", "축제", "공연", "전시"], tag: "문화행사" },
      { keywords: ["시설", "이용", "운영", "개방", "휴관"], tag: "시설이용" },
      { keywords: ["민원", "신청", "접수", "처리", "서류"], tag: "민원" },
      { keywords: ["보건", "건강", "의료", "검진", "예방"], tag: "보건" },
      { keywords: ["교육", "강좌", "프로그램", "학습", "훈련"], tag: "교육" },
      { keywords: ["정책", "제도", "시행", "변경", "신규"], tag: "정책" },
      { keywords: ["홍보", "캠페인", "안내", "공지", "알림"], tag: "홍보" },
      { keywords: ["인사", "축하", "감사", "축사", "인사말"], tag: "인사말" },
    ];
    
    // 키워드 매칭
    for (const pattern of keywordPatterns) {
      if (pattern.keywords.some(keyword => lowerText.includes(keyword))) {
        if (!tags.includes(pattern.tag)) {
          tags.push(pattern.tag);
        }
        if (tags.length >= 5) break;
      }
    }
    
    // 목적(purpose) 기반 태그 추가
    const purposeTagMap: Record<string, string> = {
      announcement: "안내방송",
      emergency: "긴급안내",
      greeting: "인사말",
      policy: "정책안내",
      event: "행사",
      promotion: "홍보",
      service: "서비스안내",
      welfare: "복지",
      traffic: "교통",
      environment: "환경",
      culture: "문화",
      facility: "시설",
      civil: "민원",
      disaster: "재난",
      celebration: "축하",
      health: "보건",
      education: "교육",
    };
    
    if (selectedPurpose && purposeTagMap[selectedPurpose] && !tags.includes(purposeTagMap[selectedPurpose])) {
      tags.unshift(purposeTagMap[selectedPurpose]);
      if (tags.length > 5) tags.pop();
    }
    
    return tags.slice(0, 5);
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

      // 저장 후 초안 메시지 삭제
      localStorage.removeItem(DRAFT_MESSAGE_KEY);
      
      setIsEditing(false);
      setEditingMessageId(null);
      setCustomText("");
      setOpenAIPrompt("");
      setOpenAIInstruction("");
      setTags([]);
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
  
  // 현재 사용할 체크리스트 (커스텀 또는 기본)
  const currentChecklist = customChecklist || purposeMeta.checklist || [];

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
              <div className="space-y-4">
                {/* 현재 선택된 목적 표시 */}
                <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <Badge variant="default" className="text-sm px-3 py-1">
                    {purposeMeta?.label || "안내방송"}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {purposeMeta?.description || "일반 공지사항 안내"}
                  </span>
                </div>
                
                {/* 목적 카드 그리드 */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {purposeOptions.map((option) => {
                    const isSelected = selectedPurpose === option.id;
                    return (
                      <Card
                        key={option.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          isSelected
                            ? "ring-2 ring-primary bg-primary/5 border-primary"
                            : "hover:border-primary/50"
                        }`}
                        onClick={async () => {
                          setSelectedPurpose(option.id);
                          // DB에 저장
                          if (user?.id) {
                            try {
                              await dbService.saveUserSettings(user.id, { selectedPurpose: option.id });
                              toast({
                                title: "목적 변경 완료",
                                description: `${option.label}이(가) 선택되었습니다.`,
                              });
                            } catch (error) {
                              console.error("목적 저장 실패:", error);
                            }
                          }
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge
                                variant={isSelected ? "default" : "outline"}
                                className="text-xs"
                              >
                                {option.label}
                              </Badge>
                              {isSelected && (
                                <div className="w-2 h-2 bg-primary rounded-full"></div>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {option.description}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
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
                        <div className="flex items-center justify-between">
                          <AccordionTrigger className="text-sm font-semibold">
                            검수 체크리스트
                          </AccordionTrigger>
                          <div className="flex gap-2 mr-2">
                            {customChecklist && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => {
                                  if (confirm("기본 체크리스트로 복원하시겠습니까?")) {
                                    localStorage.removeItem(`${CUSTOM_CHECKLIST_KEY}_${selectedPurpose}`);
                                    setCustomChecklist(null);
                                    toast({
                                      title: "복원 완료",
                                      description: "기본 체크리스트로 복원되었습니다.",
                                    });
                                  }
                                }}
                              >
                                기본으로 복원
                              </Button>
                            )}
                          </div>
                        </div>
                        <AccordionContent>
                          <div className="space-y-2">
                            <ul className="space-y-2 text-xs">
                              {currentChecklist.map((item, idx) => (
                                <li key={idx} className="flex items-center gap-2 group">
                                  <span className="text-muted-foreground flex-1">• {item}</span>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => {
                                        setEditingChecklistItem(idx);
                                        setNewChecklistItem(item);
                                      }}
                                    >
                                      <Edit className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-destructive"
                                      onClick={() => {
                                        if (confirm("이 항목을 삭제하시겠습니까?")) {
                                          const newList = currentChecklist.filter((_, i) => i !== idx);
                                          saveCustomChecklist(newList);
                                          toast({
                                            title: "삭제 완료",
                                            description: "체크리스트 항목이 삭제되었습니다.",
                                          });
                                        }
                                      }}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                            
                            {/* 편집 모드 */}
                            {editingChecklistItem !== null && (
                              <div className="flex gap-2 items-center pt-2 border-t">
                                <Input
                                  value={newChecklistItem}
                                  onChange={(e) => setNewChecklistItem(e.target.value)}
                                  className="flex-1 h-8 text-xs"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      const newList = [...currentChecklist];
                                      newList[editingChecklistItem] = newChecklistItem;
                                      saveCustomChecklist(newList);
                                      setEditingChecklistItem(null);
                                      setNewChecklistItem("");
                                      toast({
                                        title: "수정 완료",
                                        description: "체크리스트 항목이 수정되었습니다.",
                                      });
                                    } else if (e.key === "Escape") {
                                      setEditingChecklistItem(null);
                                      setNewChecklistItem("");
                                    }
                                  }}
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => {
                                    const newList = [...currentChecklist];
                                    newList[editingChecklistItem] = newChecklistItem;
                                    saveCustomChecklist(newList);
                                    setEditingChecklistItem(null);
                                    setNewChecklistItem("");
                                    toast({
                                      title: "수정 완료",
                                      description: "체크리스트 항목이 수정되었습니다.",
                                    });
                                  }}
                                >
                                  저장
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => {
                                    setEditingChecklistItem(null);
                                    setNewChecklistItem("");
                                  }}
                                >
                                  취소
                                </Button>
                              </div>
                            )}
                            
                            {/* 새 항목 추가 */}
                            {editingChecklistItem === null && (
                              <div className="flex gap-2 items-center pt-2 border-t">
                                <Input
                                  placeholder="새 체크리스트 항목 추가"
                                  value={newChecklistItem}
                                  onChange={(e) => setNewChecklistItem(e.target.value)}
                                  className="flex-1 h-8 text-xs"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && newChecklistItem.trim()) {
                                      const newList = [...currentChecklist, newChecklistItem.trim()];
                                      saveCustomChecklist(newList);
                                      setNewChecklistItem("");
                                      toast({
                                        title: "추가 완료",
                                        description: "체크리스트 항목이 추가되었습니다.",
                                      });
                                    }
                                  }}
                                />
                                <Button
                                  size="sm"
                                  className="h-8 text-xs"
                                  onClick={() => {
                                    if (newChecklistItem.trim()) {
                                      const newList = [...currentChecklist, newChecklistItem.trim()];
                                      saveCustomChecklist(newList);
                                      setNewChecklistItem("");
                                      toast({
                                        title: "추가 완료",
                                        description: "체크리스트 항목이 추가되었습니다.",
                                      });
                                    }
                                  }}
                                  disabled={!newChecklistItem.trim()}
                                >
                                  추가
                                </Button>
                              </div>
                            )}
                          </div>
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
                                const newGuide = purposeMeta.optimizedPrompt || "";
                                
                                // OpenAI 작성 탭으로 이동
                                setActiveTab("ai-assist");
                                
                                // 작성 모드: 프롬프트에 지침 추가
                                const currentPrompt = openAIPrompt.trim();
                                if (currentPrompt) {
                                  setOpenAIPrompt(`${currentPrompt}\n\n[추가 지침] ${newGuide}`);
                                } else {
                                  setOpenAIPrompt(newGuide);
                                }
                                
                                toast({
                                  title: "지침 추가 완료",
                                  description: "OpenAI 작성 탭으로 이동하여 지침이 적용되었습니다.",
                                });
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
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "manual" | "ai-assist")} className="w-full">
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
                        onChange={(e) => {
                          setCustomText(e.target.value);
                          // 텍스트 변경 시 자동 태그 생성
                          if (e.target.value.trim()) {
                            const autoTags = generateAutoTags(e.target.value);
                            if (autoTags.length > 0) {
                              setTags(autoTags);
                            }
                          }
                        }}
                        className="min-h-[200px]"
                      />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        글자수: {customText.replace(/\s/g, '').length}자 / 총글자수(공백포함): {customText.length}자
                      </span>
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
                    
                    {/* 태그 입력 */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2 items-center">
                        {tags.map((tag, idx) => (
                          <Badge key={idx} variant="secondary" className="px-2 py-1">
                            {tag}
                            <button
                              onClick={() => setTags(tags.filter((_, i) => i !== idx))}
                              className="ml-2 hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                        <Input
                          placeholder="태그 입력"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && tagInput.trim()) {
                              e.preventDefault();
                              const newTag = tagInput.trim();
                              if (!tags.includes(newTag) && tags.length < 5) {
                                setTags([...tags, newTag]);
                              }
                              setTagInput("");
                            }
                          }}
                          className="w-auto min-w-[150px] flex-1 max-w-[200px]"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        태그 입력 후 엔터 시 자동으로 태그로 구분됩니다. 작성 내용을 기반으로 자동 태그가 설정됩니다.
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="ai-assist" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    {/* 요청 내용 입력 영역 */}
                    <div className="space-y-2">
                      <Label>요청 내용</Label>
                      <Textarea
                        placeholder="예: 폭염 대비 시민 행동요령을 20초 분량으로 작성"
                        value={openAIPrompt}
                        onChange={(e) => setOpenAIPrompt(e.target.value)}
                        className="min-h-[150px]"
                      />
                      {/* 버튼을 텍스트박스 오른쪽 하단에 배치 */}
                      <div className="flex justify-end">
                        <Button
                          variant="default"
                          className="bg-gradient-to-r from-primary to-accent text-white hover:opacity-90"
                            onClick={async () => {
                              try {
                                setIsLoadingAI(true);
                                const org = user?.organization || "귀 기관";
                                const dept = user?.department || "관계 부서";
                                const purposeLabel = purposeMeta?.label || "공지";
                                // 프롬프트 최적화: 간결하게 작성
                                const basePrompt = `${purposeLabel}: ${openAIPrompt}`;
                                const out = await generateWithOpenAI(basePrompt);
                                // 마크다운 제거된 텍스트 적용
                                setCustomText(out);
                                // 생성된 텍스트 기반으로 자동 태그 생성
                                const autoTags = generateAutoTags(out);
                                if (autoTags.length > 0) {
                                  setTags(autoTags);
                                }
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
                    </div>
                    
                    {/* 생성된/수정 가능한 메시지 영역 */}
                    <div className="space-y-2">
                      <Label>메시지 내용 {customText ? "*" : ""}</Label>
                      <Textarea
                        placeholder={customText ? "생성된 메시지를 확인하고 필요시 수정하세요" : "OpenAI로 작성하거나 직접 입력하세요"}
                        value={customText}
                        onChange={(e) => {
                          setCustomText(e.target.value);
                          // 텍스트 변경 시 자동 태그 생성
                          if (e.target.value.trim()) {
                            const autoTags = generateAutoTags(e.target.value);
                            if (autoTags.length > 0) {
                              setTags(autoTags);
                            }
                          }
                        }}
                        className="min-h-[200px]"
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          글자수: {customText.replace(/\s/g, '').length}자 / 총글자수(공백포함): {customText.length}자
                        </span>
                      </div>
                    </div>
                    
                    {/* 수정 지침 영역 - 메시지가 있을 때만 표시 */}
                    {customText && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs -ml-2"
                            onClick={() => setIsInstructionOpen(!isInstructionOpen)}
                          >
                            {isInstructionOpen ? (
                              <>
                                <ChevronUp className="w-4 h-4 mr-1" />
                                수정 지침 숨기기
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-4 h-4 mr-1" />
                                수정 지침 보기
                              </>
                            )}
                          </Button>
                          {isInstructionOpen && (
                            <Select
                              value=""
                              onValueChange={(value) => {
                                if (value && value !== "") {
                                  const selectedInstruction = sampleInstructions.find((_, idx) => idx.toString() === value);
                                  if (selectedInstruction) {
                                    toggleSampleInstruction(parseInt(value));
                                  }
                                  // 선택 후 초기화를 위해 약간의 지연
                                  setTimeout(() => {
                                    const selectElement = document.querySelector('[data-state="open"]') as HTMLElement;
                                    if (selectElement) {
                                      selectElement.click();
                                    }
                                  }, 100);
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs w-[200px]">
                                <SelectValue placeholder="샘플 지침 선택" />
                              </SelectTrigger>
                              <SelectContent>
                                {sampleInstructions.map((instruction, idx) => (
                                  <SelectItem key={idx} value={idx.toString()}>
                                    <span className="text-xs line-clamp-1">{instruction}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        {isInstructionOpen && (
                          <>
                            <Textarea
                              placeholder="예: 20초 분량으로 단문으로 작성하고, 숫자를 명확히 발음할 수 있도록 수정"
                              value={openAIInstruction}
                              onChange={(e) => {
                                setOpenAIInstruction(e.target.value);
                                // 수동 입력 시 선택된 샘플 지침 업데이트
                                updateSelectedSamplesFromText(e.target.value);
                              }}
                              className="min-h-[100px]"
                            />
                            {/* 샘플 지침 빠른 선택 버튼 */}
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">자주 사용하는 지침:</p>
                              <div className="flex flex-wrap gap-2">
                                {sampleInstructions.slice(0, 5).map((instruction, idx) => {
                                  const isSelected = selectedSampleInstructions.has(idx);
                                  return (
                                    <Button
                                      key={idx}
                                      variant="outline"
                                      size="sm"
                                      className={`text-xs h-7 max-w-[200px] ${
                                        isSelected 
                                          ? "border-primary bg-primary/10 text-primary" 
                                          : ""
                                      }`}
                                      onClick={() => toggleSampleInstruction(idx)}
                                      title={instruction}
                                    >
                                      <span className="truncate">
                                        {instruction.length > 25 ? `${instruction.substring(0, 25)}...` : instruction}
                                      </span>
                                    </Button>
                                  );
                                })}
                              </div>
                            </div>
                            {/* 버튼을 텍스트박스 오른쪽 하단에 배치 */}
                            <div className="flex justify-end">
                              <Button
                                variant="default"
                                className="bg-gradient-to-r from-primary to-accent text-white hover:opacity-90"
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
                                  // 프롬프트 최적화: 간결하게 수정 지침만 전달
                                  const out = await editWithOpenAI(customText, openAIInstruction);
                                  // 마크다운 제거된 텍스트 적용
                                  setCustomText(out);
                                  // 수정된 텍스트 기반으로 자동 태그 생성
                                  const autoTags = generateAutoTags(out);
                                  if (autoTags.length > 0) {
                                    setTags(autoTags);
                                  }
                                  toast({
                                    title: "수정 완료",
                                    description: "OpenAI로 메시지가 수정되었습니다.",
                                  });
                                  // 수정 지침 초기화
                                  setOpenAIInstruction("");
                                  setSelectedSampleInstructions(new Set());
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
                          </>
                        )}
                      </div>
                    )}
                    
                    {/* 태그 입력 */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2 items-center">
                        {tags.map((tag, idx) => (
                          <Badge key={idx} variant="secondary" className="px-2 py-1">
                            {tag}
                            <button
                              onClick={() => setTags(tags.filter((_, i) => i !== idx))}
                              className="ml-2 hover:text-destructive"
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                        <Input
                          placeholder="태그 입력"
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && tagInput.trim()) {
                              e.preventDefault();
                              const newTag = tagInput.trim();
                              if (!tags.includes(newTag) && tags.length < 5) {
                                setTags([...tags, newTag]);
                              }
                              setTagInput("");
                            }
                          }}
                          className="w-auto min-w-[150px] flex-1 max-w-[200px]"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        태그 입력 후 엔터 시 자동으로 태그로 구분됩니다. 작성 내용을 기반으로 자동 태그가 설정됩니다.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* 저장 버튼 영역 - OpenAI 작성 탭일 때만 표시 */}
              {activeTab === "ai-assist" && (
                <div className="flex items-center gap-2 justify-end pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCustomText("");
                      setOpenAIPrompt("");
                      setOpenAIInstruction("");
                      setTags([]);
                      setTagInput("");
                      setIsEditing(false);
                      setEditingMessageId(null);
                      // 초안 메시지도 삭제
                      localStorage.removeItem(DRAFT_MESSAGE_KEY);
                    }}
                  >
                    초기화
                  </Button>
                  <Button onClick={handleSaveMessage} disabled={!customText.trim()}>
                    <Save className="w-4 h-4 mr-2" />
                    {isEditing ? "수정 저장" : "저장"}
                  </Button>
                </div>
              )}
              
              {/* 직접 작성 탭일 때 저장 버튼 */}
              {activeTab === "manual" && (
                <div className="flex items-center gap-2 justify-end pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCustomText("");
                      setTags([]);
                      setTagInput("");
                      setIsEditing(false);
                      setEditingMessageId(null);
                      // 초안 메시지도 삭제
                      localStorage.removeItem(DRAFT_MESSAGE_KEY);
                    }}
                  >
                    초기화
                  </Button>
                  <Button onClick={handleSaveMessage} disabled={!customText.trim()}>
                    <Save className="w-4 h-4 mr-2" />
                    {isEditing ? "수정 저장" : "저장"}
                  </Button>
                </div>
              )}
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
