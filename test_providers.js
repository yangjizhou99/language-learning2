// 测试不同 AI 提供商的功能
// 在浏览器控制台中运行

async function testProviders() {
  try {
    console.log('🧪 测试不同 AI 提供商...');
    
    // 检查用户登录状态
    if (typeof window.supabase === 'undefined') {
      console.error('❌ window.supabase 不可用，请刷新页面后重试');
      return;
    }
    
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) {
      console.error('❌ 用户未登录');
      return;
    }
    
    console.log('✅ 用户已登录:', session.user.email);
    
    const providers = ['deepseek', 'openrouter', 'openai'];
    const testParams = {
      lang: 'en',
      level: 3,
      count: 1,
      topic: 'test'
    };
    
    for (const provider of providers) {
      console.log(`\\n🎯 测试 ${provider} 提供商...`);
      
      try {
        const response = await fetch('/api/admin/cloze/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            ...testParams,
            provider: provider
          })
        });
        
        console.log(`📡 ${provider} 响应状态:`, response.status);
        
        if (response.ok) {
          const result = await response.json();
          console.log(`✅ ${provider} 生成成功！`);
          console.log(`📊 结果:`, result);
          
          if (result.items && result.items.length > 0) {
            console.log(`📝 ${provider} 生成的题目:`, result.items[0].title);
            console.log(`📄 文章预览:`, result.items[0].passage.substring(0, 100) + '...');
            console.log(`🔢 空白数量:`, result.items[0].blanks.length);
          }
        } else {
          const error = await response.text();
          console.log(`❌ ${provider} 生成失败:`, error);
          
          try {
            const errorJson = JSON.parse(error);
            console.log(`📋 ${provider} 错误详情:`, errorJson);
          } catch (e) {
            console.log(`📋 ${provider} 原始错误:`, error);
          }
        }
        
        // 等待一下再测试下一个提供商
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ ${provider} 测试出错:`, error);
      }
    }
    
    console.log('\\n🎉 所有提供商测试完成！');
    
  } catch (error) {
    console.error('❌ 测试过程出错:', error);
  }
}

// 运行测试
testProviders();
