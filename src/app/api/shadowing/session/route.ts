export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
  try {
    // Bearer 优先，其次 Cookie 方式
    const authHeader = req.headers.get('authorization') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabase: SupabaseClient;

    if (hasBearer) {
      supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      });
    } else {
      const cookieStore = await cookies();
      supabase = (createServerClient(supabaseUrl, supabaseAnon, {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() { },
          remove() { },
        },
      }) as unknown) as SupabaseClient;
    }

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const itemId = url.searchParams.get('item_id');

    if (!itemId) {
      return NextResponse.json({ error: 'item_id is required' }, { status: 400 });
    }

    // Get existing session for this user and item
    const { data: session, error } = await supabase
      .from('shadowing_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('item_id', itemId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found"
      console.error('Error fetching session:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      session: session || null,
    });
  } catch (error) {
    console.error('Error in GET shadowing session API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Bearer 优先，其次 Cookie 方式
    const authHeader = req.headers.get('authorization') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabase: SupabaseClient;

    if (hasBearer) {
      supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } },
      });
    } else {
      const cookieStore = await cookies();
      supabase = (createServerClient(supabaseUrl, supabaseAnon, {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() { },
          remove() { },
        },
      }) as unknown) as SupabaseClient;
    }

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      item_id, // 前端传入的字段名
      status = 'draft', // 使用正确的默认值
      recordings = [],
      vocab_entry_ids = [], // 使用正确的列名
      picked_preview = [], // 使用正确的列名
      selected_words = [], // 添加selected_words参数
      notes = {},
      quiz_result = null, // Quiz comprehension test result
      prediction_stats = null, // 预测统计数据 { predictedUnknown: string[], threshold: number }
    } = body;

    if (!item_id) {
      return NextResponse.json({ error: 'item_id is required' }, { status: 400 });
    }

    // 数据库中实际使用的字段名是item_id
    const item_id_db = item_id;

    // Check if session already exists
    const { data: existingSession, error: checkError } = await supabase
      .from('shadowing_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('item_id', item_id_db)
      .single();

    let session: any, error: any;

    if (checkError && checkError.code === 'PGRST116') {
      // No existing session, create new one
      const newSessionPayload = {
        id: randomUUID(),
        user_id: user.id,
        item_id: item_id_db,
        status,
        recordings,
        vocab_entry_ids,
        picked_preview,
        notes,
        quiz_result,
        created_at: new Date().toISOString(),
      };

      const { data: newSession, error: insertError } = await supabase
        .from('shadowing_sessions')
        .insert(newSessionPayload)
        .select()
        .single();

      session = newSession;
      error = insertError;
    } else if (checkError) {
      // Other error
      session = null;
      error = checkError;
    } else {
      // Update existing session
      const { data: updatedSession, error: updateError } = await supabase
        .from('shadowing_sessions')
        .update({
          status,
          recordings,
          vocab_entry_ids,
          picked_preview,
          notes,
          quiz_result,
        })
        .eq('user_id', user.id)
        .eq('item_id', item_id_db)
        .select()
        .single();

      session = updatedSession;
      error = updateError;
    }

    if (error) {
      console.error('Error saving session:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 500 },
      );
    }

    // If status is 'completed' and there are selected words to import
    if (status === 'completed') {
      console.log('[Session Save] Status is completed. Selected words:', selected_words?.length);
      const startTime = Date.now();

      // CRITICAL PATH: Only vocab import is blocking (user needs to see their vocab saved)
      // 1. Import selected words to user's vocabulary
      if (selected_words.length > 0) {
        try {
          // Check for existing vocab entries to avoid duplicates (since no unique constraint exists)
          const terms = selected_words.map((w: any) => w.text);
          const { data: existingVocab } = await supabase
            .from('vocab_entries')
            .select('id, term, lang')
            .eq('user_id', user.id)
            .in('term', terms);

          const existingMap = new Map<string, string>();
          if (existingVocab) {
            existingVocab.forEach((v: any) => {
              existingMap.set(`${v.term}_${v.lang}`, v.id);
            });
          }

          // Fetch user profile to get native_lang
          const { data: profile } = await supabase
            .from('profiles')
            .select('native_lang')
            .eq('id', user.id)
            .single();

          const userNativeLang = profile?.native_lang || 'zh';

          // Build new vocab entries (without id, let database generate it)
          const newEntries: any[] = [];

          selected_words.forEach((word: Record<string, any>) => {
            const lang = word.lang || 'ja'; // Default to Japanese
            const existingId = existingMap.get(`${word.text}_${lang}`);

            // Only add if not already existing
            if (!existingId) {
              newEntries.push({
                user_id: user.id,
                lang: lang,
                native_lang: userNativeLang,
                term: word.text,
                explanation: {
                  gloss_native: word.definition || '',
                  ...word.explanation
                },
                context: word.context || '',
                source: 'shadowing',
                source_id: item_id,
                cefr_level: word.cefr || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
          });

          let allVocabIds: string[] = [];

          // Get IDs of existing entries
          existingMap.forEach((id: string) => {
            allVocabIds.push(id);
          });

          // Insert new entries only
          if (newEntries.length > 0) {
            const { data: insertedVocab, error: vocabError } = await supabase
              .from('vocab_entries')
              .insert(newEntries)
              .select('id');

            if (!vocabError && insertedVocab) {
              allVocabIds.push(...insertedVocab.map(v => v.id));
            }
          }

          if (allVocabIds.length > 0) {
            // Update session with imported vocab IDs
            await supabase
              .from('shadowing_sessions')
              .update({
                imported_vocab_ids: allVocabIds,
              })
              .eq('id', session.id);
          }
        } catch (vocabImportError) {
          console.error('[Session Save] Error importing vocabulary:', vocabImportError);
          // Don't fail the session save if vocab import fails
        }
      }

      console.log(`[Session Save] Critical path completed in ${Date.now() - startTime}ms`);

      // NON-CRITICAL PATH: Run analytics and profile updates in background
      // These don't need to block the user response
      const backgroundTasks = async () => {
        const bgStartTime = Date.now();
        try {
          // 1.5 Calculate and save prediction accuracy statistics
          if (prediction_stats?.predictedUnknown?.length > 0) {
            try {
              const predictedSet = new Set<string>(prediction_stats.predictedUnknown as string[]);
              const markedSet = new Set<string>(selected_words.map((w: Record<string, any>) => w.text as string));

              let truePositive = 0;
              let falsePositive = 0;
              let falseNegative = 0;

              for (const word of predictedSet) {
                if (markedSet.has(word)) {
                  truePositive++;
                } else {
                  falsePositive++;
                }
              }
              for (const word of markedSet) {
                if (!predictedSet.has(word)) {
                  falseNegative++;
                }
              }

              const precision = truePositive / (truePositive + falsePositive) || 0;
              const recall = truePositive / (truePositive + falseNegative) || 0;
              const f1Score = precision + recall > 0
                ? (2 * precision * recall) / (precision + recall)
                : 0;

              const accuracyStats = {
                predictedCount: predictedSet.size,
                markedCount: markedSet.size,
                truePositive,
                falsePositive,
                falseNegative,
                precision: Math.round(precision * 1000) / 1000,
                recall: Math.round(recall * 1000) / 1000,
                f1Score: Math.round(f1Score * 1000) / 1000,
                threshold: prediction_stats.threshold || 0.5,
                timestamp: new Date().toISOString(),
              };

              const existingNotes = session.notes || {};
              await supabase
                .from('shadowing_sessions')
                .update({
                  notes: {
                    ...existingNotes,
                    prediction_accuracy: accuracyStats,
                  },
                })
                .eq('id', session.id);
            } catch (e) {
              console.error('BG: Error saving prediction stats:', e);
            }
          }

          // 1.5. Record vocabulary knowledge for Japanese content only
          const { data: itemData } = await supabase
            .from('shadowing_items')
            .select('text, lang')
            .eq('id', item_id_db)
            .single();

          if (itemData?.text && itemData?.lang === 'ja') {
            try {
              const { analyzeLexProfileAsync } = await import('@/lib/recommendation/lexProfileAnalyzer');
              const { getFrequencyRank } = await import('@/lib/nlp/wordFrequency');

              const result = await analyzeLexProfileAsync(itemData.text, 'ja');
              const contentTokens = result.details.tokenList.filter(t => t.isContentWord);
              const markedUnknownSet = new Set(selected_words.map((w: Record<string, any>) => w.text));
              const now = new Date().toISOString();
              const uniqueWords = [...new Set(contentTokens.map(t => t.token))];

              const tokenDataMap = new Map<string, typeof contentTokens[0]>();
              for (const token of contentTokens) {
                if (!tokenDataMap.has(token.token)) {
                  tokenDataMap.set(token.token, token);
                }
              }

              const wordCounts = new Map<string, number>();
              for (const token of contentTokens) {
                wordCounts.set(token.token, (wordCounts.get(token.token) || 0) + 1);
              }

              const { data: existingRecords } = await supabase
                .from('user_vocabulary_knowledge')
                .select('id, word, exposure_count, not_marked_count, marked_unknown')
                .eq('user_id', user.id)
                .in('word', uniqueWords);

              const existingMap = new Map((existingRecords || []).map(r => [r.word, r]));
              const recordsToInsert: any[] = [];
              const recordsToUpdate: { id: string; data: Record<string, unknown> }[] = [];

              for (const word of uniqueWords) {
                const isMarkedUnknown = markedUnknownSet.has(word);
                const existing = existingMap.get(word);
                const token = tokenDataMap.get(word)!;
                const occurrences = wordCounts.get(word) || 1;

                if (existing) {
                  const updates: Record<string, unknown> = {
                    exposure_count: (existing.exposure_count || 0) + occurrences,
                    last_seen_at: now,
                  };
                  if (isMarkedUnknown) {
                    updates.marked_unknown = true;
                    updates.marked_at = now;
                  } else if (!existing.marked_unknown) {
                    updates.not_marked_count = (existing.not_marked_count || 0) + occurrences;
                  }
                  recordsToUpdate.push({ id: existing.id, data: updates });
                } else {
                  recordsToInsert.push({
                    user_id: user.id,
                    word,
                    lemma: token.lemma || word,
                    jlpt_level: token.originalLevel?.match(/N[1-5]/)?.[0] || null,
                    frequency_rank: getFrequencyRank(word, token.lemma) || null,
                    marked_unknown: isMarkedUnknown,
                    marked_at: isMarkedUnknown ? now : null,
                    exposure_count: occurrences,
                    not_marked_count: isMarkedUnknown ? 0 : occurrences,
                    first_seen_at: now,
                    last_seen_at: now,
                  });
                }
              }

              if (recordsToInsert.length > 0) {
                await supabase.from('user_vocabulary_knowledge').insert(recordsToInsert);
              }

              if (recordsToUpdate.length > 0) {
                const chunkSize = 50;
                for (let i = 0; i < recordsToUpdate.length; i += chunkSize) {
                  const chunk = recordsToUpdate.slice(i, i + chunkSize);
                  await Promise.all(
                    chunk.map(({ id, data }) =>
                      supabase.from('user_vocabulary_knowledge').update(data).eq('id', id)
                    )
                  );
                }
              }

              console.log(`[VocabKnowledge] BG processed ${uniqueWords.length} words`);
            } catch (e) {
              console.error('BG: Error recording vocab knowledge:', e);
            }
          }

          // 1.6 Update Cached Bayesian Profile (only for Japanese users with vocab knowledge)
          if (itemData?.lang === 'ja') {
            try {
              const { data: allKnowledge } = await supabase
                .from('user_vocabulary_knowledge')
                .select('word, jlpt_level, frequency_rank, marked_unknown, exposure_count, not_marked_count')
                .eq('user_id', user.id);

              if (allKnowledge && allKnowledge.length > 0) {
                const { calculateUserProfileFromEvidence } = await import('@/lib/recommendation/vocabularyPredictor');
                const vocabRows = allKnowledge.map(row => ({
                  word: row.word,
                  jlpt_level: row.jlpt_level,
                  frequency_rank: row.frequency_rank,
                  marked_unknown: row.marked_unknown || false,
                  exposure_count: row.exposure_count || 0,
                  not_marked_count: row.not_marked_count || 0,
                }));

                const newProfile = calculateUserProfileFromEvidence(vocabRows);
                await supabase.from('profiles').update({ bayesian_profile: newProfile }).eq('id', user.id);
                console.log('[BayesianProfile] BG updated profile');
              }
            } catch (e) {
              console.error('BG: Error updating Bayesian profile:', e);
            }
          }

          // 2. Update User Ability & Vocab Profile (Difficulty System)
          try {
            const [profileRes, itemRes] = await Promise.all([
              supabase.from('profiles').select('ability_level, vocab_unknown_rate, explore_config, comprehension_rate').eq('id', user.id).single(),
              supabase.from('shadowing_items').select('level, base_level, lex_profile, tokens').eq('id', item_id_db).single(),
            ]);

            if (profileRes.data && itemRes.data) {
              const { calculateSessionSkill, updateAbilityLevel, updateVocabUnknownRate, updateComprehensionRate, updateExploreConfig } = await import('@/lib/recommendation/difficulty');

              const profile = profileRes.data;
              const item = itemRes.data;
              const sentenceScores = notes?.sentence_scores || {};
              const sentencesData = Object.values(sentenceScores).map((s: any) => ({
                sentenceId: 'unknown',
                firstScore: s.firstScore ?? s.score ?? 0,
                bestScore: s.bestScore ?? s.score ?? 0,
                attempts: s.attempts || 1,
              }));

              const finalSentences = sentencesData.length > 0 ? sentencesData : (recordings || []).map((r: any) => ({
                sentenceId: r.fileName || 'unknown',
                firstScore: r.score || 0,
                bestScore: r.score || 0,
                attempts: 1,
              }));

              const sessionData = {
                userId: user.id,
                itemId: item_id_db,
                itemLevel: item.base_level || item.level || 1.0,
                sentences: finalSentences,
                totalTimeSec: 0,
                selfDifficulty: body.self_difficulty as any,
                newWords: selected_words.map((w: any) => ({ word: w.text, cefrLevel: w.cefr })),
                itemLexProfile: item.lex_profile || {},
                quizResult: quiz_result ? { correctCount: quiz_result.correct_count ?? quiz_result.correctCount ?? 0, total: quiz_result.total ?? 0 } : undefined,
              };

              const estimatedTokens = item.tokens || 100;
              const sessionSkill = calculateSessionSkill(sessionData, estimatedTokens);
              const newAbilityLevel = updateAbilityLevel(profile.ability_level || 1.0, sessionData.itemLevel, sessionSkill);
              const newVocabRate = updateVocabUnknownRate(profile.vocab_unknown_rate || {}, sessionData, estimatedTokens);
              const newComprehensionRate = updateComprehensionRate(profile.comprehension_rate ?? 0.8, sessionData.quizResult);
              const newExploreConfig = updateExploreConfig(profile.explore_config || { mainRatio: 0.6, downRatio: 0.2, upRatio: 0.2 }, newComprehensionRate, sessionSkill);

              await supabase.from('profiles').update({
                ability_level: newAbilityLevel,
                vocab_unknown_rate: newVocabRate,
                comprehension_rate: newComprehensionRate,
                explore_config: newExploreConfig,
              }).eq('id', user.id);

              if (body.self_difficulty) {
                await supabase.from('shadowing_sessions').update({ self_difficulty: body.self_difficulty }).eq('id', session.id);
              }
            }
          } catch (e) {
            console.error('BG: Error updating difficulty state:', e);
          }

          console.log(`[Session Save] BG tasks completed in ${Date.now() - bgStartTime}ms`);
        } catch (e) {
          console.error('[Session Save] BG task error:', e);
        }
      };

      // Fire and forget - don't await background tasks
      // TEMPORARILY DISABLED for debugging - uncomment when stable
      // backgroundTasks().catch(e => console.error('[Session Save] BG error:', e));

      console.log(`[Session Save] Returning response after ${Date.now() - startTime}ms (BG tasks DISABLED for testing)`);
    }

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error('Error in POST shadowing session API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

