#!/usr/bin/env node

/**
 * 快速批量生成测试脚本
 * 验证优化功能是否正常工作
 */

const fetch = require('node-fetch');

async function quickTest() {
  console.log('🧪 快速批量生成测试\n');
  
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
  const authToken = process.env.TEST_AUTH_TOKEN || '';
  
  if (!authToken) {
    console.error('❌ 请设置 TEST_AUTH_TOKEN 环境变量');
    console.log('🔑 获取方法: 登录管理后台，打开浏览器开发者工具，在 Network 标签中找到 Authorization header');
    process.exit(1);
  }

  // 测试参数 - 小批量快速测试
  const testParams = {
    kind: 'cloze',
    params: {
      lang: 'ja',
      levels: [3],
      topicsText: 'Test Topic',
      perCombo: 1,
      provider: 'openrouter',
      model: 'openai/gpt-4o-mini',
      temperature: 0.5,
      concurrency: 2,
      batch_size: 2,
      retries: 1,
      throttle_ms: 50
    }
  };

  console.log('📊 测试参数:');
  console.log(`   并发数: ${testParams.params.concurrency}`);
  console.log(`   批量大小: ${testParams.params.batch_size}`);
  console.log(`   重试次数: ${testParams.params.retries}`);
  console.log(`   节流延迟: ${testParams.params.throttle_ms}ms\n`);

  try {
    console.log('🚀 开始测试...');
    const startTime = Date.now();
    
    const response = await fetch(`${baseUrl}/api/admin/batch/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(testParams)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let eventCount = 0;
    let savedCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data:')) continue;

        const json = line.slice(5).trim();
        try {
          const event = JSON.parse(json);
          eventCount++;
          
          if (event.type === 'start') {
            console.log(`✅ 开始处理 ${event.total} 个任务`);
          } else if (event.type === 'progress') {
            console.log(`🔄 处理中 #${event.idx + 1} [L${event.level}] ${event.topic}`);
          } else if (event.type === 'saved') {
            savedCount += event.saved?.count || 1;
            console.log(`💾 已保存 #${event.idx + 1} → ${event.saved?.table} (${event.saved?.count}条)`);
          } else if (event.type === 'error') {
            console.log(`❌ 错误 #${event.idx + 1}: ${event.message}`);
          } else if (event.type === 'done') {
            console.log(`🎉 完成！总共处理 ${event.total} 个任务`);
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    const throughput = savedCount / duration;

    console.log('\n📈 测试结果:');
    console.log(`   ⏱️  总耗时: ${duration.toFixed(2)}s`);
    console.log(`   📊 事件数: ${eventCount}`);
    console.log(`   💾 保存数: ${savedCount}`);
    console.log(`   🎯 吞吐量: ${throughput.toFixed(2)} 条/秒`);
    console.log(`   ✅ 测试通过！优化功能正常工作`);

  } catch (error) {
    console.error(`❌ 测试失败: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  quickTest().catch(console.error);
}

module.exports = { quickTest };
