#!/usr/bin/env node

/**
 * 批量生成性能测试脚本
 * 测试并发池、批量生成、重试机制的性能提升效果
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_CONFIG = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  authToken: process.env.TEST_AUTH_TOKEN || '',
  testCases: [
    {
      name: '原始串行模式',
      params: {
        kind: 'cloze',
        params: {
          lang: 'ja',
          levels: [3],
          topicsText: 'Daily life\nCampus',
          perCombo: 2,
          provider: 'openrouter',
          model: 'openai/gpt-4o-mini',
          temperature: 0.5,
          concurrency: 1,
          batch_size: 1,
          retries: 0,
          throttle_ms: 0
        }
      }
    },
    {
      name: '并发池模式（4并发）',
      params: {
        kind: 'cloze',
        params: {
          lang: 'ja',
          levels: [3],
          topicsText: 'Daily life\nCampus',
          perCombo: 2,
          provider: 'openrouter',
          model: 'openai/gpt-4o-mini',
          temperature: 0.5,
          concurrency: 4,
          batch_size: 1,
          retries: 2,
          throttle_ms: 0
        }
      }
    },
    {
      name: '批量生成模式（3条/次）',
      params: {
        kind: 'cloze',
        params: {
          lang: 'ja',
          levels: [3],
          topicsText: 'Daily life\nCampus',
          perCombo: 2,
          provider: 'openrouter',
          model: 'openai/gpt-4o-mini',
          temperature: 0.5,
          concurrency: 1,
          batch_size: 3,
          retries: 0,
          throttle_ms: 0
        }
      }
    },
    {
      name: '优化组合模式（4并发+3批量）',
      params: {
        kind: 'cloze',
        params: {
          lang: 'ja',
          levels: [3],
          topicsText: 'Daily life\nCampus',
          perCombo: 2,
          provider: 'openrouter',
          model: 'openai/gpt-4o-mini',
          temperature: 0.5,
          concurrency: 4,
          batch_size: 3,
          retries: 2,
          throttle_ms: 100
        }
      }
    }
  ]
};

class PerformanceTester {
  constructor() {
    this.results = [];
  }

  async runTest(testCase) {
    console.log(`\n🧪 开始测试: ${testCase.name}`);
    console.log(`📊 参数: 并发=${testCase.params.params.concurrency}, 批量=${testCase.params.params.batch_size}, 重试=${testCase.params.params.retries}`);
    
    const startTime = Date.now();
    const events = [];
    let totalGenerated = 0;
    let totalTokens = 0;
    let errorCount = 0;

    try {
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/admin/batch/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_CONFIG.authToken}`
        },
        body: JSON.stringify(testCase.params)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
            events.push(event);

            if (event.type === 'saved') {
              totalGenerated += event.saved?.count || 1;
              if (event.usage) {
                totalTokens += event.usage.total_tokens || 0;
              }
            } else if (event.type === 'error') {
              errorCount++;
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    } catch (error) {
      console.error(`❌ 测试失败: ${error.message}`);
      return null;
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    const throughput = totalGenerated / (duration / 1000); // 条/秒
    const tokenRate = totalTokens / (duration / 1000); // tokens/秒

    const result = {
      name: testCase.name,
      duration: duration,
      totalGenerated: totalGenerated,
      totalTokens: totalTokens,
      errorCount: errorCount,
      throughput: throughput,
      tokenRate: tokenRate,
      events: events.length,
      params: testCase.params.params
    };

    console.log(`✅ 测试完成:`);
    console.log(`   ⏱️  耗时: ${(duration / 1000).toFixed(2)}s`);
    console.log(`   📈 生成: ${totalGenerated} 条`);
    console.log(`   🎯 吞吐: ${throughput.toFixed(2)} 条/秒`);
    console.log(`   🔤 Token: ${totalTokens} (${tokenRate.toFixed(2)} tokens/秒)`);
    console.log(`   ❌ 错误: ${errorCount} 个`);

    return result;
  }

  async runAllTests() {
    console.log('🚀 开始批量生成性能测试...\n');
    console.log(`🔗 测试地址: ${TEST_CONFIG.baseUrl}`);
    console.log(`🔑 认证: ${TEST_CONFIG.authToken ? '已配置' : '未配置'}\n`);

    for (const testCase of TEST_CONFIG.testCases) {
      const result = await this.runTest(testCase);
      if (result) {
        this.results.push(result);
      }
      
      // 测试间隔，避免API限制
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    this.generateReport();
  }

  generateReport() {
    console.log('\n📊 性能测试报告');
    console.log('='.repeat(80));

    // 按吞吐量排序
    const sortedResults = [...this.results].sort((a, b) => b.throughput - a.throughput);

    console.log('\n🏆 性能排名 (按吞吐量):');
    sortedResults.forEach((result, index) => {
      const improvement = index === 0 ? '' : ` (+${((result.throughput / sortedResults[0].throughput - 1) * 100).toFixed(1)}%)`;
      console.log(`${index + 1}. ${result.name}`);
      console.log(`   吞吐量: ${result.throughput.toFixed(2)} 条/秒${improvement}`);
      console.log(`   耗时: ${(result.duration / 1000).toFixed(2)}s`);
      console.log(`   生成: ${result.totalGenerated} 条`);
      console.log(`   错误: ${result.errorCount} 个\n`);
    });

    // 计算性能提升
    if (this.results.length >= 2) {
      const baseline = this.results[0]; // 串行模式
      const optimized = this.results[this.results.length - 1]; // 优化组合模式
      
      const speedImprovement = (optimized.throughput / baseline.throughput - 1) * 100;
      const timeReduction = (1 - optimized.duration / baseline.duration) * 100;
      
      console.log('📈 性能提升分析:');
      console.log(`   速度提升: ${speedImprovement.toFixed(1)}%`);
      console.log(`   时间减少: ${timeReduction.toFixed(1)}%`);
      console.log(`   效率倍数: ${(optimized.throughput / baseline.throughput).toFixed(2)}x\n`);
    }

    // 保存详细报告
    const reportPath = path.join(__dirname, `batch-performance-report-${Date.now()}.json`);
    const report = {
      timestamp: new Date().toISOString(),
      config: TEST_CONFIG,
      results: this.results,
      summary: {
        bestThroughput: sortedResults[0]?.throughput || 0,
        worstThroughput: sortedResults[sortedResults.length - 1]?.throughput || 0,
        averageThroughput: this.results.reduce((sum, r) => sum + r.throughput, 0) / this.results.length,
        totalTests: this.results.length,
        totalErrors: this.results.reduce((sum, r) => sum + r.errorCount, 0)
      }
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`💾 详细报告已保存: ${reportPath}`);
  }
}

// 主函数
async function main() {
  if (!TEST_CONFIG.authToken) {
    console.error('❌ 请设置 TEST_AUTH_TOKEN 环境变量');
    console.log('🔑 获取方法: 登录管理后台，打开浏览器开发者工具，在 Network 标签中找到 Authorization header');
    process.exit(1);
  }

  const tester = new PerformanceTester();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { PerformanceTester, TEST_CONFIG };
