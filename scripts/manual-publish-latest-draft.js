#!/usr/bin/env node
// 使用服务端密钥手动发布最新的 shadowing_draft

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function main() {
  const s = getClient();
  const { data: d, error } = await s
    .from('shadowing_drafts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error || !d) {
    console.log(JSON.stringify({ ok: false, step: 'fetch_draft', error: error?.message || 'no_draft' }));
    process.exit(1);
  }

  const rawAudioUrl = typeof d?.notes?.audio_url === 'string' && d.notes.audio_url.trim() ? d.notes.audio_url : '';
  let audio_bucket = null;
  let audio_path = null;
  let normalized = rawAudioUrl;
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
        normalized = `/api/storage-proxy?path=${audio_path}&bucket=${audio_bucket}`;
      }
    }
  } catch {}

  const ins = {
    id: crypto.randomUUID(),
    lang: d.lang,
    level: d.level,
    title: d.title,
    text: d.text,
    audio_url: normalized,
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
    meta: { from_draft: d.id, notes: d.notes, published_at: new Date().toISOString() },
  };
  if (audio_bucket) ins.audio_bucket = audio_bucket;
  if (audio_path) ins.audio_path = audio_path;

  const r1 = await s.from('shadowing_items').insert([ins]).select();
  if (r1.error) {
    console.log(JSON.stringify({ ok: false, step: 'insert_item', error: r1.error.message, details: r1.error }));
    process.exit(2);
  }

  const r2 = await s.from('shadowing_drafts').update({ status: 'approved' }).eq('id', d.id).select();
  if (r2.error) {
    console.log(JSON.stringify({ ok: false, step: 'update_draft', error: r2.error.message, details: r2.error }));
    process.exit(3);
  }

  console.log(JSON.stringify({ ok: true, item: r1.data?.[0] || null, draft: r2.data?.[0] || null }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(99);
});


