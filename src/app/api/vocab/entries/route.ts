import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabaseAdmin';

// GET: 获取用户生词本 (支持按语言过滤)
export async function GET(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    
    // 从请求头中获取用户ID
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }
    
    // 解析JWT token获取用户ID
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const lang = searchParams.get('lang');
    const limit = parseInt(searchParams.get('limit') || '1000');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('vocab_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (lang) {
      query = query.eq('lang', lang);
    }

    const { data: entries, error } = await query;

    if (error) {
      console.error('查询生词本失败:', error);
      return NextResponse.json({ success: false, error: '查询失败' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      entries: entries || [],
      total: entries?.length || 0
    });

  } catch (error) {
    console.error('获取生词本失败:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

// POST: 添加生词到生词本
export async function POST(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    
    // 从请求头中获取用户ID
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }
    
    // 解析JWT token获取用户ID
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      term, 
      lang, 
      native_lang, 
      source, 
      source_id, 
      context, 
      explanation, 
      status = 'new' 
    } = body;

    if (!term || !lang || !native_lang) {
      return NextResponse.json({ success: false, error: '缺少必要参数' }, { status: 400 });
    }

    // 检查是否已存在
    const { data: existing } = await supabase
      .from('vocab_entries')
      .select('id, explanation')
      .eq('user_id', user.id)
      .eq('term', term)
      .eq('lang', lang)
      .single();

    let entry;
    if (existing) {
      // 更新现有条目
      const { data, error } = await supabase
        .from('vocab_entries')
        .update({
          explanation: explanation || existing.explanation,
          context: context,
          source: source,
          source_id: source_id,
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('更新生词失败:', error);
        return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 });
      }
      entry = data;
    } else {
      // 插入新条目
      const { data, error } = await supabase
        .from('vocab_entries')
        .insert({
          user_id: user.id,
          term: term,
          lang: lang,
          native_lang: native_lang,
          source: source,
          source_id: source_id,
          context: context,
          explanation: explanation,
          status: status
        })
        .select()
        .single();

      if (error) {
        console.error('添加生词失败:', error);
        return NextResponse.json({ success: false, error: '添加失败' }, { status: 500 });
      }
      entry = data;
    }

    return NextResponse.json({ 
      success: true, 
      entry: entry
    });

  } catch (error) {
    console.error('保存生词失败:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

// PATCH: 更新生词 (刷新解释)
export async function PATCH(req: NextRequest) {
  try {
    const supabase = getServiceSupabase();
    
    // 从请求头中获取用户ID
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }
    
    // 解析JWT token获取用户ID
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }

    const body = await req.json();
    const { id, explanation } = body;

    if (!id || !explanation) {
      return NextResponse.json({ success: false, error: '缺少必要参数' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('vocab_entries')
      .update({
        explanation: explanation,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('更新生词解释失败:', error);
      return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      entry: data
    });

  } catch (error) {
    console.error('更新生词解释失败:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}