import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    console.log("开始更新音色价格...");

    // 根据最新价格表定义价格映射
    const priceUpdates = [
      // Chirp3-HD 音色 - $30/100万字符
      { pattern: 'Chirp3-HD', price: 30, description: 'Chirp 3: HD' },
      // Instant custom voice - $60/100万字符 (这个需要特殊处理)
      { pattern: 'Instant-Custom', price: 60, description: 'Instant custom voice' },
      // WaveNet 音色 - $4/100万字符
      { pattern: 'Wavenet', price: 4, description: 'WaveNet' },
      // Standard 音色 - $4/100万字符
      { pattern: 'Standard', price: 4, description: 'Standard' },
      // Neural2 音色 - $16/100万字符
      { pattern: 'Neural2', price: 16, description: 'Neural2' },
      // Studio 音色 - $160/100万字符
      { pattern: 'Studio', price: 160, description: 'Studio' },
      // Polyglot 音色 - $16/100万字符
      { pattern: 'Polyglot', price: 16, description: 'Polyglot' },
      // Chirp-HD 音色 (旧版本) - $30/100万字符
      { pattern: 'Chirp-HD', price: 30, description: 'Chirp-HD (legacy)' },
      // News 音色 - $4/100万字符 (归类为Standard)
      { pattern: 'News', price: 4, description: 'News' },
      // Casual 音色 - $4/100万字符 (归类为Standard)
      { pattern: 'Casual', price: 4, description: 'Casual' },
    ];

    let totalUpdated = 0;
    const updateResults = [];

    for (const update of priceUpdates) {
      console.log(`更新 ${update.description} 音色价格...`);
      
      // 构建SQL查询来更新匹配的音色
      const { data, error } = await supabase
        .from('voices')
        .update({
          pricing: {
            pricePerMillionChars: update.price,
            examplePrice: (update.price / 1000).toFixed(4),
            examplePrice10k: (update.price / 100).toFixed(2)
          },
          updated_at: new Date().toISOString()
        })
        .like('name', `%${update.pattern}%`)
        .select('name, pricing');

      if (error) {
        console.error(`更新 ${update.description} 音色失败:`, error);
        updateResults.push({
          pattern: update.pattern,
          success: false,
          error: error.message,
          count: 0
        });
      } else {
        const count = data?.length || 0;
        totalUpdated += count;
        console.log(`成功更新 ${count} 个 ${update.description} 音色，价格: $${update.price}/100万字符`);
        updateResults.push({
          pattern: update.pattern,
          success: true,
          count: count,
          price: update.price
        });
      }
    }

    // 获取更新后的统计信息
    const { data: stats } = await supabase
      .from('voices')
      .select('name, pricing, category')
      .order('name');

    const categoryStats: Record<string, { count: number, avgPrice: number, totalPrice: number }> = {};
    stats?.forEach(voice => {
      const category = voice.category || 'Unknown';
      const price = voice.pricing?.pricePerMillionChars || 0;
      
      if (!categoryStats[category]) {
        categoryStats[category] = { count: 0, avgPrice: 0, totalPrice: 0 };
      }
      categoryStats[category].count++;
      categoryStats[category].totalPrice += price;
      categoryStats[category].avgPrice = categoryStats[category].totalPrice / categoryStats[category].count;
    });

    console.log("价格更新完成！");
    console.log(`总共更新了 ${totalUpdated} 个音色`);
    console.log("分类统计:", categoryStats);

    return NextResponse.json({
      success: true,
      message: `成功更新 ${totalUpdated} 个音色的价格`,
      totalUpdated,
      updateResults,
      categoryStats
    });

  } catch (error) {
    console.error("更新音色价格失败:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "未知错误",
        message: "更新音色价格失败"
      },
      { status: 500 }
    );
  }
}
