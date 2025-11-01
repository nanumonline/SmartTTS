import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, UserPlus, Trash2, Edit } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

interface Role {
  id: string;
  name: string;
  permissions: string[];
  userCount: number;
}

export default function SettingsRolesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>([
    { id: "admin", name: "관리자", permissions: ["all"], userCount: 1 },
    { id: "editor", name: "편집자", permissions: ["create", "edit"], userCount: 3 },
    { id: "viewer", name: "뷰어", permissions: ["view"], userCount: 5 },
  ]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState({
    name: "",
    permissions: [] as string[],
  });

  const availablePermissions = [
    { value: "view", label: "조회" },
    { value: "create", label: "생성" },
    { value: "edit", label: "수정" },
    { value: "delete", label: "삭제" },
    { value: "approve", label: "승인" },
    { value: "send", label: "전송" },
    { value: "all", label: "전체 권한" },
  ];

  const handleCreateRole = () => {
    if (!newRole.name.trim()) {
      toast({
        title: "입력 필요",
        description: "역할 이름을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    const role: Role = {
      id: `role_${Date.now()}`,
      name: newRole.name,
      permissions: newRole.permissions,
      userCount: 0,
    };

    setRoles([...roles, role]);
    setIsCreateDialogOpen(false);
    setNewRole({ name: "", permissions: [] });

    toast({
      title: "역할 생성 완료",
      description: "새 역할이 생성되었습니다.",
    });
  };

  const handleDeleteRole = (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    setRoles(roles.filter((r) => r.id !== id));
    toast({
      title: "삭제 완료",
      description: "역할이 삭제되었습니다.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">권한 설정</h1>
          <p className="text-muted-foreground mt-1">
            사용자 역할 및 권한을 관리합니다.
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          새 역할
        </Button>
      </div>

      {/* 역할 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map((role) => (
          <Card key={role.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-2">{role.name}</CardTitle>
                  <CardDescription>
                    {role.userCount}명의 사용자
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <Edit className="w-4 h-4" />
                  </Button>
                  {role.id !== "admin" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteRole(role.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {role.permissions.includes("all") ? (
                  <Badge variant="default">전체 권한</Badge>
                ) : (
                  role.permissions.map((perm) => {
                    const permLabel = availablePermissions.find((p) => p.value === perm)?.label || perm;
                    return <Badge key={perm} variant="outline">{permLabel}</Badge>;
                  })
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 역할 생성 다이얼로그 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>새 역할 생성</DialogTitle>
            <DialogDescription>
              새로운 역할을 생성하고 권한을 설정합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>역할 이름 *</Label>
              <Input
                value={newRole.name}
                onChange={(e) =>
                  setNewRole({ ...newRole, name: e.target.value })
                }
                placeholder="예: 편집자"
              />
            </div>
            <div className="space-y-2">
              <Label>권한 선택</Label>
              <div className="space-y-2">
                {availablePermissions
                  .filter((p) => p.value !== "all")
                  .map((perm) => (
                    <div key={perm.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newRole.permissions.includes(perm.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewRole({
                              ...newRole,
                              permissions: [...newRole.permissions, perm.value],
                            });
                          } else {
                            setNewRole({
                              ...newRole,
                              permissions: newRole.permissions.filter(
                                (p) => p !== perm.value
                              ),
                            });
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <Label className="font-normal">{perm.label}</Label>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleCreateRole}>생성</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
