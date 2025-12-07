import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const subtopicId = searchParams.get('subtopic_id');

    if (!subtopicId) {
        return NextResponse.json({ error: 'Missing subtopic_id' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);
    let supabase;

    if (hasBearer) {
        supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                auth: { persistSession: false, autoRefreshToken: false },
                global: { headers: { Authorization: authHeader } },
            }
        );
    } else {
        const cookieStore = await cookies();
        supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                },
            }
        );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        console.error('[Subtopic Vectors API] Unauthorized:', authError);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Fetch vectors
        const { data: vectors, error } = await supabase
            .from('subtopic_scene_vectors')
            .select('scene_id, weight')
            .eq('subtopic_id', subtopicId)
            .gt('weight', 0)
            .order('weight', { ascending: false });

        if (error) throw error;

        // Fetch scene names
        const { data: scenes, error: sceneError } = await supabase
            .from('scene_tags')
            .select('scene_id, name_cn');

        if (sceneError) throw sceneError;

        const sceneMap = new Map(scenes.map((s: any) => [s.scene_id, s.name_cn]));

        const result = vectors.map((v: any) => ({
            scene_id: v.scene_id,
            name_cn: sceneMap.get(v.scene_id) || v.scene_id,
            weight: v.weight
        }));

        return NextResponse.json({ success: true, vectors: result });
    } catch (error: any) {
        console.error('Error fetching subtopic vectors:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
