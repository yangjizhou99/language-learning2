# PostgreSQL COPY 协议流式同步指南

## 概述

本系统实现了基于PostgreSQL COPY协议的高效数据流式传输，特别适合大量数据的同步场景。相比传统的逐条插入，COPY协议提供了更高的性能和更低的网络开销。

## 技术原理

### 1. COPY协议优势

#### 性能优势
- **批量传输**：一次性传输大量数据，减少网络往返次数
- **二进制格式**：比文本格式更紧凑，传输效率更高
- **流式处理**：边读边写，内存占用低
- **事务安全**：整个同步过程在一个事务中完成

#### 与传统方法对比
```
传统方法 (逐条INSERT):
INSERT INTO table VALUES (...);
INSERT INTO table VALUES (...);
INSERT INTO table VALUES (...);
...

COPY协议:
COPY table FROM STDIN WITH (FORMAT binary);
[二进制数据流]
```

### 2. 流式处理架构

```
源数据库 → 查询流 → 转换流 → COPY流 → 目标数据库
    ↓         ↓        ↓        ↓
   SELECT   Transform  Format   INSERT
```

#### 组件说明
- **查询流 (QueryStream)**：从源数据库流式读取数据
- **转换流 (TransformStream)**：数据格式转换和字段映射
- **COPY流 (CopyStream)**：将数据格式化为COPY协议格式

### 3. 数据流程

```typescript
// 1. 建立连接
const sourceClient = await sourcePool.connect();
const targetClient = await targetClient.connect();

// 2. 开始事务
await targetClient.query('BEGIN');

// 3. 清空目标表
await targetClient.query('TRUNCATE TABLE target_table CASCADE');

// 4. 创建流式管道
sourceClient.query(selectQuery)
  .pipe(transformStream)      // 数据转换
  .pipe(copyStream)          // COPY格式输出
  .on('finish', async () => {
    await targetClient.query('COMMIT');
  });

// 5. 提交事务
await targetClient.query('COMMIT');
```

## 使用方法

### 1. 安装依赖

```bash
npm install pg pg-copy-streams
npm install @types/pg --save-dev
```

### 2. 配置数据库连接

```typescript
const sourceConfig = {
  host: 'localhost',
  port: 5432,
  database: 'local_db',
  username: 'postgres',
  password: 'password',
  ssl: false
};

const targetConfig = {
  host: 'remote.example.com',
  port: 5432,
  database: 'production_db',
  username: 'postgres',
  password: 'password',
  ssl: true
};
```

### 3. 执行同步

```typescript
import { StreamCopySync, createTableConfigs } from '@/lib/database/stream-copy';

// 创建同步配置
const syncConfig = {
  sourceUrl: 'postgresql://user:pass@localhost:5432/source_db',
  targetUrl: 'postgresql://user:pass@remote:5432/target_db',
  tables: createTableConfigs(['shadowing_items', 'cloze_items'])
};

// 执行同步
const sync = new StreamCopySync(syncConfig);
const results = await sync.syncAll();
```

### 4. 使用Web界面

访问 `/admin/question-bank/copy-sync` 页面：

1. **配置源数据库**：填写本地数据库连接信息
2. **配置目标数据库**：填写远程数据库连接信息
3. **选择同步表**：勾选需要同步的表
4. **开始同步**：点击"开始同步"按钮

## 技术实现

### 1. 核心类结构

```typescript
class StreamCopySync {
  private sourcePool: Pool;      // 源数据库连接池
  private targetPool: Pool;      // 目标数据库连接池
  private config: StreamCopyConfig;

  async syncAll(): Promise<CopyResult[]>
  async copyTable(tableConfig: TableConfig): Promise<CopyResult>
  private buildSelectQuery(tableConfig: TableConfig): string
}
```

### 2. 流式处理实现

```typescript
// 查询流
const sourceStream = sourceClient.query(selectQuery);

// 转换流
const transformStream = new Transform({
  objectMode: true,
  transform: (row, encoding, callback) => {
    const transformedRow = tableConfig.transform ? 
      tableConfig.transform(row) : row;
    const orderedRow = tableConfig.columns.map(col => transformedRow[col]);
    callback(null, orderedRow);
  }
});

// COPY流
const copyStream = targetClient.query(
  copyTo(`COPY ${tableName} (${columns.join(', ')}) FROM STDIN WITH (FORMAT text)`)
);
```

### 3. 数据转换

```typescript
// 字段映射
const columnMap = {
  'shadowing_items': [
    'id', 'lang', 'level', 'title', 'text', 'audio_url', 
    'duration_ms', 'tokens', 'cefr', 'meta', 'created_at'
  ],
  'cloze_items': [
    'id', 'lang', 'level', 'topic', 'title', 'passage', 
    'blanks', 'meta', 'created_at'
  ]
};

// JSON字段处理
const transforms = {
  'shadowing_items': (row) => ({
    ...row,
    meta: typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta
  })
};
```

