export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getProfileFromSelfReport, SelfReportedLevel } from '@/lib/coldStart/selfReportProfiles';
import { calculateFromQuickTest, QuickTestResponse, QUICK_TEST_WORDS, shuffleTestWords } from '@/lib/coldStart/quickTest';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/onboarding
 * Get onboarding status and test words
 */
export async function GET(req: NextRequest) {
    try {
        const supabase = await getSupabaseClient(req);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get current onboarding status
        const { data: profile } = await supabase
            .from('profiles')
            .select('onboarding_completed, quick_test_completed, self_reported_jlpt')
            .eq('id', user.id)
            .single();

        return NextResponse.json({
            success: true,
            onboardingCompleted: profile?.onboarding_completed || false,
            quickTestCompleted: profile?.quick_test_completed || false,
            selfReportedJlpt: profile?.self_reported_jlpt || null,
            testWords: shuffleTestWords(),
        });
    } catch (error) {
        console.error('Error in GET onboarding:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/onboarding
 * Save onboarding results
 * 
 * Body:
 * - selfReportedJlpt: 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'unsure'
 * - quickTestResponses?: QuickTestResponse[] (optional)
 * - skipQuickTest?: boolean
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = await getSupabaseClient(req);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { selfReportedJlpt, quickTestResponses, skipQuickTest, adaptiveTestResult } = body as {
            selfReportedJlpt: SelfReportedLevel;
            quickTestResponses?: QuickTestResponse[];
            skipQuickTest?: boolean;
            adaptiveTestResult?: {
                estimatedLevel: number;
                jlptMastery: Record<string, number>;
                questionsAnswered: number;
                confidence: number;
            };
        };

        if (!selfReportedJlpt) {
            return NextResponse.json({ error: 'selfReportedJlpt is required' }, { status: 400 });
        }

        // Calculate initial profile
        let initialProfile;
        let quickTestCompleted = false;

        if (adaptiveTestResult) {
            // Use adaptive test results (highest priority)
            initialProfile = {
                jlptMastery: adaptiveTestResult.jlptMastery,
                estimatedLevel: adaptiveTestResult.estimatedLevel,
                evidenceCount: adaptiveTestResult.questionsAnswered,
                frequencyThreshold: 5000,
                lastUpdated: new Date(),
            };
            quickTestCompleted = true;
        } else if (quickTestResponses && quickTestResponses.length > 0 && !skipQuickTest) {
            // Use quick test results
            initialProfile = calculateFromQuickTest(quickTestResponses);
            quickTestCompleted = true;
        } else {
            // Use self-report only
            initialProfile = getProfileFromSelfReport(selfReportedJlpt);
        }

        // Update profile
        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                self_reported_jlpt: selfReportedJlpt,
                onboarding_completed: true,
                quick_test_completed: quickTestCompleted,
            })
            .eq('id', user.id);

        if (updateError) {
            console.error('Error updating profile:', updateError);
            return NextResponse.json({ error: 'Failed to save onboarding' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            profile: {
                jlptMastery: initialProfile.jlptMastery,
                estimatedLevel: Math.round(initialProfile.estimatedLevel * 100) / 100,
                evidenceCount: initialProfile.evidenceCount,
                quickTestCompleted,
            },
        });
    } catch (error) {
        console.error('Error in POST onboarding:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

async function getSupabaseClient(req: NextRequest): Promise<SupabaseClient> {
    const authHeader = req.headers.get('authorization') || '';
    const hasBearer = /^Bearer\s+/.test(authHeader);

    if (hasBearer) {
        return createClient(supabaseUrl, supabaseAnon, {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: authHeader } },
        });
    } else {
        const cookieStore = await cookies();
        return createServerClient(supabaseUrl, supabaseAnon, {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set() { },
                remove() { },
            },
        }) as unknown as SupabaseClient;
    }
}
