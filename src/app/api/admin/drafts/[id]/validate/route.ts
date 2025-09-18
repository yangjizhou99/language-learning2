export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { splitSentencesWithIndex } from '@/lib/nlp/segment';
import { inBounds, exact } from '@/lib/answerkey/validate';

type Span = [number, number];

function overlap(a: Span, b: Span) {
  return !(a[1] <= b[0] || b[1] <= a[0]);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json();
  const { lang, text, keys, cloze_short = [], cloze_long = [] } = body || {};
  if (!lang || !text || !keys)
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });

  const len = text.length;
  const sents = splitSentencesWithIndex(text, lang);

  // Pass1：span 边界 & exact-match
  const p1 = (keys.pass1 || []).filter(
    (k: any) =>
      inBounds(k.span, len) &&
      exact(text, k.span, text.slice(k.span[0], k.span[1])) &&
      (k.tag === 'connective' || k.tag === 'time'),
  );

  // Pass2：先行词必须在同句，且在代词之前
  const p2 = (keys.pass2 || [])
    .map((x: any) => ({
      pron: x.pron,
      antecedents: (x.antecedents || [])
        .filter((a: Span) => {
          const okBounds = inBounds(a, len) && inBounds(x.pron, len);
          if (!okBounds) return false;
          if (a[1] > x.pron[0]) return false;
          return sents.some(
            (S) => a[0] >= S.start && a[1] <= S.end && x.pron[0] >= S.start && x.pron[1] <= S.end,
          );
        })
        .slice(-3),
    }))
    .filter((x: any) => x.antecedents.length > 0);

  // Pass3：S/V/O 同句、顺序 & 不重叠
  const p3 = (keys.pass3 || []).filter((t: any) => {
    const ok = ['s', 'v', 'o'].every((k) => inBounds(t[k], len));
    if (!ok) return false;
    const sameSent = sents.some((S) => t.s[0] >= S.start && t.o[1] <= S.end);
    const order = t.s[0] <= t.v[0] && t.v[0] <= t.o[0];
    const disjoint = t.s[1] <= t.v[0] && t.v[1] <= t.o[0];
    return sameSent && order && disjoint && !overlap(t.s, t.v) && !overlap(t.v, t.o);
  });

  // Cloze：exact-match + 去重 + 每句最多 1 个
  function cleanCloze(items: any[]) {
    const bySent = new Map<number, number>();
    const out: any[] = [];
    items.sort((a, b) => a.start - b.start);
    for (const it of items) {
      if (!inBounds([it.start, it.end], len)) continue;
      const ans = text.slice(it.start, it.end);
      if (ans !== it.answer) continue;
      if (out.some((x) => overlap([it.start, it.end], [x.start, x.end]))) continue;
      const si = sents.findIndex((S) => it.start >= S.start && it.end <= S.end);
      if (si === -1) continue;
      const q = bySent.get(si) || 0;
      if (q >= 1) continue;
      out.push({
        start: it.start,
        end: it.end,
        answer: ans,
        hint: it.hint || 'blank',
        type: it.type || 'collocation',
      });
      bySent.set(si, q + 1);
    }
    return out;
  }
  const czS = cleanCloze(cloze_short);
  const czL = cleanCloze(cloze_long);

  return NextResponse.json({
    ok: true,
    keys: { pass1: p1, pass2: p2, pass3: p3 },
    cloze_short: czS,
    cloze_long: czL,
    report: {
      len,
      sentences: sents.length,
      pass1: p1.length,
      pass2: p2.length,
      pass3: p3.length,
      cloze_short: czS.length,
      cloze_long: czL.length,
    },
  });
}
