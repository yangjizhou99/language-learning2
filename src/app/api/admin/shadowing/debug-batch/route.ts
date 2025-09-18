import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 检查管理员权限
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json(
        {
          error: '权限检查失败',
          reason: auth.reason,
        },
        { status: 403 },
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // 检查环境变量
    const envCheck = {
      DEEPSEEK_API_KEY: !!process.env.DEEPSEEK_API_KEY,
      OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    };

    // 检查数据库表
    let dbStatus = {
      shadowing_subtopics: false,
      shadowing_drafts: false,
      shadowing_themes: false,
    };

    try {
      // 检查 shadowing_subtopics 表
      const { data: subtopics, error: subtopicsError } = await supabase
        .from('shadowing_subtopics')
        .select('id')
        .limit(1);
      dbStatus.shadowing_subtopics = !subtopicsError;

      // 检查 shadowing_drafts 表
      const { data: drafts, error: draftsError } = await supabase
        .from('shadowing_drafts')
        .select('id')
        .limit(1);
      dbStatus.shadowing_drafts = !draftsError;

      // 检查 shadowing_themes 表
      const { data: themes, error: themesError } = await supabase
        .from('shadowing_themes')
        .select('id')
        .limit(1);
      dbStatus.shadowing_themes = !themesError;
    } catch (error) {
      console.error('数据库检查错误:', error);
    }

    // 检查用户权限
    let userPermissions = null;
    try {
      const { data: permissions, error: permError } = await supabase
        .from('user_permissions')
        .select('api_keys, ai_enabled')
        .eq('user_id', auth.user.id)
        .single();

      if (!permError && permissions) {
        userPermissions = {
          hasApiKeys: !!(permissions.api_keys && Object.keys(permissions.api_keys).length > 0),
          aiEnabled: permissions.ai_enabled,
          apiKeys: permissions.api_keys,
        };
      }
    } catch (error) {
      console.error('用户权限检查错误:', error);
    }

    // 测试 AI 客户端导入
    let aiClientStatus = 'unknown';
    try {
      const { chatJSON } = await import('@/lib/ai/client');
      aiClientStatus = 'imported_successfully';
    } catch (error) {
      aiClientStatus = `import_error: ${error}`;
    }

    return NextResponse.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      user: {
        id: auth.user.id,
        email: auth.user.email,
      },
      environment: envCheck,
      database: dbStatus,
      userPermissions,
      aiClient: aiClientStatus,
      recommendations: generateRecommendations(envCheck, dbStatus, userPermissions),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

function generateRecommendations(envCheck: any, dbStatus: any, userPermissions: any) {
  const recommendations = [];

  if (!envCheck.OPENROUTER_API_KEY && !envCheck.DEEPSEEK_API_KEY && !envCheck.OPENAI_API_KEY) {
    recommendations.push('❌ 没有配置任何AI API密钥，请至少配置一个');
  }

  if (!envCheck.SUPABASE_SERVICE_ROLE_KEY) {
    recommendations.push('❌ 缺少 SUPABASE_SERVICE_ROLE_KEY，这是必需的');
  }

  if (!dbStatus.shadowing_subtopics) {
    recommendations.push('❌ shadowing_subtopics 表不存在或无法访问');
  }

  if (!dbStatus.shadowing_drafts) {
    recommendations.push('❌ shadowing_drafts 表不存在或无法访问');
  }

  if (userPermissions && !userPermissions.hasApiKeys) {
    recommendations.push('⚠️ 用户没有配置个人API密钥，将使用全局密钥');
  }

  if (userPermissions && !userPermissions.aiEnabled) {
    recommendations.push('⚠️ 用户AI功能未启用');
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ 所有检查都通过，系统应该可以正常工作');
  }

  return recommendations;
}
