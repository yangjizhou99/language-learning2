import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { package: exportPackage, remoteConfig } = body;

    if (!exportPackage || !remoteConfig || !remoteConfig.url || !remoteConfig.key) {
      return NextResponse.json({ 
        error: "缺少必要的参数：package, remoteConfig" 
      }, { status: 400 });
    }

    // 创建远程数据库客户端
    const remoteSupabase = createClient(remoteConfig.url, remoteConfig.key);

    // 验证远程数据库连接
    const { data: testData, error: testError } = await remoteSupabase
      .from('shadowing_items')
      .select('id')
      .limit(1);

    if (testError) {
      return NextResponse.json({ 
        error: `远程数据库连接失败: ${testError.message}` 
      }, { status: 500 });
    }

    const results = {
      shadowing: { success: 0, failed: 0, errors: [] as string[] },
      cloze: { success: 0, failed: 0, errors: [] as string[] },
      alignment: { success: 0, failed: 0, errors: [] as string[] }
    };

    // 按类型分组题目
    const itemsByType = exportPackage.items.reduce((acc: any, item: any) => {
      if (!acc[item.type]) acc[item.type] = [];
      acc[item.type].push(item);
      return acc;
    }, {});

    // 同步跟读练习题目
    if (itemsByType.shadowing && itemsByType.shadowing.length > 0) {
      try {
        const shadowingData = itemsByType.shadowing.map((item: any) => ({
          id: item.id,
          lang: item.lang,
          level: item.level,
          title: item.title,
          text: item.text,
          audio_url: item.audio_url,
          duration_ms: item.duration_ms,
          tokens: item.tokens,
          cefr: item.cefr,
          meta: item.meta || {},
          created_at: item.created_at,
          translations: item.translations,
          trans_updated_at: item.trans_updated_at,
          theme_id: item.theme_id,
          subtopic_id: item.subtopic_id
        }));

        const { error: shadowingError } = await remoteSupabase
          .from('shadowing_items')
          .upsert(shadowingData, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          });

        if (shadowingError) {
          results.shadowing.failed = itemsByType.shadowing.length;
          results.shadowing.errors.push(shadowingError.message);
        } else {
          results.shadowing.success = itemsByType.shadowing.length;
        }
      } catch (error) {
        results.shadowing.failed = itemsByType.shadowing.length;
        results.shadowing.errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    // 同步完形填空题目
    if (itemsByType.cloze && itemsByType.cloze.length > 0) {
      try {
        const clozeData = itemsByType.cloze.map((item: any) => ({
          id: item.id,
          lang: item.lang,
          level: item.level,
          topic: item.topic,
          title: item.title,
          passage: item.passage,
          blanks: item.blanks,
          meta: item.meta || {},
          created_at: item.created_at
        }));

        const { error: clozeError } = await remoteSupabase
          .from('cloze_items')
          .upsert(clozeData, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          });

        if (clozeError) {
          results.cloze.failed = itemsByType.cloze.length;
          results.cloze.errors.push(clozeError.message);
        } else {
          results.cloze.success = itemsByType.cloze.length;
        }
      } catch (error) {
        results.cloze.failed = itemsByType.cloze.length;
        results.cloze.errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    // 同步对齐练习包
    if (itemsByType.alignment && itemsByType.alignment.length > 0) {
      try {
        const alignmentData = itemsByType.alignment.map((item: any) => ({
          id: item.id,
          lang: item.lang,
          level: item.level,
          topic: item.topic,
          title: item.title,
          content: item.content || item.text,
          meta: item.meta || {},
          created_at: item.created_at
        }));

        const { error: alignmentError } = await remoteSupabase
          .from('alignment_packs')
          .upsert(alignmentData, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          });

        if (alignmentError) {
          results.alignment.failed = itemsByType.alignment.length;
          results.alignment.errors.push(alignmentError.message);
        } else {
          results.alignment.success = itemsByType.alignment.length;
        }
      } catch (error) {
        results.alignment.failed = itemsByType.alignment.length;
        results.alignment.errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    // 计算总体结果
    const totalSuccess = results.shadowing.success + results.cloze.success + results.alignment.success;
    const totalFailed = results.shadowing.failed + results.cloze.failed + results.alignment.failed;
    const totalItems = exportPackage.items.length;

    return NextResponse.json({
      success: true,
      message: `同步完成：成功 ${totalSuccess} 个，失败 ${totalFailed} 个`,
      results,
      summary: {
        total: totalItems,
        success: totalSuccess,
        failed: totalFailed
      }
    });

  } catch (error) {
    console.error('同步到远程数据库失败:', error);
    return NextResponse.json({ 
      error: `同步失败: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
}
