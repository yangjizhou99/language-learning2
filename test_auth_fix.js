// 测试认证修复
// 在浏览器控制台中运行

async function testAuthFix() {
  try {
    console.log('🔧 测试认证修复...');
    
    // 检查 Supabase 客户端
    if (typeof window.supabase === 'undefined') {
      console.log('❌ window.supabase 不可用，请刷新页面');
      return;
    }
    
    // 获取会话
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) {
      console.log('❌ 未登录，请先登录');
      return;
    }
    
    console.log('✅ 已登录:', session.user.email);
    console.log('🔑 令牌长度:', session.access_token?.length || 0);
    
    // 测试生成 API
    console.log('\\n🎯 测试 Cloze 生成...');
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
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ 生成成功！');
      console.log('📊 结果:', result);
    } else {
      const error = await response.text();
      console.log('❌ 生成失败:', error);
    }
    
  } catch (error) {
    console.error('❌ 测试出错:', error);
  }
}

// 运行测试
testAuthFix();
