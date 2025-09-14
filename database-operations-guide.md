# 数据库操作指南

## 概述
本指南记录了如何通过 Supabase 服务角色密钥直接操作数据库的方法。

## 环境配置

### 1. 环境变量设置
在 `.env.local` 文件中配置以下环境变量：
```bash
NEXT_PUBLIC_SUPABASE_URL=你的Supabase项目URL
SUPABASE_SERVICE_ROLE_KEY=你的服务角色密钥
```

### 2. 创建数据库客户端
```javascript
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// 加载环境变量
const envPath = '.env.local';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

// 创建服务角色客户端（绕过RLS限制）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
```

## 常用操作

### 1. 查询数据
```javascript
// 查询所有用户
const { data: users, error } = await supabase
  .from('profiles')
  .select('id, username, role, created_at')
  .order('created_at', { ascending: false });

// 查询特定条件的用户
const { data: adminUsers, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('role', 'admin');

// 分页查询
const { data: users, error, count } = await supabase
  .from('profiles')
  .select('*', { count: 'exact' })
  .range(0, 19);
```

### 2. 删除数据
```javascript
// 删除特定用户的所有相关数据
const userIds = ['user-id-1', 'user-id-2'];

// 删除练习数据
await supabase.from('shadowing_attempts').delete().in('user_id', userIds);
await supabase.from('cloze_attempts').delete().in('user_id', userIds);
await supabase.from('alignment_attempts').delete().in('user_id', userIds);
await supabase.from('vocab_entries').delete().in('user_id', userIds);
await supabase.from('user_permissions').delete().in('user_id', userIds);

// 删除用户资料
await supabase.from('profiles').delete().in('id', userIds);

// 删除认证用户
for (const userId of userIds) {
  await supabase.auth.admin.deleteUser(userId);
}
```

### 3. 认证用户管理
```javascript
// 获取所有认证用户
const { data: authUsers, error } = await supabase.auth.admin.listUsers();

// 删除认证用户
const { error } = await supabase.auth.admin.deleteUser(userId);

// 创建用户
const { data, error } = await supabase.auth.admin.createUser({
  email: 'user@example.com',
  password: 'password123',
  email_confirm: true
});
```

### 4. 统计查询
```javascript
// 获取记录总数
const { count, error } = await supabase
  .from('profiles')
  .select('*', { count: 'exact', head: true });

// 检查表是否存在数据
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .limit(1);
```

## 实际案例：删除非管理员用户

### 完整脚本示例
```javascript
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// 加载环境变量
const envPath = '.env.local';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function deleteNonAdminUsers() {
  console.log('=== 开始删除非管理员用户 ===');
  
  // 1. 获取非管理员用户
  const { data: nonAdminUsers, error: nonAdminError } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('role', 'user');
  
  if (nonAdminError) {
    console.error('获取非管理员用户失败:', nonAdminError.message);
    return;
  }
  
  const nonAdminUserIds = nonAdminUsers.map(u => u.id);
  console.log('找到非管理员用户:', nonAdminUserIds.length);
  
  // 2. 删除相关数据
  const tables = [
    'shadowing_attempts',
    'cloze_attempts', 
    'alignment_attempts',
    'vocab_entries',
    'user_permissions'
  ];
  
  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .in('user_id', nonAdminUserIds);
    
    if (error) {
      console.warn(`删除${table}失败:`, error.message);
    } else {
      console.log(`✅ 已删除${table}数据`);
    }
  }
  
  // 3. 删除用户资料
  const { error: profilesError } = await supabase
    .from('profiles')
    .delete()
    .in('id', nonAdminUserIds);
  
  if (profilesError) {
    console.error('删除profiles记录失败:', profilesError.message);
    return;
  }
  
  // 4. 删除认证用户
  for (const userId of nonAdminUserIds) {
    try {
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      if (authError) {
        console.warn(`删除用户${userId}认证记录失败:`, authError.message);
      } else {
        console.log(`✅ 已删除用户${userId}认证记录`);
      }
    } catch (error) {
      console.warn(`删除用户${userId}时出错:`, error.message);
    }
  }
  
  console.log('=== 删除完成 ===');
}

deleteNonAdminUsers().catch(console.error);
```

## 安全注意事项

### 1. 服务角色密钥
- **服务角色密钥具有完全数据库访问权限**
- **绕过所有RLS（行级安全）策略**
- **仅在服务器端使用，绝不在客户端暴露**

### 2. 操作前备份
```javascript
// 备份重要数据
const backup = {
  timestamp: new Date().toISOString(),
  data: originalData
};
fs.writeFileSync('backup.json', JSON.stringify(backup, null, 2));
```

### 3. 批量操作
- 使用事务确保数据一致性
- 分批处理大量数据避免超时
- 添加错误处理和回滚机制

## 常用表结构

### profiles 表
- `id`: 用户ID (UUID)
- `username`: 用户名
- `role`: 角色 (admin/user)
- `created_at`: 创建时间

### 练习数据表
- `shadowing_attempts`: 跟读练习记录
- `cloze_attempts`: 完形填空记录
- `alignment_attempts`: 对齐练习记录
- `vocab_entries`: 词汇记录

### 权限表
- `user_permissions`: 用户权限设置

## 故障排除

### 1. 认证失败
- 检查环境变量是否正确设置
- 确认服务角色密钥有效
- 验证Supabase项目URL

### 2. 权限错误
- 使用服务角色密钥而非匿名密钥
- 检查表是否存在
- 确认字段名称正确

### 3. 数据不一致
- 按正确顺序删除关联数据
- 先删除子表，再删除主表
- 最后删除认证用户

## 总结

通过服务角色密钥可以直接操作Supabase数据库，绕过RLS限制。这种方法适用于：
- 数据清理和维护
- 批量数据操作
- 管理员功能实现
- 数据迁移和备份

**重要提醒：** 服务角色密钥具有完全权限，使用时务必谨慎，建议在操作前进行数据备份。
