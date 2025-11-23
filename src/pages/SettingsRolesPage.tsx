import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Shield, UserPlus, Trash2, Edit, Users, Building2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as dbService from "@/services/dbService";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";

interface Role {
  id: string;
  name: string;
  permissions: string[];
  userCount: number;
}

interface OrganizationUser {
  id: string;
  email: string;
  full_name: string;
  organization: string;
  department: string;
  role?: string;
  permissions?: string[];
}

export default function SettingsRolesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [organizationUsers, setOrganizationUsers] = useState<OrganizationUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editUserDialog, setEditUserDialog] = useState<{ open: boolean; user: OrganizationUser | null }>({
    open: false,
    user: null,
  });
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState({
    name: "",
    permissions: [] as string[],
  });
  const [userRoleUpdate, setUserRoleUpdate] = useState<{
    userId: string;
    role: string;
    permissions: string[];
  } | null>(null);

  useEffect(() => {
    if (user?.id && user?.organization) {
      loadOrganizationData();
    }
  }, [user?.id, user?.organization]);

  const availablePermissions = [
    { value: "view", label: "조회" },
    { value: "create", label: "생성" },
    { value: "edit", label: "수정" },
    { value: "delete", label: "삭제" },
    { value: "approve", label: "승인" },
    { value: "send", label: "전송" },
    { value: "all", label: "전체 권한" },
  ];

  const loadOrganizationData = async () => {
    if (!user?.id || !user?.organization) {
      toast({
        title: "조직 정보 없음",
        description: "조직 정보가 없습니다. 프로필을 업데이트해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // 같은 조직의 사용자 목록 조회
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, organization, department")
        .eq("organization", user.organization)
        .order("full_name");

      if (profilesError) {
        throw profilesError;
      }

      // 각 사용자의 역할 정보를 user_settings에서 가져오기
      const usersWithRoles: OrganizationUser[] = await Promise.all(
        (profiles || []).map(async (profile) => {
          // user_settings에서 역할 정보 조회
          const { data: settings } = await supabase
            .from("tts_user_settings")
            .select("preferences")
            .eq("user_id", profile.id)
            .maybeSingle();

          const role = settings?.preferences?.role || "viewer";
          const permissions = settings?.preferences?.permissions || ["view"];

          // 현재 세션의 사용자 이메일은 auth.getUser()로 가져올 수 있지만,
          // 다른 사용자의 이메일은 RLS 정책 때문에 가져올 수 없습니다.
          // 따라서 프로필 이름이나 ID를 사용합니다.
          const displayName = profile.full_name || profile.id.substring(0, 8) || "이름 없음";

          return {
            id: profile.id,
            email: "", // RLS 정책 때문에 다른 사용자의 이메일은 가져올 수 없음
            full_name: displayName,
            organization: profile.organization || "",
            department: profile.department || "",
            role,
            permissions: Array.isArray(permissions) ? permissions : [permissions],
          };
        })
      );

      setOrganizationUsers(usersWithRoles);

      // 역할별 사용자 수 계산
      const roleMap = new Map<string, { name: string; permissions: string[]; userCount: number }>();
      
      usersWithRoles.forEach((orgUser) => {
        const roleId = orgUser.role || "viewer";
        if (!roleMap.has(roleId)) {
          roleMap.set(roleId, {
            name: getRoleName(roleId),
            permissions: orgUser.permissions || [],
            userCount: 0,
          });
        }
        const role = roleMap.get(roleId)!;
        role.userCount++;
      });

      // 역할 목록 생성
      const rolesList: Role[] = Array.from(roleMap.entries()).map(([id, data]) => ({
        id,
        name: data.name,
        permissions: data.permissions,
        userCount: data.userCount,
      }));

      setRoles(rolesList);
    } catch (error: any) {
      console.error("조직 데이터 로드 실패:", error);
      toast({
        title: "로드 실패",
        description: "조직 데이터를 불러오는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleName = (roleId: string): string => {
    const roleNames: Record<string, string> = {
      admin: "관리자",
      editor: "편집자",
      viewer: "뷰어",
    };
    return roleNames[roleId] || roleId;
  };

  const handleCreateRole = async () => {
    if (!newRole.name.trim()) {
      toast({
        title: "입력 필요",
        description: "역할 이름을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    // 역할은 미리 정의된 것만 사용 (admin, editor, viewer)
    const roleId = newRole.name.toLowerCase().includes("관리") ? "admin" :
                   newRole.name.toLowerCase().includes("편집") ? "editor" : "viewer";

    const role: Role = {
      id: roleId,
      name: newRole.name,
      permissions: newRole.permissions.length > 0 ? newRole.permissions : ["view"],
      userCount: 0,
    };

    setRoles([...roles.filter(r => r.id !== roleId), role]);
    setIsCreateDialogOpen(false);
    setNewRole({ name: "", permissions: [] });

    toast({
      title: "역할 생성 완료",
      description: "새 역할이 생성되었습니다.",
    });
  };

  const handleDeleteRole = (id: string) => {
    if (id === "admin") {
      toast({
        title: "삭제 불가",
        description: "관리자 역할은 삭제할 수 없습니다.",
        variant: "destructive",
      });
      return;
    }
    setDeleteRoleId(id);
  };

  const confirmDeleteRole = () => {
    if (!deleteRoleId) return;
    setRoles(roles.filter((r) => r.id !== deleteRoleId));
    setDeleteRoleId(null);
    toast({
      title: "삭제 완료",
      description: "역할이 삭제되었습니다.",
    });
  };

  const handleUpdateUserRole = async () => {
    if (!userRoleUpdate || !user?.id) return;

    try {
      // 현재 사용자 설정 가져오기
      const currentSettings = await dbService.loadUserSettings(userRoleUpdate.userId);
      
      // 역할 및 권한 업데이트
      const success = await dbService.saveUserSettings(userRoleUpdate.userId, {
        ...currentSettings,
        preferences: {
          ...currentSettings?.preferences,
          role: userRoleUpdate.role,
          permissions: userRoleUpdate.permissions,
        },
      });

      if (success) {
        toast({
          title: "권한 업데이트 완료",
          description: "사용자 권한이 업데이트되었습니다.",
        });
        await loadOrganizationData();
        setEditUserDialog({ open: false, user: null });
        setUserRoleUpdate(null);
      } else {
        throw new Error("권한 업데이트 실패");
      }
    } catch (error: any) {
      console.error("권한 업데이트 실패:", error);
      toast({
        title: "업데이트 실패",
        description: "사용자 권한 업데이트 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const openEditUserDialog = (orgUser: OrganizationUser) => {
    setEditUserDialog({ open: true, user: orgUser });
    setUserRoleUpdate({
      userId: orgUser.id,
      role: orgUser.role || "viewer",
      permissions: orgUser.permissions || ["view"],
    });
  };

  if (!user?.organization) {
    return (
      <PageContainer maxWidth="wide">
        <PageHeader
          title="권한 설정"
          description="사용자 역할 및 권한을 관리합니다."
        />
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                조직 정보가 없습니다. 프로필에서 조직을 설정해주세요.
              </p>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        title="권한 설정"
        description={`${user.organization} 조직의 사용자 역할 및 권한을 관리합니다.`}
        action={
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            새 역할
          </Button>
        }
      />

      {/* 조직 정보 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            조직 정보
          </CardTitle>
          <CardDescription>
            현재 조직의 구성원 및 역할을 관리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">조직명</Label>
                <p className="font-medium">{user.organization}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">부서</Label>
                <p className="font-medium">{user.department || "미지정"}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">구성원 수</Label>
                <p className="font-medium">{organizationUsers.length}명</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 조직 구성원 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            조직 구성원
          </CardTitle>
          <CardDescription>
            같은 조직의 사용자 목록입니다. 각 사용자의 역할과 권한을 관리할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">로딩 중...</p>
            </div>
          ) : organizationUsers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">조직 구성원이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {organizationUsers.map((orgUser) => (
                <div
                  key={orgUser.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-base">
                          {orgUser.full_name || "이름 없음"}
                        </p>
                        {orgUser.id === user.id && (
                          <Badge variant="outline" className="text-xs">나</Badge>
                        )}
                        <Badge variant={orgUser.role === "admin" ? "default" : orgUser.role === "editor" ? "secondary" : "outline"} className="text-xs">
                          {getRoleName(orgUser.role || "viewer")}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1 space-y-1">
                        <p className="text-xs">ID: {orgUser.id.substring(0, 8)}...</p>
                        {orgUser.department && (
                          <p className="text-xs">부서: {orgUser.department}</p>
                        )}
                        {orgUser.permissions && orgUser.permissions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {orgUser.permissions.map((perm) => {
                              const permLabel = availablePermissions.find((p) => p.value === perm)?.label || perm;
                              return (
                                <Badge key={perm} variant="outline" className="text-xs">
                                  {permLabel}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditUserDialog(orgUser)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 역할 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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

      {/* 사용자 권한 수정 다이얼로그 */}
      <Dialog open={editUserDialog.open} onOpenChange={(open) => setEditUserDialog({ open, user: null })}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>사용자 권한 수정</DialogTitle>
            <DialogDescription>
              {editUserDialog.user?.full_name || "사용자"}의 역할과 권한을 설정합니다.
            </DialogDescription>
          </DialogHeader>
          {userRoleUpdate && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>역할 *</Label>
                <Select
                  value={userRoleUpdate.role}
                  onValueChange={(value) =>
                    setUserRoleUpdate({
                      ...userRoleUpdate,
                      role: value,
                      // 역할에 따라 기본 권한 설정
                      permissions:
                        value === "admin"
                          ? ["all"]
                          : value === "editor"
                          ? ["view", "create", "edit"]
                          : ["view"],
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">관리자</SelectItem>
                    <SelectItem value="editor">편집자</SelectItem>
                    <SelectItem value="viewer">뷰어</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {userRoleUpdate.role !== "admin" && (
                <div className="space-y-2">
                  <Label>권한 선택</Label>
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                    {availablePermissions
                      .filter((p) => p.value !== "all")
                      .map((perm) => (
                        <div key={perm.value} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={userRoleUpdate.permissions.includes(perm.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setUserRoleUpdate({
                                  ...userRoleUpdate,
                                  permissions: [...userRoleUpdate.permissions, perm.value],
                                });
                              } else {
                                setUserRoleUpdate({
                                  ...userRoleUpdate,
                                  permissions: userRoleUpdate.permissions.filter((p) => p !== perm.value),
                                });
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          <Label className="font-normal cursor-pointer">{perm.label}</Label>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUserDialog({ open: false, user: null })}>
              취소
            </Button>
            <Button onClick={handleUpdateUserRole}>저장</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* 역할 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteRoleId !== null} onOpenChange={(open) => !open && setDeleteRoleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>역할 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 역할을 삭제하시겠습니까? 이 역할을 가진 사용자들은 역할이 제거됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteRole} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
