# 性能测试指南

## 概述

本指南提供了完整的性能测试方案，用于验证数据库索引优化后的性能提升效果。

## 测试类型

### 1. 数据库性能测试
- **文件**: `performance-test.js`
- **功能**: 测试数据库查询性能
- **指标**: 查询时间、索引使用情况

### 2. API 性能测试
- **文件**: `api-performance-test.js`
- **功能**: 测试 API 响应时间
- **指标**: 响应时间、成功率、数据大小

### 3. 前端性能测试
- **文件**: `frontend-performance-test.js`
- **功能**: 测试页面加载和渲染性能
- **指标**: 加载时间、首次绘制、交互时间

### 4. 综合测试
- **文件**: `run-all-tests.js`
- **功能**: 运行所有测试并生成综合报告

## 快速开始

### 1. 安装依赖

```bash
# 进入脚本目录
cd scripts

# 安装基础依赖
npm install

# 安装前端测试依赖（可选）
npm run install:puppeteer
```

### 2. 设置环境变量

```bash
# 必需的环境变量
export NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# 可选的环境变量
export NEXT_PUBLIC_SITE_URL="http://localhost:3000"  # 用于 API 和前端测试
```

### 3. 运行测试

```bash
# 运行数据库性能测试
npm run test:db

# 运行 API 性能测试
npm run test:api

# 运行前端性能测试（需要 Puppeteer）
npm run test:frontend

# 运行所有测试
npm run test:all
```

## 详细说明

### 数据库性能测试

测试以下查询的性能：

1. **Shadowing 题目查询** - 按语言和等级查询
2. **Cloze 题目查询** - 按语言和等级查询
3. **用户练习记录查询** - 按用户和语言查询
4. **词汇表全文搜索** - 文本搜索性能
5. **文章草稿状态查询** - 按状态查询

**输出示例**:
```
📊 测试: Shadowing题目查询 (lang + level)
  轮次 1: 45.23ms (10 条记录)
  轮次 2: 42.15ms (10 条记录)
  轮次 3: 43.67ms (10 条记录)
  📈 平均: 43.68ms, 最小: 42.15ms, 最大: 45.23ms
```

### API 性能测试

测试以下 API 的性能：

1. **Shadowing 下一题 API** - `/api/shadowing/next`
2. **Cloze 下一题 API** - `/api/cloze/next`
3. **Shadowing 目录 API** - `/api/shadowing/catalog`
4. **词汇表 API** - `/api/vocab/list`

**输出示例**:
```
🌐 测试 API: Shadowing 下一题 API
   路径: /api/shadowing/next?lang=en&level=2
   轮次 1: 156.78ms (状态: 200, 大小: 1024 bytes)
   轮次 2: 142.33ms (状态: 200, 大小: 1024 bytes)
   轮次 3: 148.91ms (状态: 200, 大小: 1024 bytes)
   📈 平均: 149.34ms, 最小: 142.33ms, 最大: 156.78ms
```

### 前端性能测试

测试以下页面的性能：

1. **Shadowing 练习页面** - `/practice/shadowing`
2. **Cloze 练习页面** - `/practice/cloze`
3. **词汇表页面** - `/vocab`
4. **首页** - `/`

**输出示例**:
```
🌐 测试页面: Shadowing 练习页面
   路径: /practice/shadowing
   轮次 1: 加载 1234ms, 交互 234ms
     DOM加载: 456.78ms
     首次绘制: 567.89ms
     首次内容绘制: 678.90ms
   📈 平均加载: 1234.00ms
   📈 平均交互: 234.00ms
   📈 平均首次绘制: 567.89ms
```

## 性能基准

### 数据库查询性能
- **优秀**: < 50ms
- **良好**: 50-100ms
- **需要优化**: > 100ms

### API 响应时间
- **优秀**: < 200ms
- **良好**: 200-500ms
- **需要优化**: > 500ms

### 前端加载时间
- **优秀**: < 1000ms
- **良好**: 1000-3000ms
- **需要优化**: > 3000ms

### 首次绘制时间
- **优秀**: < 500ms
- **良好**: 500-1500ms
- **需要优化**: > 1500ms

## 报告文件

测试完成后会生成以下报告文件：

- `performance-report-{timestamp}.json` - 数据库性能报告
- `api-performance-report-{timestamp}.json` - API 性能报告
- `frontend-performance-report-{timestamp}.json` - 前端性能报告
- `combined-performance-report-{timestamp}.json` - 综合性能报告

## 故障排除

### 常见问题

1. **环境变量未设置**
   ```
   ❌ 请设置环境变量:
   NEXT_PUBLIC_SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
   ```
   **解决方案**: 设置正确的环境变量

2. **Puppeteer 未安装**
   ```
   ❌ 请先安装 Puppeteer:
   npm install puppeteer
   ```
   **解决方案**: 运行 `npm run install:puppeteer`

3. **API 测试失败**
   ```
   ❌ 轮次 1 失败: Request timeout
   ```
   **解决方案**: 检查应用是否运行，URL 是否正确

4. **数据库连接失败**
   ```
   ❌ 查询失败: Invalid API key
   ```
   **解决方案**: 检查 Supabase 配置和权限

### 调试技巧

1. **启用详细日志**:
   ```bash
   DEBUG=* npm run test:db
   ```

2. **单独测试特定功能**:
   ```bash
   # 只测试数据库
   node performance-test.js
   
   # 只测试 API
   node api-performance-test.js
   ```

3. **检查索引使用情况**:
   ```sql
   SELECT 
     schemaname,
     tablename,
     indexname,
     idx_scan,
     idx_tup_read,
     idx_tup_fetch
   FROM pg_stat_user_indexes 
   WHERE schemaname = 'public' 
   AND indexname LIKE 'idx_%'
   ORDER BY idx_scan DESC;
   ```

## 持续监控

建议定期运行性能测试以监控性能变化：

1. **每日监控**: 运行数据库和 API 测试
2. **每周监控**: 运行完整测试套件
3. **发布前**: 运行所有测试并对比基准

## 优化建议

基于测试结果，系统会自动生成优化建议：

- 数据库查询优化
- API 缓存策略
- 前端资源优化
- 索引调整建议

## 联系支持

如果遇到问题或需要帮助，请：

1. 检查本文档的故障排除部分
2. 查看生成的错误日志
3. 联系开发团队
