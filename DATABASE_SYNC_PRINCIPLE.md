# 数据库同步原理详解

## 1. 筛选功能问题分析

### 问题原因
1. **API返回数据结构不一致**：不同API返回的字段名不统一
2. **缺少必要字段**：某些表没有status字段，导致筛选失败
3. **字段映射错误**：alignment_packs表的字段结构与前端期望不匹配

### 解决方案
1. **统一API返回格式**：所有API都返回`{ items: [], pagination: {} }`格式
2. **添加默认字段**：为没有status字段的表添加默认状态
3. **字段映射**：将不同表的字段映射到统一的格式

## 2. 数据库同步原理

### 2.1 同步架构

```
本地数据库 (开发环境)
    ↓ 筛选和打包
导出包 (JSON格式)
    ↓ 网络传输
远程数据库 (生产环境)
```

### 2.2 同步流程

#### 步骤1：数据筛选和打包
```typescript
// 1. 从本地数据库获取数据
const shadowingItems = await supabaseAdmin
  .from('shadowing_items')
  .select('*')
  .eq('lang', 'en')
  .eq('level', 3);

// 2. 用户在前端筛选
const filteredItems = items.filter(item => 
  item.title.includes(searchQuery) &&
  item.lang === selectedLang &&
  item.level === selectedLevel
);

// 3. 创建导出包
const exportPackage = {
  id: Date.now().toString(),
  name: "英语L3跟读练习包",
  items: filteredItems,
  created_at: new Date().toISOString()
};
```

#### 步骤2：远程数据库连接
```typescript
// 使用远程数据库配置创建客户端
const remoteSupabase = createClient(
  remoteConfig.url,    // 远程Supabase URL
  remoteConfig.key     // 远程数据库服务角色密钥
);

// 验证连接
const { data, error } = await remoteSupabase
  .from('shadowing_items')
  .select('id')
  .limit(1);
```

#### 步骤3：数据同步
```typescript
// 按表类型分组数据
const itemsByType = exportPackage.items.reduce((acc, item) => {
  if (!acc[item.type]) acc[item.type] = [];
  acc[item.type].push(item);
  return acc;
}, {});

// 分别同步到不同的表
for (const [tableType, items] of Object.entries(itemsByType)) {
  await remoteSupabase
    .from(tableType === 'shadowing' ? 'shadowing_items' : 
          tableType === 'cloze' ? 'cloze_items' : 'alignment_packs')
    .upsert(items, { 
      onConflict: 'id',
      ignoreDuplicates: false 
    });
}
```

### 2.3 数据表映射

#### Shadowing Items (跟读练习)
```sql
-- 本地表结构
CREATE TABLE shadowing_items (
  id uuid PRIMARY KEY,
  lang text NOT NULL,
  level int NOT NULL,
  title text NOT NULL,
  text text NOT NULL,
  audio_url text NOT NULL,
  duration_ms int,
  tokens int,
  cefr text,
  meta jsonb,
  created_at timestamptz
);

-- 同步到远程时保持相同结构
-- 使用 upsert 操作，如果ID存在则更新，否则插入
```

#### Cloze Items (完形填空)
```sql
-- 本地表结构
CREATE TABLE cloze_items (
  id uuid PRIMARY KEY,
  lang text NOT NULL,
  level int NOT NULL,
  topic text,
  title text NOT NULL,
  passage text NOT NULL,
  blanks jsonb NOT NULL,
  meta jsonb,
  created_at timestamptz
);

-- 同步时保持JSON格式的blanks字段
```

#### Alignment Packs (对齐练习)
```sql
-- 本地表结构
CREATE TABLE alignment_packs (
  id uuid PRIMARY KEY,
  lang text NOT NULL,
  topic text NOT NULL,
  level_min int,
  level_max int,
  steps jsonb NOT NULL,
  status text,
  created_at timestamptz
);

-- 同步时保持JSON格式的steps字段
```

### 2.4 同步策略

#### Upsert操作
```typescript
// 使用 upsert 而不是 insert，避免重复数据
await remoteSupabase
  .from('shadowing_items')
  .upsert(items, { 
    onConflict: 'id',           // 以ID作为冲突检测字段
    ignoreDuplicates: false     // 不忽略重复，而是更新
  });
```

