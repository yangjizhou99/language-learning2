import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

type EvalReq = {
  lang: 'en' | 'ja' | 'zh';
  instruction: string;
  user_output: string;
  rubrics: string[]; // e.g. ["Task","Naturalness","Tone"]
  model?: string; // deepseek-chat | deepseek-reasoner
};

type AudioEvalReq = {
  text: string;
  lang: 'en' | 'ja' | 'zh';
};

type EvalResp = {
  scores: Record<string, number>; // rubric -> 1..5
  feedback: string;
  rewrite_best?: string; // same-language rewrite
  overall?: number; // avg
};

type AudioEvalResp = {
  score: number; // 0.0 - 1.0
  feedback: string;
  accuracy: number; // 0.0 - 1.0
  fluency: number; // 0.0 - 1.0
};

const sys = (lang: string) => `
你是严格的语言评审员。仅输出 JSON（scores{}, feedback, rewrite_best）。
规则：
- 语言=${lang}（feedback 与 rewrite_best 都用此语言）
- 对给定 rubrics（如 Task/Naturalness/Tone）逐项打分，整数 1..5；5=非常好，1=差。
- feedback：简短、可操作（≤80字/词），先指出问题再给替代建议。
- 在不改变信息的前提下，给出更自然/更礼貌/更连贯的 rewrite_best。仅输出 JSON。`;

const audioEvalSys = (lang: string) => `
你是严格的语言发音评审员。仅输出 JSON（score, feedback, accuracy, fluency）。
规则：
- 语言=${lang}（feedback 用此语言）
- score：整体评分 0.0-1.0（1.0=完美，0.0=完全错误）
- accuracy：发音准确性 0.0-1.0
- fluency：流利度 0.0-1.0
- feedback：简短、可操作的改进建议（≤50字/词）
仅输出 JSON。`;

