import { supabase } from "./supabase";

export type ClozeLevel = "easy" | "mid" | "hard";
export type SftLevel = "basic" | "standard" | "advanced";

export async function recommendClozeLevel(userId: string, lookback = 7): Promise<ClozeLevel> {
  const { data, error } = await supabase
    .from("sessions")
    .select("score")
    .eq("task_type", "cloze")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(lookback);
  if (error || !data || data.length === 0) return "mid";
  const scores = data
    .map(r => (typeof r.score === "number" ? Number(r.score) : NaN))
    .filter(v => Number.isFinite(v)) as number[];
  if (scores.length === 0) return "mid";
  const avg = scores.reduce((a,b)=>a+b,0)/scores.length;
  if (avg >= 85) return "hard";
  if (avg >= 60) return "mid";
  return "easy";
}

export function nextSftLevel(prev?: SftLevel, lastOverall?: number): SftLevel {
  if (lastOverall == null) return prev || "standard";
  if (lastOverall >= 4.5) return "advanced";
  if (lastOverall >= 3.5) return prev || "standard";
  if (lastOverall >= 2.5) return "basic";
  return "basic";
}
