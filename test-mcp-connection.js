// 测试 Playwright MCP 连接
const { spawn } = require('child_process');

console.log('🧪 测试 Playwright MCP 连接...');

// 启动 Playwright MCP 服务器
const mcpProcess = spawn('npx', ['@playwright/mcp@0.0.42', '--help'], {
  stdio: 'pipe',
  shell: true
});

mcpProcess.stdout.on('data', (data) => {
  console.log('✅ MCP 服务器响应:', data.toString());
});

mcpProcess.stderr.on('data', (data) => {
  console.log('❌ MCP 服务器错误:', data.toString());
});

mcpProcess.on('close', (code) => {
  if (code === 0) {
    console.log('🎉 Playwright MCP 连接测试成功！');
  } else {
    console.log('❌ Playwright MCP 连接测试失败，退出码:', code);
  }
});

// 5秒后结束测试
setTimeout(() => {
  mcpProcess.kill();
  console.log('⏰ 测试完成');
}, 5000);







