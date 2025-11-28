import { getServiceSupabase } from '@/lib/supabaseAdmin';
import { chatJSON } from '@/lib/ai/client';

type Provider = 'openrouter' | 'deepseek' | 'openai';

// 对外暴露的类型：仍然是“按主题的偏好权重”，但内部已完全改为统一场景空间

export type ThemePreference = {
  theme_id: string;
  weight: number; // 实际含义：用户场景向量 U 与该主题场景向量 M 的相似度得分
  topScenes?: { scene_id: string; name_cn: string; weight: number }[]; // 贡献度最高的场景
};

export type SubtopicPreference = {
  subtopic_id: string;
  weight: number;
};

export type UserPreferenceVectors = {
  themes: ThemePreference[];
  subtopics: SubtopicPreference[]; // 目前不使用，保持为空以兼容调用方
  themeMap: Map<string, number>;
  subtopicMap: Map<string, number>;
};

// 内部使用的行类型

type ProfileRow = {
  id: string;
  goals: string | null;
  domains: string[] | null;
  native_lang: string | null;
  target_langs: string[] | null;
};

type SceneTagRow = {
  scene_id: string;
  name_cn: string | null;
  name_en: string | null;
  description: string | null;
};

type ScenePreferenceRow = {
  scene_id: string;
  weight: number;
};

type ThemeSceneVectorRow = {
  theme_id: string;
  scene_id: string;
  weight: number;
};

type LLMScenePreferenceResponse = {
  scenes?: { scene_id: string; weight: number }[];
};

/**
 * 获取用户的“统一场景空间”偏好，并为每个主题计算一个推荐权重。
 * - 完全抛弃旧的按 theme/subtopic 存偏好的方案；
 * - 用户偏好只存到 user_scene_preferences（scene_tags 维度）；
 * - 主题场景向量来自 theme_scene_vectors；
 * - 最终返回 per-theme 权重，用于前端排序。
 */
export async function getUserPreferenceVectors(
  userId: string,
  opts: { forceRefresh?: boolean } = {},
): Promise<UserPreferenceVectors> {
  const { forceRefresh = false } = opts;
  const supabase = getServiceSupabase();

  if (!forceRefresh) {
    const existing = await loadPreferenceVectors(supabase, userId);
    if (existing) return existing;
  }

  // 无缓存或强制刷新：使用 LLM 基于 profile → scene_tags 生成 user_scene_preferences
  await generateAndStoreScenePreferences(supabase, userId);
  const after = await loadPreferenceVectors(supabase, userId);
  if (after) return after;

  // Fallback: 空向量
  return {
    themes: [],
    subtopics: [],
    themeMap: new Map(),
    subtopicMap: new Map(),
  };
}

/**
 * 从 user_scene_preferences + theme_scene_vectors 中计算 per-theme 得分。
 */
