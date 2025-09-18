import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import {
  PackerFactory,
  ShadowingPacker,
  ClozePacker,
  AlignmentPacker,
} from '@/lib/question-bank/specialized-packers';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const {
      sourceConfig,
      targetConfig,
      supabaseConfig,
      questionTypes = ['shadowing', 'cloze', 'alignment'],
      filters = {},
    } = body;

    if (!sourceConfig?.url || !targetConfig?.url || !supabaseConfig?.url || !supabaseConfig?.key) {
      return NextResponse.json(
        {
          error: '缺少必要的数据库配置',
        },
        { status: 400 },
      );
    }

    const results = [];
    const errors = [];

    // 为每种题目类型创建专门的打包器
    for (const questionType of questionTypes) {
      try {
        let result;
        switch (questionType) {
          case 'shadowing':
            const shadowingPacker = new ShadowingPacker({
              sourceUrl: sourceConfig.url,
              targetUrl: targetConfig.url,
              supabaseUrl: supabaseConfig.url,
              supabaseKey: supabaseConfig.key,
            });
            result = await shadowingPacker.packShadowingItems(filters);
            break;
          case 'cloze':
            const clozePacker = new ClozePacker({
              sourceUrl: sourceConfig.url,
              targetUrl: targetConfig.url,
              supabaseUrl: supabaseConfig.url,
              supabaseKey: supabaseConfig.key,
            });
            result = await clozePacker.packClozeItems(filters);
            break;
          case 'alignment':
            const alignmentPacker = new AlignmentPacker({
              sourceUrl: sourceConfig.url,
              targetUrl: targetConfig.url,
              supabaseUrl: supabaseConfig.url,
              supabaseKey: supabaseConfig.key,
            });
            result = await alignmentPacker.packAlignmentItems(filters);
            break;
          default:
            throw new Error(`不支持的题目类型: ${questionType}`);
        }

        results.push(result);
      } catch (error) {
        errors.push({
          type: questionType,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 计算总体统计
    const totalItems = results.reduce((sum, r) => sum + r.itemsCount, 0);
    const totalFiles = results.reduce((sum, r) => sum + r.filesCount, 0);
    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    // 如果有错误，返回失败状态
    const hasErrors = errors.length > 0 || failedCount > 0;

    return NextResponse.json({
      success: !hasErrors,
      message: hasErrors
        ? `专项同步失败：处理 ${totalItems} 个题目，${totalFiles} 个文件，成功 ${successCount} 个类型，失败 ${failedCount} 个类型`
        : `专项同步完成：处理 ${totalItems} 个题目，${totalFiles} 个文件，成功 ${successCount} 个类型，失败 ${failedCount} 个类型`,
      results,
      errors,
      summary: {
        totalTypes: questionTypes.length,
        successTypes: successCount,
        failedTypes: failedCount,
        totalItems,
        totalFiles,
        totalDuration: `${totalDuration}ms`,
      },
    });
  } catch (error) {
    console.error('专项同步失败:', error);
    return NextResponse.json(
      {
        error: `专项同步失败: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 },
    );
  }
}

/**
 * 构建PostgreSQL连接字符串
 */
function buildConnectionString(config: {
  host: string;
  port?: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}): string {
  const { host, port = 5432, database, username, password, ssl = true } = config;

  const params = new URLSearchParams({
    host,
    port: port.toString(),
    database,
    user: username,
    password,
    ssl: ssl.toString(),
  });

  return `postgresql://${username}:${password}@${host}:${port}/${database}?${params.toString()}`;
}
