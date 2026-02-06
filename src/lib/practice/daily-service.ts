import { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export type DailyPracticeItem = {
    lang: string;
    level: number | null;
    phase: 'unpracticed' | 'unfinished' | 'cleared';
    item?: any;
    today_done?: boolean;
    message?: string;
    error?: string;
};

/**
 * Get the daily shadowing practice item for a user and language.
 * Optimized to reduce DB round-trips and use proper indexes.
 */
export async function getDailyShadowingItem(
    supabase: SupabaseClient,
    userId: string,
    lang: string
): Promise<DailyPracticeItem> {
    try {
        // 1. Fetch pool of approved items with their metadata + session status + theme/subtopic
        // We select specific fields to keep payload light, but include theme/subtopic details via JOIN.
        const { data: items, error: itemsError } = await supabase
            .from('shadowing_items')
            .select(`
        id, lang, level, title, text, audio_url, audio_bucket, audio_path, 
        duration_ms, tokens, cefr, meta, translations, trans_updated_at, 
        sentence_timeline, created_at, theme_id, subtopic_id, notes,
        theme:shadowing_themes(id, title, desc),
        subtopic:shadowing_subtopics(id, title, one_line)
      `)
            .eq('lang', lang)
            .eq('status', 'approved') // Critical: Hits the partial index
            .order('created_at', { ascending: false })
            .limit(500);

        if (itemsError) {
            console.error('getDailyShadowingItem items fetch error:', itemsError);
            throw new Error('items_query_failed');
        }

        const allItems = items || [];
        if (allItems.length === 0) {
            return { lang, level: null, phase: 'cleared' };
        }

        // 2. Fetch user's session status for these items to filter unpracticed/unfinished
        // Optimization: Only fetch status for the items in our pool
        const itemIds = allItems.map((i) => i.id);
        const { data: sessions, error: sessionsError } = await supabase
            .from('shadowing_sessions')
            .select('item_id, status')
            .eq('user_id', userId)
            .in('item_id', itemIds);

        if (sessionsError) {
            console.error('getDailyShadowingItem sessions fetch error:', sessionsError);
            // Fallback: assume no sessions if error, but logging it is important
        }

        const sessionByItem = new Map<string, 'draft' | 'completed'>();
        (sessions || []).forEach((s: { item_id: string; status: 'draft' | 'completed' }) => {
            if (s?.item_id) sessionByItem.set(s.item_id, s.status);
        });

        const unpracticed = allItems.filter((i) => !sessionByItem.has(i.id));
        const unfinished = allItems.filter((i) => sessionByItem.get(i.id) === 'draft');

        // 3. Deterministic "Today's Seed" logic
        // We identify "Today's Item" based on a hash of (User + Lang + Date).
        // This item is "Today's Goal", regardless of whether it's done or not.
        // If it's done, we show it as "Done". If not, we guide them to it (unless valid pool logic overrides).
        const seedAll = `${userId}:${lang}:${new Date().toISOString().slice(0, 10)}`;
        const idxAll = parseInt(crypto.createHash('sha1').update(seedAll).digest('hex').slice(0, 8), 16) % allItems.length;
        const rawToday = allItems[idxAll];
        const todayDone = !!rawToday && sessionByItem.get(rawToday.id) === 'completed';
        const hasChoice = (arr: unknown[]) => Array.isArray(arr) && arr.length > 0;

        // 4. Selection Logic
        let pool = unpracticed;
        let phase: 'unpracticed' | 'unfinished' | 'cleared' = 'unpracticed';

        if (!hasChoice(pool)) {
            pool = unfinished;
            phase = hasChoice(pool) ? 'unfinished' : 'cleared';
        }

        if (phase === 'cleared') {
            return { lang, level: null, phase: 'cleared', message: '恭喜清空题库', today_done: todayDone };
        }

        // Default to the "Today" item if possible, otherwise pick from pool?
        // The original logic seemed to just use `rawToday` as the returned item unless specific conditions met?
        // Actually, looking at original code:
        // It filters pool/phase, BUT it returns `item` constructed from `rawToday` (variable `raw`).
        // Wait, lines 118-120: `const raw = rawToday as Record<string, any>;`
        // Then returns `item` based on `raw`.
        // So "Phase" calculation is just for status reporting, but the ITEM returned is always the deterministic "Today's Item"?
        // OR does it imply we should practice `pool[0]`?
        // Re-reading original code (Step 19):
        // It calculates `pool` and `phase`.
        // Then it defines `raw = rawToday`. 
        // Then it returns `{ item: ..., phase: ... }`.
        // It does NOT seem to pick from `pool` for the `item` field. It always picks `rawToday`.
        // This means the "Daily Task" is fixed per day. The `phase` tells the UI if they have other stuff to do?
        // Actually, if `rawToday` is completed (`todayDone` is true), the UI probably shows "Done".
        // AND if they click it, they might re-practice or do nothing.

        // However, if the user wants to "continue learning", they might want the next unpracticed item.
        // But the API seems to return ONE item.
        // If the intention of "Daily" is "One specific item per day", then returning `rawToday` is correct.
        // If the intention is "Give me something to do", and today's is done, maybe we should give another?
        // The previous code returned `today_done` flag. The UI uses it.
        // So we will strictly preserve the logic: Return `rawToday` as the item.

        const raw = rawToday;

        // Resolve Audio URL
        const resolvedAudio =
            raw.audio_url || raw?.notes?.audio_url ||
            (raw.audio_bucket && raw.audio_path
                ? `/api/storage-proxy?path=${encodeURIComponent(raw.audio_path)}&bucket=${encodeURIComponent(raw.audio_bucket)}`
                : null);

        // Construct final item object (matching the shape expected by frontend)
        // Note: theme and subtopic are already joined by Supabase (as objects in the row)
        const item = {
            id: raw.id,
            lang: raw.lang,
            level: raw.level,
            title: raw.title,
            text: raw.text,
            audio_url: resolvedAudio,
            duration_ms: raw.duration_ms,
            tokens: raw.tokens,
            cefr: raw.cefr,
            meta: raw.meta,
            translations: raw.translations,
            trans_updated_at: raw.trans_updated_at,
            sentence_timeline: raw.sentence_timeline,
            created_at: raw.created_at,
            theme_id: raw.theme_id,
            subtopic_id: raw.subtopic_id,
            theme: raw.theme,       // Joined data
            subtopic: raw.subtopic, // Joined data
            notes: raw.notes,
        };

        return {
            lang,
            level: raw.level,
            phase,
            item,
            today_done: todayDone
        };

    } catch (e) {
        console.error('getDailyShadowingItem exception:', e);
        // Return error formatted safely
        return { lang, level: null, phase: 'unpracticed', error: 'server_error' };
    }
}
