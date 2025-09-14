"use client";

import { Container } from "@/components/Container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Database, Copy } from "lucide-react";
import { useState } from "react";

export default function SetupDatabasePage() {
  const [copied, setCopied] = useState(false);

  const migrationSQL = `-- 创建用户权限管理表
-- 20250120000009_create_user_permissions.sql

-- 用户权限表
create table if not exists public.user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  can_access_shadowing boolean not null default true,
  can_access_cloze boolean not null default true,
  can_access_alignment boolean not null default true,
  can_access_articles boolean not null default true,
  allowed_languages text[] not null default array['en', 'ja', 'zh'],
  allowed_levels int[] not null default array[1, 2, 3, 4, 5],
  max_daily_attempts int not null default 50,
  custom_restrictions jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

-- 启用行级安全
alter table public.user_permissions enable row level security;

-- 创建策略：只有管理员可以查看和修改所有权限，用户只能查看自己的权限
create policy user_permissions_admin_all on public.user_permissions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy user_permissions_own_read on public.user_permissions
  for select to authenticated
  using (auth.uid() = user_id);

-- 创建索引
create index if not exists idx_user_permissions_user_id on public.user_permissions(user_id);
create index if not exists idx_user_permissions_created_at on public.user_permissions(created_at);

-- 创建更新时间触发器
create or replace function update_user_permissions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_user_permissions_updated_at
  before update on public.user_permissions
  for each row execute function update_user_permissions_updated_at();`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(migrationSQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  return (
    <Container>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">数据库设置</h1>
          <p className="text-muted-foreground">设置用户权限管理所需的数据库表</p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            用户权限管理功能需要创建 <code>user_permissions</code> 表。请按照以下步骤在Supabase中执行数据库迁移。
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              数据库迁移步骤
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <div>
                  <p className="font-medium">打开Supabase控制台</p>
                  <p className="text-sm text-muted-foreground">
                    访问你的Supabase项目控制台，进入 SQL Editor
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <div>
                  <p className="font-medium">复制并执行SQL</p>
                  <p className="text-sm text-muted-foreground">
                    复制下面的SQL代码并在Supabase SQL Editor中执行
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                  3
                </div>
                <div>
                  <p className="font-medium">验证创建</p>
                  <p className="text-sm text-muted-foreground">
                    确认 <code>user_permissions</code> 表已成功创建
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SQL迁移代码</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                复制下面的SQL代码到Supabase SQL Editor中执行
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                className="flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                {copied ? '已复制!' : '复制代码'}
              </Button>
            </div>
            
            <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-sm">
              {migrationSQL}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              完成后的功能
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm">执行迁移后，你将能够：</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>在用户详情页面查看和管理用户权限</li>
                <li>设置用户可以访问的功能模块</li>
                <li>配置用户的语言和难度级别权限</li>
                <li>设置用户的每日练习次数限制</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </Container>
  );
}
