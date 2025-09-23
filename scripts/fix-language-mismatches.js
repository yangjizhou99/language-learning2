#!/usr/bin/env node

/**
 * Fix language mismatches in shadowing_themes and shadowing_subtopics.
 * - Detects the language of textual fields
 * - Translates to the row.lang ('en' | 'ja' | 'zh') when mismatched
 * - Supports dry-run (default) and --apply to persist changes
 * - Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * - Optional: OPENROUTER_API_KEY (preferred) or DEEPSEEK_API_KEY (not used directly here)
 *
 * Usage:
 *   node scripts/fix-language-mismatches.js --apply --provider=openrouter --model=deepseek/deepseek-chat --batch=200 --concurrency=4
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const argv = process.argv.slice(2).reduce((acc, cur) => {
  const [k, v] = cur.includes('=') ? cur.split('=') : [cur, true];
  acc[k.replace(/^--/, '')] = v === undefined ? true : v;
  return acc;
}, {});

const APPLY = Boolean(argv.apply);
const PROVIDER = String(argv.provider || 'openrouter');
const MODEL = String(argv.model || 'deepseek/deepseek-chat');
const BATCH = parseInt(String(argv.batch || '200'), 10);
const CONCURRENCY = Math.max(1, parseInt(String(argv.concurrency || '4'), 10));

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function detectLang(text) {
  if (!text || typeof text !== 'string') return null;
  const s = text.replace(/[^\p{L}\p{N}]/gu, '');
  if (!s) return null;
  let han = 0;
  let hira = 0;
  let kata = 0;
  let latin = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0);
    if (code >= 0x4e00 && code <= 0x9fff) han++;
    else if (code >= 0x3040 && code <= 0x309f) hira++;
    else if (code >= 0x30a0 && code <= 0x30ff) kata++;
    else if ((code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)) latin++;
  }
  const total = han + hira + kata + latin;
  if (total === 0) return null;
  const jp = hira + kata;
  if (jp / total > 0.25) return 'ja';
  if (han / total > 0.25) return 'zh';
  return 'en';
}

async function translateText(text, targetLang, fieldKind = 'text') {
  if (!text || !text.trim()) return text;
  const current = detectLang(text);
  if (current === targetLang) return text;

  if (PROVIDER !== 'openrouter') {
    console.warn('[translate] Only provider=openrouter is implemented in this script. Falling back to passthrough.');
    return text;
  }
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[translate] No OPENROUTER_API_KEY/OPENAI_API_KEY in env; returning original text.');
    return text;
  }

  const targetName = targetLang === 'en' ? 'English' : targetLang === 'ja' ? '日本語' : '简体中文';
  const instructions = fieldKind === 'seed'
    ? `Translate the following keywords into ${targetName}. Return ONLY a comma-separated list of concise keywords without explanations.`
    : `Translate the following content into ${targetName}. Keep meaning faithful. Return ONLY the translated text.`;

  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: instructions },
          { role: 'user', content: text },
        ],
        temperature: 0.2,
      }),
    });
    const j = await r.json();
    const out = j?.choices?.[0]?.message?.content || text;
    // normalize seed spacing
    if (fieldKind === 'seed') {
      return out
        .split(/[，,]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .join(', ');
    }
    return out.trim();
  } catch (e) {
    console.warn('[translate] failed, returning original:', e?.message || e);
    return text;
  }
}

async function processTable({
  table,
  idField,
  fields,
}) {
  console.log(`\nProcessing ${table} ...`);
  let from = 0;
  let fixedCount = 0;
  let scanned = 0;
  const changedRows = [];

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(`*`)
      .range(from, from + BATCH - 1);
    if (error) throw new Error(`${table} fetch error: ${error.message}`);
    if (!data || data.length === 0) break;

    scanned += data.length;

    // chunk with concurrency
    const chunks = [];
    for (let i = 0; i < data.length; i += CONCURRENCY) {
      chunks.push(data.slice(i, i + CONCURRENCY));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async (row) => {
        const targetLang = row.lang;
        if (!['en', 'ja', 'zh'].includes(targetLang)) return null;
        const updates = {};
        let hasChange = false;

        for (const f of fields) {
          const val = row[f.name];
          if (!val || typeof val !== 'string') continue;
          const detected = detectLang(val);
          if (detected && detected !== targetLang) {
            const translated = await translateText(val, targetLang, f.kind);
            if (translated && translated !== val) {
              updates[f.name] = translated;
              hasChange = true;
            }
          }
        }

        if (hasChange) {
          if (APPLY) {
            const { error: upErr } = await supabase
              .from(table)
              .update(updates)
              .eq(idField, row[idField]);
            if (upErr) {
              console.warn(`[update] ${table}:${row[idField]} failed:`, upErr.message);
            } else {
              fixedCount++;
              changedRows.push({ table, id: row[idField], before: fields.reduce((acc, f)=>{acc[f.name]=row[f.name];return acc;},{}), after: updates });
            }
          } else {
            fixedCount++;
            changedRows.push({ table, id: row[idField], before: fields.reduce((acc, f)=>{acc[f.name]=row[f.name];return acc;},{}), after: updates });
          }
        }
        return null;
      });
      await Promise.all(promises);
    }

    from += data.length;
    if (data.length < BATCH) break;
  }

  // write backup report
  const outFile = path.join(process.cwd(), `fix-lang-${table}-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ apply: APPLY, table, fixedCount, scanned, changes: changedRows }, null, 2));
  console.log(`[report] ${table}: scanned=${scanned}, fixed=${fixedCount}, report=${outFile}`);
}

(async () => {
  console.log('[start] fix-language-mismatches', { APPLY, PROVIDER, MODEL, BATCH, CONCURRENCY });

  // themes: fix title/desc if present
  await processTable({
    table: 'shadowing_themes',
    idField: 'id',
    fields: [
      { name: 'title', kind: 'text' },
      { name: 'desc', kind: 'text' },
    ],
  });

  // subtopics: fix title/one_line/seed
  await processTable({
    table: 'shadowing_subtopics',
    idField: 'id',
    fields: [
      { name: 'title', kind: 'text' },
      { name: 'one_line', kind: 'text' },
      { name: 'seed', kind: 'seed' },
    ],
  });

  console.log('[done]');
  process.exit(0);
})().catch((e) => {
  console.error('[fatal]', e);
  process.exit(1);
});
