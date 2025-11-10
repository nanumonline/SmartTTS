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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  ChevronUp,
  Copy,
  X,
  Tags,
  Settings
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import * as dbService from "@/services/dbService";
import { supabase } from "@/integrations/supabase/client";
import { correctKoreanPostpositions } from "@/lib/koreanPostposition";
import { formatDateTime, purposeOptions, getPurposeMeta, PurposeOption } from "@/lib/pageUtils";
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
  const [messageHistory, setMessageHistory] = useState<Array<{ id?: string; text: string; purpose: string; createdAt?: string; updatedAt?: string; tags?: string[] }>>([]);
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
  const [allTags, setAllTags] = useState<Record<string, number>>({}); // 태그별 사용 횟수
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>(""); // 태그 필터
  const [isTagManagementOpen, setIsTagManagementOpen] = useState(false);
  const [customTags, setCustomTags] = useState<string[]>([]); // 커스텀 태그 목록
  
  // 검수 체크리스트 관련
  const [customChecklist, setCustomChecklist] = useState<string[] | null>(null);
  const [editingChecklistItem, setEditingChecklistItem] = useState<number | null>(null);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  
  // 커스텀 목적 관련
  const [customPurposes, setCustomPurposes] = useState<PurposeOption[]>([]);
  const [isAddingPurpose, setIsAddingPurpose] = useState(false);
  const [newPurpose, setNewPurpose] = useState({ label: "", description: "", checklist: [] as string[], optimizedPrompt: "" });
  
  // 템플릿 관련
  const [templates, setTemplates] = useState<dbService.TemplateEntry[]>([]);
  const [selectedTemplateCategory, setSelectedTemplateCategory] = useState<string>("all");
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<dbService.TemplateEntry | null>(null);
  const [newTemplate, setNewTemplate] = useState({ name: "", category: "", text: "", purpose: selectedPurpose });
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<dbService.TemplateEntry | null>(null);
  
  // 삭제 확인 다이얼로그 상태
  const [deleteTemplateDialog, setDeleteTemplateDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [deleteMessageDialog, setDeleteMessageDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [restoreChecklistDialog, setRestoreChecklistDialog] = useState<{ open: boolean }>({ open: false });
  const [deleteChecklistItemDialog, setDeleteChecklistItemDialog] = useState<{ open: boolean; index: number | null }>({ open: false, index: null });
  const [splitTextDialog, setSplitTextDialog] = useState<{ open: boolean; text: string }>({ open: false, text: "" });
  
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
  const CUSTOM_PURPOSES_KEY = `custom_purposes_${user?.id || 'anonymous'}`;
  const CUSTOM_TAGS_KEY = `custom_tags_${user?.id || 'anonymous'}`;
  const TAG_USAGE_KEY = `tag_usage_${user?.id || 'anonymous'}`;

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
      
      // 저장된 커스텀 목적 로드
      loadCustomPurposes();
      
      // 템플릿 로드
      loadTemplates();
      
      // 태그 관련 로드
      loadCustomTags();
      loadTagUsage();
    }
  }, [user?.id]);
  
  // 커스텀 태그 로드
  const loadCustomTags = () => {
    try {
      const saved = localStorage.getItem(CUSTOM_TAGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setCustomTags(parsed);
      }
    } catch (error) {
      console.error("커스텀 태그 로드 실패:", error);
    }
  };
  
  // 커스텀 태그 저장
  const saveCustomTags = (tagList: string[]) => {
    try {
      localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(tagList));
      setCustomTags(tagList);
    } catch (error) {
      console.error("커스텀 태그 저장 실패:", error);
    }
  };
  
  // 태그 사용 통계 로드
  const loadTagUsage = () => {
    try {
      const saved = localStorage.getItem(TAG_USAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setAllTags(parsed);
      }
    } catch (error) {
      console.error("태그 사용 통계 로드 실패:", error);
    }
  };
  
  // 태그 사용 통계 저장
  const saveTagUsage = (tagUsage: Record<string, number>) => {
    try {
      localStorage.setItem(TAG_USAGE_KEY, JSON.stringify(tagUsage));
      setAllTags(tagUsage);
    } catch (error) {
      console.error("태그 사용 통계 저장 실패:", error);
    }
  };
  
  // 태그 사용 통계 업데이트
  const updateTagUsage = (tagList: string[]) => {
    const updated = { ...allTags };
    tagList.forEach(tag => {
      updated[tag] = (updated[tag] || 0) + 1;
    });
    saveTagUsage(updated);
  };
  
  // 템플릿 로드
  const loadTemplates = async () => {
    if (!user?.id) return;
    try {
      const loadedTemplates = await dbService.loadTemplates(user.id);
      setTemplates(loadedTemplates);
      
      // 템플릿이 없으면 초기 템플릿 생성
      if (loadedTemplates.length === 0) {
        await createInitialTemplates();
        const reloadedTemplates = await dbService.loadTemplates(user.id);
        setTemplates(reloadedTemplates);
      }
    } catch (error) {
      console.error("템플릿 로드 실패:", error);
    }
  };
  
  // 초기 템플릿 생성
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
      {
        text: "긴급 안내입니다. {기관명}에서 {상황설명} 상황으로 인해 {대응방안}을 시행합니다. 시민 여러분께서는 {행동지침}을 따라주시기 바랍니다.",
        purpose: "emergency",
        templateName: "긴급 상황 안내",
        templateCategory: "emergency",
      },
      {
        text: "{기관명} {부서명}에서 {행사명} 행사를 개최합니다. 일시는 {일시}이며, 장소는 {장소}입니다. {행사내용}",
        purpose: "event",
        templateName: "행사 안내",
        templateCategory: "event",
      },
      {
        text: "{기관명}에서 {서비스명} 서비스를 {변경사항} 변경하여 운영합니다. {운영시간} 동안 이용 가능하며, 자세한 사항은 {연락처}로 문의해주시기 바랍니다.",
        purpose: "service",
        templateName: "서비스 안내",
        templateCategory: "service",
      },
      {
        text: "{기관명}에서 {날짜}부터 {정책명} 정책을 시행합니다. {정책목표}를 목표로 하며, {적용대상}에게 적용됩니다. {정책내용}",
        purpose: "policy",
        templateName: "정책 시행 안내",
        templateCategory: "policy",
      },
      {
        text: "안녕하세요. {기관명} {담당자명}입니다. {내용}에 대해 안내드리겠습니다. 문의사항은 {연락처}로 연락주시기 바랍니다.",
        purpose: "greeting",
        templateName: "담당자 인사말",
        templateCategory: "greeting",
      },
      {
        text: "{기관명}에서 {날짜} {장소}에서 {행사명} 행사를 진행합니다. {행사내용} 참가를 원하시는 분은 {연락처}로 신청해주시기 바랍니다.",
        purpose: "event",
        templateName: "행사 참가 안내",
        templateCategory: "event",
      },
      {
        text: "긴급 안내입니다. {기관명}에서 {상황설명}로 인해 {대응방안}을 즉시 시행합니다. 시민 여러분께서는 {행동지침}을 반드시 준수해주시기 바랍니다. 추가 안내사항은 {연락처}로 문의해주시기 바랍니다.",
        purpose: "emergency",
        templateName: "긴급 대응 안내",
        templateCategory: "emergency",
      },
      {
        text: "{기관명} {부서명}에서 {서비스명} 서비스를 신규로 개설합니다. {내용} 이용을 원하시는 분은 {연락처}로 문의하시거나 {홈페이지}에서 확인하시기 바랍니다.",
        purpose: "service",
        templateName: "신규 서비스 안내",
        templateCategory: "service",
      },
      {
        text: "{기관명}에서 {날짜}부터 {정책명} 정책의 변경사항을 안내드립니다. {변경사항} 변경되며, {적용대상}에게 적용됩니다. 자세한 내용은 {연락처}로 문의해주시기 바랍니다.",
        purpose: "policy",
        templateName: "정책 변경 안내",
        templateCategory: "policy",
      },
    ];

    try {
      for (const template of initialTemplates) {
        await dbService.saveTemplate(user.id, {
          ...template,
          isTemplate: true,
        } as dbService.TemplateEntry);
      }
      
      toast({
        title: "초기 템플릿 생성 완료",
        description: `${initialTemplates.length}개의 기본 템플릿이 생성되었습니다.`,
      });
    } catch (error) {
      console.error("초기 템플릿 생성 실패:", error);
    }
  };
  
  // 템플릿 변수 추출
  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{([^}]+)\}/g) || [];
    return [...new Set(matches.map(m => m.replace(/[{}]/g, "")))];
  };
  
  // 템플릿 변수 교체
  const replaceTemplateVariables = (text: string, variables: Record<string, string>): string => {
    let replaced = text;
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, "g");
      replaced = replaced.replace(regex, variables[key] || `{${key}}`);
    });
    return replaced;
  };
  
  // 모든 목적 목록 (기본 + 커스텀) - 템플릿 함수들보다 먼저 선언
  const allPurposeOptions = [...purposeOptions, ...customPurposes];
  
  // 목적 ID를 한글 라벨로 변환
  const getPurposeLabel = (purposeId: string): string => {
    const option = allPurposeOptions.find(p => p.id === purposeId);
    return option?.label || purposeId;
  };
  
  // 카테고리별 템플릿 예시 가져오기
  const getTemplateExample = (categoryId: string): { name: string; text: string } => {
    const examples: Record<string, { name: string; text: string }> = {
      greeting: {
        name: "기본 인사말",
        text: "안녕하세요. {기관명}입니다. {날짜} {내용}을 안내드립니다. 시민 여러분께서는 참고하여 주시기 바랍니다. 문의사항이 있으시면 {연락처}로 연락주시기 바랍니다."
      },
      announcement: {
        name: "기본 안내방송",
        text: "{기관명}에서 알려드립니다. {내용} 자세한 사항은 {연락처}로 문의해주시기 바랍니다. 감사합니다."
      },
      policy: {
        name: "정책 안내",
        text: "{기관명}의 {정책명} 정책에 대해 안내드립니다. 본 정책은 {정책목표}를 목표로 하며, {적용대상}에게 적용됩니다. {정책내용} 자세한 내용은 {연락처}로 문의해주시기 바랍니다."
      },
      emergency: {
        name: "긴급 상황 안내",
        text: "긴급 안내입니다. {기관명}에서 알려드립니다. 현재 {상황설명} 상황으로 인해 {대응방안}을 시행하고 있습니다. 시민 여러분께서는 {행동지침}을 반드시 준수해주시기 바랍니다. 추가 안내사항은 {연락처}로 문의해주시기 바랍니다."
      },
      event: {
        name: "행사 안내",
        text: "{기관명} {부서명}에서 {행사명} 행사를 개최합니다. 일시는 {일시}이며, 장소는 {장소}입니다. {행사내용} 참가를 원하시는 분은 {연락처}로 신청해주시기 바랍니다. 많은 참여 부탁드립니다."
      },
      service: {
        name: "서비스 안내",
        text: "{기관명}에서 {서비스명} 서비스를 안내드립니다. {내용} 이용 시간은 {운영시간}이며, 자세한 사항은 {연락처}로 문의하시거나 {홈페이지}에서 확인하실 수 있습니다."
      },
      research: {
        name: "연구 안내",
        text: "{기관명} {부서명}에서 {연구분야} 관련 연구를 진행하고 있습니다. {내용} 관련 문의사항은 {연락처}로 연락주시기 바랍니다."
      },
      facility: {
        name: "시설 안내",
        text: "{기관명} {부서명}에서 시설 이용 안내를 드립니다. {내용} 이용 시간은 {운영시간}이며, 자세한 사항은 {연락처}로 문의해주시기 바랍니다."
      },
      safety: {
        name: "안전 안내",
        text: "{기관명}에서 안전 관련 안내를 드립니다. {상황설명}으로 인해 {행동지침}을 준수해주시기 바랍니다. 긴급 상황 시 {연락처}로 신고해주시기 바랍니다."
      },
      weather: {
        name: "기상 안내",
        text: "{기관명}에서 기상 상황 안내를 드립니다. {날짜} {상황설명} 예상됩니다. 시민 여러분께서는 {행동지침}을 준수해주시기 바랍니다. 자세한 기상 정보는 {연락처}로 문의해주시기 바랍니다."
      },
      traffic: {
        name: "교통 안내",
        text: "{기관명}에서 교통 안내를 드립니다. {일시} {장소} 일대에서 {내용}로 인해 교통 통제가 시행됩니다. 이용하시는 분들께서는 {행동지침}을 참고하여 주시기 바랍니다."
      },
      health: {
        name: "보건 안내",
        text: "{기관명} {부서명}에서 보건 관련 안내를 드립니다. {내용} 관련하여 {행동지침}을 준수해주시기 바랍니다. 문의사항은 {연락처}로 연락주시기 바랍니다."
      },
      education: {
        name: "교육 안내",
        text: "{기관명}에서 교육 프로그램 안내를 드립니다. {행사명} 프로그램을 {일시} {장소}에서 진행합니다. {행사내용} 참가를 원하시는 분은 {연락처}로 신청해주시기 바랍니다."
      },
      culture: {
        name: "문화 행사 안내",
        text: "{기관명}에서 문화 행사 안내를 드립니다. {행사명} 행사를 {일시} {장소}에서 개최합니다. {행사내용} 많은 관심과 참여 부탁드립니다. 문의사항은 {연락처}로 연락주시기 바랍니다."
      },
      environment: {
        name: "환경 안내",
        text: "{기관명}에서 환경 관련 안내를 드립니다. {내용} 시민 여러분께서는 {행동지침}을 준수해주시기 바랍니다. 자세한 사항은 {연락처}로 문의해주시기 바랍니다."
      },
      welfare: {
        name: "복지 안내",
        text: "{기관명} {부서명}에서 복지 서비스 안내를 드립니다. {서비스명} 서비스를 {내용} 제공하고 있습니다. 이용을 원하시는 분은 {연락처}로 문의하시거나 {홈페이지}에서 확인하실 수 있습니다."
      },
      administration: {
        name: "행정 안내",
        text: "{기관명}에서 행정 업무 안내를 드립니다. {내용} 관련하여 {변경사항} 변경되었습니다. 자세한 사항은 {연락처}로 문의해주시기 바랍니다."
      },
      public_works: {
        name: "공사 안내",
        text: "{기관명}에서 공사 안내를 드립니다. {일시}부터 {장소} 일대에서 {내용} 공사를 진행합니다. 이용하시는 분들께서는 {행동지침}을 참고하여 주시기 바랍니다. 문의사항은 {연락처}로 연락주시기 바랍니다."
      },
      disaster: {
        name: "재난 안내",
        text: "긴급 안내입니다. {기관명}에서 알려드립니다. {상황설명} 상황으로 인해 {대응방안}을 즉시 시행하고 있습니다. 시민 여러분께서는 {행동지침}을 반드시 준수해주시기 바랍니다. 긴급 상황 신고는 {연락처}로 해주시기 바랍니다."
      },
      notice: {
        name: "공지사항",
        text: "{기관명}에서 공지사항을 안내드립니다. {내용} 관련하여 {변경사항} 변경되었습니다. 자세한 사항은 {연락처}로 문의해주시기 바랍니다. 감사합니다."
      }
    };
    
    return examples[categoryId] || {
      name: "새 템플릿",
      text: "{기관명}에서 알려드립니다. {내용} 자세한 사항은 {연락처}로 문의해주시기 바랍니다."
    };
  };
  
  // 템플릿 카테고리 목록 (목적 기반)
  const templateCategories = allPurposeOptions.map(option => ({
    id: option.id,
    label: option.label,
  }));
  
  // 필터링된 템플릿 목록
  const filteredTemplates = templates.filter(t => 
    selectedTemplateCategory === "all" || t.templateCategory === selectedTemplateCategory
  );
  
  // 카테고리별 템플릿 그룹화
  const templatesByCategory = templateCategories.reduce((acc, category) => {
    acc[category.id] = templates.filter(t => t.templateCategory === category.id);
    return acc;
  }, {} as Record<string, dbService.TemplateEntry[]>);
  
  // 템플릿 선택 시 변수 초기화
  const handleTemplateSelect = (template: dbService.TemplateEntry) => {
    setSelectedTemplate(template);
    const variables = extractVariables(template.text);
    const defaultValues: Record<string, string> = {
      "기관명": user?.organization || "",
      "담당자명": user?.name || "",
      "부서명": user?.department || "",
      "연락처": "",
      "홈페이지": "",
      "이벤트명": "",
      "정책명": "",
      "정책목표": "",
      "정책내용": "",
      "적용대상": "",
      "상황설명": "",
      "대응방안": "",
      "행동지침": "",
      "일시": new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
      "장소": "",
      "서비스명": "",
      "변경사항": "",
      "운영시간": "",
      "행사명": "",
      "행사내용": "",
      "내용": "",
      "날짜": new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }),
    };
    
    const initialVariables: Record<string, string> = {};
    variables.forEach(v => {
      initialVariables[v] = defaultValues[v] || "";
    });
    
    setTemplateVariables(initialVariables);
    
    // 템플릿 적용 탭으로 이동
    setActiveTab("manual");
    
    // 변수 교체된 텍스트 생성
    const replaced = replaceTemplateVariables(template.text, initialVariables);
    setCustomText(replaced);
    
    toast({
      title: "템플릿 적용",
      description: `${template.templateName || "템플릿"}이 적용되었습니다.`,
    });
  };
  
  // 템플릿 변수 변경 핸들러
  const handleTemplateVariableChange = (varName: string, value: string) => {
    const updated = { ...templateVariables, [varName]: value };
    setTemplateVariables(updated);
    
    if (selectedTemplate) {
      const replaced = replaceTemplateVariables(selectedTemplate.text, updated);
      // 한국어 조사 교정
      const corrected = correctKoreanPostpositions(replaced);
      setCustomText(corrected);
    }
  };
  
  // 템플릿 저장
  const handleSaveTemplate = async () => {
    if (!newTemplate.name.trim() || !newTemplate.text.trim() || !newTemplate.category) {
      toast({
        title: "입력 필요",
        description: "템플릿 이름, 내용, 카테고리를 모두 입력해주세요.",
        variant: "destructive",
      });
      return;
    }
    
    if (!user?.id) return;
    
    try {
      const template: dbService.TemplateEntry = {
        id: editingTemplate?.id || `temp_${Date.now()}`,
        text: newTemplate.text,
        purpose: newTemplate.purpose || selectedPurpose,
        isTemplate: true,
        templateName: newTemplate.name.trim(),
        templateCategory: newTemplate.category,
        variables: extractVariables(newTemplate.text),
      };
      
      if (editingTemplate) {
        await dbService.updateTemplate(user.id, editingTemplate.id, template);
        toast({
          title: "템플릿 수정 완료",
          description: "템플릿이 수정되었습니다.",
        });
      } else {
        await dbService.saveTemplate(user.id, template);
        toast({
          title: "템플릿 저장 완료",
          description: "템플릿이 저장되었습니다.",
        });
      }
      
      await loadTemplates();
      setIsTemplateDialogOpen(false);
      setEditingTemplate(null);
      setNewTemplate({ name: "", category: "", text: "", purpose: selectedPurpose });
    } catch (error) {
      console.error("템플릿 저장 실패:", error);
      toast({
        title: "템플릿 저장 실패",
        description: "템플릿 저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };
  
  // 템플릿 삭제
  const handleDeleteTemplate = async (id: string) => {
    if (!user?.id) return;
    setDeleteTemplateDialog({ open: true, id });
  };
  
  const confirmDeleteTemplate = async () => {
    if (!user?.id || !deleteTemplateDialog.id) return;
    
    try {
      await dbService.deleteTemplate(user.id, deleteTemplateDialog.id);
      await loadTemplates();
      if (selectedTemplate?.id === deleteTemplateDialog.id) {
        setSelectedTemplate(null);
        setTemplateVariables({});
      }
      setDeleteTemplateDialog({ open: false, id: null });
      toast({
        title: "템플릿 삭제 완료",
        description: "템플릿이 삭제되었습니다.",
      });
    } catch (error) {
      console.error("템플릿 삭제 실패:", error);
      toast({
        title: "템플릿 삭제 실패",
        description: "템플릿 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };
  
  // 커스텀 목적 로드
  const loadCustomPurposes = () => {
    try {
      const saved = localStorage.getItem(CUSTOM_PURPOSES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setCustomPurposes(parsed);
      }
    } catch (error) {
      console.error("커스텀 목적 로드 실패:", error);
    }
  };
  
  // 커스텀 목적 저장
  const saveCustomPurposes = (purposes: PurposeOption[]) => {
    try {
      localStorage.setItem(CUSTOM_PURPOSES_KEY, JSON.stringify(purposes));
      setCustomPurposes(purposes);
    } catch (error) {
      console.error("커스텀 목적 저장 실패:", error);
    }
  };
  
  // 초안 메시지 로드
  const loadDraftMessage = () => {
    try {
      const draft = localStorage.getItem(DRAFT_MESSAGE_KEY);
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.text) setCustomText(parsed.text);
        if (parsed.openAIPrompt) setOpenAIPrompt(parsed.openAIPrompt);
        if (parsed.openAIInstruction) {
          setOpenAIInstruction(parsed.openAIInstruction);
          // 수정 지침이 있으면 선택된 샘플 지침 업데이트
          updateSelectedSamplesFromText(parsed.openAIInstruction);
        }
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

  // 자동 태그 생성 함수 (개선)
  const generateAutoTags = (text: string): string[] => {
    if (!text.trim()) return [];
    
    const tags: string[] = [];
    const lowerText = text.toLowerCase();
    
    // 공공기관 관련 키워드 패턴 (확장)
    const keywordPatterns = [
      { keywords: ["긴급", "비상", "재난", "재해", "안전", "위험", "응급"], tag: "긴급안내" },
      { keywords: ["복지", "수혜", "지원", "혜택", "급여", "보조금", "수당"], tag: "복지" },
      { keywords: ["교통", "도로", "교통정체", "통행", "운행", "버스", "지하철"], tag: "교통" },
      { keywords: ["환경", "대기", "미세먼지", "기후", "에너지", "탄소", "재활용"], tag: "환경" },
      { keywords: ["문화", "행사", "축제", "공연", "전시", "예술", "공연장"], tag: "문화행사" },
      { keywords: ["시설", "이용", "운영", "개방", "휴관", "시설물", "건물"], tag: "시설이용" },
      { keywords: ["민원", "신청", "접수", "처리", "서류", "행정", "업무"], tag: "민원" },
      { keywords: ["보건", "건강", "의료", "검진", "예방", "질병", "병원"], tag: "보건" },
      { keywords: ["교육", "강좌", "프로그램", "학습", "훈련", "강의", "수업"], tag: "교육" },
      { keywords: ["정책", "제도", "시행", "변경", "신규", "법령", "규정"], tag: "정책" },
      { keywords: ["홍보", "캠페인", "안내", "공지", "알림", "광고", "선전"], tag: "홍보" },
      { keywords: ["인사", "축하", "감사", "축사", "인사말", "환영", "환송"], tag: "인사말" },
      { keywords: ["날씨", "기상", "강수", "폭설", "태풍", "기온", "예보"], tag: "기상" },
      { keywords: ["공사", "공단", "공사장", "건설", "보수", "공사중"], tag: "공사" },
      { keywords: ["행사", "이벤트", "개최", "참가", "신청", "모집"], tag: "행사" },
      { keywords: ["서비스", "이용", "신청", "접수", "운영", "개설"], tag: "서비스" },
      { keywords: ["연구", "개발", "연구소", "연구원", "연구과제"], tag: "연구" },
      { keywords: ["안전", "사고", "예방", "경보", "주의", "경고"], tag: "안전" },
      { keywords: ["주차", "주차장", "주차공간", "주차요금"], tag: "주차" },
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
      greeting: "인사말",
      announcement: "안내방송",
      policy: "정책안내",
      emergency: "긴급안내",
      event: "행사",
      service: "서비스",
      research: "연구",
      facility: "시설",
      safety: "안전",
      weather: "기상",
      traffic: "교통",
      health: "보건",
      education: "교육",
      culture: "문화",
      environment: "환경",
      welfare: "복지",
      administration: "행정",
      public_works: "공사",
      disaster: "재난",
      notice: "공지사항",
    };

    if (selectedPurpose && purposeTagMap[selectedPurpose] && !tags.includes(purposeTagMap[selectedPurpose])) {
      tags.unshift(purposeTagMap[selectedPurpose]);
      if (tags.length > 5) tags.pop();
    }
    
    // 커스텀 태그와 병합 (키워드 매칭)
    customTags.forEach(customTag => {
      if (lowerText.includes(customTag.toLowerCase()) && !tags.includes(customTag) && tags.length < 5) {
        tags.push(customTag);
      }
    });
    
    return tags.slice(0, 5);
  };

  // 샘플 지침 토글 함수
  const toggleSampleInstruction = (idx: number) => {
    const instruction = sampleInstructions[idx];
    if (!instruction) return;

    const newSelected = new Set(selectedSampleInstructions);
    const currentInstructions = openAIInstruction.split('\n').filter(line => line.trim());
    
    if (newSelected.has(idx)) {
      // 이미 선택된 경우: 제거
      newSelected.delete(idx);
      // 텍스트에서 해당 지침 제거
      const updatedInstructions = currentInstructions.filter(line => line.trim() !== instruction.trim());
      setOpenAIInstruction(updatedInstructions.join('\n'));
    } else {
      // 선택되지 않은 경우: 추가
      newSelected.add(idx);
      // 텍스트에 해당 지침 추가
      if (openAIInstruction.trim()) {
        setOpenAIInstruction(`${openAIInstruction}\n${instruction}`);
      } else {
        setOpenAIInstruction(instruction);
      }
    }
    
    setSelectedSampleInstructions(newSelected);
  };

  // 텍스트에서 선택된 샘플 지침 업데이트
  const updateSelectedSamplesFromText = (text: string) => {
    const newSelected = new Set<number>();
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    sampleInstructions.forEach((instruction, idx) => {
      if (lines.some(line => line === instruction.trim())) {
        newSelected.add(idx);
      }
    });
    
    setSelectedSampleInstructions(newSelected);
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
          tags: tags,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setMessageHistory([newMessage, ...messageHistory]);
        
        // 태그 사용 통계 업데이트
        if (tags.length > 0) {
          updateTagUsage(tags);
        }
        
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
    setDeleteMessageDialog({ open: true, id });
  };
  
  const confirmDeleteMessage = async () => {
    if (!deleteMessageDialog.id) return;

    try {
      if (user?.id) {
        await dbService.deleteMessage(user.id, deleteMessageDialog.id);
      }
      const updated = messageHistory.filter((m) => m.id !== deleteMessageDialog.id);
      setMessageHistory(updated);
      setDeleteMessageDialog({ open: false, id: null });
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
    if (msg.tags) {
      setTags(msg.tags);
    }
    setIsEditing(true);
    setEditingMessageId(msg.id);
    setIsMessageHistoryOpen(false);
    toast({
      title: "메시지 불러오기 완료",
      description: "메시지가 편집 영역에 로드되었습니다.",
    });
  };

  const purposeMeta = getPurposeMeta(selectedPurpose);
  
  // 커스텀 목적의 경우 직접 메타데이터 사용
  const getPurposeMetaForSelected = (purposeId: string) => {
    const customPurpose = customPurposes.find(p => p.id === purposeId);
    if (customPurpose) {
      return {
        label: customPurpose.label,
        description: customPurpose.description,
        checklist: customPurpose.checklist || [],
        optimizedPrompt: customPurpose.optimizedPrompt || "",
      };
    }
    return getPurposeMeta(purposeId);
  };
  
  const purposeMetaForSelected = getPurposeMetaForSelected(selectedPurpose);
  
  // 현재 사용할 체크리스트 (커스텀 또는 기본)
  const currentChecklist = customChecklist || purposeMetaForSelected.checklist || [];
  
  // 공공기관(지자체) 방송지침
  const publicBroadcastGuidelines = [
    "공공기관의 신뢰성과 권위를 유지하는 격식 있는 톤 사용",
    "시민 중심의 친절하고 명확한 안내",
    "법적 근거와 정책 방향을 명확히 제시",
    "접근성과 이해도를 고려한 쉬운 표현 사용",
    "긴급 상황 시 즉각적인 행동요령 제시",
    "문의처와 연락 방법을 명확히 안내",
    "시간, 장소, 대상 등 핵심 정보를 앞부분에 배치",
    "반복 안내가 필요한 경우 강조",
    "TTS 친화적으로 숫자와 단위를 명확히 표기",
    "호흡이 자연스럽도록 문장 길이 조절",
  ];
  
  // 최적 프롬프트 생성 (검수체크리스트 + 공공기관 방송지침 포함)
  const generateOptimizedPrompt = (): string => {
    const checklistText = currentChecklist.length > 0 
      ? `검수 체크리스트: ${currentChecklist.join(", ")}`
      : "";
    const guidelinesText = `공공기관(지자체) 방송지침: ${publicBroadcastGuidelines.join(", ")}`;
    const basePrompt = purposeMetaForSelected?.optimizedPrompt || "";
    
    const parts = [basePrompt];
    if (checklistText) parts.push(checklistText);
    if (guidelinesText) parts.push(guidelinesText);
    
    return parts.join("\n\n");
  };
  
  const optimizedPromptWithGuidelines = generateOptimizedPrompt();

  // 필터링된 메시지 목록 (태그 필터 포함)
  const filteredMessages = messageHistory.filter((msg) => {
    const purposeMatch = filterPurpose === "all" || msg.purpose === filterPurpose;
    const tagMatch = !selectedTagFilter || (msg.tags && msg.tags.includes(selectedTagFilter));
    return purposeMatch && tagMatch;
  });
  
  // 태그 클라우드 데이터 준비 (사용 횟수 기준 정렬)
  const tagCloudData = Object.entries(allTags)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30); // 상위 30개만 표시
  
  // 태그 크기 계산 (최소 12px, 최대 24px)
  const getTagSize = (count: number): string => {
    const maxCount = Math.max(...Object.values(allTags), 1);
    const minSize = 12;
    const maxSize = 24;
    const size = minSize + ((count / maxCount) * (maxSize - minSize));
    return `${Math.round(size)}px`;
  };

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
                    {purposeMetaForSelected?.label || "안내방송"}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {purposeMetaForSelected?.description || "일반 공지사항 안내"}
                  </span>
                </div>
                
                {/* 목적 카드 그리드 - 2줄 종스크롤 */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[200px] overflow-y-auto pr-2">
                  {allPurposeOptions.map((option) => {
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
                  
                  {/* 목적 추가 버튼 */}
                  <Card
                    className="cursor-pointer transition-all hover:shadow-md border-dashed hover:border-primary/50"
                    onClick={() => setIsAddingPurpose(true)}
                  >
                    <CardContent className="p-4 flex flex-col items-center justify-center h-full min-h-[80px]">
                      <Plus className="w-5 h-5 text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground text-center">목적 추가</p>
                    </CardContent>
                  </Card>
                </div>
                
                {/* 목적 추가 다이얼로그 */}
                {isAddingPurpose && (
                  <Dialog open={isAddingPurpose} onOpenChange={setIsAddingPurpose}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>새 목적 추가</DialogTitle>
                        <DialogDescription>
                          새로운 방송 목적을 추가하세요.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>목적 이름 *</Label>
                          <Input
                            placeholder="예: 행사 축하"
                            value={newPurpose.label}
                            onChange={(e) => setNewPurpose({ ...newPurpose, label: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>설명 *</Label>
                          <Input
                            placeholder="예: 행사 축하 인사말"
                            value={newPurpose.description}
                            onChange={(e) => setNewPurpose({ ...newPurpose, description: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>검수 체크리스트 (줄바꿈으로 구분)</Label>
                          <Textarea
                            placeholder="예: 행사명이 명확한가?&#10;감사 인사가 포함되었는가?"
                            value={newPurpose.checklist.join('\n')}
                            onChange={(e) => setNewPurpose({ 
                              ...newPurpose, 
                              checklist: e.target.value.split('\n').filter(line => line.trim()) 
                            })}
                            className="min-h-[100px]"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>최적 프롬프트 가이드 *</Label>
                          <Textarea
                            placeholder="예: 행사 축하 목적에 맞는 방송문을 작성하세요..."
                            value={newPurpose.optimizedPrompt}
                            onChange={(e) => setNewPurpose({ ...newPurpose, optimizedPrompt: e.target.value })}
                            className="min-h-[100px]"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => {
                          setIsAddingPurpose(false);
                          setNewPurpose({ label: "", description: "", checklist: [], optimizedPrompt: "" });
                        }}>
                          취소
                        </Button>
                        <Button onClick={() => {
                          if (!newPurpose.label.trim() || !newPurpose.description.trim() || !newPurpose.optimizedPrompt.trim()) {
                            toast({
                              title: "입력 필요",
                              description: "목적 이름, 설명, 최적 프롬프트는 필수입니다.",
                              variant: "destructive",
                            });
                            return;
                          }
                          const customPurpose: PurposeOption = {
                            id: `custom_${Date.now()}`,
                            label: newPurpose.label.trim(),
                            description: newPurpose.description.trim(),
                            checklist: newPurpose.checklist,
                            optimizedPrompt: newPurpose.optimizedPrompt.trim(),
                          };
                          const updated = [...customPurposes, customPurpose];
                          saveCustomPurposes(updated);
                          setSelectedPurpose(customPurpose.id);
                          setIsAddingPurpose(false);
                          setNewPurpose({ label: "", description: "", checklist: [], optimizedPrompt: "" });
                          toast({
                            title: "목적 추가 완료",
                            description: `${customPurpose.label}이(가) 추가되었습니다.`,
                          });
                        }}>
                          추가
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 검수 체크리스트 및 프롬프트 가이드 */}
          {(purposeMetaForSelected?.checklist || purposeMetaForSelected?.optimizedPrompt) && (
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
                    {/* 검수 체크리스트 - 수정 가능 */}
                    {purposeMetaForSelected.checklist && purposeMetaForSelected.checklist.length > 0 && (
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
                                  setRestoreChecklistDialog({ open: true });
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
                                        setDeleteChecklistItemDialog({ open: true, index: idx });
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
                    
                    {/* 최적 프롬프트 가이드 */}
                    {purposeMetaForSelected.optimizedPrompt && (
                      <AccordionItem value="prompt" className="border-none">
                        <AccordionTrigger className="text-sm font-semibold">
                          최적 프롬프트 가이드
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-foreground">기본 프롬프트:</p>
                              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                                {purposeMetaForSelected.optimizedPrompt}
                              </p>
                            </div>
                            
                            {/* 공공기관 방송지침 - 아코디언 처리 */}
                            <Accordion type="single" collapsible className="w-full">
                              <AccordionItem value="guidelines" className="border-none">
                                <AccordionTrigger className="text-xs font-medium text-foreground py-2">
                                  공공기관(지자체) 방송지침
                                </AccordionTrigger>
                                <AccordionContent>
                                  <ul className="text-xs text-muted-foreground bg-muted/50 p-2 rounded space-y-1 max-h-[200px] overflow-y-auto">
                                    {publicBroadcastGuidelines.map((guideline, idx) => (
                                      <li key={idx}>• {guideline}</li>
                                    ))}
                                  </ul>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )}
                  </Accordion>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 메시지 템플릿 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm">메시지 템플릿</CardTitle>
                  <CardDescription>
                    저장된 템플릿을 선택하여 빠르게 메시지를 작성하세요.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingTemplate(null);
                    setNewTemplate({ name: "", category: selectedPurpose, text: "", purpose: selectedPurpose });
                    setIsTemplateDialogOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  템플릿 추가
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 카테고리 필터 - 둥근 버튼 */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={selectedTemplateCategory === "all" ? "default" : "outline"}
                    onClick={() => setSelectedTemplateCategory("all")}
                    className="rounded-full"
                  >
                    전체
                  </Button>
                  {templateCategories.map((category) => (
                    <Button
                      key={category.id}
                      size="sm"
                      variant={selectedTemplateCategory === category.id ? "default" : "outline"}
                      onClick={() => setSelectedTemplateCategory(category.id)}
                      className="rounded-full"
                    >
                      {category.label}
                    </Button>
                  ))}
                </div>
                
                {/* 템플릿 목록 */}
                {filteredTemplates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>저장된 템플릿이 없습니다.</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => {
                        setEditingTemplate(null);
                        setNewTemplate({ name: "", category: selectedPurpose, text: "", purpose: selectedPurpose });
                        setIsTemplateDialogOpen(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      첫 템플릿 만들기
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredTemplates.map((template) => (
                      <div
                        key={template.id}
                        className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {getPurposeLabel(template.templateCategory || template.purpose)}
                            </Badge>
                            <span className="text-sm font-medium truncate">
                              {template.templateName || "이름 없음"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {template.text.replace(/\{[^}]+\}/g, "[변수]")}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => handleTemplateSelect(template)}
                            title="템플릿 적용"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setEditingTemplate(template);
                              setNewTemplate({
                                name: template.templateName || "",
                                category: template.templateCategory || template.purpose,
                                text: template.text,
                                purpose: template.purpose,
                              });
                              setIsTemplateDialogOpen(true);
                            }}
                            title="템플릿 수정"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive"
                            onClick={() => handleDeleteTemplate(template.id)}
                            title="템플릿 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

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
                    {/* 템플릿 변수 입력 섹션 */}
                    {selectedTemplate && Object.keys(templateVariables).length > 0 && (
                      <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">템플릿 변수 입력</Label>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedTemplate(null);
                              setTemplateVariables({});
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {Object.keys(templateVariables).map((varName) => {
                            const isRequired = ["기관명", "담당자명", "부서명"].includes(varName);
                            return (
                              <div key={varName} className="space-y-1">
                                <Label htmlFor={`template-var-${varName}`} className="text-xs">
                                  {varName} {isRequired && <span className="text-red-500">*</span>}
                                </Label>
                                <Input
                                  id={`template-var-${varName}`}
                                  value={templateVariables[varName] || ""}
                                  onChange={(e) => handleTemplateVariableChange(varName, e.target.value)}
                                  placeholder={`예: ${varName === "기관명" ? user?.organization || "강원특별자치도청" : varName === "담당자명" ? user?.name || "김철수" : varName === "부서명" ? user?.department || "관계 부서" : ""}`}
                                  className="h-8 text-sm"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
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
                            onClick={() => {
                              setSplitTextDialog({ open: true, text: customText });
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
                                const purposeLabel = purposeMetaForSelected?.label || "공지";
                                // 통합 프롬프트 사용 (검수체크리스트 + 공공기관 방송지침 포함)
                                const basePrompt = `${purposeLabel}: ${openAIPrompt}`;
                                const fullPrompt = `${basePrompt}\n\n${optimizedPromptWithGuidelines}`;
                                const out = await generateWithOpenAI(fullPrompt);
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
          {/* 태그 클라우드 */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Tags className="w-4 h-4" />
                  태그 클라우드
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsTagManagementOpen(true)}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
              <CardDescription className="text-xs mt-2">
                태그를 클릭하여 해당 태그가 포함된 메시지를 필터링합니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tagCloudData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Tags className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>사용된 태그가 없습니다.</p>
                  <p className="text-xs mt-1">메시지를 저장하면 태그가 표시됩니다.</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 items-center justify-center min-h-[100px]">
                  {selectedTagFilter && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedTagFilter("")}
                      className="rounded-full"
                    >
                      전체 보기
                    </Button>
                  )}
                  {tagCloudData.map(([tag, count]) => (
                    <Button
                      key={tag}
                      variant={selectedTagFilter === tag ? "default" : "outline"}
                      size="sm"
                      className="rounded-full transition-all hover:scale-105"
                      style={{
                        fontSize: getTagSize(count),
                        fontWeight: selectedTagFilter === tag ? 600 : 400,
                      }}
                      onClick={() => setSelectedTagFilter(selectedTagFilter === tag ? "" : tag)}
                    >
                      {tag} ({count})
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
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
                                    {msg.tags && msg.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {msg.tags.map((tag, idx) => (
                                          <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0">
                                            {tag}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
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

      {/* 템플릿 추가/수정 다이얼로그 */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "템플릿 수정" : "템플릿 추가"}</DialogTitle>
            <DialogDescription>
              메시지 템플릿을 생성하거나 수정합니다. 변수는 {`{변수명}`} 형식으로 입력하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>템플릿 이름 *</Label>
              <Input
                placeholder="예: 긴급 안내 템플릿"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label>카테고리 *</Label>
              <Select
                value={newTemplate.category}
                onValueChange={(value) => {
                  // 카테고리 선택 시 예시 템플릿 자동 입력 (새 템플릿일 때만)
                  if (!editingTemplate && value) {
                    const example = getTemplateExample(value);
                    setNewTemplate({ 
                      name: example.name, 
                      category: value, 
                      purpose: value,
                      text: example.text
                    });
                  } else {
                    setNewTemplate({ ...newTemplate, category: value, purpose: value });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  {templateCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {newTemplate.category && !editingTemplate && (
                <p className="text-xs text-muted-foreground">
                  💡 카테고리 선택 시 예시 템플릿이 자동으로 입력됩니다. 필요에 따라 수정하여 사용하세요.
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>템플릿 내용 *</Label>
              <Textarea
                placeholder={`예: {기관명}에서 알려드립니다. {상황설명}으로 인해 {대응방안}을 시행합니다. 시민 여러분께서는 {행동지침}을 따라주시기 바랍니다.`}
                value={newTemplate.text}
                onChange={(e) => setNewTemplate({ ...newTemplate, text: e.target.value })}
                className="min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                변수 예시: {"{기관명}"}, {"{담당자명}"}, {"{부서명}"}, {"{일시}"}, {"{장소}"} 등
              </p>
              {newTemplate.text && (
                <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                  <p className="font-medium mb-1">감지된 변수:</p>
                  <div className="flex flex-wrap gap-2">
                    {extractVariables(newTemplate.text).map((v) => (
                      <Badge key={v} variant="secondary" className="text-xs">
                        {`{${v}}`}
                      </Badge>
                    ))}
                    {extractVariables(newTemplate.text).length === 0 && (
                      <span className="text-muted-foreground">변수가 없습니다.</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsTemplateDialogOpen(false);
              setEditingTemplate(null);
              setNewTemplate({ name: "", category: "", text: "", purpose: selectedPurpose });
            }}>
              취소
            </Button>
            <Button onClick={handleSaveTemplate}>
              {editingTemplate ? "수정" : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 템플릿 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteTemplateDialog.open} onOpenChange={(open) => setDeleteTemplateDialog({ open, id: open ? deleteTemplateDialog.id : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>템플릿 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              정말 이 템플릿을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmDeleteTemplate}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 메시지 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteMessageDialog.open} onOpenChange={(open) => setDeleteMessageDialog({ open, id: open ? deleteMessageDialog.id : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>메시지 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              정말 이 메시지를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmDeleteMessage}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 체크리스트 복원 확인 다이얼로그 */}
      <AlertDialog open={restoreChecklistDialog.open} onOpenChange={(open) => setRestoreChecklistDialog({ open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>체크리스트 복원 확인</AlertDialogTitle>
            <AlertDialogDescription>
              기본 체크리스트로 복원하시겠습니까? 현재 수정된 내용은 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                localStorage.removeItem(`${CUSTOM_CHECKLIST_KEY}_${selectedPurpose}`);
                setCustomChecklist(null);
                setRestoreChecklistDialog({ open: false });
                toast({
                  title: "복원 완료",
                  description: "기본 체크리스트로 복원되었습니다.",
                });
              }}
            >
              복원
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 체크리스트 항목 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteChecklistItemDialog.open} onOpenChange={(open) => setDeleteChecklistItemDialog({ open, index: open ? deleteChecklistItemDialog.index : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>체크리스트 항목 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              이 항목을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deleteChecklistItemDialog.index !== null) {
                  const newList = currentChecklist.filter((_, i) => i !== deleteChecklistItemDialog.index);
                  saveCustomChecklist(newList);
                  setDeleteChecklistItemDialog({ open: false, index: null });
                  toast({
                    title: "삭제 완료",
                    description: "체크리스트 항목이 삭제되었습니다.",
                  });
                }
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 텍스트 분리/축약 선택 다이얼로그 */}
      <AlertDialog open={splitTextDialog.open} onOpenChange={(open) => setSplitTextDialog({ open, text: open ? splitTextDialog.text : "" })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>텍스트 처리 방법 선택</AlertDialogTitle>
            <AlertDialogDescription>
              현재 {splitTextDialog.text.length}자입니다. 처리 방법을 선택해주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setSplitTextDialog({ open: false, text: "" })}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  setIsLoadingAI(true);
                  const out = await editWithOpenAI(
                    splitTextDialog.text,
                    `300자 이내로 간결하게 축약하세요. 핵심 내용은 유지하되 불필요한 설명은 생략하세요.`
                  );
                  setCustomText(out);
                  setSplitTextDialog({ open: false, text: "" });
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
              }}
            >
              300자 이내로 축약 (AI 활용)
            </AlertDialogAction>
            <AlertDialogAction
              className="border border-border hover:bg-muted"
              onClick={() => {
                const chunks = splitTextIntoChunks(splitTextDialog.text, 300);
                if (chunks.length > 1) {
                  const combined = chunks.map((chunk, idx) => 
                    `[${idx + 1}]\n${chunk}`
                  ).join('\n\n');
                  setCustomText(combined);
                  setSplitTextDialog({ open: false, text: "" });
                  toast({
                    title: "분리 완료",
                    description: `${chunks.length}개로 분리되었습니다.`,
                  });
                }
              }}
            >
              300자 단위로 자동 분리
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
