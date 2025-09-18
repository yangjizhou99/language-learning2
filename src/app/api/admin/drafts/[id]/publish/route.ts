import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const supabase = auth.supabase;
  const { id } = await params;

  const { data: d, error: e0 } = await supabase
    .from('article_drafts')
    .select('*')
    .eq('id', id)
    .single();
  if (e0 || !d) return NextResponse.json({ error: 'draft not found' }, { status: 404 });
  if (d.status === 'published' && d.published_article_id)
    return NextResponse.json({ ok: true, article_id: d.published_article_id });

  // 生成checksum
  const checksum = await crypto.subtle
    .digest('SHA-256', new TextEncoder().encode(d.text))
    .then((hash) =>
      Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(''),
    );

  // 正式入库（事务性写入）
  const { data: art, error: e1 } = await supabase
    .from('articles')
    .insert([
      {
        lang: d.lang,
        genre: d.genre,
        difficulty: d.difficulty,
        title: d.title,
        text: d.text,
        source_url: d?.meta?.source_url || null,
        license: d.license || null,
        checksum,
        meta: { attribution: d.source === 'ai' ? 'AI generated' : 'User provided' },
      },
    ])
    .select('id')
    .single();
  if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });

  const { error: e2 } = await supabase.from('article_keys').insert([
    {
      article_id: art.id,
      pass1: d.keys.pass1,
      pass2: d.keys.pass2,
      pass3: d.keys.pass3,
    },
  ]);
  if (e2) return NextResponse.json({ error: e2.message }, { status: 400 });

  const { error: e3 } = await supabase.from('article_cloze').insert([
    { article_id: art.id, version: 'short', items: d.cloze_short },
    { article_id: art.id, version: 'long', items: d.cloze_long },
  ]);
  if (e3) return NextResponse.json({ error: e3.message }, { status: 400 });

  await supabase
    .from('article_drafts')
    .update({ status: 'published', published_article_id: art.id })
    .eq('id', id);
  return NextResponse.json({ ok: true, article_id: art.id });
}
