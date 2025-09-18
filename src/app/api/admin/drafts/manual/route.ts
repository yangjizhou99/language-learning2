import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { pass1, pass2, pass3, makeCloze } from '@/lib/answerkey/generate';
import { splitSentencesWithIndex } from '@/lib/nlp/segment';
import { inBounds, exact } from '@/lib/answerkey/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const supabase = auth.supabase;
  const b = await req.json();
  const { lang, genre, difficulty, title, text, license, source_url } = b;
  if (!lang || !genre || !difficulty || !title || !text)
    return NextResponse.json({ error: '缺字段' }, { status: 400 });

  const p1 = pass1(text, lang),
    p2 = pass2(text, lang),
    p3 = pass3(text, lang);
  const shortCloze = makeCloze(text, lang, 'short');
  const longCloze = makeCloze(text, lang, 'long');
  const sents = splitSentencesWithIndex(text, lang),
    len = text.length;

  const p1c = p1.filter((k: any) => inBounds(k.span, len) && exact(text, k.span, k.surface));
  const p2c = p2
    .map((x: any) => ({
      pron: x.pron,
      antecedents: (x.antecedents || [])
        .filter(
          (a: any) =>
            inBounds(a, len) &&
            a[1] <= x.pron[0] &&
            sents.some(
              (S) => a[0] >= S.start && a[1] <= S.end && x.pron[0] >= S.start && x.pron[1] <= S.end,
            ),
        )
        .slice(-3),
    }))
    .filter((x: any) => x.antecedents.length > 0);
  const p3c = p3.filter(
    (t: any) =>
      sents.some((S) => t.s[0] >= S.start && t.o[1] <= S.end) &&
      t.s[1] <= t.v[0] &&
      t.v[1] <= t.o[0],
  );

  const { data, error } = await supabase
    .from('article_drafts')
    .insert([
      {
        source: 'manual',
        lang,
        genre,
        difficulty,
        title,
        text,
        license: license || 'User-Provided',
        meta: { source_url },
        keys: { pass1: p1c, pass2: p2c, pass3: p3c },
        cloze_short: shortCloze,
        cloze_long: longCloze,
        validator_report: {
          len,
          sentences: sents.length,
          p1: p1c.length,
          p2: p2c.length,
          p3: p3c.length,
        },
        status: 'pending',
        created_by: auth.user.id,
      },
    ])
    .select('id')
    .single();

  if (error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  return NextResponse.json({ ok: true, draft_id: data.id });
}
