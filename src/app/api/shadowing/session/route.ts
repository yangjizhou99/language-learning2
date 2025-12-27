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
      // 1. Import selected words to user's vocabulary
      if (selected_words.length > 0) {
        try {
          const vocabEntries = selected_words.map((word: Record<string, any>) => ({
            user_id: user.id,
            source_lang: word.lang || 'en',
            target_lang: 'zh', // Default to Chinese
            word: word.text,
            definition: word.definition || '',
            context: word.context || '',
            source_type: 'shadowing',
            source_id: item_id,
            frequency_rank: word.frequency_rank || null,
            cefr_level: word.cefr || null, // Store CEFR level if available
            created_at: new Date().toISOString(),
          }));

          const { data: insertedVocab, error: vocabError } = await supabase
            .from('vocab_entries')
            .upsert(vocabEntries, {
              onConflict: 'user_id,word,source_lang',
            })
            .select('id');

          if (!vocabError && insertedVocab) {
            // Update session with imported vocab IDs
            const vocabIds = insertedVocab.map((v: { id: string }) => v.id);
            await supabase
              .from('shadowing_sessions')
              .update({
                imported_vocab_ids: vocabIds,
              })
              .eq('id', session.id);
          }
        } catch (vocabImportError) {
          console.error('Error importing vocabulary:', vocabImportError);
          // Don't fail the session save if vocab import fails
        }
      }

      // 1.5. Record vocabulary knowledge for Bayesian prediction
      // Track all content words: marked as unknown vs seen but not marked
      try {
        // Fetch article text to get all tokens
        const { data: itemData } = await supabase
          .from('shadowing_items')
          .select('text, lang')
          .eq('id', item_id_db)
          .single();

        if (itemData?.text && itemData?.lang === 'ja') {
          const { analyzeLexProfileAsync } = await import('@/lib/recommendation/lexProfileAnalyzer');
          const { getFrequencyRank } = await import('@/lib/nlp/wordFrequency');

          const result = await analyzeLexProfileAsync(itemData.text, 'ja');
          const contentTokens = result.details.tokenList.filter(t => t.isContentWord);

          // Build set of marked unknown words
          const markedUnknownSet = new Set(
            selected_words.map((w: Record<string, any>) => w.text)
          );

          const now = new Date().toISOString();

          // Process each content word
          for (const token of contentTokens) {
            const word = token.token;
            const isMarkedUnknown = markedUnknownSet.has(word);

            // Check if record exists
            const { data: existing } = await supabase
              .from('user_vocabulary_knowledge')
              .select('id, exposure_count, not_marked_count, marked_unknown')
              .eq('user_id', user.id)
              .eq('word', word)
              .single();

            if (existing) {
              // Update existing record
              const updates: Record<string, unknown> = {
                exposure_count: (existing.exposure_count || 0) + 1,
                last_seen_at: now,
              };

              if (isMarkedUnknown) {
                updates.marked_unknown = true;
                updates.marked_at = now;
              } else if (!existing.marked_unknown) {
                // Seen but not marked → weak positive evidence
                updates.not_marked_count = (existing.not_marked_count || 0) + 1;
              }

              await supabase
                .from('user_vocabulary_knowledge')
                .update(updates)
                .eq('id', existing.id);
            } else {
              // Insert new record
              await supabase
                .from('user_vocabulary_knowledge')
                .insert({
                  user_id: user.id,
                  word,
                  lemma: token.lemma || word,
                  jlpt_level: token.originalLevel?.match(/N[1-5]/)?.[0] || null,
                  frequency_rank: getFrequencyRank(word, token.lemma) || null,
                  marked_unknown: isMarkedUnknown,
                  marked_at: isMarkedUnknown ? now : null,
                  exposure_count: 1,
                  not_marked_count: isMarkedUnknown ? 0 : 1,
                  first_seen_at: now,
                  last_seen_at: now,
                });
            }
          }

          console.log(`[VocabKnowledge] Recorded ${contentTokens.length} tokens, ${markedUnknownSet.size} marked unknown`);
        }
      } catch (vocabKnowledgeError) {
        console.error('Error recording vocabulary knowledge:', vocabKnowledgeError);
        // Don't fail the session save if this fails
      }

      // 2. Update User Ability & Vocab Profile (Difficulty System)
      try {
        // Fetch User Profile & Item Metadata
        const [profileRes, itemRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('ability_level, vocab_unknown_rate, explore_config, comprehension_rate')
            .eq('id', user.id)
            .single(),
          supabase
            .from('shadowing_items')
            .select('level, base_level, lex_profile, tokens')
            .eq('id', item_id_db)
            .single(),
        ]);

        if (profileRes.data && itemRes.data) {
          const {
            calculateSessionSkill,
            updateAbilityLevel,
            updateVocabUnknownRate,
            updateComprehensionRate,
            updateExploreConfig,
          } = await import('@/lib/recommendation/difficulty');

          const profile = profileRes.data;
          const item = itemRes.data;

          // Prepare Session Data for Calculation
          // Prepare Session Data for Calculation
          const sentenceScores = notes?.sentence_scores || {};
          const sentencesData = Object.values(sentenceScores).map((s: any) => ({
            sentenceId: 'unknown',
            firstScore: s.firstScore ?? s.score ?? 0,
            bestScore: s.bestScore ?? s.score ?? 0,
            attempts: s.attempts || 1,
          }));

          // Fallback to recordings if sentence_scores is empty
          const finalSentences = sentencesData.length > 0 ? sentencesData : (recordings || []).map((r: any) => ({
            sentenceId: r.fileName || 'unknown',
            firstScore: r.score || 0,
            bestScore: r.score || 0,
            attempts: 1,
          }));

          const sessionData = {
            userId: user.id,
            itemId: item_id_db,
            itemLevel: item.base_level || item.level || 1.0, // Fallback to integer level
            sentences: finalSentences,
            totalTimeSec: 0, // Not critical for now
            selfDifficulty: body.self_difficulty as any,
            newWords: selected_words.map((w: any) => ({
              word: w.text,
              cefrLevel: w.cefr,
            })),
            itemLexProfile: item.lex_profile || {},
            quizResult: quiz_result ? {
              correctCount: quiz_result.correct_count ?? quiz_result.correctCount ?? 0,
              total: quiz_result.total ?? 0,
            } : undefined,
          };

          // Calculate New State
          const estimatedTokens = item.tokens || 100; // Use actual tokens or fallback

          const sessionSkill = calculateSessionSkill(sessionData, estimatedTokens);

          const newAbilityLevel = updateAbilityLevel(
            profile.ability_level || 1.0,
            sessionData.itemLevel,
            sessionSkill
          );

          const newVocabRate = updateVocabUnknownRate(
            profile.vocab_unknown_rate || {},
            sessionData,
            estimatedTokens
          );

          // Update comprehension rate based on quiz result
          const newComprehensionRate = updateComprehensionRate(
            profile.comprehension_rate ?? 0.8, // Default to 80%
            sessionData.quizResult
          );

          // Update Explore Config (Learning Strategy)
          const newExploreConfig = updateExploreConfig(
            profile.explore_config || { mainRatio: 0.6, downRatio: 0.2, upRatio: 0.2 },
            newComprehensionRate,
            sessionSkill
          );

          // Update Profile
          await supabase
            .from('profiles')
            .update({
              ability_level: newAbilityLevel,
              vocab_unknown_rate: newVocabRate,
              comprehension_rate: newComprehensionRate,
              explore_config: newExploreConfig,
            })
            .eq('id', user.id);

          // Update Session with self_difficulty
          if (body.self_difficulty) {
            await supabase
              .from('shadowing_sessions')
              .update({ self_difficulty: body.self_difficulty })
              .eq('id', session.id);
          }
        }
      } catch (difficultyError) {
        console.error('Error updating difficulty state:', difficultyError);
        // Don't fail the request
      }
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
