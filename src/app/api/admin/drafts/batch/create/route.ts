export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getServiceSupabase } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
	const auth = await requireAdmin(req); if (!auth.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
	const supabase = getServiceSupabase();

	const b = await req.json();
	const { name, provider, model, lang, genre, words = 300, temperature = 0.6,
		topics = [], difficulties = [3] } = b;

	if (!name || !provider || !model || !lang || !genre || !Array.isArray(difficulties) || difficulties.length === 0) {
		return NextResponse.json({ error: "缺少字段或参数无效" }, { status: 400 });
	}

	// 1) 新建批次
	const { data: batch, error: e1 } = await supabase
		.from("article_batches")
		.insert([{ name, provider, model, lang, genre, words, temperature, status: "pending", created_by: auth.user.id }])
		.select("id")
		.single();
	if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });

	// 2) 生成队列项（笛卡尔：topic × difficulty）
	const rows: any[] = [];
	const topicList = Array.isArray(topics) && topics.length ? topics : [null];
	for (const t of topicList) for (const d of difficulties) {
		rows.push({ batch_id: batch.id, topic: t, difficulty: Number(d) || 3, status: "pending" });
	}
	const { error: e2 } = await supabase.from("article_batch_items").insert(rows);
	if (e2) return NextResponse.json({ error: e2.message }, { status: 400 });

	return NextResponse.json({ ok: true, batch_id: batch.id, total_items: rows.length });
}


