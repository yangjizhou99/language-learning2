export interface MinimalProfile {
  username?: string | null;
  bio?: string | null;
  goals?: string | null;
  preferred_tone?: string | null;
  native_lang?: string | null;
  target_langs?: string[] | null;
  domains?: string[] | null;
}

export function isProfileCompleteStrict(profile?: MinimalProfile | null): boolean {
  if (!profile) return false;
  const hasUsername = typeof profile.username === 'string' && profile.username.trim().length > 0;
  const hasBio = typeof profile.bio === 'string' && profile.bio.trim().length > 0;
  const hasGoals = typeof profile.goals === 'string' && profile.goals.trim().length > 0;
  const hasPreferredTone = typeof profile.preferred_tone === 'string' && profile.preferred_tone.trim().length > 0;
  const hasNative = typeof profile.native_lang === 'string' && profile.native_lang.trim().length > 0;
  const hasTargets = Array.isArray(profile.target_langs) && profile.target_langs.length > 0;
  const hasDomains = Array.isArray(profile.domains) && profile.domains.length > 0;
  return (
    hasUsername &&
    hasBio &&
    hasGoals &&
    hasPreferredTone &&
    hasNative &&
    hasTargets &&
    hasDomains
  );
}