export async function POST(req: NextRequest) {
  try {
    // 获取用户信息
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 检查是否是音频评分请求
    const contentType = req.headers.get('content-type');

    if (contentType?.includes('multipart/form-data')) {
      // 音频评分请求
      const formData = await req.formData();
      const audio = formData.get('audio') as File;
      const text = formData.get('text') as string;
      const lang = formData.get('lang') as 'en' | 'ja' | 'zh';
      const recognized = (formData.get('recognized') as string) || '';

      if (!audio || !text || !lang) {
        return NextResponse.json({ error: 'missing params: audio/text/lang' }, { status: 400 });
      }

      // 若提供了前端识别文本，直接基于该识别结果与原文计算准确度（字符级 CER 简化版）
      function normalizeZh(s: string): string {
        return s
          .replace(/[，。,\.、；;！!？?\s]/g, '')
          .replace(/春联/g, '对联') // 简单同义词归一
          .replace(/龙舟/g, '龙舟')
          .toLowerCase();
      }
      function normalizeJa(s: string): string {
        return s.replace(/[、。\s]/g, '').toLowerCase();
      }
      function normalizeEn(s: string): string {
        return s.replace(/[^a-z0-9]/gi, '').toLowerCase();
      }
      function norm(lang: string, s: string): string {
        if (lang === 'zh') return normalizeZh(s || '');
        if (lang === 'ja') return normalizeJa(s || '');
        return normalizeEn(s || '');
      }
      function cer(ref: string, hyp: string): number {
        // 计算 Levenshtein 距离 / 参考长度
        const r = ref.split('');
        const h = hyp.split('');
        const dp = Array(r.length + 1)
          .fill(0)
          .map(() => Array(h.length + 1).fill(0));
        for (let i = 0; i <= r.length; i++) dp[i][0] = i;
        for (let j = 0; j <= h.length; j++) dp[0][j] = j;
        for (let i = 1; i <= r.length; i++) {
          for (let j = 1; j <= h.length; j++) {
            const cost = r[i - 1] === h[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
          }
        }
        const dist = dp[r.length][h.length];
        return r.length ? dist / r.length : 1;
      }

      const ref = norm(lang, text || '');
      // 如果没有传识别文本，先退化为简单高分保守返回
      if (!recognized || !recognized.trim()) {
        const response: AudioEvalResp = {
          score: 0.8,
          feedback:
            lang === 'zh'
              ? '识别文本缺失，返回保守得分。'
              : lang === 'ja'
                ? '認識テキストが無いため暫定スコアです。'
                : 'No ASR text provided; returning a conservative score.',
          accuracy: 0.8,
          fluency: 0.8,
        };
        return NextResponse.json(response);
      }

      const hyp = norm(lang, recognized || '');
      const cerVal = cer(ref, hyp); // 0..1，越小越好
      const acc = Math.max(0, Math.min(1, 1 - cerVal));
      // 设定流利度为识别长度/参考长度的平滑函数（简化），并与准确度做温和平均
      const lenRatio = Math.min(1, (hyp.length + 1) / (ref.length + 1));
      const flu = Math.max(0.5, Math.min(1, 0.6 * lenRatio + 0.4 * acc));
      const overall = Math.round((0.8 * acc + 0.2 * flu) * 100) / 100;

      const feedbacks = {
        ja:
          overall > 0.85
            ? '発音と流暢さは良好です。抑揚と区切りを更に意識しましょう。'
            : '一部の音節が不一致。ゆっくり区切って発音し、難所を重点練習しましょう。',
        en:
          overall > 0.85
            ? 'Good accuracy and fluency. Focus on prosody and stress patterns.'
            : 'Some mismatches detected. Slow down and practice tricky segments deliberately.',
        zh:
          overall > 0.85
            ? '准确度与流利度良好。再加强语调与停连更自然。'
            : '存在若干不匹配。放慢速度，分句练习，重点突破难点词。',
      } as const;

      const response: AudioEvalResp = {
        score: overall,
        feedback: feedbacks[lang],
        accuracy: acc,
        fluency: flu,
      };
      return NextResponse.json(response);
    } else {
      // 文本评分请求（原有功能）
      const { lang, instruction, user_output, rubrics, model }: EvalReq = await req.json();
      if (!lang || !instruction || !user_output || !rubrics?.length) {
        return NextResponse.json(
          { error: 'missing params: lang/instruction/user_output/rubrics' },
          { status: 400 },
        );
      }

      // 获取用户API密钥
      const { getUserAPIKeys } = await import('@/lib/user-api-keys');
      const userKeys = await getUserAPIKeys(user.id);
      const apiKey = userKeys?.deepseek || process.env.DEEPSEEK_API_KEY;
      if (!apiKey)
        return NextResponse.json({ error: 'DEEPSEEK_API_KEY is missing' }, { status: 500 });

      const client = new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com' });

      const prompt = `
请根据 rubrics 对下列输出打分并给出反馈与更佳改写。
[Instruction]
${instruction}
[User Output]
${user_output}
[Rubrics]
${rubrics.join(', ')}
`;

      const resp = await client.chat.completions.create({
        model: model || 'deepseek-chat',
        messages: [
          { role: 'system', content: sys(lang) },
          { role: 'user', content: prompt },
        ],
        // @ts-ignore
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });

      const raw = resp.choices?.[0]?.message?.content ?? '{}';
      let data: EvalResp;
      try {
        data = JSON.parse(raw);
      } catch {
        const m = raw.match(/\{[\s\S]*\}$/);
        if (!m)
          return NextResponse.json(
            { error: 'LLM non-JSON', raw: raw.slice(0, 500) },
            { status: 502 },
          );
        data = JSON.parse(m[0]);
      }

      // 基本有效性校验 + 归一化（1..5）
      if (!data?.scores || typeof data?.feedback !== 'string') {
        return NextResponse.json({ error: 'invalid eval payload', raw: data }, { status: 502 });
      }
      for (const k of Object.keys(data.scores)) {
        let v = Number(data.scores[k]);
        if (!Number.isFinite(v)) v = 1;
        data.scores[k] = Math.max(1, Math.min(5, Math.round(v)));
      }
      const vals = Object.values(data.scores) as number[];
      data.overall = vals.length
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
        : undefined;

      return NextResponse.json(data);
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown error' }, { status: 500 });
  }
}
