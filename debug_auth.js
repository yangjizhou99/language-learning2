// 调试管理员认证问题
// 在浏览器控制台中运行此脚本

async function debugAuth() {
  try {
    console.log('🔍 开始调试管理员认证...');
    
    // 1. 检查用户登录状态
    const { data: { session }, error: sessionError } = await window.supabase.auth.getSession();
    if (sessionError) {
      console.error('❌ 会话检查失败:', sessionError);
      return;
    }
    
    if (!session) {
      console.error('❌ 用户未登录');
      return;
    }
    
    console.log('✅ 用户已登录:', session.user.email);
    console.log('📧 用户ID:', session.user.id);
    
    // 2. 检查用户 profile 和角色
    const { data: profile, error: profileError } = await window.supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    if (profileError) {
      console.error('❌ 获取用户资料失败:', profileError);
      return;
    }
    
    console.log('👤 用户资料:', profile);
    console.log('🔑 当前角色:', profile?.role || '未设置');
    
    // 3. 检查是否为管理员
    const isAdmin = profile?.role === 'admin';
    console.log('🛡️ 是否为管理员:', isAdmin ? '✅ 是' : '❌ 否');
    
    if (!isAdmin) {
      console.log('🔧 正在设置管理员权限...');
      const { data: updateData, error: updateError } = await window.supabase
        .from('profiles')
        .upsert({ 
          id: session.user.id, 
          role: 'admin' 
        }, { 
          onConflict: 'id' 
        });
      
      if (updateError) {
        console.error('❌ 设置管理员权限失败:', updateError);
        return;
      }
      
      console.log('✅ 管理员权限设置成功！');
    }
    
    // 4. 测试管理员 API 调用
    console.log('🧪 测试管理员 API 调用...');
    
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
    
    console.log('📡 API 响应状态:', testResponse.status);
    
    if (testResponse.ok) {
      const result = await testResponse.json();
      console.log('✅ API 调用成功！', result);
    } else {
      const errorText = await testResponse.text();
      console.log('❌ API 调用失败:', errorText);
      
      // 尝试解析错误信息
      try {
        const errorJson = JSON.parse(errorText);
        console.log('📋 错误详情:', errorJson);
      } catch (e) {
        console.log('📋 原始错误:', errorText);
      }
    }
    
    // 5. 检查数据库中的管理员函数
    console.log('🔍 检查数据库管理员函数...');
    const { data: adminCheck, error: adminCheckError } = await window.supabase
      .rpc('is_admin');
    
    if (adminCheckError) {
      console.log('⚠️ 管理员函数检查失败:', adminCheckError);
    } else {
      console.log('🛡️ 数据库管理员检查结果:', adminCheck);
    }
    
  } catch (error) {
    console.error('❌ 调试过程中出错:', error);
  }
}

// 检查 supabase 是否可用
if (typeof window !== 'undefined' && window.supabase) {
  debugAuth();
} else {
  console.log('请在浏览器中运行此脚本');
  console.log('确保你已经登录并且 supabase 客户端已加载');
}
