#!/usr/bin/env node

/**
 * Shadowing API 测试脚本
 * 用于验证新创建的API接口是否正常工作
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// 模拟用户认证token（实际使用时需要真实的token）
const MOCK_TOKEN = 'mock-token-for-testing';

async function testAPI() {
  console.log('🧪 开始测试 Shadowing API...\n');

  try {
    // 测试1: 获取推荐等级（需要认证）
    console.log('1️⃣ 测试获取推荐等级...');
    try {
      const response = await fetch(`${BASE_URL}/api/shadowing/recommended?lang=en`, {
        headers: { 'Authorization': `Bearer ${MOCK_TOKEN}` }
      });
      console.log(`   状态码: ${response.status}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`   响应: ${JSON.stringify(data, null, 2)}`);
      } else {
        const error = await response.text();
        console.log(`   错误: ${error}`);
      }
    } catch (error) {
      console.log(`   请求失败: ${error.message}`);
    }

    // 测试2: 获取下一题（需要认证）
    console.log('\n2️⃣ 测试获取下一题...');
    try {
      const response = await fetch(`${BASE_URL}/api/shadowing/next?lang=en&level=2`, {
        headers: { 'Authorization': `Bearer ${MOCK_TOKEN}` }
      });
      console.log(`   状态码: ${response.status}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`   响应: ${JSON.stringify(data, null, 2)}`);
      } else {
        const error = await response.text();
        console.log(`   错误: ${error}`);
      }
    } catch (error) {
      console.log(`   请求失败: ${error.message}`);
    }

    // 测试3: 记录练习结果（需要认证）
    console.log('\n3️⃣ 测试记录练习结果...');
    try {
      const response = await fetch(`${BASE_URL}/api/shadowing/attempts`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MOCK_TOKEN}`
        },
        body: JSON.stringify({
          item_id: 'test-item-id',
          lang: 'en',
          level: 2,
          metrics: {
            accuracy: 0.85,
            complete: true,
            time_sec: 120
          }
        })
      });
      console.log(`   状态码: ${response.status}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`   响应: ${JSON.stringify(data, null, 2)}`);
      } else {
        const error = await response.text();
        console.log(`   错误: ${error}`);
      }
    } catch (error) {
      console.log(`   请求失败: ${error.message}`);
    }

    // 测试4: AI生成题库（需要管理员权限）
    console.log('\n4️⃣ 测试AI生成题库...');
    try {
      const response = await fetch(`${BASE_URL}/api/admin/shadowing/generate`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MOCK_TOKEN}`
        },
        body: JSON.stringify({
          lang: 'en',
          level: 2,
          count: 2,
          topic: 'travel',
          provider: 'openrouter',
          model: 'openai/gpt-4o-mini',
          temperature: 0.6
        })
      });
      console.log(`   状态码: ${response.status}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`   响应: ${JSON.stringify(data, null, 2)}`);
      } else {
        const error = await response.text();
        console.log(`   错误: ${error}`);
      }
    } catch (error) {
      console.log(`   请求失败: ${error.message}`);
    }

    // 测试5: 合成音频（需要管理员权限）
    console.log('\n5️⃣ 测试合成音频...');
    try {
      const response = await fetch(`${BASE_URL}/api/admin/shadowing/synthesize`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MOCK_TOKEN}`
        },
        body: JSON.stringify({
          text: 'Hello, this is a test for shadowing practice.',
          lang: 'en',
          voice: 'en-US-Wavenet-A',
          speakingRate: 1.0,
          title: 'Test Audio'
        })
      });
      console.log(`   状态码: ${response.status}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`   响应: ${JSON.stringify(data, null, 2)}`);
      } else {
        const error = await response.text();
        console.log(`   错误: ${error}`);
      }
    } catch (error) {
      console.log(`   请求失败: ${error.message}`);
    }

    // 测试6: 保存到题库（需要管理员权限）
    console.log('\n6️⃣ 测试保存到题库...');
    try {
      const response = await fetch(`${BASE_URL}/api/admin/shadowing/save`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MOCK_TOKEN}`
        },
        body: JSON.stringify({
          lang: 'en',
          level: 2,
          items: [
            {
              title: 'Test Item',
              text: 'This is a test item for shadowing practice.',
              audio_url: 'https://example.com/test-audio.mp3'
            }
          ]
        })
      });
      console.log(`   状态码: ${response.status}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`   响应: ${JSON.stringify(data, null, 2)}`);
      } else {
        const error = await response.text();
        console.log(`   错误: ${error}`);
      }
    } catch (error) {
      console.log(`   请求失败: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }

  console.log('\n✅ 测试完成！');
  console.log('\n📝 注意事项:');
  console.log('   - 这些测试需要真实的认证token才能正常工作');
  console.log('   - 某些API需要管理员权限');
  console.log('   - 确保数据库表已创建');
  console.log('   - 确保环境变量已配置');
}

// 运行测试
if (require.main === module) {
  testAPI().catch(console.error);
}

module.exports = { testAPI };