async function loadPreferenceVectors(
  supabase: ReturnType<typeof getServiceSupabase>,
  userId: string,
): Promise<UserPreferenceVectors | null> {
  // 1. 读取用户在场景空间的偏好
  const { data: scenePrefs, error: sceneErr } = await supabase
    .from('user_scene_preferences')
    .select('scene_id, weight')
    .eq('user_id', userId);

  if (sceneErr) {
    console.error('Failed to load user_scene_preferences:', sceneErr);
    return null;
  }

  const sceneMap = new Map<string, number>();
  for (const r of (scenePrefs || []) as ScenePreferenceRow[]) {
    sceneMap.set(r.scene_id, clamp01(r.weight));
  }
  if (sceneMap.size === 0) return null;

  // 2. 读取所有 active 主题及其场景向量
  const { data: themes, error: themeErr } = await supabase
    .from('shadowing_themes')
    .select('id')
    .eq('status', 'active');

  if (themeErr) {
    console.error('Failed to load shadowing_themes for scoring:', themeErr);
    return null;
  }

  const themeRows = (themes || []) as { id: string }[];
  if (!themeRows.length) {
    return {
      themes: [],
      subtopics: [],
      themeMap: new Map(),
      subtopicMap: new Map(),
    };
  }

  const themeIds = themeRows.map((t) => t.id);

  const { data: vectors, error: vectorErr } = await supabase
    .from('theme_scene_vectors')
    .select('theme_id, scene_id, weight')
    .in('theme_id', themeIds);

  if (vectorErr) {
    console.error('Failed to load theme_scene_vectors:', vectorErr);
    return null;
  }

  // 额外读取 scene_tags 以获取中文名
  const { data: sceneTags, error: tagErr } = await supabase
    .from('scene_tags')
    .select('scene_id, name_cn');

  const sceneNameMap = new Map<string, string>();
  if (sceneTags) {
    sceneTags.forEach((t: any) => {
      sceneNameMap.set(t.scene_id, t.name_cn || t.scene_id);
    });
  }

  const vectorRows = (vectors || []) as ThemeSceneVectorRow[];

  // 3. 对每个 theme 计算 U·M（用户场景偏好 × 主题场景向量）
  // 同时记录每个主题下贡献度最高的场景
  const themeScoreMap = new Map<string, number>();
  const themeSceneContribs = new Map<string, Array<{ scene_id: string; contrib: number }>>();

  for (const row of vectorRows) {
    const u = sceneMap.get(row.scene_id) ?? 0;
    const w = clamp01(row.weight);
    if (u <= 0 || w <= 0) continue;

    const contrib = u * w;
    const prev = themeScoreMap.get(row.theme_id) ?? 0;
    themeScoreMap.set(row.theme_id, prev + contrib);

    // 记录贡献
    if (!themeSceneContribs.has(row.theme_id)) {
      themeSceneContribs.set(row.theme_id, []);
    }
    themeSceneContribs.get(row.theme_id)?.push({ scene_id: row.scene_id, contrib });
  }

  // 对没有任何场景向量的主题，得分默认为 0
  for (const t of themeRows) {
    if (!themeScoreMap.has(t.id)) themeScoreMap.set(t.id, 0);
  }

  const themesOut: ThemePreference[] = [];
  const themeMap = new Map<string, number>();
  for (const [themeId, score] of themeScoreMap.entries()) {
    const val = clamp01(score); // 简单裁剪到 [0,1]，后续可按需要做归一化

    // 获取 Top 2 场景
    const contribs = themeSceneContribs.get(themeId) || [];
    contribs.sort((a, b) => b.contrib - a.contrib);
    const topScenes = contribs.slice(0, 2).map(c => ({
      scene_id: c.scene_id,
      name_cn: sceneNameMap.get(c.scene_id) || c.scene_id,
      weight: c.contrib // 这里存的是贡献值 (u*w)
    }));

    themesOut.push({ theme_id: themeId, weight: val, topScenes });
    themeMap.set(themeId, val);
  }

  // 按得分从高到低排序，方便调用方
  themesOut.sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));

  return {
    themes: themesOut,
    subtopics: [],
    themeMap,
    subtopicMap: new Map(),
  };
}

/**
 * 基于用户 profile + scene_tags，用 LLM 生成 user_scene_preferences。
 */
