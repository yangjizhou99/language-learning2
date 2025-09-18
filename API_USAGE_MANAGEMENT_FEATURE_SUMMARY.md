# API使用管理功能总结

## 功能概述

本功能实现了完整的API使用管理和用户权限控制系统，包括：

1. **API使用统计** - 实时监控API调用情况
2. **全局使用限制** - 设置系统级别的API使用限制
3. **用户级别限制** - 为特定用户设置独立的使用限制
4. **AI权限管理** - 控制用户的AI功能访问权限
5. **模型权限控制** - 管理用户可访问的AI模型

## 核心功能

### 1. API使用统计页面 (`/admin/api-usage`)

#### 功能特性：

- 📊 **实时统计**：显示所有用户的API使用情况
- 📈 **数据可视化**：图表展示使用趋势
- 🔍 **用户筛选**：按用户查看详细使用记录
- ⚙️ **管理功能**：统一的用户管理界面

#### 页面结构：

```
使用统计
├── 用户使用概览
├── 使用趋势图表
└── 用户详情表格

使用限制
├── 全局API使用限制设置
└── 限制状态显示

AI配置
└── 用户AI功能配置管理
```

### 2. 用户管理模态框

#### 功能特性：

- 👤 **用户选择**：从统计页面选择要管理的用户
- 🔒 **限制管理**：设置用户特定的API使用限制
- 🤖 **AI配置**：管理用户的AI功能权限和模型访问

#### 管理选项：

```
用户管理
├── 使用限制
│   ├── 启用/禁用用户限制
│   ├── 每日限制设置
│   └── 每月限制设置
└── AI配置
    ├── 启用/禁用AI功能
    ├── API密钥配置
    └── 模型权限管理
```

### 3. 权限控制系统

#### AI权限检查：

- ✅ **功能启用检查**：只有明确启用AI功能的用户才能使用
- 🔑 **API密钥验证**：检查用户是否配置了必要的API密钥
- 🎯 **模型权限控制**：限制用户只能访问授权的AI模型
- 📊 **使用限制检查**：实时检查用户是否超出使用限制

#### 限制类型：

- **调用次数限制**：每日/每月API调用次数
- **Token限制**：每日/每月Token使用量
- **费用限制**：每日/每月API使用费用

## 技术实现

### 数据库表结构

#### 1. `api_usage_logs` - API使用日志

```sql
- id (uuid, primary key)
- user_id (uuid, foreign key)
- provider (text) - AI提供商
- model (text) - 使用的模型
- tokens_used (integer) - 使用的Token数
- cost (decimal) - 费用
- created_at (timestamp)
```

#### 2. `api_limits` - 全局API限制

```sql
- id (uuid, primary key)
- daily_calls_limit (integer)
- daily_tokens_limit (integer)
- daily_cost_limit (decimal)
- monthly_calls_limit (integer)
- monthly_tokens_limit (integer)
- monthly_cost_limit (decimal)
- enabled (boolean)
```

#### 3. `user_api_limits` - 用户API限制

```sql
- id (uuid, primary key)
- user_id (uuid, foreign key)
- daily_calls_limit (integer)
- daily_tokens_limit (integer)
- daily_cost_limit (decimal)
- monthly_calls_limit (integer)
- monthly_tokens_limit (integer)
- monthly_cost_limit (decimal)
- enabled (boolean)
```

#### 4. `user_permissions` - 用户权限（扩展）

```sql
- user_id (uuid, primary key)
- ai_enabled (boolean) - AI功能启用状态
- api_keys (jsonb) - 用户API密钥配置
- model_permissions (jsonb) - 模型权限配置
- ... (其他权限字段)
```

### 核心组件

#### 1. `APIUsageAlert` - 使用量警告组件

- 显示当前使用量和限制
- 警告接近或超出限制的情况

#### 2. `AIConfigPanel` - AI配置面板

- 管理用户AI功能启用状态
- 配置API密钥
- 管理模型权限

#### 3. `UserLimitsPanel` - 用户限制面板

- 设置用户特定的使用限制
- 支持全局和用户级别限制

