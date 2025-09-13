import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { getServiceSupabase } from '@/lib/supabase';

export async function DELETE(req: NextRequest) {
  try {
    // 检查管理员权限
    await requireAdmin(req);
    
    const supabase = getServiceSupabase();
    
    console.log('🧹 开始清理 Shadowing 数据...');
    
    // 按顺序清理，避免外键约束问题
    const tables = [
      'shadowing_sessions',
      'shadowing_drafts', 
      'shadowing_items',
      'shadowing_subtopics',
      'shadowing_themes'
    ];
    
    const results = [];
    
    for (const table of tables) {
      try {
        console.log(`清理 ${table}...`);
        const { error } = await supabase
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // 删除所有记录
        
        if (error) {
          console.error(`清理 ${table} 失败:`, error.message);
          results.push({ table, success: false, error: error.message });
        } else {
          console.log(`✅ ${table} 清理完成`);
          results.push({ table, success: true });
        }
      } catch (err) {
        console.error(`清理 ${table} 时发生错误:`, err);
        results.push({ table, success: false, error: String(err) });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    return NextResponse.json({
      success: true,
      message: `清理完成: ${successCount}/${totalCount} 个表成功清理`,
      results
    });
    
  } catch (error) {
    console.error('清理 Shadowing 数据时发生错误:', error);
    return NextResponse.json(
      { error: '清理失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
