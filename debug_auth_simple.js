// 简单的认证调试脚本
// 在浏览器控制台中运行

async function debugAuthSimple() {
  try {
    console.log('🔍 开始简单认证调试...');
    
    // 1. 检查 Supabase 客户端
    if (typeof window.supabase === 'undefined') {
      console.log('❌ window.supabase 不可用');
      console.log('💡 请刷新页面后重试');
      return;
    }
    
    console.log('✅ window.supabase 可用');
    
    // 2. 检查会话
    const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ 会话检查失败:', sessionError);
      return;
    }
    
    if (!session) {
      console.log('❌ 用户未登录');
      console.log('💡 请先登录');
      return;
    }
    
    console.log('✅ 用户已登录');
    console.log('📧 邮箱:', session.user.email);
    console.log('🆔 用户ID:', session.user.id);
    console.log('🔑 访问令牌长度:', session.access_token?.length || 0);
    
    // 3. 检查用户资料
    const { data: profile, error: profileError } = await window.supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    if (profileError) {
      console.error('❌ 获取用户资料失败:', profileError);
      return;
    }
    
    console.log('📋 用户资料:', profile);
    console.log('🔑 当前角色:', profile?.role || '未设置');
    
    // 4. 测试 API 调用
    console.log('\\n🧪 测试 API 调用...');
    
    const response = await fetch('/api/admin/cloze/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        lang: 'en',
        level: 3,
        count: 1,
        topic: 'test',
        provider: 'deepseek'
      })
    });
    
    console.log('📡 响应状态:', response.status);
    console.log('📡 响应状态文本:', response.statusText);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ 生成成功！');
      console.log('📊 结果:', result);
    } else {
      const error = await response.text();
      console.log('❌ 生成失败:', error);
      
      try {
        const errorJson = JSON.parse(error);
        console.log('📋 错误详情:', errorJson);
      } catch (e) {
        console.log('📋 原始错误:', error);
      }
    }
    
  } catch (error) {
    console.error('❌ 调试出错:', error);
  }
}

// 运行调试
debugAuthSimple();