#### 4. `APIUsageStats` - 使用统计组件

- 显示用户使用情况
- 提供数据可视化

### API接口

#### 1. `/api/admin/api-usage` - 使用统计

- `GET` - 获取使用统计数据
- `POST` - 创建使用日志

#### 2. `/api/admin/api-limits` - 全局限制

- `GET` - 获取全局限制设置
- `POST` - 保存全局限制设置

#### 3. `/api/admin/users/[userId]/limits` - 用户限制

- `GET` - 获取用户限制设置
- `POST` - 保存用户限制设置

#### 4. `/api/admin/users/[userId]/permissions` - 用户权限

- `GET` - 获取用户权限
- `PUT` - 更新用户权限

### 权限检查系统

#### 1. `checkAPILimits` - API限制检查

```typescript
// 检查用户是否超出API使用限制
const limitCheck = await checkAPILimits(userId, provider, model);
if (!limitCheck.allowed) {
  throw new Error(`API使用限制: ${limitCheck.reason}`);
}
```

#### 2. `checkUserAIPermissions` - AI权限检查

```typescript
// 检查用户AI功能权限
const permissionCheck = await checkUserAIPermissions(userId, provider, model);
if (!permissionCheck.allowed) {
  throw new Error(`AI权限限制: ${permissionCheck.reason}`);
}
```

## 使用指南

### 管理员操作流程

#### 1. 设置全局限制

1. 访问 `/admin/api-usage`
2. 切换到"使用限制"标签
3. 启用全局限制
4. 设置每日/每月限制
5. 点击"保存设置"

#### 2. 管理用户权限

1. 在用户统计表格中点击"用户管理"
2. 切换到"使用限制"标签设置用户限制
3. 切换到"AI配置"标签管理AI权限
4. 保存所有设置

#### 3. 监控使用情况

1. 查看"使用统计"标签的概览数据
2. 使用图表分析使用趋势
3. 检查用户详情表格

### 权限控制效果

#### 用户AI功能访问：

- ❌ **未启用AI功能**：无法使用任何AI生成功能
- ❌ **未配置API密钥**：无法调用AI服务
- ❌ **模型未授权**：无法使用未授权的AI模型
- ❌ **超出使用限制**：无法进行新的AI调用

#### 限制生效范围：

- `/practice/shadowing` - 影子跟读练习
- `/practice/cloze` - 完形填空练习
- `/practice/alignment` - 角色扮演练习
- `/practice/articles` - 文章阅读练习

## 安全特性

### 1. 认证保护

- 所有管理接口都需要管理员权限
- 使用Supabase RLS进行数据库访问控制

### 2. 数据验证

- 严格的输入数据验证
- 防止SQL注入和XSS攻击

### 3. 权限隔离

- 用户只能查看自己的使用数据
- 管理员可以管理所有用户权限

## 性能优化

### 1. 数据库优化

- 为常用查询字段创建索引
- 使用复合索引优化多条件查询

### 2. 缓存策略

- 权限检查结果缓存
- 使用统计数据缓存

### 3. 异步处理

- 使用日志记录异步处理
- 非阻塞的权限检查

## 维护说明

### 1. 定期检查

- 监控API使用趋势
- 检查用户权限配置
- 验证限制设置有效性

### 2. 数据清理

- 定期清理过期的使用日志
- 归档历史统计数据

### 3. 权限审计

- 定期审查用户权限设置
- 检查异常使用模式

## 故障排除

### 常见问题

#### 1. AI功能无法使用

- 检查用户AI功能是否启用
- 验证API密钥配置
- 确认模型权限设置

#### 2. 限制不生效

- 检查限制设置是否正确保存
- 验证数据库表结构
- 确认权限检查逻辑

#### 3. 数据不显示

- 检查数据库连接
- 验证RLS策略设置
- 确认用户权限

### 调试工具

- 浏览器开发者工具
- Supabase控制台日志
- 数据库查询工具

---

**功能开发完成时间**: 2025年1月20日  
**最后更新**: 2025年1月20日  
**版本**: 1.0.0
