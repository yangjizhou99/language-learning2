// 测试备份页面功能
const config = {
  baseUrl: 'http://localhost:3003',
  backupPage: '/admin/backup',
  adminPage: '/admin'
};

async function testBackupPage() {
  console.log('🧪 测试备份页面功能...\n');

  try {
    // 1. 测试管理员页面
    console.log('1. 测试管理员页面...');
    const adminResponse = await fetch(`${config.baseUrl}${config.adminPage}`);
    console.log(`   状态: ${adminResponse.status} ${adminResponse.ok ? '✅' : '❌'}`);
    
    if (adminResponse.ok) {
      const adminText = await adminResponse.text();
      const hasBackupLink = adminText.includes('备份中心') || adminText.includes('/admin/backup');
      console.log(`   包含备份链接: ${hasBackupLink ? '✅' : '❌'}`);
    }

    // 2. 测试备份页面
    console.log('\n2. 测试备份页面...');
    const backupResponse = await fetch(`${config.baseUrl}${config.backupPage}`);
    console.log(`   状态: ${backupResponse.status} ${backupResponse.ok ? '✅' : '❌'}`);
    
    if (backupResponse.ok) {
      const backupText = await backupResponse.text();
      const hasBackupTitle = backupText.includes('备份中心');
      const hasDatabaseSection = backupText.includes('数据库连接');
      const hasTableSection = backupText.includes('表选择');
      const hasBackupSection = backupText.includes('备份操作');
      
      console.log(`   包含备份标题: ${hasBackupTitle ? '✅' : '❌'}`);
      console.log(`   包含数据库连接: ${hasDatabaseSection ? '✅' : '❌'}`);
      console.log(`   包含表选择: ${hasTableSection ? '✅' : '❌'}`);
      console.log(`   包含备份操作: ${hasBackupSection ? '✅' : '❌'}`);
    }

    // 3. 测试 API 路由
    console.log('\n3. 测试备份 API 路由...');
    try {
      const apiResponse = await fetch(`${config.baseUrl}/api/backup/db/tables?connPreset=dev`);
      console.log(`   API 状态: ${apiResponse.status} ${apiResponse.ok ? '✅' : '❌'}`);
      
      if (apiResponse.ok) {
        const apiData = await apiResponse.json();
        console.log(`   API 响应: ${apiData.tables ? `${apiData.tables.length} 张表` : '无表数据'}`);
      } else {
        const errorText = await apiResponse.text();
        console.log(`   API 错误: ${errorText.substring(0, 100)}...`);
      }
    } catch (apiError) {
      console.log(`   API 连接失败: ${apiError.message}`);
    }

    console.log('\n🎯 测试完成！');
    console.log('\n📋 访问方式:');
    console.log(`   管理员控制台: ${config.baseUrl}${config.adminPage}`);
    console.log(`   备份中心: ${config.baseUrl}${config.backupPage}`);

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
testBackupPage();
