import { supabase } from './supabase';

export type RAGStats = { terms: number; phrases: number; hasProfile: boolean };

export async function buildRAG(
  lang: 'en' | 'ja' | 'zh',
  topic: string,
  kTerms = 8,
  kPhrases = 5,
): Promise<{ text: string; stats: RAGStats }> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return { text: '', stats: { terms: 0, phrases: 0, hasProfile: false } };

  // Get profile
  const { data: prof } = await supabase
    .from('profiles')
    .select('bio,goals,preferred_tone,domains,native_lang,target_langs,username')
    .eq('id', uid)
    .maybeSingle();

  // RAG功能已删除，只返回用户档案信息
  const profPart = prof
    ? [
        `【PROFILE】`,
        `username: ${prof.username || ''}`,
        `native_lang: ${prof.native_lang || ''}`,
        `target_langs: ${prof.target_langs?.join(', ') || ''}`,
        `bio: ${prof.bio || ''}`,
        `goals: ${prof.goals || ''}`,
        `preferred_tone: ${prof.preferred_tone || ''}`,
        `domains: ${prof.domains?.join(', ') || ''}`,
      ].join('\n')
    : '';

  // 限制长度
  let rag = profPart.trim();
  if (rag.length > 2000) rag = rag.slice(0, 2000);

  return {
    text: rag,
    stats: {
      terms: 0,
      phrases: 0,
      hasProfile: !!prof,
    },
  };
}
