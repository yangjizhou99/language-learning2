#!/usr/bin/env node

/**
 * 前端性能测试脚本
 * 使用 Puppeteer 测试页面加载和渲染性能
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// 配置
const config = {
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  headless: true,
  timeout: 30000, // 30秒超时
  testRounds: 3,
  warmupRounds: 1,
};

// 页面测试用例
const pageTests = [
  {
    name: 'Shadowing 练习页面',
    path: '/practice/shadowing',
    waitForSelector: '[data-testid="shadowing-container"]',
    measureInteractions: true
  },
  {
    name: 'Cloze 练习页面',
    path: '/practice/cloze',
    waitForSelector: '[data-testid="cloze-container"]',
    measureInteractions: true
  },
  {
    name: '词汇表页面',
    path: '/vocab',
    waitForSelector: '[data-testid="vocab-container"]',
    measureInteractions: false
  },
  {
    name: '首页',
    path: '/',
    waitForSelector: 'main',
    measureInteractions: false
  }
];

// 性能指标收集
async function collectPerformanceMetrics(page) {
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    const measure = performance.getEntriesByType('measure');
    
    return {
      // 导航时间
      navigation: {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        total: navigation.loadEventEnd - navigation.navigationStart
      },
      // 绘制时间
      paint: {
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0
      },
      // 内存使用
      memory: performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      } : null,
      // 用户交互时间
      interaction: measure.find(m => m.name === 'user-interaction')?.duration || 0
    };
  });
  
  return metrics;
}

// 测试单个页面
async function testPage(browser, testCase) {
  console.log(`🌐 测试页面: ${testCase.name}`);
  console.log(`   路径: ${testCase.path}`);
  
  const results = [];
  
  for (let round = 0; round < config.testRounds + config.warmupRounds; round++) {
    const isWarmup = round < config.warmupRounds;
    const page = await browser.newPage();
    
    try {
      // 启用性能监控
      await page.evaluateOnNewDocument(() => {
        performance.mark('page-start');
      });
      
      const startTime = Date.now();
      
      // 导航到页面
      await page.goto(`${config.baseUrl}${testCase.path}`, {
        waitUntil: 'networkidle2',
        timeout: config.timeout
      });
      
      // 等待关键元素
      if (testCase.waitForSelector) {
        await page.waitForSelector(testCase.waitForSelector, { timeout: 10000 });
      }
      
      const loadTime = Date.now() - startTime;
      
      // 收集性能指标
      const metrics = await collectPerformanceMetrics(page);
      
      // 测试用户交互（如果启用）
      let interactionTime = 0;
      if (testCase.measureInteractions && !isWarmup) {
        const interactionStart = Date.now();
        
        // 模拟用户交互
        if (testCase.path.includes('shadowing')) {
          // 点击播放按钮
          const playButton = await page.$('[data-testid="play-button"]');
          if (playButton) {
            await playButton.click();
            await page.waitForTimeout(1000);
          }
        } else if (testCase.path.includes('cloze')) {
          // 填写输入框
          const inputs = await page.$$('input[type="text"]');
          if (inputs.length > 0) {
            await inputs[0].type('test');
            await page.waitForTimeout(500);
          }
        }
        
        interactionTime = Date.now() - interactionStart;
      }
      
      if (!isWarmup) {
        const result = {
          round: round - config.warmupRounds + 1,
          loadTime,
          metrics,
          interactionTime
        };
        
        results.push(result);
        
        console.log(`   轮次 ${result.round}: 加载 ${loadTime}ms, 交互 ${interactionTime}ms`);
        console.log(`     DOM加载: ${metrics.navigation.domContentLoaded.toFixed(2)}ms`);
        console.log(`     首次绘制: ${metrics.paint.firstPaint.toFixed(2)}ms`);
        console.log(`     首次内容绘制: ${metrics.paint.firstContentfulPaint.toFixed(2)}ms`);
      } else {
        console.log(`   预热轮次 ${round + 1}: 加载 ${loadTime}ms`);
      }
      
    } catch (error) {
      console.log(`   ❌ 轮次 ${round + 1} 失败: ${error.message}`);
    } finally {
      await page.close();
    }
  }
  
  if (results.length > 0) {
    const avgLoadTime = results.reduce((sum, r) => sum + r.loadTime, 0) / results.length;
    const avgInteractionTime = results.reduce((sum, r) => sum + r.interactionTime, 0) / results.length;
    const avgFirstPaint = results.reduce((sum, r) => sum + r.metrics.paint.firstPaint, 0) / results.length;
    
    console.log(`   📈 平均加载: ${avgLoadTime.toFixed(2)}ms`);
    console.log(`   📈 平均交互: ${avgInteractionTime.toFixed(2)}ms`);
    console.log(`   📈 平均首次绘制: ${avgFirstPaint.toFixed(2)}ms`);
    console.log('');
    
    return {
      name: testCase.name,
      path: testCase.path,
      results,
      avgLoadTime,
      avgInteractionTime,
      avgFirstPaint,
      avgDomContentLoaded: results.reduce((sum, r) => sum + r.metrics.navigation.domContentLoaded, 0) / results.length,
      avgFirstContentfulPaint: results.reduce((sum, r) => sum + r.metrics.paint.firstContentfulPaint, 0) / results.length
    };
  }
  
  return null;
}

// 运行前端性能测试
async function runFrontendTests() {
  console.log('🚀 开始前端性能测试...\n');
  console.log(`基础 URL: ${config.baseUrl}`);
  console.log(`测试轮数: ${config.testRounds}`);
  console.log(`预热轮数: ${config.warmupRounds}`);
  console.log('');
  
  const browser = await puppeteer.launch({
    headless: config.headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const results = [];
  
  try {
    for (const testCase of pageTests) {
      const result = await testPage(browser, testCase);
      if (result) {
        results.push(result);
      }
    }
  } finally {
    await browser.close();
  }
  
  return results;
}

// 生成前端性能报告
function generateFrontendReport(results) {
  const timestamp = new Date().toISOString();
  const report = {
    timestamp,
    config,
    results,
    summary: {
      totalTests: results.length,
      avgLoadTime: results.reduce((sum, r) => sum + r.avgLoadTime, 0) / results.length,
      avgInteractionTime: results.reduce((sum, r) => sum + r.avgInteractionTime, 0) / results.length,
      avgFirstPaint: results.reduce((sum, r) => sum + r.avgFirstPaint, 0) / results.length,
      fastestPage: results.reduce((min, r) => r.avgLoadTime < min.avgLoadTime ? r : min),
      slowestPage: results.reduce((max, r) => r.avgLoadTime > max.avgLoadTime ? r : max)
    }
  };
  
  // 保存到文件
  const reportPath = path.join(__dirname, `frontend-performance-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // 控制台输出
  console.log('📋 前端性能测试报告');
  console.log('='.repeat(50));
  console.log(`测试时间: ${timestamp}`);
  console.log(`基础 URL: ${config.baseUrl}`);
  console.log(`测试轮数: ${config.testRounds}`);
  console.log('');
  
  console.log('📊 详细结果:');
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.name}`);
    console.log(`   路径: ${result.path}`);
    console.log(`   平均加载: ${result.avgLoadTime.toFixed(2)}ms`);
    console.log(`   平均交互: ${result.avgInteractionTime.toFixed(2)}ms`);
    console.log(`   首次绘制: ${result.avgFirstPaint.toFixed(2)}ms`);
    console.log(`   首次内容绘制: ${result.avgFirstContentfulPaint.toFixed(2)}ms`);
    console.log(`   DOM加载: ${result.avgDomContentLoaded.toFixed(2)}ms`);
    console.log('');
  });
  
  console.log('📈 总结:');
  console.log(`总测试数: ${report.summary.totalTests}`);
  console.log(`整体平均加载: ${report.summary.avgLoadTime.toFixed(2)}ms`);
  console.log(`整体平均交互: ${report.summary.avgInteractionTime.toFixed(2)}ms`);
  console.log(`整体平均首次绘制: ${report.summary.avgFirstPaint.toFixed(2)}ms`);
  console.log(`最快页面: ${report.summary.fastestPage.name} (${report.summary.fastestPage.avgLoadTime.toFixed(2)}ms)`);
  console.log(`最慢页面: ${report.summary.slowestPage.name} (${report.summary.slowestPage.avgLoadTime.toFixed(2)}ms)`);
  console.log('');
  console.log(`📄 详细报告已保存到: ${reportPath}`);
  
  return report;
}

// 主函数
async function main() {
  try {
    // 检查 Puppeteer 是否可用
    try {
      require.resolve('puppeteer');
    } catch (error) {
      console.error('❌ 请先安装 Puppeteer:');
      console.error('npm install puppeteer');
      process.exit(1);
    }
    
    // 运行前端测试
    const results = await runFrontendTests();
    
    // 生成报告
    generateFrontendReport(results);
    
    console.log('✅ 前端性能测试完成！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main();
}

module.exports = { runFrontendTests, generateFrontendReport };
