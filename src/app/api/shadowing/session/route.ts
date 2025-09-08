export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: NextRequest) {
  try {
    // Bearer 优先，其次 Cookie 方式
    const authHeader = req.headers.get('authorization') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabase: ReturnType<typeof createServerClient> | ReturnType<typeof createClient>;
    
    if (hasBearer) {
      supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } }
      });
    } else {
      const cookieStore = await cookies();
      supabase = createServerClient(supabaseUrl, supabaseAnon, {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set() {},
          remove() {},
        }
      });
    }
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
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

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching session:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      session: session || null
    });

  } catch (error) {
    console.error('Error in GET shadowing session API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Bearer 优先，其次 Cookie 方式
    const authHeader = req.headers.get('authorization') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabase: ReturnType<typeof createServerClient> | ReturnType<typeof createClient>;
    
    if (hasBearer) {
      supabase = createClient(supabaseUrl, supabaseAnon, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: authHeader } }
      });
    } else {
      const cookieStore = await cookies();
      supabase = createServerClient(supabaseUrl, supabaseAnon, {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set() {},
          remove() {},
        }
      });
    }
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

  const body = await req.json();
  const {
    item_id, // 使用正确的列名
    status = 'in_progress', // 使用正确的默认值
    recordings = [],
    vocab_entry_ids = [], // 使用正确的列名
    picked_preview = [], // 使用正确的列名
    selected_words = [], // 添加selected_words参数
    notes = {}
  } = body;

  if (!item_id) {
    return NextResponse.json({ error: 'item_id is required' }, { status: 400 });
  }

    // Check if session already exists
    const { data: existingSession, error: checkError } = await supabase
      .from('shadowing_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('item_id', item_id)
      .single();

    let session, error;
    
    if (checkError && checkError.code === 'PGRST116') {
      // No existing session, create new one
      const { data: newSession, error: insertError } = await supabase
        .from('shadowing_sessions')
        .insert({
          user_id: user.id,
          item_id,
          status,
          recordings,
          vocab_entry_ids,
          picked_preview,
          notes
        })
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
          notes
        })
        .eq('user_id', user.id)
        .eq('item_id', item_id)
        .select()
        .single();
      
      session = updatedSession;
      error = updateError;
    }

    if (error) {
      console.error('Error saving session:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If status is 'completed' and there are selected words to import
    if (status === 'completed' && selected_words.length > 0) {
      try {
        // Import selected words to user's vocabulary
        const vocabEntries = selected_words.map((word: any) => ({
          user_id: user.id,
          source_lang: word.lang || 'en',
          target_lang: 'zh', // Default to Chinese
          word: word.text,
          definition: word.definition || '',
          context: word.context || '',
          source_type: 'shadowing',
          source_id: item_id,
          frequency_rank: word.frequency_rank || null,
          created_at: new Date().toISOString()
        }));

        const { data: insertedVocab, error: vocabError } = await supabase
          .from('vocab_entries')
          .upsert(vocabEntries, {
            onConflict: 'user_id,word,source_lang'
          })
          .select('id');

        if (!vocabError && insertedVocab) {
          // Update session with imported vocab IDs
          const vocabIds = insertedVocab.map((v: any) => v.id);
          await supabase
            .from('shadowing_sessions')
            .update({
              imported_vocab_ids: vocabIds
            })
            .eq('id', session.id);
        }
      } catch (vocabImportError) {
        console.error('Error importing vocabulary:', vocabImportError);
        // Don't fail the session save if vocab import fails
      }
    }

    return NextResponse.json({
      success: true,
      session
    });

  } catch (error) {
    console.error('Error in POST shadowing session API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
