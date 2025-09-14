"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Container } from "@/components/Container";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, 
  Save, 
  Shield, 
  Globe, 
  Target, 
  Settings,
  CheckCircle,
  AlertCircle
} from "lucide-react";

interface UserPermissions {
  user_id: string;
  can_access_shadowing: boolean;
  can_access_cloze: boolean;
  can_access_alignment: boolean;
  can_access_articles: boolean;
  allowed_languages: string[];
  allowed_levels: number[];
  max_daily_attempts: number;
  custom_restrictions: Record<string, any>;
}

interface UserProfile {
  id: string;
  email: string;
  username?: string;
  role: 'admin' | 'user';
}

const AVAILABLE_LANGUAGES = [
  { code: 'en', name: '英语' },
  { code: 'ja', name: '日语' },
  { code: 'zh', name: '中文' }
];

const AVAILABLE_LEVELS = [
  { level: 1, name: '初级' },
  { level: 2, name: '初中级' },
  { level: 3, name: '中级' },
  { level: 4, name: '中高级' },
  { level: 5, name: '高级' }
];

export default function UserPermissionsPage() {
  const params = useParams();
  const userId = params.userId as string;
  
  const [user, setUser] = useState<UserProfile | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (userId) {
      fetchUserAndPermissions();
    }
  }, [userId]);

  const fetchUserAndPermissions = async () => {
    setLoading(true);
    try {
      console.log('正在获取用户权限，用户ID:', userId);
      
      // 首先检查用户ID是否有效
      if (!userId || userId === 'undefined') {
        throw new Error('无效的用户ID');
      }

      // 获取用户基本信息
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('id, username, role')
        .eq('id', userId)
        .single();

      console.log('用户查询结果:', { user, userError });

      if (userError) {
        console.error('用户查询错误:', userError);
        if (userError.code === 'PGRST116') {
          throw new Error('用户不存在');
        }
        throw new Error(`用户查询失败: ${userError.message}`);
      }

      if (!user) {
        throw new Error('用户不存在');
      }
      setUser(user);

      // 获取权限设置
      const { data: permissions, error: permissionsError } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId)
        .single();

      console.log('权限查询结果:', { permissions, permissionsError });

      // 如果表不存在或没有权限记录，创建默认权限
      if (permissionsError && (permissionsError.code === 'PGRST116' || permissionsError.message.includes('relation') && permissionsError.message.includes('does not exist'))) {
        console.log('权限表不存在或没有记录，使用默认权限');
        const defaultPermissions: UserPermissions = {
          user_id: userId,
          can_access_shadowing: true,
          can_access_cloze: true,
          can_access_alignment: true,
          can_access_articles: true,
          allowed_languages: ['en', 'ja', 'zh'],
          allowed_levels: [1, 2, 3, 4, 5],
          max_daily_attempts: 50,
          custom_restrictions: {}
        };
        setPermissions(defaultPermissions);
      } else if (permissionsError) {
        console.error('获取权限设置失败:', permissionsError);
        throw new Error('获取权限设置失败');
      } else if (permissions) {
        setPermissions(permissions);
      } else {
        // 没有权限记录，创建默认权限
        const defaultPermissions: UserPermissions = {
          user_id: userId,
          can_access_shadowing: true,
          can_access_cloze: true,
          can_access_alignment: true,
          can_access_articles: true,
          allowed_languages: ['en', 'ja', 'zh'],
          allowed_levels: [1, 2, 3, 4, 5],
          max_daily_attempts: 50,
          custom_restrictions: {}
        };
        setPermissions(defaultPermissions);
      }
    } catch (error) {
      console.error('获取数据失败:', error);
      setMessage({ type: 'error', text: '获取数据失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!permissions) return;

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('user_permissions')
        .upsert(permissions, { 
          onConflict: 'user_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('保存权限失败:', error);
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          setMessage({ type: 'error', text: '权限表不存在，请先在Supabase中执行数据库迁移' });
        } else {
          throw new Error('保存权限设置失败');
        }
      } else {
        setMessage({ type: 'success', text: '权限设置已保存' });
      }
    } catch (error) {
      console.error('保存失败:', error);
      setMessage({ type: 'error', text: '保存失败，请重试' });
    } finally {
      setSaving(false);
    }
  };

  const handlePermissionChange = (key: keyof UserPermissions, value: any) => {
    if (!permissions) return;
    setPermissions({ ...permissions, [key]: value });
  };

  const handleLanguageToggle = (langCode: string) => {
    if (!permissions) return;
    const newLanguages = permissions.allowed_languages.includes(langCode)
      ? permissions.allowed_languages.filter(l => l !== langCode)
      : [...permissions.allowed_languages, langCode];
    handlePermissionChange('allowed_languages', newLanguages);
  };

  const handleLevelToggle = (level: number) => {
    if (!permissions) return;
    const newLevels = permissions.allowed_levels.includes(level)
      ? permissions.allowed_levels.filter(l => l !== level)
      : [...permissions.allowed_levels, level];
    handlePermissionChange('allowed_levels', newLevels);
  };

  if (loading) {
    return (
      <Container>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Container>
    );
  }

  if (!user || !permissions) {
    return (
      <Container>
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold mb-4">用户不存在</h2>
          <Link href="/admin/users">
            <Button>返回用户列表</Button>
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="space-y-6">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/admin/users/${userId}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">权限管理</h1>
              <p className="text-muted-foreground">
                管理 {user.username || `用户 ${user.id.slice(0, 8)}`} 的访问权限
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? '保存中...' : '保存设置'}
          </Button>
        </div>

        <Breadcrumbs items={[
          { label: "管理员", href: "/admin" },
          { label: "用户管理", href: "/admin/users" },
          { label: user.username || `用户 ${user.id.slice(0, 8)}`, href: `/admin/users/${userId}` },
          { label: "权限管理", href: `/admin/users/${userId}/permissions` }
        ]} />

        {/* 消息提示 */}
        {message && (
          <Alert className={message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            <div className="flex items-center gap-2">
              {message.type === 'success' ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                {message.text}
              </AlertDescription>
            </div>
          </Alert>
        )}

        <Tabs defaultValue="access" className="space-y-6">
          <TabsList>
            <TabsTrigger value="access">访问权限</TabsTrigger>
            <TabsTrigger value="content">内容权限</TabsTrigger>
            <TabsTrigger value="limits">限制设置</TabsTrigger>
          </TabsList>

          <TabsContent value="access" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  功能访问权限
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="shadowing">Shadowing 练习</Label>
                        <p className="text-sm text-muted-foreground">
                          允许用户访问 Shadowing 练习功能
                        </p>
                      </div>
                      <Switch
                        id="shadowing"
                        checked={permissions.can_access_shadowing}
                        onCheckedChange={(checked) => 
                          handlePermissionChange('can_access_shadowing', checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="cloze">Cloze 练习</Label>
                        <p className="text-sm text-muted-foreground">
                          允许用户访问 Cloze 填空练习功能
                        </p>
                      </div>
                      <Switch
                        id="cloze"
                        checked={permissions.can_access_cloze}
                        onCheckedChange={(checked) => 
                          handlePermissionChange('can_access_cloze', checked)
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="alignment">Alignment 练习</Label>
                        <p className="text-sm text-muted-foreground">
                          允许用户访问对齐训练功能
                        </p>
                      </div>
                      <Switch
                        id="alignment"
                        checked={permissions.can_access_alignment}
                        onCheckedChange={(checked) => 
                          handlePermissionChange('can_access_alignment', checked)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="articles">广读文章</Label>
                        <p className="text-sm text-muted-foreground">
                          允许用户访问广读文章功能
                        </p>
                      </div>
                      <Switch
                        id="articles"
                        checked={permissions.can_access_articles}
                        onCheckedChange={(checked) => 
                          handlePermissionChange('can_access_articles', checked)
                        }
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    允许的语言
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {AVAILABLE_LANGUAGES.map((lang) => (
                    <div key={lang.code} className="flex items-center space-x-2">
                      <Checkbox
                        id={`lang-${lang.code}`}
                        checked={permissions.allowed_languages.includes(lang.code)}
                        onCheckedChange={() => handleLanguageToggle(lang.code)}
                      />
                      <Label htmlFor={`lang-${lang.code}`} className="text-sm font-medium">
                        {lang.name} ({lang.code.toUpperCase()})
                      </Label>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    允许的等级
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {AVAILABLE_LEVELS.map((level) => (
                    <div key={level.level} className="flex items-center space-x-2">
                      <Checkbox
                        id={`level-${level.level}`}
                        checked={permissions.allowed_levels.includes(level.level)}
                        onCheckedChange={() => handleLevelToggle(level.level)}
                      />
                      <Label htmlFor={`level-${level.level}`} className="text-sm font-medium">
                        等级 {level.level} - {level.name}
                      </Label>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="limits" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  使用限制
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="max_daily_attempts">每日最大练习次数</Label>
                  <Input
                    id="max_daily_attempts"
                    type="number"
                    min="0"
                    max="1000"
                    value={permissions.max_daily_attempts}
                    onChange={(e) => 
                      handlePermissionChange('max_daily_attempts', parseInt(e.target.value) || 0)
                    }
                    className="w-48"
                  />
                  <p className="text-sm text-muted-foreground">
                    设置用户每天可以进行的最大练习次数，0 表示无限制
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>当前权限摘要</Label>
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="text-sm">
                      <strong>可访问功能：</strong>
                      {[
                        permissions.can_access_shadowing && 'Shadowing',
                        permissions.can_access_cloze && 'Cloze',
                        permissions.can_access_alignment && 'Alignment',
                        permissions.can_access_articles && '广读文章'
                      ].filter(Boolean).join(', ') || '无'}
                    </div>
                    <div className="text-sm">
                      <strong>允许语言：</strong>
                      {permissions.allowed_languages.map(lang => 
                        AVAILABLE_LANGUAGES.find(l => l.code === lang)?.name || lang
                      ).join(', ') || '无'}
                    </div>
                    <div className="text-sm">
                      <strong>允许等级：</strong>
                      {permissions.allowed_levels.sort().join(', ') || '无'}
                    </div>
                    <div className="text-sm">
                      <strong>每日限制：</strong>
                      {permissions.max_daily_attempts === 0 ? '无限制' : `${permissions.max_daily_attempts} 次`}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Container>
  );
}
