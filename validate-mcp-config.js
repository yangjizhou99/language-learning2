// 验证 MCP 配置格式
const fs = require('fs');

console.log('🔍 验证 MCP 配置文件...');

const configFiles = [
  'cursor-mcp-config.json',
  'cursor-mcp-settings.json'
];

configFiles.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const config = JSON.parse(content);
    
    console.log(`✅ ${file} - JSON 格式正确`);
    
    // 检查必要字段
    if (config.mcpServers && typeof config.mcpServers === 'object') {
      console.log(`   ✅ mcpServers 是对象`);
      
      Object.keys(config.mcpServers).forEach(serverName => {
        const server = config.mcpServers[serverName];
        if (server.command && server.args) {
          console.log(`   ✅ ${serverName} 配置完整`);
        } else {
          console.log(`   ❌ ${serverName} 配置不完整`);
        }
      });
    } else {
      console.log(`   ❌ mcpServers 不是对象或不存在`);
    }
    
  } catch (error) {
    console.log(`❌ ${file} - 错误: ${error.message}`);
  }
});

console.log('\n📋 配置建议:');
console.log('1. 确保 JSON 格式正确');
console.log('2. mcpServers 必须是对象');
console.log('3. 每个服务器必须有 command 和 args 字段');
console.log('4. 重启 Cursor 后生效');







