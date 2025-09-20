import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    // 使用 Supabase 客户端
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    console.log('🧹 开始清理外键约束问题...');

    // 1. 查找引用了不存在主题的子主题
    const { data: allSubtopics } = await supabase
      .from('shadowing_subtopics')
      .select('id, theme_id, title_cn')
      .not('theme_id', 'is', null);

    const { data: allThemes } = await supabase
      .from('shadowing_themes')
      .select('id');

    const existingThemeIds = new Set(allThemes?.map(t => t.id) || []);
    const invalidSubtopics = allSubtopics?.filter(subtopic => 
      subtopic.theme_id && !existingThemeIds.has(subtopic.theme_id)
    ) || [];

    console.log(`发现 ${invalidSubtopics.length} 个无效的子主题引用`);

    if (invalidSubtopics.length > 0) {
      console.log('无效的子主题:');
      invalidSubtopics.forEach((subtopic, index) => {
        console.log(`  ${index + 1}. ${subtopic.title_cn} (ID: ${subtopic.id}, 引用的主题ID: ${subtopic.theme_id})`);
      });

      // 2. 清理无效的子主题引用（将 theme_id 设为 NULL）
      const invalidIds = invalidSubtopics.map(s => s.id);
      
      const { error: updateError } = await supabase
        .from('shadowing_subtopics')
        .update({ theme_id: null })
        .in('id', invalidIds);

      if (updateError) {
        console.error('清理无效引用失败:', updateError);
        return NextResponse.json(
          { error: `清理失败: ${updateError.message}` },
          { status: 500 }
        );
      }

      console.log(`✅ 已清理 ${invalidSubtopics.length} 个无效的子主题引用`);
    } else {
      console.log('✅ 没有发现外键约束问题');
    }

    // 3. 验证清理结果
    const { data: remainingSubtopics } = await supabase
      .from('shadowing_subtopics')
      .select('id, theme_id')
      .not('theme_id', 'is', null);

    const stillInvalid = remainingSubtopics?.filter(subtopic => 
      subtopic.theme_id && !existingThemeIds.has(subtopic.theme_id)
    ) || [];

    if (stillInvalid.length === 0) {
      console.log('🎉 所有外键约束问题已清理完成！');
      
      return NextResponse.json({
        success: true,
        message: '外键约束问题已清理完成，现在可以重新尝试打包',
        cleaned: invalidSubtopics.length,
        details: {
          invalidSubtopics: invalidSubtopics.map(s => ({
            id: s.id,
            title_cn: s.title_cn,
            theme_id: s.theme_id
          }))
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        message: `仍有 ${stillInvalid.length} 个外键约束问题`,
        cleaned: invalidSubtopics.length,
        remaining: stillInvalid.length
      });
    }

  } catch (error) {
    console.error('清理外键约束失败:', error);
    return NextResponse.json(
      {
        error: `清理失败: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 },
    );
  }
}