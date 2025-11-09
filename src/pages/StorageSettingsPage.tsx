import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FolderOpen, Save, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import * as dbService from "@/services/dbService";
import * as fileStorageService from "@/services/fileStorageService";
import PageHeader from "@/components/layout/PageHeader";
import PageContainer from "@/components/layout/PageContainer";

export default function StorageSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [storagePath, setStoragePath] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Electron 환경 체크
    const checkElectron = () => {
      return typeof window !== 'undefined' && 
             ((window as any).electron !== undefined ||
              (window as any).require !== undefined);
    };
    setIsElectron(checkElectron());

    // 저장 경로 로드
    loadStoragePath();
  }, [user]);

  const loadStoragePath = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      // DB에서 저장 경로 로드
      const settings = await dbService.loadUserSettings(user.id);
      if (settings?.storagePath) {
        setStoragePath(settings.storagePath);
      } else {
        // Electron 환경에서 기본 경로 가져오기
        const defaultPath = await fileStorageService.getStorageRootPath();
        if (defaultPath) {
          setStoragePath(defaultPath);
        }
      }
    } catch (error) {
      console.error("저장 경로 로드 실패:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPath = async () => {
    try {
      const selectedPath = await fileStorageService.selectStoragePathDialog();
      if (selectedPath) {
        setStoragePath(selectedPath);
      }
    } catch (error) {
      console.error("경로 선택 실패:", error);
      toast({
        title: "경로 선택 실패",
        description: "경로 선택 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!user?.id) {
      toast({
        title: "로그인 필요",
        description: "저장 경로를 설정하려면 로그인이 필요합니다.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // DB에 저장
      const success = await dbService.saveUserSettings(user.id, {
        storagePath: storagePath || undefined,
      });

      // Electron 환경에서도 설정 저장
      if (isElectron && storagePath) {
        await fileStorageService.setStorageRootPath(storagePath);
      }

      if (success) {
        toast({
          title: "저장 완료",
          description: "저장 경로가 설정되었습니다.",
        });
      } else {
        throw new Error("DB 저장 실패");
      }
    } catch (error) {
      console.error("저장 경로 설정 실패:", error);
      toast({
        title: "저장 실패",
        description: "저장 경로 설정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        title="저장 경로 설정"
        description="음원 파일이 저장될 로컬 경로를 설정합니다."
        icon={FolderOpen}
      />

      <div className="space-y-6">
        {/* 환경 정보 */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {isElectron ? (
              <span>Electron 환경에서 실행 중입니다. 로컬 파일 시스템에 직접 저장할 수 있습니다.</span>
            ) : (
              <span>브라우저 환경에서는 다운로드 폴더를 사용합니다. Electron 환경에서는 로컬 경로를 설정할 수 있습니다.</span>
            )}
          </AlertDescription>
        </Alert>

        {/* 저장 경로 설정 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              저장 경로
            </CardTitle>
            <CardDescription>
              생성된 음원 파일이 저장될 기본 경로를 설정합니다.
              <br />
              <span className="text-xs text-muted-foreground mt-2 block">
                파일 구조: /audio/tts/YYYY/MMDD/voiceId_hash.[mp3|wav]
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="storage-path">저장 경로</Label>
              <div className="flex gap-2">
                <Input
                  id="storage-path"
                  value={storagePath}
                  onChange={(e) => setStoragePath(e.target.value)}
                  placeholder={isElectron ? "C:/Users/YourName/Documents/audio" : "브라우저에서는 다운로드 폴더 사용"}
                  disabled={!isElectron}
                  className="flex-1"
                />
                {isElectron && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSelectPath}
                    disabled={isLoading}
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    경로 선택
                  </Button>
                )}
              </div>
              {!isElectron && (
                <p className="text-xs text-muted-foreground">
                  브라우저 환경에서는 다운로드 폴더에 파일이 저장됩니다.
                </p>
              )}
            </div>

            {/* 저장 경로 정보 */}
            {storagePath && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  <strong>현재 경로:</strong> {storagePath}
                  <br />
                  <span className="text-xs text-muted-foreground">
                    예: {storagePath}/audio/tts/2024/1102/voice_abc123.mp3
                  </span>
                </AlertDescription>
              </Alert>
            )}

            {/* 저장 버튼 */}
            <div className="flex justify-end gap-2">
              <Button
                onClick={handleSave}
                disabled={isSaving || isLoading || (!isElectron && !storagePath)}
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 저장 규칙 설명 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              저장 규칙
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="space-y-1">
              <p className="font-medium">파일 구조:</p>
              <code className="block p-2 bg-muted rounded text-xs">
                {storagePath || "[저장경로]"}/audio/tts/YYYY/MMDD/voiceId_hash.[mp3|wav]
              </code>
            </div>
            <div className="space-y-1">
              <p className="font-medium">파일명 구성:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><code>voiceId</code>: 선택한 음성 ID</li>
                <li><code>hash</code>: 파라미터 해시 (중복 방지)</li>
                <li>확장자: MP3 또는 WAV</li>
              </ul>
            </div>
            <div className="space-y-1">
              <p className="font-medium">동작 방식:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>음원 생성 시 자동으로 파일이 저장됩니다</li>
                <li>DB에는 메타데이터와 파일 경로가 저장됩니다</li>
                <li>파일이 실제 저장소의 Single Source of Truth입니다</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

