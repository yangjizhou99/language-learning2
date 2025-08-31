export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
	try {
		const searchParams = new URL(req.url).searchParams;
		const lang = searchParams.get("lang") || "en";
		const level = parseInt(searchParams.get("level") || "2");
		
		// 验证参数
		if (!["en", "ja", "zh"].includes(lang)) {
			return NextResponse.json({ error: "无效的语言参数" }, { status: 400 });
		}
		
		if (level < 1 || level > 5) {
			return NextResponse.json({ error: "无效的等级参数" }, { status: 400 });
		}

		// 使用服务端密钥客户端以绕过 RLS（只读查询）
		const supabase = getServiceSupabase();

		// 从题库中随机选择一道题
		const { data: items, error } = await supabase
			.from("shadowing_items")
			.select("*")
			.eq("lang", lang)
			.eq("level", level)
			.order("created_at", { ascending: false })
			.limit(10);

		if (error) {
			console.error("查询题库失败:", error);
			return NextResponse.json({ error: "查询题库失败" }, { status: 500 });
		}

		if (!items || items.length === 0) {
			return NextResponse.json({ error: "该等级暂无题目" }, { status: 404 });
		}

		// 随机选择一道题
		const randomIndex = Math.floor(Math.random() * items.length);
		const selectedItem = items[randomIndex];

		return NextResponse.json({
			item: {
				id: selectedItem.id,
				title: selectedItem.title,
				text: selectedItem.text,
				audio_url: selectedItem.audio_url,
				level: selectedItem.level,
				lang: selectedItem.lang,
				duration_ms: selectedItem.duration_ms,
				tokens: selectedItem.tokens,
				cefr: selectedItem.cefr,
				meta: selectedItem.meta
			}
		});

	} catch (error) {
		console.error("获取下一题失败:", error);
		return NextResponse.json({ error: "服务器错误" }, { status: 500 });
	}
}
