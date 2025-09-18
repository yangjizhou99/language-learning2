import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { StreamCopySync, createTableConfigs } from "@/lib/database/stream-copy";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { 
      sourceConfig, 
      targetConfig, 
      tables = ['shadowing_items', 'cloze_items', 'alignment_packs'],
      options = {}
    } = body;

    if (!sourceConfig?.url || !targetConfig?.url) {
      return NextResponse.json({ 
        error: "缺少源数据库或目标数据库配置" 
      }, { status: 400 });
    }

    // 构建数据库连接字符串
    const sourceUrl = buildConnectionString(sourceConfig);
    const targetUrl = buildConnectionString(targetConfig);

    // 创建表配置
    const tableConfigs = createTableConfigs(tables);

    // 创建同步配置
    const syncConfig = {
      sourceUrl,
      targetUrl,
      tables: tableConfigs
    };

    // 创建同步实例
    const sync = new StreamCopySync(syncConfig);

    try {
      // 执行同步
      const results = await sync.syncAll();
      
      // 计算总体统计
      const totalRows = results.reduce((sum, r) => sum + r.rowsProcessed, 0);
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.filter(r => !r.success).length;
      const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

      return NextResponse.json({
        success: true,
        message: `COPY同步完成：处理 ${totalRows} 行数据，成功 ${successCount} 个表，失败 ${failedCount} 个表`,
        results,
        summary: {
          totalTables: tables.length,
          successTables: successCount,
          failedTables: failedCount,
          totalRows,
          totalDuration: `${totalDuration}ms`
        }
      });

    } finally {
      // 关闭连接池
      await sync.close();
    }

  } catch (error) {
    console.error('COPY同步失败:', error);
    return NextResponse.json({ 
      error: `COPY同步失败: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
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
    ssl: ssl.toString()
  });

  return `postgresql://${username}:${password}@${host}:${port}/${database}?${params.toString()}`;
}
