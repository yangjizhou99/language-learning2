#!/usr/bin/env node

/**
 * 运行所有性能测试的主脚本
 */

const { runPerformanceTest, generateReport, checkIndexUsage } = require('./performance-test');
const { runApiTests, generateApiReport } = require('./api-performance-test');
const { runFrontendTests, generateFrontendReport } = require('./frontend-performance-test');
const fs = require('fs');
const path = require('path');

// 配置
const config = {
  runDatabaseTests: true,
  runApiTests: true,
  runFrontendTests: false, // 默认关闭，需要 Puppeteer
  generateCombinedReport: true,
};

// 生成综合报告
function generateCombinedReport(dbReport, apiReport, frontendReport) {
  const timestamp = new Date().toISOString();
  const combinedReport = {
    timestamp,
    config,
    database: dbReport,
    api: apiReport,
    frontend: frontendReport,
    summary: {
      totalTests:
        (dbReport?.summary?.totalTests || 0) +
        (apiReport?.summary?.totalTests || 0) +
        (frontendReport?.summary?.totalTests || 0),
      avgDatabaseTime: dbReport?.summary?.avgOverallTime || 0,
      avgApiTime: apiReport?.summary?.avgOverallTime || 0,
      avgFrontendTime: frontendReport?.summary?.avgLoadTime || 0,
      recommendations: generateRecommendations(dbReport, apiReport, frontendReport),
    },
  };

  // 保存到文件
  const reportPath = path.join(__dirname, `combined-performance-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(combinedReport, null, 2));

  // 控制台输出
  console.log('📋 综合性能测试报告');
  console.log('='.repeat(60));
  console.log(`测试时间: ${timestamp}`);
  console.log('');

  if (dbReport) {
    console.log('🗄️  数据库性能:');
    console.log(`   测试数量: ${dbReport.summary.totalTests}`);
    console.log(`   平均查询时间: ${dbReport.summary.avgOverallTime.toFixed(2)}ms`);
    console.log(
      `   最快查询: ${dbReport.summary.fastestTest.name} (${dbReport.summary.fastestTest.avgTime.toFixed(2)}ms)`,
    );
    console.log(
      `   最慢查询: ${dbReport.summary.slowestTest.name} (${dbReport.summary.slowestTest.avgTime.toFixed(2)}ms)`,
    );
    console.log('');
  }

  if (apiReport) {
    console.log('🌐 API 性能:');
    console.log(`   测试数量: ${apiReport.summary.totalTests}`);
    console.log(`   平均响应时间: ${apiReport.summary.avgOverallTime.toFixed(2)}ms`);
    console.log(
      `   最快 API: ${apiReport.summary.fastestApi.name} (${apiReport.summary.fastestApi.avgTime.toFixed(2)}ms)`,
    );
    console.log(
      `   最慢 API: ${apiReport.summary.slowestApi.name} (${apiReport.summary.slowestApi.avgTime.toFixed(2)}ms)`,
    );
    console.log(`   平均成功率: ${apiReport.summary.avgSuccessRate.toFixed(1)}%`);
    console.log('');
  }

  if (frontendReport) {
    console.log('🖥️  前端性能:');
    console.log(`   测试数量: ${frontendReport.summary.totalTests}`);
    console.log(`   平均加载时间: ${frontendReport.summary.avgLoadTime.toFixed(2)}ms`);
    console.log(`   平均首次绘制: ${frontendReport.summary.avgFirstPaint.toFixed(2)}ms`);
    console.log(
      `   最快页面: ${frontendReport.summary.fastestPage.name} (${frontendReport.summary.fastestPage.avgLoadTime.toFixed(2)}ms)`,
    );
    console.log(
      `   最慢页面: ${frontendReport.summary.slowestPage.name} (${frontendReport.summary.slowestPage.avgLoadTime.toFixed(2)}ms)`,
    );
    console.log('');
  }

  console.log('💡 优化建议:');
  combinedReport.summary.recommendations.forEach((rec, index) => {
    console.log(`   ${index + 1}. ${rec}`);
  });
  console.log('');

  console.log(`📄 综合报告已保存到: ${reportPath}`);

  return combinedReport;
}

// 生成优化建议
function generateRecommendations(dbReport, apiReport, frontendReport) {
  const recommendations = [];

  // 数据库优化建议
  if (dbReport) {
    if (dbReport.summary.avgOverallTime > 100) {
      recommendations.push('数据库查询较慢，建议检查索引使用情况和查询优化');
    }
    if (dbReport.summary.slowestTest.avgTime > 500) {
      recommendations.push(
        `最慢查询 "${dbReport.summary.slowestTest.name}" 需要优化，考虑添加更多索引`,
      );
    }
  }

  // API 优化建议
  if (apiReport) {
    if (apiReport.summary.avgOverallTime > 1000) {
      recommendations.push('API 响应时间较慢，建议启用缓存和优化查询');
    }
    if (apiReport.summary.avgSuccessRate < 95) {
      recommendations.push('API 成功率较低，建议检查错误处理和重试机制');
    }
  }

  // 前端优化建议
  if (frontendReport) {
    if (frontendReport.summary.avgLoadTime > 3000) {
      recommendations.push('页面加载时间较慢，建议优化资源加载和代码分割');
    }
    if (frontendReport.summary.avgFirstPaint > 1500) {
      recommendations.push('首次绘制时间较慢，建议优化关键渲染路径');
    }
  }

  // 通用建议
  if (recommendations.length === 0) {
    recommendations.push('性能表现良好，继续保持！');
  }

  return recommendations;
}

// 主函数
async function main() {
  console.log('🚀 开始综合性能测试...\n');

  let dbReport = null;
  let apiReport = null;
  let frontendReport = null;

  try {
    // 数据库性能测试
    if (config.runDatabaseTests) {
      console.log('📊 运行数据库性能测试...');
      try {
        await checkIndexUsage();
        const dbResults = await runPerformanceTest();
        dbReport = generateReport(dbResults);
        console.log('✅ 数据库测试完成\n');
      } catch (error) {
        console.error('❌ 数据库测试失败:', error.message);
        console.log('');
      }
    }

    // API 性能测试
    if (config.runApiTests) {
      console.log('🌐 运行 API 性能测试...');
      try {
        const apiResults = await runApiTests();
        apiReport = generateApiReport(apiResults);
        console.log('✅ API 测试完成\n');
      } catch (error) {
        console.error('❌ API 测试失败:', error.message);
        console.log('');
      }
    }

    // 前端性能测试
    if (config.runFrontendTests) {
      console.log('🖥️  运行前端性能测试...');
      try {
        const frontendResults = await runFrontendTests();
        frontendReport = generateFrontendReport(frontendResults);
        console.log('✅ 前端测试完成\n');
      } catch (error) {
        console.error('❌ 前端测试失败:', error.message);
        console.log('');
      }
    }

    // 生成综合报告
    if (config.generateCombinedReport) {
      console.log('📋 生成综合报告...');
      generateCombinedReport(dbReport, apiReport, frontendReport);
    }

    console.log('✅ 所有性能测试完成！');
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main();
}

module.exports = { generateCombinedReport, generateRecommendations };
