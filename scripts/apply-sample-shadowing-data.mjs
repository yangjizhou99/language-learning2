#!/usr/bin/env node
import path from 'path';
import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const conn = process.env.LOCAL_DB_URL || process.env.DATABASE_URL || process.env.PG_DATABASE_URL || process.env.PG_URL || process.env.PGURI;
if (!conn) {
  console.error('未找到本地数据库连接串（LOCAL_DB_URL / DATABASE_URL）');
  process.exit(1);
}

// 样例数据（根据你提供的片段）
const metaObj = {
  meta: { lang: 'ja', genre: 'dialogue', level: 'L2' },
  tips: '道案内の基本的な表現を学べます。緊急時の丁寧な尋ね方に注目。',
  pacing: '緊迫感のある速いテンポ',
  source: { kind: 'subtopic', subtopic_id: '8c59b805-a62c-495b-bff3-369e05f532b3' },
  speakers: ['A', 'B'],
  audio_url:
    'http://localhost:3000/api/storage-proxy?path=ja/dialogue-1758557827343-yrcn7xvthcs.mp3&bucket=tts',
  violations: [],
  is_dialogue: true,
  key_phrases: ['急いで病院に行きたい', '最短ルートを教えて', '歩いてどのくらい', '急いで歩けば', 'お気をつけて'],
  tts_provider: 'Google',
  dialogue_count: 2,
  random_voice_assignment: { A: 'ja-JP-Chirp3-HD-Fenrir', B: 'ja-JP-Chirp3-HD-Vindemiatrix' },
};

const aiProvider = 'deepseek';
const aiModel = 'deepseek-chat';
const aiUsage = {
  total_tokens: 514,
  prompt_tokens: 231,
  completion_tokens: 283,
  prompt_tokens_details: { cached_tokens: 0 },
  prompt_cache_hit_tokens: 0,
  prompt_cache_miss_tokens: 231,
};
const statusVal = 'approved';
const createdAt = '2025-09-22T15:55:55.021Z';
const translations = {
  en: 'A: Excuse me, I need to get to the hospital urgently.\nB: Oh, which hospital?',
};

async function main() {
  const client = new Client({ connectionString: conn });
  await client.connect();
  try {
    // 选择最近插入的占位记录（各取1条）
    const draftsRes = await client.query(
      `SELECT id FROM shadowing_drafts ORDER BY created_at DESC NULLS LAST LIMIT 1;`
    );
    const itemsRes = await client.query(
      `SELECT id FROM shadowing_items ORDER BY created_at DESC NULLS LAST LIMIT 1;`
    );
    const draftId = draftsRes.rows[0]?.id;
    const itemId = itemsRes.rows[0]?.id;
    if (!draftId || !itemId) {
      console.error('未找到占位记录，请先插入占位数据');
      process.exit(2);
    }

    // 更新 drafts
    await client.query(
      `UPDATE shadowing_drafts SET
        ai_provider = $1,
        ai_model = $2,
        ai_usage = $3::jsonb,
        status = $4,
        created_at = $5::timestamptz,
        translations = $6::jsonb,
        notes = $7::jsonb
       WHERE id = $8`,
      [aiProvider, aiModel, JSON.stringify(aiUsage), statusVal, createdAt, JSON.stringify(translations), JSON.stringify(metaObj), draftId]
    );

    // 更新 items（把 meta 放到 items.meta，音频 URL 单独列）
    await client.query(
      `UPDATE shadowing_items SET
        lang = COALESCE(lang, 'ja'),
        title = COALESCE(title, 'Placeholder title'),
        audio_url = $1,
        meta = $2::jsonb
       WHERE id = $3`,
      [metaObj.audio_url, JSON.stringify(metaObj), itemId]
    );

    console.log('已写入样例数据：', { draftId, itemId });
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


