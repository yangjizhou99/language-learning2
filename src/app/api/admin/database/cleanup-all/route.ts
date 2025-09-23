import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getSupabaseFor, type DatabaseType } from '@/lib/supabaseEnv';

type CheckResult = {
  ok: boolean;
  details: Array<{ table: string; missing: string[]; extra?: string[] }>; // 仅报告缺失
};

type CleanupSummary = {
  truncatedTables: number;
  storage: { buckets: number; deletedObjects: number };
};

export async function POST(req: NextRequest) {
  // 权限校验（不要放在 /api/admin/backup/* 路径下，避免被放开的逻辑绕过）
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.reason || 'forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    databaseType?: DatabaseType;
    confirm?: string; // 必须为 'ERASE-ALL' 才执行危险操作
    dryRun?: boolean; // 默认 true
    checkOnly?: boolean; // 仅校验，不做清空
  };

  const databaseType: DatabaseType = (body?.databaseType as DatabaseType) || 'supabase';
  const dryRun = body?.dryRun !== false; // 默认 dry-run
  const checkOnly = body?.checkOnly === true;

  const supabase = getSupabaseFor(databaseType);

  // 1) 读取关键表字段信息（使用 RPC: get_table_columns(table_name text)）
  const required: Record<string, string[]> = {
    user_permissions: ['api_keys', 'ai_enabled', 'model_permissions'],
    shadowing_items: ['audio_bucket', 'audio_path'], // audio_url_proxy 为生成列，信息架构可能不可见，故不强校验
    shadowing_subtopics: ['title', 'one_line', 'seed'], // 已通过 20250922000000 重命名
    vocab_entries: ['srs_due', 'srs_interval', 'srs_ease', 'srs_reps', 'srs_lapses', 'srs_state'],
  };

  const check = await checkSchema(supabase, required);
  if (!check.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: '数据库结构与迁移不一致，请先修复迁移再重试',
        details: check.details,
      },
      { status: 400 },
    );
  }

  if (checkOnly) {
    return NextResponse.json({ ok: true, message: '结构校验通过（仅校验）', details: check.details });
  }

  // 2) 未提供确认口令时，仅返回可执行提示
  if (body?.confirm !== 'ERASE-ALL') {
    return NextResponse.json(
      {
        ok: true,
        message:
          '结构校验通过。要执行清空操作，请在请求体中提供 { confirm: "ERASE-ALL", dryRun: false }。默认 dryRun=true 仅预览。',
        dryRun,
      },
      { status: 200 },
    );
  }

  // 3) 获取全部 public 表（RPC: get_table_list）
  const { data: tableList, error: listErr } = await (supabase as any).rpc('get_table_list');
  if (listErr) {
    return NextResponse.json(
      { error: '获取表列表失败（缺少 get_table_list 函数？）', details: listErr.message },
      { status: 500 },
    );
  }

  const tables: string[] = Array.isArray(tableList)
    ? (tableList as Array<{ table_name: string }>).map((t) => (t as any).table_name || String(t))
    : [];

  // 4) 预览/执行 TRUNCATE ALL
  const truncateSQL = tables.map((t) => `TRUNCATE TABLE "${t}" CASCADE;`).join('\n');

  // 5) 清空存储桶（仅统计预览或执行）
  const storageStats = { buckets: 0, deletedObjects: 0 };
  let previewDeleteTotal = 0;
  try {
    const { data: buckets, error: bucketsErr } = await (supabase as any).storage.listBuckets();
    if (bucketsErr) throw bucketsErr;
    storageStats.buckets = (buckets?.length as number) || 0;

    if (Array.isArray(buckets)) {
      for (const b of buckets) {
        const allPaths = await listAllObjectsPaths(supabase, b.name);
        if (dryRun) {
          previewDeleteTotal += allPaths.length;
        } else {
          // 分批删除，避免单次过多
          const chunkSize = 100;
          for (let i = 0; i < allPaths.length; i += chunkSize) {
            const chunk = allPaths.slice(i, i + chunkSize);
            const { error: delErr } = await (supabase as any).storage.from(b.name).remove(chunk);
            if (delErr) {
              return NextResponse.json(
                { error: `删除存储桶 ${b.name} 对象失败`, details: delErr.message },
                { status: 500 },
              );
            }
            storageStats.deletedObjects += chunk.length;
          }
        }
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: '清理存储桶失败', details: msg }, { status: 500 });
  }

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      preview: {
        truncateTables: tables.length,
        storage: { buckets: storageStats.buckets, objectsToDelete: previewDeleteTotal },
      },
      hint: '要真正执行请设置 { dryRun: false, confirm: "ERASE-ALL" }',
    });
  }

  // 6) 执行 TRUNCATE（使用 exec_sql）
  const { error: execErr } = await (supabase as any).rpc('exec_sql', { sql: truncateSQL });
  if (execErr) {
    return NextResponse.json(
      { error: '清空数据库失败（exec_sql RPC 执行错误）', details: execErr.message },
      { status: 500 },
    );
  }

  const summary: CleanupSummary = {
    truncatedTables: tables.length,
    storage: storageStats,
  };

  return NextResponse.json({ ok: true, summary });
}

async function checkSchema(
  supabase: ReturnType<typeof getSupabaseFor>,
  required: Record<string, string[]>,
): Promise<CheckResult> {
  const details: Array<{ table: string; missing: string[]; extra?: string[] }> = [];
  let allOk = true;

  for (const [table, cols] of Object.entries(required)) {
    const { data, error } = await (supabase as any).rpc('get_table_columns', { table_name_param: table });
    if (error) {
      allOk = false;
      details.push({ table, missing: cols });
      continue;
    }
    const existing: string[] = Array.isArray(data)
      ? (data as Array<{ column_name: string }>).map((c) => (c as any).column_name)
      : [];
    const missing = cols.filter((c) => !existing.includes(c));
    if (missing.length > 0) allOk = false;
    details.push({ table, missing });
  }

  return { ok: allOk, details };
}

async function listAllObjectsPaths(
  supabase: ReturnType<typeof getSupabaseFor>,
  bucket: string,
): Promise<string[]> {
  const results: string[] = [];

  async function walk(prefix: string = ''): Promise<void> {
    const { data: items, error } = await (supabase as any).storage
      .from(bucket)
      .list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    if (!items || items.length === 0) return;

    for (const it of items as any[]) {
      const fullPath = prefix ? `${prefix}/${it.name}` : it.name;
      // 约定：有 metadata.size 认为是文件；否则视为目录
      if (it?.metadata && typeof it.metadata.size === 'number') {
        results.push(fullPath);
      } else {
        await walk(fullPath);
      }
    }
  }

  await walk('');
  return results;
}



