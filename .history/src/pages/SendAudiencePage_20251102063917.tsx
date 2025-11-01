import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, Users, Trash2, Plus, FileSpreadsheet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

interface AudienceMember {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  organization?: string;
  department?: string;
}

export default function SendAudiencePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [audience, setAudience] = useState<AudienceMember[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // TODO: CSV/Excel 파일 파싱 및 대상자 목록 추출
      // 현재는 예시 데이터
      const text = await file.text();
      // 간단한 CSV 파싱 (실제로는 라이브러리 사용 권장)
      const lines = text.split("\n");
      const headers = lines[0]?.split(",") || [];
      const members: AudienceMember[] = lines.slice(1).map((line, index) => {
        const values = line.split(",");
        return {
          id: `member_${Date.now()}_${index}`,
          name: values[0] || `대상자 ${index + 1}`,
          phone: values[1],
          email: values[2],
          organization: values[3],
          department: values[4],
        };
      }).filter((m) => m.name);

      setAudience([...audience, ...members]);
      toast({
        title: "업로드 완료",
        description: `${members.length}명의 대상자가 추가되었습니다.`,
      });
    } catch (error) {
      console.error("파일 업로드 실패:", error);
      toast({
        title: "업로드 실패",
        description: "파일을 읽는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = (id: string) => {
    setAudience(audience.filter((m) => m.id !== id));
    toast({
      title: "삭제 완료",
      description: "대상자가 삭제되었습니다.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">대상자 관리</h1>
          <p className="text-muted-foreground mt-1">
            전송 대상자를 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            총 {audience.length}명
          </Badge>
          <Button
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".csv,.xlsx,.xls";
              input.onchange = (e) => handleFileUpload(e as any);
              input.click();
            }}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                업로드 중...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                파일 업로드
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 대상자 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>대상자 목록</CardTitle>
          <CardDescription>
            CSV 또는 Excel 파일로 대상자를 일괄 등록할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {audience.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">등록된 대상자가 없습니다.</p>
              <Button
                variant="outline"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".csv,.xlsx,.xls";
                  input.onchange = (e) => handleFileUpload(e as any);
                  input.click();
                }}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                파일로 대상자 추가
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {audience.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium">{member.name}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      {member.phone && <span>📞 {member.phone}</span>}
                      {member.email && <span>✉️ {member.email}</span>}
                      {member.organization && <span>🏢 {member.organization}</span>}
                      {member.department && <span>• {member.department}</span>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(member.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
