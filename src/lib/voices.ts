type Kind = 'Neural2' | 'WaveNet' | 'all';
export type Voice = {
  name: string;
  type?: string;
  ssmlGender?: string;
  naturalSampleRateHertz?: number;
};

const inflight = new Map<string, Promise<Voice[]>>();
const KEY = (lang: string, kind: Kind) => `voices:${lang}:${kind}`;

export async function getVoicesCached(lang: string, kind: Kind = 'Neural2'): Promise<Voice[]> {
  const k = KEY(lang, kind);
  // 1) 本地缓存（7 天）
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const { t, v } = JSON.parse(raw);
        if (Date.now() - t < 7 * 24 * 60 * 60 * 1000) return v as Voice[];
      }
    } catch {}
  }
  // 2) in-flight 去重
  if (inflight.has(k)) return inflight.get(k)!;

  const p = fetch(`/api/tts/voices?lang=${lang}&kind=${kind}`)
    .then(async (r) => {
      if (!r.ok) throw new Error(await r.text());
      const v = await r.json();
      try {
        if (typeof window !== 'undefined')
          localStorage.setItem(k, JSON.stringify({ t: Date.now(), v }));
      } catch {}
      return v as Voice[];
    })
    .catch(() => [] as Voice[])
    .finally(() => inflight.delete(k));

  inflight.set(k, p);
  return p;
}
