// 临时脚本：设置管理员权限
// 使用方法：在浏览器控制台中运行

async function setupAdmin() {
  try {
    console.log('🔧 开始设置管理员权限...');
    
    // 获取当前用户会话
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) {
      console.error('❌ 请先登录');
      return;
    }
    
    console.log('✅ 用户已登录:', session.user.email);
    
    // 设置管理员权限
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
    
    console.log('✅ 管理员权限设置成功！');
    console.log('现在你可以使用 Cloze 生成功能了');
    
    // 测试管理员权限
    const testResponse = await fetch('/api/admin/cloze/generate', {
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
    
    if (testResponse.ok) {
      console.log('✅ 管理员权限测试成功！');
    } else {
      const error = await testResponse.text();
      console.log('⚠️ 权限测试失败:', error);
    }
    
  } catch (error) {
    console.error('❌ 设置过程中出错:', error);
  }
}

// 检查 supabase 是否可用
if (typeof window !== 'undefined' && window.supabase) {
  setupAdmin();
} else {
  console.log('请在浏览器中运行此脚本');
  console.log('确保你已经登录并且 supabase 客户端已加载');
}
