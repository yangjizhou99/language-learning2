'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminSetupPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [dbStatus, setDbStatus] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/admin/setup', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      setUser(data.user);
      setProfile(data.profile);

      if (data.dbStatus === 'ok') {
        setDbStatus('✅ 数据库表结构正常');
      } else if (data.dbStatus === 'missing_table') {
        setDbStatus('❌ article_drafts 表不存在，需要运行数据库迁移');
      } else {
        setDbStatus('❌ 数据库状态未知');
      }
    } catch (error) {
      console.error('Status check error:', error);
      setMessage(`状态检查失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  // 禁止自我提升为管理员
  const makeAdmin = async () => {
    setMessage('❌ 出于安全考虑，已禁用自助设置管理员。请联系后台由管理员授予权限。');
  };

  const runDebugCheck = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/admin/debug', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const result = await response.json();
      setDebugInfo(result);

      if (!response.ok) {
        setMessage(`❌ 调试检查失败: ${result.error}`);
      } else {
        setMessage('✅ 调试信息已获取，请查看下方详情');
      }
    } catch (error) {
      setMessage(`❌ 调试检查错误: ${error}`);
    }
  };

  const testAIGeneration = async () => {
    try {
      setMessage('🧪 测试AI生成中...');
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/admin/test-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          provider: 'deepseek',
          model: 'deepseek-chat',
          temperature: 0.6,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(
          `❌ AI生成测试失败: ${result.error}\n步骤: ${result.step}\n详情: ${result.details || JSON.stringify(result, null, 2)}`,
        );
      } else {
        setMessage(
          `✅ AI生成测试成功！\n标题: ${result.test_result.title}\n内容预览: ${result.test_result.text_preview}\n字数: ${result.test_result.text_length}`,
        );
      }
    } catch (error) {
      setMessage(`❌ AI生成测试错误: ${error}`);
    }
  };

  const testDraftsList = async () => {
    try {
      setMessage('📋 测试草稿列表中...');
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/admin/drafts/test', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(
          `❌ 草稿列表测试失败: ${result.error}\n步骤: ${result.step}\n详情: ${result.details || result.db_error || ''}`,
        );
      } else {
        setMessage(
          `✅ 草稿列表测试成功！\n找到记录数: ${result.count}\n数据: ${JSON.stringify(result.data, null, 2).slice(0, 200)}...`,
        );
      }
    } catch (error) {
      setMessage(`❌ 草稿列表测试错误: ${error}`);
    }
  };

  const debugDraftsData = async () => {
    try {
      setMessage('🔎 调试草稿数据中...');
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/admin/drafts/debug', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(
          `❌ 草稿数据调试失败: ${result.error}\n详情: ${result.details || result.table_error || result.query_error || ''}`,
        );
      } else {
        const statusText = Object.entries(result.status_counts)
          .map(([status, count]) => `${status}: ${count}`)
          .join(', ');
        setMessage(`✅ 草稿数据调试成功！
总草稿数: ${result.total_drafts}
状态分布: ${statusText || '无'}
你的草稿数: ${result.user_drafts_count}
当前用户: ${result.current_user}
最近草稿: ${JSON.stringify(result.recent_drafts, null, 2)}`);
      }
    } catch (error) {
      setMessage(`❌ 草稿数据调试错误: ${error}`);
    }
  };

  const testListAPI = async () => {
    try {
      setMessage('🔍 测试草稿列表API调用...');
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      // 测试具体的列表API调用（和草稿页面完全相同的调用方式）
      const response = await fetch('/api/admin/drafts/list-debug?status=pending', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(
          `❌ 草稿列表API调用失败: ${result.error}\n步骤: ${result.step}\n详情: ${result.details || ''}`,
        );
      } else {
        setMessage(`✅ 草稿列表API调用成功！
状态过滤: ${result.status_filter}
找到记录数: ${result.count}
用户ID: ${result.user_id}
数据预览: ${JSON.stringify(result.data?.slice(0, 2), null, 2)}`);
      }
    } catch (error) {
      setMessage(`❌ 草稿列表API测试错误: ${error}`);
    }
  };

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <div className="text-center">加载中...</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <div className="text-center text-red-600">请先登录才能设置管理员权限</div>
      </main>
    );
  }

  const isAdmin = profile?.role === 'admin';

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">管理员权限设置</h1>

      <div className="bg-white p-6 rounded-lg border space-y-4">
        <div>
          <strong>当前用户:</strong> {user.email}
        </div>
        <div>
          <strong>用户 ID:</strong> {user.id}
        </div>
        <div>
          <strong>当前角色:</strong>
          <span
            className={`ml-2 px-2 py-1 rounded text-sm ${
              isAdmin ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}
          >
            {profile?.role || 'user'}
          </span>
        </div>
        {dbStatus && (
          <div className="flex items-center justify-between">
            <div>
              <strong>数据库状态:</strong> {dbStatus}
            </div>
            <button
              onClick={() => {
                setLoading(true);
                checkStatus();
              }}
              className="px-2 py-1 text-xs border rounded hover:bg-gray-50"
              disabled={loading}
            >
              刷新状态
            </button>
          </div>
        )}
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.includes('✅')
              ? 'bg-green-50 text-green-800'
              : message.includes('❌')
                ? 'bg-red-50 text-red-800'
                : 'bg-blue-50 text-blue-800'
          }`}
        >
          {message}
        </div>
      )}

      {!isAdmin && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
          <h3 className="font-medium text-yellow-800 mb-2">需要管理员权限</h3>
          <p className="text-yellow-700 text-sm mb-2">
            出于安全考虑，已移除自助提权功能。请联系现有管理员在后台为你的账户授予管理员权限。
          </p>
          <button
            onClick={makeAdmin}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded cursor-not-allowed"
          >
            已禁用自助设置管理员
          </button>
        </div>
      )}

      {isAdmin && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
          <h3 className="font-medium text-green-800 mb-2">✅ 管理员权限已激活</h3>
          <p className="text-green-700 text-sm mb-4">你现在可以使用所有管理员功能：</p>
          <div className="space-y-2">
            <a href="/admin/articles" className="block text-blue-600 hover:underline">
              📝 题库管理 - AI 生成草稿
            </a>
            <a href="/admin/drafts" className="block text-blue-600 hover:underline">
              📋 草稿箱 - 审核和发布
            </a>
          </div>
          <div className="mt-4 space-x-2 space-y-2">
            <div>
              <button
                onClick={runDebugCheck}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
              >
                🔍 运行故障诊断
              </button>
              <button
                onClick={testAIGeneration}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 ml-2"
              >
                🧪 测试AI生成
              </button>
            </div>
            <div>
              <button
                onClick={testDraftsList}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                📋 测试草稿列表
              </button>
              <button
                onClick={debugDraftsData}
                className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 ml-2"
              >
                🔎 调试草稿数据
              </button>
              <button
                onClick={testListAPI}
                className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 ml-2"
              >
                🔧 测试列表API
              </button>
            </div>
          </div>
        </div>
      )}

      {dbStatus.includes('❌') && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
          <h3 className="font-medium text-red-800 mb-2">需要运行数据库迁移</h3>
          <p className="text-red-700 text-sm mb-4">
            article_drafts 表不存在。请在 Supabase 控制台执行以下 SQL 语句：
          </p>
          <pre className="bg-red-100 p-3 rounded text-xs overflow-x-auto text-red-800">
            {`-- 创建草稿表
CREATE TABLE IF NOT EXISTS public.article_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  lang text NOT NULL,
  genre text NOT NULL,
  difficulty int NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  title text NOT NULL,
  text text NOT NULL,
  license text DEFAULT NULL,
  ai_provider text DEFAULT NULL,
  ai_model text DEFAULT NULL,
  ai_params jsonb DEFAULT '{}'::jsonb,
  ai_usage jsonb DEFAULT '{}'::jsonb,
  keys jsonb DEFAULT '{}'::jsonb,
  cloze_short jsonb DEFAULT '[]'::jsonb,
  cloze_long jsonb DEFAULT '[]'::jsonb,
  validator_report jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  meta jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  published_article_id uuid DEFAULT NULL
);

