export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await params;
  const { data, error } = await auth.supabase
    .from('shadowing_drafts')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data)
    return NextResponse.json({ error: error?.message || 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true, draft: data });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const b = await req.json();
  const patch: any = {};
  for (const k of [
    'title',
    'topic',
    'genre',
    'register',
    'text',
    'notes',
    'translations',
    'trans_updated_at',
  ])
    if (k in b) patch[k] = b[k];
  const { id } = await params;
  const { error } = await auth.supabase.from('shadowing_drafts').update(patch).eq('id', id);
  if (error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { action } = await req.json();
  if (action === 'publish') {
    const { id } = await params;
    const { data: d, error: e0 } = await auth.supabase
      .from('shadowing_drafts')
      .select('*')
      .eq('id', id)
      .single();
    if (e0 || !d) return NextResponse.json({ error: 'not found' }, { status: 404 });

    // 获取音频URL，如果为空则使用空字符串
    const rawAudioUrl =
      typeof d?.notes?.audio_url === 'string' && d.notes.audio_url.trim() ? d.notes.audio_url : '';

    // 解析 bucket/path 并归一化为相对代理链接
    let audio_bucket: string | null = null;
    let audio_path: string | null = null;
    let normalizedAudioUrl = rawAudioUrl;

    try {
      if (rawAudioUrl) {
        if (rawAudioUrl.includes('/api/storage-proxy')) {
          const u = new URL(rawAudioUrl, 'http://local');
          const b = u.searchParams.get('bucket');
          const p = u.searchParams.get('path');
          if (b) audio_bucket = b;
          if (p) audio_path = decodeURIComponent(p);
        } else if (rawAudioUrl.includes('/storage/v1/object/')) {
          const m1 = rawAudioUrl.match(/\/storage\/v1\/object\/(?:sign|public)\/([^/]+)\//);
          const m2 = rawAudioUrl.match(/\/storage\/v1\/object\/(?:sign|public)\/[^/]+\/([^?]+)/);
          if (m1 && m1[1]) audio_bucket = m1[1];
          if (m2 && m2[1]) audio_path = m2[1];
        }

        if (!audio_bucket) audio_bucket = 'tts';
        if (audio_bucket && audio_path) {
          normalizedAudioUrl = `/api/storage-proxy?path=${audio_path}&bucket=${audio_bucket}`;
        }
      }
    } catch (e) {
      // 忽略解析错误，保留原始URL
    }

    // 准备插入数据（显式生成 id，避免依赖数据库默认值缺失）
    const insertData: any = {
      id: crypto.randomUUID(),
      lang: d.lang,
      level: d.level,
      title: d.title,
      text: d.text,
      audio_url: normalizedAudioUrl,
      topic: d.topic || '',
      genre: d.genre || 'monologue',
      register: d.register || 'neutral',
      notes: d.notes || {},
      ai_provider: d.ai_provider || null,
      ai_model: d.ai_model || null,
      ai_usage: d.ai_usage || {},
      status: 'approved',
      created_by: d.created_by || null,
      theme_id: d.theme_id || null,
      subtopic_id: d.subtopic_id || null,
      translations: d.translations || {},
      trans_updated_at: d.trans_updated_at,
      quiz_questions: d.quiz_questions || null,
      meta: { from_draft: d.id, notes: d.notes, published_at: new Date().toISOString() },
    };

    // 若草稿 notes 中带有句级时间轴/时长，发布时落入目标表字段
    if (d?.notes?.sentence_timeline) {
      insertData.sentence_timeline = d.notes.sentence_timeline;
    }
    if (typeof d?.notes?.duration_ms === 'number') {
      insertData.duration_ms = d.notes.duration_ms;
    }

    if (audio_bucket) insertData.audio_bucket = audio_bucket;
    if (audio_path) insertData.audio_path = audio_path;

    console.log('准备插入的数据:', JSON.stringify(insertData, null, 2));

    // 检查数据长度和有效性
    if (insertData.title && insertData.title.length > 5000) {
      console.warn('标题过长，截断到5000字符:', insertData.title.length);
      insertData.title = insertData.title.substring(0, 5000);
    }

    if (insertData.text && insertData.text.length > 50000) {
      console.warn('文本过长，截断到50000字符:', insertData.text.length);
      insertData.text = insertData.text.substring(0, 50000);
    }

    if (insertData.audio_url && insertData.audio_url.length > 5000) {
      console.warn('音频URL过长，截断到5000字符:', insertData.audio_url.length);
      insertData.audio_url = insertData.audio_url.substring(0, 5000);
    }

    // 检查外键约束
    if (insertData.theme_id) {
      const { data: themeExists } = await auth.supabase
        .from('shadowing_themes')
        .select('id')
        .eq('id', insertData.theme_id)
        .single();
      if (!themeExists) {
        console.warn('主题ID不存在，设置为null:', insertData.theme_id);
        insertData.theme_id = null;
      }
    }

    if (insertData.subtopic_id) {
      const { data: subtopicExists } = await auth.supabase
        .from('shadowing_subtopics')
        .select('id')
        .eq('id', insertData.subtopic_id)
        .single();
      if (!subtopicExists) {
        console.warn('子主题ID不存在，设置为null:', insertData.subtopic_id);
        insertData.subtopic_id = null;
      }
    }

    console.log('最终插入的数据:', JSON.stringify(insertData, null, 2));

    const { data: insertResult, error: e1 } = await auth.supabase
      .from('shadowing_items')
      .insert([insertData])
      .select();
    if (e1) {
      console.error('插入 shadowing_items 失败:', e1);
      console.error('错误详情:', JSON.stringify(e1, null, 2));
      console.error('尝试插入的数据:', JSON.stringify(insertData, null, 2));
      return NextResponse.json(
        {
          error: `发布失败: ${e1.message}`,
          details: e1.details,
          hint: e1.hint,
          code: e1.code,
        },
        { status: 400 },
      );
    }
    console.log('插入成功，返回数据:', insertResult);

    console.log('开始更新草稿状态，ID:', id);
    const { data: updateData, error: e2 } = await auth.supabase
      .from('shadowing_drafts')
      .update({ status: 'approved' })
      .eq('id', id)
      .select();
    if (e2) {
      console.error('更新草稿状态失败:', e2);
      console.error('错误详情:', JSON.stringify(e2, null, 2));
      return NextResponse.json(
        {
          error: `更新草稿状态失败: ${e2.message}`,
          details: e2.details,
          hint: e2.hint,
          code: e2.code,
        },
        { status: 400 },
      );
    }
    console.log('草稿状态更新成功:', updateData);

    return NextResponse.json({ ok: true });
  }

  if (action === 'revert') {
    const { id } = await params;
    // 将草稿状态从 approved 改回 draft
    const { error: e1 } = await auth.supabase
      .from('shadowing_drafts')
      .update({ status: 'draft' })
      .eq('id', id);
    if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });

    // 从 shadowing_items 表中删除对应的项目
    const { error: e2 } = await auth.supabase
      .from('shadowing_items')
      .delete()
      .eq('meta->>from_draft', id);
    if (e2) {
      console.warn('Failed to delete from shadowing_items:', e2.message);
      // 不返回错误，因为主要操作（撤回草稿）已经成功
    }

    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id } = await params;

  try {
    // 1. 先获取草稿信息，包括音频URL
    const { data: draft, error: fetchError } = await auth.supabase
      .from('shadowing_drafts')
      .select('id, title, audio_url, lang')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('获取草稿信息失败:', fetchError);
    }

    // 2. 删除草稿记录
    const { error } = await auth.supabase.from('shadowing_drafts').delete().eq('id', id);
    if (error) {
      // 如果硬删除失败，尝试归档
      const { error: e2 } = await auth.supabase
        .from('shadowing_drafts')
        .update({ status: 'archived' })
        .eq('id', id);
      if (e2) return NextResponse.json({ error: e2.message }, { status: 400 });
    }

    // 3. 删除关联的音频文件
    if (draft && draft.audio_url) {
      try {
        // 从URL中提取文件路径
        const url = new URL(draft.audio_url);
        const pathParts = url.pathname.split('/');
        const bucketName = pathParts[pathParts.length - 2]; // 倒数第二个部分是bucket名
        const fileName = pathParts[pathParts.length - 1]; // 最后一个是文件名

        // 构建完整的文件路径
        const filePath = `${draft.lang || 'zh'}/${fileName}`;

        console.log(`尝试删除音频文件: ${filePath}`);

        // 删除Supabase Storage中的文件
        const { error: deleteError } = await auth.supabase.storage
          .from(bucketName)
          .remove([filePath]);

        if (deleteError) {
          console.warn(`删除音频文件失败: ${filePath} - ${deleteError.message}`);
        } else {
          console.log(`成功删除音频文件: ${filePath}`);
        }
      } catch (urlError) {
        console.warn(`解析音频URL失败: ${draft.audio_url} - ${urlError}`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('删除草稿时发生错误:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
