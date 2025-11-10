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
import { Plus, FileText, Edit, Trash2, Copy, CheckCircle, Save, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import * as dbService from "@/services/dbService";
import { correctKoreanPostpositions } from "@/lib/koreanPostposition";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5; // 페이지당 템플릿 개수
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    text: "",
    purpose: "announcement",
    category: "greeting",
  });

  useEffect(() => {
    if (user?.id) {
      loadTemplates();
      setCurrentPage(1); // 카테고리 변경 시 첫 페이지로 리셋
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
      // 인사말 카테고리
      {
        text: "안녕하십니까. {기관명} 시장 {담당자명}입니다. {이벤트명}을 맞이하여 시민 여러분께 인사드립니다. 항상 시민의 행복과 지역발전을 위해 최선을 다하겠습니다. 감사합니다.",
        purpose: "greeting",
        templateName: "시장 인사말",
        templateCategory: "greeting",
      },
      {
        text: "안녕하십니까. {기관명} 도지사 {담당자명}입니다. {정책명} 정책을 통해 도민 여러분의 삶의 질 향상에 최선을 다하겠습니다. 여러분의 소중한 의견과 참여를 부탁드립니다.",
        purpose: "greeting",
        templateName: "도지사 인사말",
        templateCategory: "greeting",
      },
      // 안내방송 카테고리
      {
        text: "{기관명}에서 {내용}을 안내드립니다. 자세한 사항은 {연락처}로 문의해주시기 바랍니다. 많은 관심과 참여 부탁드립니다.",
        purpose: "announcement",
        templateName: "기본 안내방송",
        templateCategory: "announcement",
      },
      {
        text: "안내방송입니다. {기관명}에서 {내용}을 알려드립니다. {일시}에 {장소}에서 진행되며, {안내사항}을 참고해주시기 바랍니다. 문의사항은 {연락처}로 연락주시기 바랍니다.",
        purpose: "announcement",
        templateName: "상세 안내방송",
        templateCategory: "announcement",
      },
      // 긴급 안내 카테고리
      {
        text: "긴급 안내입니다. {기관명}에서 알려드립니다. {상황설명}으로 인해 {대응방안}을 시행합니다. 시민 여러분께서는 {행동지침}을 따라주시기 바랍니다. 자세한 사항은 {연락처}로 문의해주세요.",
        purpose: "emergency",
        templateName: "긴급 안내방송",
        templateCategory: "emergency",
      },
      // 행사 안내 카테고리
      {
        text: "{기관명}에서 알려드립니다. {행사명}이 {일시}에 {장소}에서 개최됩니다. 행사 기간은 {기간}이며, {행사내용}을 준비하였으니 많은 참여 부탁드립니다. 자세한 사항은 {연락처}로 문의해주세요.",
        purpose: "event",
        templateName: "행사 안내",
        templateCategory: "event",
      },
      // 서비스 안내 카테고리
      {
        text: "{기관명}에서 안내드립니다. {서비스명} 서비스가 {변경사항}으로 운영됩니다. 이용시간은 {운영시간}이며, 적용 기간은 {기간}입니다. 문의사항은 {연락처}로 연락주시기 바랍니다.",
        purpose: "service",
        templateName: "서비스 안내",
        templateCategory: "service",
      },
      // 정책안내 카테고리
      {
        text: "{기관명}에서 새로운 정책을 발표합니다. {정책명}을 통해 {정책목표}를 달성하고자 합니다. {정책내용}으로 운영되며, {적용대상}에게 혜택이 제공됩니다. 신청 기간은 {기간}입니다. 자세한 내용은 {홈페이지}에서 확인하실 수 있습니다.",
        purpose: "policy",
        templateName: "정책 발표",
        templateCategory: "policy",
      },
      // 홍보/광고 카테고리
      {
        text: "{기관명}에서 {홍보대상}을 홍보합니다. {홍보내용}을 통해 {기대효과}를 기대하고 있습니다. {참여방법}으로 참여하실 수 있으며, 자세한 사항은 {연락처}로 문의해주세요.",
        purpose: "promotion",
        templateName: "홍보 방송",
        templateCategory: "promotion",
      },
      // 복지 안내 카테고리
      {
        text: "{기관명}에서 복지 정책을 안내드립니다. {복지정책명}을 통해 {수혜대상}에게 {혜택내용}이 제공됩니다. 신청 기간은 {기간}이며, 신청 방법은 {신청방법}입니다. 문의사항은 {연락처}로 연락주시기 바랍니다.",
        purpose: "welfare",
        templateName: "복지 정책 안내",
        templateCategory: "welfare",
      },
      // 교통 안내 카테고리
      {
        text: "{기관명}에서 교통 안내를 드립니다. {구간} 구간에서 {교통상황}으로 인해 {통행제한}이 시행됩니다. 통행 시간은 {시간}이며, 대체 경로는 {대체경로}입니다. 안전 운전에 주의해주시기 바랍니다.",
        purpose: "traffic",
        templateName: "교통 안내",
        templateCategory: "traffic",
      },
      // 환경 안내 카테고리
      {
        text: "{기관명}에서 환경 정책을 안내드립니다. {정책명}을 통해 {정책목표}를 달성하고자 합니다. 시민 여러분의 {참여방법} 참여를 부탁드리며, {기대효과}를 기대하고 있습니다. 자세한 사항은 {연락처}로 문의해주세요.",
        purpose: "environment",
        templateName: "환경 정책 안내",
        templateCategory: "environment",
      },
      // 문화/관광 안내 카테고리
      {
        text: "{기관명}에서 문화행사를 안내드립니다. {행사명}이 {일시}에 {장소}에서 개최됩니다. {행사내용}을 준비하였으며, 참여비는 {비용}입니다. 많은 관심과 참여 부탁드립니다. 문의사항은 {연락처}로 연락주시기 바랍니다.",
        purpose: "culture",
        templateName: "문화행사 안내",
        templateCategory: "culture",
      },
      // 시설 이용 안내 카테고리
      {
        text: "{기관명}에서 시설 이용 안내를 드립니다. {시설명}은 {위치}에 위치해 있으며, 이용 시간은 {이용시간}입니다. 이용 시 {주의사항}을 준수해주시기 바랍니다. 문의사항은 {연락처}로 연락주시기 바랍니다.",
        purpose: "facility",
        templateName: "시설 이용 안내",
        templateCategory: "facility",
      },
      // 민원 안내 카테고리
      {
        text: "{기관명}에서 민원 안내를 드립니다. {민원종류} 민원은 {접수방법}으로 접수하실 수 있으며, 처리 기한은 {처리기한}입니다. 접수 시 {필수서류}를 준비해주시기 바랍니다. 문의사항은 {연락처}로 연락주시기 바랍니다.",
        purpose: "civil",
        templateName: "민원 접수 안내",
        templateCategory: "civil",
      },
      // 재난 안내 카테고리
      {
        text: "재난 안내입니다. {기관명}에서 알려드립니다. {재난유형}으로 인해 {위험도} 단계가 발령되었습니다. 대피 방법은 {대피방법}이며, 대피 장소는 {대피장소}입니다. 긴급 상황 시 {긴급연락처}로 연락주시기 바랍니다.",
        purpose: "disaster",
        templateName: "재난 대피 안내",
        templateCategory: "disaster",
      },
      // 축하 인사 카테고리
      {
        text: "{기관명}에서 {축하대상}을 축하드립니다. {축하이유}를 맞이하여 진심으로 축하 인사를 드립니다. 앞으로도 {기대메시지}를 기대하며, 감사합니다.",
        purpose: "celebration",
        templateName: "축하 인사",
        templateCategory: "celebration",
      },
      // 보건 안내 카테고리
      {
        text: "{기관명}에서 보건 안내를 드립니다. {보건정보}에 대해 안내드리며, 시민 여러분께서는 {행동요령}을 따라주시기 바랍니다. 관련 기관 연락처는 {연락처}입니다. 건강에 주의하시기 바랍니다.",
        purpose: "health",
        templateName: "보건 정보 안내",
        templateCategory: "health",
      },
      // 교육 안내 카테고리
      {
        text: "{기관명}에서 교육 프로그램을 안내드립니다. {프로그램명}은 {대상}을 대상으로 진행되며, 신청 기간은 {기간}입니다. 신청 방법은 {신청방법}이며, 많은 관심과 참여 부탁드립니다. 문의사항은 {연락처}로 연락주시기 바랍니다.",
        purpose: "education",
        templateName: "교육 프로그램 안내",
        templateCategory: "education",
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
    
    // 변수 추출
    const variables = (template.variables || []).length > 0 
      ? template.variables! 
      : (template.text.match(/\{([^}]+)\}/g) || []).map(v => v.replace(/[{}]/g, ""));
    
    // 사용자 정보 기반 기본값 설정
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
      "연구분야": "",
      "서비스명": "",
      "변경사항": "",
      "운영시간": "",
      "행사명": "",
      "행사내용": "",
      "내용": "",
      "날짜": new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }),
      "기간": "",
      "안내사항": "",
      "홍보대상": "",
      "홍보내용": "",
      "기대효과": "",
      "참여방법": "",
      "복지정책명": "",
      "수혜대상": "",
      "혜택내용": "",
      "신청방법": "",
      "구간": "",
      "교통상황": "",
      "통행제한": "",
      "시간": "",
      "대체경로": "",
      "비용": "",
      "시설명": "",
      "위치": "",
      "이용시간": "",
      "주의사항": "",
      "민원종류": "",
      "접수방법": "",
      "처리기한": "",
      "필수서류": "",
      "재난유형": "",
      "위험도": "",
      "대피방법": "",
      "대피장소": "",
      "긴급연락처": "",
      "축하대상": "",
      "축하이유": "",
      "기대메시지": "",
      "보건정보": "",
      "행동요령": "",
      "프로그램명": "",
      "대상": "",
    };
    
    // 변수 초기화 (중복 제거)
    const uniqueVariables = [...new Set(variables)];
    const vars: Record<string, string> = {};
    uniqueVariables.forEach((v) => {
      vars[v] = defaultValues[v] || "";
    });
    setTemplateVariables(vars);
    
    // 초기 텍스트 생성 (기본값이 있는 변수는 교체)
    let initialText = template.text;
    Object.keys(vars).forEach((key) => {
      if (vars[key]) {
        const regex = new RegExp(`\\{${key}\\}`, "g");
        initialText = initialText.replace(regex, vars[key]);
      }
    });
    
    // 한국어 조사 교정
    const corrected = correctKoreanPostpositions(initialText);
    setResolvedText(corrected);
  };

  const handleVariableChange = (varName: string, value: string) => {
    const updated = { ...templateVariables, [varName]: value };
    setTemplateVariables(updated);

    if (!selectedTemplate) return;

    // 변수 교체 (빈 값이면 변수명 그대로 유지)
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

  const handleSaveResolvedMessage = async () => {
    if (!resolvedText.trim()) {
      toast({
        title: "저장할 내용 없음",
        description: "변수를 먼저 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id || !selectedTemplate) {
      toast({
        title: "저장 실패",
        description: "로그인이 필요하거나 템플릿이 선택되지 않았습니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      const messageId = await dbService.saveMessage(user.id, {
        text: resolvedText,
        purpose: selectedTemplate.purpose || "announcement", // 기본값 설정
        isTemplate: false, // 일반 메시지로 저장
      });

      if (messageId) {
        toast({
          title: "저장 완료",
          description: "적용된 메시지가 저장되었습니다.",
        });
      } else {
        throw new Error("메시지 저장에 실패했습니다.");
      }
    } catch (error: any) {
      console.error("메시지 저장 실패:", error);
      const errorMessage = error?.message || error?.code || "알 수 없는 오류";
      toast({
        title: "저장 실패",
        description: `메시지 저장 중 오류가 발생했습니다: ${errorMessage}`,
        variant: "destructive",
      });
    }
  };

  // 카테고리/용도 한글 변환 함수
  const getCategoryLabel = (category: string): string => {
    const categoryMap: Record<string, string> = {
      greeting: "인사말",
      announcement: "안내방송",
      policy: "정책안내",
      emergency: "긴급 안내",
      event: "행사 안내",
      service: "서비스 안내",
      promotion: "홍보/광고",
      welfare: "복지 안내",
      traffic: "교통 안내",
      environment: "환경 안내",
      culture: "문화/관광 안내",
      facility: "시설 이용 안내",
      civil: "민원 안내",
      disaster: "재난 안내",
      celebration: "축하 인사",
      health: "보건 안내",
      education: "교육 안내",
    };
    return categoryMap[category] || category;
  };

  const getPurposeLabel = (purpose: string): string => {
    const purposeMap: Record<string, string> = {
      greeting: "인사말",
      announcement: "안내방송",
      policy: "정책안내",
      emergency: "긴급 안내",
      event: "행사 안내",
      service: "서비스 안내",
      promotion: "홍보/광고",
      welfare: "복지 안내",
      traffic: "교통 안내",
      environment: "환경 안내",
      culture: "문화/관광 안내",
      facility: "시설 이용 안내",
      civil: "민원 안내",
      disaster: "재난 안내",
      celebration: "축하 인사",
      health: "보건 안내",
      education: "교육 안내",
    };
    return purposeMap[purpose] || purpose;
  };

  // 페이지네이션 계산
  const totalPages = Math.ceil(templates.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTemplates = templates.slice(startIndex, endIndex);

  const purposes = [
    { value: "announcement", label: "안내방송" },
    { value: "emergency", label: "긴급 안내" },
    { value: "greeting", label: "인사말" },
    { value: "policy", label: "정책안내" },
    { value: "event", label: "행사 안내" },
    { value: "service", label: "서비스 안내" },
    { value: "promotion", label: "홍보/광고" },
    { value: "welfare", label: "복지 안내" },
    { value: "traffic", label: "교통 안내" },
    { value: "environment", label: "환경 안내" },
    { value: "culture", label: "문화/관광 안내" },
    { value: "facility", label: "시설 이용 안내" },
    { value: "civil", label: "민원 안내" },
    { value: "disaster", label: "재난 안내" },
    { value: "celebration", label: "축하 인사" },
    { value: "health", label: "보건 안내" },
    { value: "education", label: "교육 안내" },
  ];

  const categories = [
    { value: "all", label: "전체" },
    { value: "greeting", label: "인사말" },
    { value: "announcement", label: "안내방송" },
    { value: "policy", label: "정책안내" },
    { value: "emergency", label: "긴급 안내" },
    { value: "event", label: "행사 안내" },
    { value: "service", label: "서비스 안내" },
    { value: "promotion", label: "홍보/광고" },
    { value: "welfare", label: "복지 안내" },
    { value: "traffic", label: "교통 안내" },
    { value: "environment", label: "환경 안내" },
    { value: "culture", label: "문화/관광 안내" },
    { value: "facility", label: "시설 이용 안내" },
    { value: "civil", label: "민원 안내" },
    { value: "disaster", label: "재난 안내" },
    { value: "celebration", label: "축하 인사" },
    { value: "health", label: "보건 안내" },
    { value: "education", label: "교육 안내" },
  ];

  // 카테고리별 예시 템플릿 텍스트
  const getTemplateExample = (category: string): string => {
    const examples: Record<string, string> = {
      greeting: "안녕하십니까. {기관명} 시장 {담당자명}입니다. {이벤트명}을 맞이하여 시민 여러분께 인사드립니다. 항상 시민의 행복과 지역발전을 위해 최선을 다하겠습니다. 감사합니다.",
      announcement: "{기관명}에서 {내용}을 안내드립니다. 자세한 사항은 {연락처}로 문의해주시기 바랍니다. 많은 관심과 참여 부탁드립니다.",
      policy: "{기관명}에서 새로운 정책을 발표합니다. {정책명}을 통해 {정책목표}를 달성하고자 합니다. {정책내용}으로 운영되며, {적용대상}에게 혜택이 제공됩니다. 신청 기간은 {기간}입니다. 자세한 내용은 {홈페이지}에서 확인하실 수 있습니다.",
      emergency: "긴급 안내입니다. {기관명}에서 알려드립니다. {상황설명}으로 인해 {대응방안}을 시행합니다. 시민 여러분께서는 {행동지침}을 따라주시기 바랍니다. 자세한 사항은 {연락처}로 문의해주세요.",
      event: "{기관명}에서 알려드립니다. {행사명}이 {일시}에 {장소}에서 개최됩니다. 행사 기간은 {기간}이며, {행사내용}을 준비하였으니 많은 참여 부탁드립니다. 자세한 사항은 {연락처}로 문의해주세요.",
      service: "{기관명}에서 안내드립니다. {서비스명} 서비스가 {변경사항}으로 운영됩니다. 이용시간은 {운영시간}이며, 적용 기간은 {기간}입니다. 문의사항은 {연락처}로 연락주시기 바랍니다.",
      promotion: "{기관명}에서 {홍보대상}을 홍보합니다. {홍보내용}을 통해 {기대효과}를 기대하고 있습니다. {참여방법}으로 참여하실 수 있으며, 자세한 사항은 {연락처}로 문의해주세요.",
      welfare: "{기관명}에서 복지 정책을 안내드립니다. {복지정책명}을 통해 {수혜대상}에게 {혜택내용}이 제공됩니다. 신청 기간은 {기간}이며, 신청 방법은 {신청방법}입니다. 문의사항은 {연락처}로 연락주시기 바랍니다.",
      traffic: "{기관명}에서 교통 안내를 드립니다. {구간} 구간에서 {교통상황}으로 인해 {통행제한}이 시행됩니다. 통행 시간은 {시간}이며, 대체 경로는 {대체경로}입니다. 안전 운전에 주의해주시기 바랍니다.",
      environment: "{기관명}에서 환경 정책을 안내드립니다. {환경정책명}을 통해 {정책목표}를 달성하고자 합니다. 시민 여러분의 {참여방법} 참여를 부탁드리며, {기대효과}를 기대하고 있습니다. 자세한 사항은 {연락처}로 문의해주세요.",
      culture: "{기관명}에서 문화행사를 안내드립니다. {행사명}이 {일시}에 {장소}에서 개최됩니다. {행사내용}을 준비하였으며, 참여비는 {비용}입니다. 많은 관심과 참여 부탁드립니다. 문의사항은 {연락처}로 연락주시기 바랍니다.",
      facility: "{기관명}에서 시설 이용 안내를 드립니다. {시설명}은 {위치}에 위치해 있으며, 이용 시간은 {이용시간}입니다. 이용 시 {주의사항}을 준수해주시기 바랍니다. 문의사항은 {연락처}로 연락주시기 바랍니다.",
      civil: "{기관명}에서 민원 안내를 드립니다. {민원종류} 민원은 {접수방법}으로 접수하실 수 있으며, 처리 기한은 {처리기한}입니다. 접수 시 {필수서류}를 준비해주시기 바랍니다. 문의사항은 {연락처}로 연락주시기 바랍니다.",
      disaster: "재난 안내입니다. {기관명}에서 알려드립니다. {재난유형}으로 인해 {위험도} 단계가 발령되었습니다. 대피 방법은 {대피방법}이며, 대피 장소는 {대피장소}입니다. 긴급 상황 시 {긴급연락처}로 연락주시기 바랍니다.",
      celebration: "{기관명}에서 {축하대상}을 축하드립니다. {축하이유}를 맞이하여 진심으로 축하 인사를 드립니다. 앞으로도 {기대메시지}를 기대하며, 감사합니다.",
      health: "{기관명}에서 보건 안내를 드립니다. {보건정보}에 대해 안내드리며, 시민 여러분께서는 {행동요령}을 따라주시기 바랍니다. 관련 기관 연락처는 {연락처}입니다. 건강에 주의하시기 바랍니다.",
      education: "{기관명}에서 교육 프로그램을 안내드립니다. {프로그램명}은 {대상}을 대상으로 진행되며, 신청 기간은 {기간}입니다. 신청 방법은 {신청방법}이며, 많은 관심과 참여 부탁드립니다. 문의사항은 {연락처}로 연락주시기 바랍니다.",
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
        <div className="space-y-2">
          <span className="text-sm font-medium">카테고리:</span>
          <div className="grid grid-cols-9 gap-2">
            {categories.map((cat) => (
              <Button
                key={cat.value}
                variant={selectedCategory === cat.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat.value)}
                className="w-full"
              >
                {cat.label}
              </Button>
            ))}
          </div>
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
              <>
                {paginatedTemplates.map((template) => (
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
                          <Badge variant="outline">{getCategoryLabel(template.templateCategory || "")}</Badge>
                          <Badge variant="secondary" className="text-xs">{getPurposeLabel(template.purpose || "")}</Badge>
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
                ))}
                {/* 페이지네이션 */}
                {totalPages > 1 && (
                  <div className="mt-4 flex justify-center">
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
                      const isRequired = ["기관명", "담당자명", "부서명", "내용"].includes(varName);
                      const placeholderMap: Record<string, string> = {
                        "기관명": "예: 강원특별자치도청",
                        "담당자명": "예: 김철수",
                        "부서명": "예: 기획조정실",
                        "연락처": "예: 033-123-4567",
                        "홈페이지": "예: www.example.go.kr",
                        "이벤트명": "예: 신년인사회",
                        "정책명": "예: 지역발전 정책",
                        "정책목표": "예: 지역경제 활성화",
                        "정책내용": "예: 소상공인 지원 프로그램 운영",
                        "적용대상": "예: 지역 소상공인",
                        "상황설명": "예: 폭설로 인한 교통 불편",
                        "대응방안": "예: 제설 작업 실시",
                        "행동지침": "예: 외출 자제 및 안전 운전",
                        "일시": "예: 2025년 1월 15일 오후 2시",
                        "장소": "예: 시청 대회의실",
                        "연구분야": "예: 지역산업 연구",
                        "서비스명": "예: 민원 상담 서비스",
                        "변경사항": "예: 온라인 예약제 도입",
                        "운영시간": "예: 평일 09:00~18:00",
                        "행사명": "예: 지역 문화 축제",
                        "행사내용": "예: 전통 공연 및 체험 프로그램",
                        "내용": "예: 주요 공지사항 안내",
                        "날짜": "예: 2025년 1월 15일",
                        "기간": "예: 2025년 1월 15일 ~ 1월 31일",
                      };
                      
                      return (
                        <div key={varName} className="space-y-1">
                          <Label htmlFor={`var-${varName}`} className="text-sm">
                            {varName} {isRequired && <span className="text-red-500">*</span>}
                          </Label>
                          <Input
                            id={`var-${varName}`}
                            value={templateVariables[varName] || ""}
                            onChange={(e) => handleVariableChange(varName, e.target.value)}
                            placeholder={placeholderMap[varName] || `{${varName}} 입력`}
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
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={handleCopyResolved}>
                          <Copy className="w-4 h-4 mr-2" />
                          복사
                        </Button>
                        <Button variant="default" size="sm" onClick={handleSaveResolvedMessage}>
                          <Save className="w-4 h-4 mr-2" />
                          저장
                        </Button>
                      </div>
                    </div>
                    <Textarea
                      value={resolvedText}
                      readOnly
                      className="min-h-[150px] bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      💡 변수를 모두 입력하면 자동으로 조사가 교정됩니다. 저장 버튼을 클릭하면 문구 관리에서 확인할 수 있습니다.
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