ALTER TABLE public.article_drafts ENABLE row level security;

-- 权限策略
DROP POLICY IF EXISTS draft_select ON public.article_drafts;
CREATE POLICY draft_select ON public.article_drafts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS draft_write ON public.article_drafts;
CREATE POLICY draft_write ON public.article_drafts FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());`}
          </pre>
          <p className="text-red-700 text-sm mt-3">执行完毕后，刷新此页面检查状态。</p>
        </div>
      )}

      {debugInfo && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <h3 className="font-medium text-blue-800 mb-3">🔍 故障诊断报告</h3>

          <div className="space-y-3 text-sm">
            <div>
              <strong>管理员权限:</strong>{' '}
              <span className="text-green-600">{debugInfo.admin_check}</span>
            </div>

            <div>
              <strong>环境变量检查:</strong>
              <ul className="mt-1 ml-4 space-y-1">
                <li>
                  DEEPSEEK_API_KEY:{' '}
                  {debugInfo.env_variables?.DEEPSEEK_API_KEY ? '✅ 已设置' : '❌ 未设置'}
                </li>
                <li>
                  OPENROUTER_API_KEY:{' '}
                  {debugInfo.env_variables?.OPENROUTER_API_KEY ? '✅ 已设置' : '❌ 未设置'}
                </li>
                <li>
                  OPENAI_API_KEY:{' '}
                  {debugInfo.env_variables?.OPENAI_API_KEY ? '✅ 已设置' : '❌ 未设置'}
                </li>
                <li>
                  SUPABASE_URL:{' '}
                  {debugInfo.env_variables?.NEXT_PUBLIC_SUPABASE_URL ? '✅ 已设置' : '❌ 未设置'}
                </li>
                <li>
                  SUPABASE_ANON_KEY:{' '}
                  {debugInfo.env_variables?.NEXT_PUBLIC_SUPABASE_ANON_KEY
                    ? '✅ 已设置'
                    : '❌ 未设置'}
                </li>
              </ul>
            </div>

            <div>
              <strong>AI 客户端状态:</strong>{' '}
              <span className="font-mono text-xs">{debugInfo.ai_client_status}</span>
            </div>

            <div>
              <strong>数据库连接:</strong>{' '}
              <span className="font-mono text-xs">{debugInfo.db_test_status}</span>
            </div>

            {debugInfo.error && (
              <div className="mt-3 p-2 bg-red-100 rounded text-red-800">
                <strong>错误详情:</strong> {debugInfo.error}
                {debugInfo.details && <div className="mt-1 text-xs">{debugInfo.details}</div>}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
        <h4 className="font-medium mb-2">说明：</h4>
        <ul className="space-y-1">
          <li>• 只有管理员可以生成和发布文章内容</li>
          <li>• 管理员权限存储在数据库的 profiles.role 字段中</li>
          <li>• 这是一次性设置，设置后即可长期使用管理功能</li>
          <li>• 如果数据库状态显示错误，需要先运行上面的 SQL 迁移</li>
          <li>
            • <strong>如果 AI 生成还是失败，请点击上方的「🔍 运行故障诊断」按钮</strong>
          </li>
        </ul>
      </div>
    </main>
  );
}
