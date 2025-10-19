// Playwright MCP 使用示例
// 这个文件展示了如何在你的语言学习项目中使用 Playwright MCP

const { chromium } = require('playwright');

async function exampleUsage() {
  // 启动浏览器
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // 访问网页
  await page.goto('https://example.com');
  
  // 获取页面标题
  const title = await page.title();
  console.log('页面标题:', title);
  
  // 截图
  await page.screenshot({ path: 'example-screenshot.png' });
  
  // 关闭浏览器
  await browser.close();
}

// 运行示例
exampleUsage().catch(console.error);







