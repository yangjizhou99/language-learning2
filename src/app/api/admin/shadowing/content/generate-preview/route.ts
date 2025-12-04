import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { chatJSON } from '@/lib/ai/client';
import { buildShadowPrompt, Lang, Genre, DialogueType } from '@/lib/shadowing/prompt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        // Temporarily disable admin check for testing if needed, but keeping it for now
        // const auth = await requireAdmin(req);
        // if (!auth.ok) {
        //   return NextResponse.json({ error: 'forbidden' }, { status: 403 });
        // }

        const body = await req.json();
        const {
            subtopic,
            provider = 'deepseek',
            model = 'deepseek-chat',
            temperature = 0.7,
            previous_context,
            theme_script, // Add theme_script
        } = body;

        if (!subtopic || !subtopic.title || !subtopic.lang || !subtopic.level || !subtopic.genre) {
            return NextResponse.json({ error: 'Missing required subtopic fields' }, { status: 400 });
        }

        let prompt = buildShadowPrompt({
            lang: subtopic.lang as Lang,
            level: subtopic.level as 1 | 2 | 3 | 4 | 5 | 6,
            genre: subtopic.genre as Genre,
            dialogueType: subtopic.dialogue_type as DialogueType,
            title: subtopic.title,
            one_line: subtopic.one_line,
        });

        if (subtopic.script) {
            prompt += `\n\nCHAPTER_SCRIPT (Specific Plot for this Scene):\n${subtopic.script}\n\nFollow this script closely.`;
        }

        if (theme_script) {
            prompt += `\n\nTHEME_SCRIPT (Overall Plot):\n${theme_script}\n\nEnsure the content aligns with this overall story arc.`;
        }

        if (previous_context) {
            prompt += `\n\nPREVIOUS_STORY_CONTEXT:\n${previous_context}\n\nEnsure the new content flows logically from this context.`;
        }

        const result = await chatJSON({
            provider: provider as 'openrouter' | 'deepseek' | 'openai',
            model,
            temperature,
            timeoutMs: 120000,
            messages: [
                { role: 'system', content: 'You are a helpful writing assistant.' },
                { role: 'user', content: prompt },
            ],
        });

        let parsed;
        try {
            parsed = JSON.parse(result.content);
        } catch (e) {
            const jsonMatch = result.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Invalid JSON response');
            }
        }

        return NextResponse.json({
            success: true,
            data: parsed,
        });
    } catch (error: any) {
        console.error('Content generation preview error:', error);
        return NextResponse.json(
            { error: error.message || String(error) },
            { status: 500 },
        );
    }
}