async function generateAndStoreScenePreferences(
  supabase: ReturnType<typeof getServiceSupabase>,
  userId: string,
) {
  // 1. 读取用户 profile
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, goals, domains, native_lang, target_langs')
    .eq('id', userId)
    .single<ProfileRow>();

  if (profileErr) {
    console.error('Failed to load profile for scene preferences:', profileErr);
    return;
  }

  // 2. 读取场景标签列表
  const { data: scenes, error: scenesErr } = await supabase
    .from('scene_tags')
    .select('scene_id, name_cn, name_en, description')
    .order('scene_id', { ascending: true });

  if (scenesErr || !scenes || scenes.length === 0) {
    console.error('Failed to load scene_tags for scene preferences:', scenesErr);
    return;
  }

  const sceneRows = scenes as SceneTagRow[];

  // 此处默认使用 DeepSeek，避免 OpenRouter key 异常导致 401
  const providerEnv: Provider = 'deepseek';
  const modelEnv = 'deepseek-chat';

  const userInfo = {
    goals: profile?.goals || '',
    domains: profile?.domains || [],
    native_lang: profile?.native_lang || null,
    target_langs: profile?.target_langs || [],
  };

  const sceneListText = sceneRows
    .map(
      (s) =>
        `- ${s.scene_id}: ${s.name_cn || s.name_en || ''} ${s.description ? `（${s.description}）` : ''
        }`,
    )
    .join('\n');

  const systemPrompt =
    '你是一个语言学习网站的推荐系统助手。\n' +
    '网站维护了一套稳定的“学习场景标签”（scene_tags），例如“日常生活、出行与问路、餐饮点餐”等。\n' +
    '每个用户在个人资料里写了学习目标 (goals) 和感兴趣领域 (domains)。\n' +
    '你的任务：根据用户的 goals/domains/目标语言，为每个场景标签分配一个 0~1 的权重，用于个性化推荐。';

  const userPrompt = [
    '【用户资料】(user_profile)',
    JSON.stringify(userInfo, null, 2),
    '',
    '【场景标签列表】(scene_tags)',
    sceneListText,
    '',
    '请根据用户的学习目标/兴趣/目标语言，对每个场景标签分配一个 0~1 的权重。',
    '要求：',
    '- 请为每个 scene_id 给出一个 0~1 的实数 weight（可以保留 1~2 位小数）。',
    '- 至少有 3~5 个场景的权重大于 0.6，表示重点场景。',
    '- 不要忽略任何场景，所有 scene_id 都必须出现在输出中。',
    '',
    '输出格式（只输出 JSON）：',
    '{',
    '  "scenes": [',
    '    { "scene_id": "daily_life", "weight": 0.8 },',
    '    { "scene_id": "travel_and_directions", "weight": 0.7 }',
    '  ]',
    '}',
  ].join('\n');

  try {
    const { content } = await chatJSON({
      provider: providerEnv,
      model: modelEnv,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_json: true,
      temperature: 0.2,
      timeoutMs: 60_000,
      userId,
    });

    let parsed: LLMScenePreferenceResponse | null = null;
    try {
      if (typeof content === 'string') {
        parsed = JSON.parse(content) as LLMScenePreferenceResponse;
      } else if (typeof content === 'object' && content !== null) {
        parsed = content as LLMScenePreferenceResponse;
      }
    } catch (e) {
      console.error('Failed to parse LLM scene preference JSON:', e, 'raw content:', content);
      parsed = null;
    }

    if (!parsed || !Array.isArray(parsed.scenes)) {
      console.error('LLM scene preference response missing scenes array');
      return;
    }

    const validSceneIds = new Set(sceneRows.map((s) => s.scene_id));

    const payload =
      (parsed.scenes || [])
        .map((s) => {
          const raw = typeof s.weight === 'number' ? s.weight : 0;
          let val = Number.isFinite(raw) ? raw : 0;
          val = clamp01(val);
          return {
            user_id: userId,
            scene_id: String(s.scene_id),
            weight: val,
            updated_at: new Date().toISOString(),
          };
        })
        // 过滤掉不存在于 scene_tags 表中的 scene_id
        .filter((r) => validSceneIds.has(r.scene_id)) ?? [];

    if (payload.length === 0) {
      console.warn('LLM scene preference returned no valid scenes, skipping upsert');
      return;
    }

    const { error } = await supabase.from('user_scene_preferences').upsert(payload, {
      onConflict: 'user_id,scene_id',
    });
    if (error) {
      console.error('Failed to upsert user_scene_preferences:', error);
    }
  } catch (e) {
    console.error('Error while generating user scene preferences via LLM:', e);
  }
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

