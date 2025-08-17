import { supabase } from "./supabase";

export type RAGStats = { terms: number; phrases: number; hasProfile: boolean };

export async function buildRAG(lang: "en"|"ja"|"zh", topic: string, kTerms = 8, kPhrases = 5): Promise<{ text: string; stats: RAGStats }> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) return { text: "", stats: { terms: 0, phrases: 0, hasProfile: false } };

  // Get profile
  const { data: prof } = await supabase.from("profiles")
    .select("bio,goals,preferred_tone,domains,native_lang,target_langs,username")
    .eq("id", uid)
    .maybeSingle();

  // Get terms matching topic
  const like = `%${topic}%`;
  const { data: terms } = await supabase
    .from("glossary")
    .select("*")
    .eq("lang", lang)
    .or(`term.ilike.${like},definition.ilike.${like}`)
    .order("updated_at", { ascending: false })
    .limit(kTerms);

  // Get recent phrases
  const { data: ph } = await supabase
    .from("phrases")
    .select("tag,text,example,lang")
    .eq("lang", lang)
    .order("created_at", { ascending: false })
    .limit(kPhrases);

  // Build profile section
  const profPart = prof ? [
    `【PROFILE】`,
    `username: ${prof.username || ""}`,
    `native_lang: ${prof.native_lang || ""}`,
    `target_langs: ${prof.target_langs?.join(", ") || ""}`,
    `bio: ${prof.bio || ""}`,
    `goals: ${prof.goals || ""}`,
    `preferred_tone: ${prof.preferred_tone || ""}`,
    `domains: ${prof.domains?.join(", ") || ""}`
  ].join("\n") : "";

  // Build terms section
  const termPart = terms?.map(t => 
    `- ${t.term} :: ${t.definition} ${t.aliases?.length ? `(aka: ${t.aliases.join(", ")})` : ""} ${t.tags?.length ? `[${t.tags.join(", ")}]` : ""}`
  ).join("\n") || "";

  // Build phrases section
  const phrasePart = ph?.map(p => `- ${p.tag}: ${p.text} => ${p.example}`).join("\n") || "";

  // Combine all sections
  let rag = [
    profPart && `${profPart}\n`,
    terms?.length ? `【GLOSSARY ${lang}】\n${termPart}\n` : "",
    ph?.length ? `【PHRASES ${lang}】\n${phrasePart}\n` : ""
  ].join("").trim();

  // Limit to 2000 chars
  if (rag.length > 2000) rag = rag.slice(0, 2000);

  return { 
    text: rag, 
    stats: { 
      terms: terms?.length || 0, 
      phrases: ph?.length || 0, 
      hasProfile: !!prof 
    } 
  };
}