#### 批量处理
```typescript
// 分批处理大量数据，避免超时
const batchSize = 100;
for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);
  await remoteSupabase
    .from('shadowing_items')
    .upsert(batch);
}
```

#### 错误处理
```typescript
try {
  const { error } = await remoteSupabase
    .from('shadowing_items')
    .upsert(items);
  
  if (error) {
    throw new Error(`同步失败: ${error.message}`);
  }
} catch (error) {
  // 记录错误，返回部分成功结果
  results.shadowing.failed = items.length;
  results.shadowing.errors.push(error.message);
}
```

### 2.5 安全机制

#### 权限验证
```typescript
// 1. 验证管理员权限
const auth = await requireAdmin(req);
if (!auth.ok) {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

// 2. 验证远程数据库连接
const { data: testData, error: testError } = await remoteSupabase
  .from('shadowing_items')
  .select('id')
  .limit(1);
```

#### 数据验证
```typescript
// 验证必需字段
if (!exportPackage || !remoteConfig || !remoteConfig.url || !remoteConfig.key) {
  return NextResponse.json({ 
    error: "缺少必要的参数" 
  }, { status: 400 });
}

// 验证数据完整性
const requiredFields = ['id', 'lang', 'level', 'title'];
for (const item of items) {
  for (const field of requiredFields) {
    if (!item[field]) {
      throw new Error(`缺少必需字段: ${field}`);
    }
  }
}
```

### 2.6 网络传输

#### HTTPS加密
```typescript
// 使用HTTPS确保数据传输安全
const remoteSupabase = createClient(
  'https://your-project.supabase.co',  // 必须是HTTPS
  remoteConfig.key
);
```

#### 请求头设置
```typescript
// 设置适当的请求头
const response = await fetch('/api/admin/question-bank/sync-remote', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    package: exportPackage,
    remoteConfig: remoteConfig
  })
});
```

### 2.7 同步结果处理

#### 成功统计
```typescript
const results = {
  shadowing: { success: 0, failed: 0, errors: [] },
  cloze: { success: 0, failed: 0, errors: [] },
  alignment: { success: 0, failed: 0, errors: [] }
};

// 记录每个表的同步结果
if (error) {
  results.shadowing.failed = items.length;
  results.shadowing.errors.push(error.message);
} else {
  results.shadowing.success = items.length;
}
```

#### 返回结果
```typescript
return NextResponse.json({
  success: true,
  message: `同步完成：成功 ${totalSuccess} 个，失败 ${totalFailed} 个`,
  results,
  summary: {
    total: totalItems,
    success: totalSuccess,
    failed: totalFailed
  }
});
```

## 3. 故障排除

### 3.1 常见问题

1. **连接失败**
   - 检查URL格式是否正确
   - 验证服务密钥是否有效
   - 确认网络连接正常

2. **权限错误**
   - 确认服务密钥有足够权限
   - 检查RLS策略设置
   - 验证表是否存在

3. **数据格式错误**
   - 检查字段类型是否匹配
   - 验证JSON字段格式
   - 确认必填字段都有值

4. **超时问题**
   - 减少批量大小
   - 增加超时时间
   - 分批处理大量数据

### 3.2 调试方法

```typescript
// 1. 启用详细日志
console.log('同步开始:', {
  totalItems: exportPackage.items.length,
  remoteUrl: remoteConfig.url
});

// 2. 验证数据格式
console.log('数据样本:', items[0]);

// 3. 测试连接
const { data, error } = await remoteSupabase
  .from('shadowing_items')
  .select('count')
  .limit(1);
console.log('连接测试结果:', { data, error });
```

## 4. 性能优化

### 4.1 批量处理
- 使用批量upsert操作
- 合理设置批次大小
- 避免逐条插入

### 4.2 索引优化
- 确保ID字段有索引
- 为查询字段添加复合索引
- 定期分析查询性能

### 4.3 网络优化
- 使用压缩传输
- 实现重试机制
- 监控传输速度

这个同步系统确保了数据的安全、完整和高效传输，同时提供了详细的错误处理和结果反馈。

