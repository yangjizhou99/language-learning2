// 简单的认证测试
// 在浏览器控制台中运行

async function testAuth() {
  try {
    console.log('🔍 简单认证测试...');
    
    // 1. 检查当前会话
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) {
      console.error('❌ 未登录');
      return;
    }
    
    console.log('✅ 已登录:', session.user.email);
    
    // 2. 直接设置管理员权限
    console.log('🔧 设置管理员权限...');
    const { data, error } = await window.supabase
      .from('profiles')
      .upsert({ 
        id: session.user.id, 
        role: 'admin' 
      }, { 
        onConflict: 'id' 
      });
    
    if (error) {
      console.error('❌ 设置失败:', error);
      return;
    }
    
    console.log('✅ 权限设置完成');
    
    // 3. 验证权限设置
    const { data: profile } = await window.supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();
    
    console.log('👤 当前角色:', profile?.role);
    
    // 4. 测试 API 调用
    console.log('🧪 测试 API...');
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
        topic: 'test'
      })
    });
    
    console.log('📡 响应状态:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ 成功:', result);
    } else {
      const error = await response.text();
      console.log('❌ 失败:', error);
    }
    
  } catch (error) {
    console.error('❌ 测试出错:', error);
  }
}

// 运行测试
testAuth();