## 性能优化

### 1. 连接池配置

```typescript
const pool = new Pool({
  connectionString: url,
  max: 5,                    // 最大连接数
  idleTimeoutMillis: 30000,  // 空闲超时
  connectionTimeoutMillis: 2000, // 连接超时
});
```

### 2. 批量处理

```typescript
// 分批读取数据
const batchSize = 1000;
const cursor = client.query(query).cursor(batchSize);

cursor.read(batchSize, (err, rows) => {
  if (rows.length === 0) {
    // 处理完成
    return;
  }
  // 处理当前批次
});
```

### 3. 内存管理

```typescript
// 流式处理，避免一次性加载所有数据
sourceStream
  .pipe(transformStream)  // 边读边转换
  .pipe(copyStream)       // 边转换边写入
  .on('finish', resolve);
```

## 错误处理

### 1. 连接错误

```typescript
try {
  const sourceClient = await sourcePool.connect();
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    throw new Error('数据库连接被拒绝，请检查主机和端口');
  }
  throw error;
}
```

### 2. 数据转换错误

```typescript
transform: (row, encoding, callback) => {
  try {
    const transformedRow = transformRow(row);
    callback(null, transformedRow);
  } catch (error) {
    console.error('数据转换错误:', error);
    callback(null, null); // 跳过错误行
  }
}
```

### 3. 事务回滚

```typescript
try {
  await targetClient.query('BEGIN');
  // 执行同步
  await targetClient.query('COMMIT');
} catch (error) {
  await targetClient.query('ROLLBACK');
  throw error;
}
```

## 监控和日志

### 1. 性能监控

```typescript
const startTime = Date.now();
// ... 执行同步
const duration = Date.now() - startTime;

return {
  table: tableName,
  success: true,
  rowsProcessed: rowCount,
  duration: duration
};
```

### 2. 进度跟踪

```typescript
transformStream.on('data', (row) => {
  rowsProcessed++;
  if (rowsProcessed % 1000 === 0) {
    console.log(`已处理 ${rowsProcessed} 行`);
  }
});
```

### 3. 错误日志

```typescript
copyStream.on('error', (error) => {
  console.error('COPY流错误:', error);
  // 记录到错误日志
});
```

## 安全考虑

### 1. 连接安全

```typescript
// 使用SSL连接
const config = {
  ssl: {
    rejectUnauthorized: false  // 生产环境应设为true
  }
};
```

### 2. 数据验证

```typescript
// 验证必需字段
const requiredFields = ['id', 'lang', 'level'];
for (const field of requiredFields) {
  if (!row[field]) {
    throw new Error(`缺少必需字段: ${field}`);
  }
}
```

### 3. 权限控制

```typescript
// 检查管理员权限
const auth = await requireAdmin(req);
if (!auth.ok) {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}
```

## 故障排除

### 1. 常见问题

#### 连接超时
```typescript
// 增加连接超时时间
const pool = new Pool({
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 60000
});
```

#### 内存不足
```typescript
// 减少批次大小
const batchSize = 100; // 从1000减少到100
```

#### 数据格式错误
```typescript
// 添加数据验证
const validateRow = (row) => {
  if (!row.id || !row.lang) {
    throw new Error('无效的数据行');
  }
};
```

### 2. 调试技巧

```typescript
// 启用详细日志
const debug = process.env.NODE_ENV === 'development';

if (debug) {
  console.log('同步配置:', syncConfig);
  console.log('处理行数:', rowsProcessed);
}
```

## 最佳实践

### 1. 数据备份

```sql
-- 同步前备份目标表
CREATE TABLE shadowing_items_backup AS 
SELECT * FROM shadowing_items;
```

### 2. 分批同步

```typescript
// 大量数据分批同步
const tables = ['table1', 'table2', 'table3'];
for (const table of tables) {
  await syncTable(table);
  await new Promise(resolve => setTimeout(resolve, 1000)); // 间隔1秒
}
```

### 3. 监控告警

```typescript
// 设置性能阈值
if (duration > 300000) { // 5分钟
  sendAlert('同步时间过长，请检查性能');
}
```

## 总结

PostgreSQL COPY协议流式同步提供了高效、安全、可靠的数据传输解决方案。通过合理的配置和错误处理，可以处理大量数据的同步需求，同时保持系统的稳定性和性能。

关键优势：
- **高性能**：比传统方法快10-100倍
- **低内存**：流式处理，内存占用恒定
- **事务安全**：原子性操作，数据一致性保证
- **易于监控**：详细的进度和错误信息
