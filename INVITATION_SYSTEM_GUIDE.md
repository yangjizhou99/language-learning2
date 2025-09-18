# 邀请码注册系统使用指南

## 概述

邀请码注册系统为您的语言学习应用提供了灵活的权限控制机制。管理员可以创建邀请码，用户通过邀请码注册后自动获得相应的权限设置。

## 功能特性

### 🎫 邀请码管理

- **创建邀请码**：管理员可以创建带有自定义权限的邀请码
- **权限控制**：细粒度控制用户可访问的功能模块
- **使用限制**：设置最大使用次数和过期时间
- **状态管理**：启用/禁用邀请码
- **使用统计**：查看邀请码使用情况

### 🔐 权限系统

- **模块权限**：控制用户可访问的练习模块（跟读、完形填空、对齐练习、文章阅读）
- **AI功能**：控制用户是否可以使用AI功能
- **语言限制**：限制用户可学习的语言
- **难度等级**：控制用户可访问的难度等级
- **每日限制**：设置每日最大尝试次数
- **API使用限制**：设置用户的API调用限制（调用次数、Token限制、费用限制）
- **API密钥配置**：为邀请码用户配置专用的API密钥
- **模型权限配置**：控制用户可以使用的AI模型和限制
- **权限过期**：支持权限过期时间设置

### 📋 权限来源规则

- **邀请码注册**：使用邀请码的权限设置，完全覆盖任何现有权限
- **直接注册**：使用系统默认权限设置
- **无冲突**：两种注册方式使用不同的权限来源，不会产生冲突

### 👤 用户注册

- **邀请码验证**：注册前验证邀请码有效性
- **权限预览**：显示邀请码对应的权限设置
- **自动权限应用**：注册成功后自动应用邀请码权限
- **无缝体验**：注册后自动登录

## 使用流程

### 管理员操作

1. **访问邀请码管理**
   - 登录管理员账号
   - 进入 `/admin/invitations` 页面

2. **创建邀请码**
   - 点击"创建邀请码"按钮
   - 设置最大使用次数（默认1次）
   - 设置过期时间（可选）
   - 配置权限设置：
     - ✓ 跟读练习
     - ✓ 完形填空
     - ✓ 对齐练习
     - ✓ 文章阅读
     - ✓ AI功能
     - ✓ API密钥配置（可选）
     - ✓ API使用限制（可选）
     - ✓ 模型权限配置（可选）
   - 添加描述信息（可选）
   - 点击"创建"生成邀请码

3. **管理邀请码**
   - 查看邀请码列表
   - 复制邀请码给用户
   - 启用/禁用邀请码
   - 删除不需要的邀请码
   - 查看使用统计

### 用户操作

1. **获取邀请码**
   - 从管理员处获取8位邀请码

2. **注册账号**
   - 访问 `/auth` 页面
   - 点击"邀请码注册"展开注册表单
   - 输入邀请码并点击"验证"
   - 查看权限预览
   - 填写邮箱和密码
   - 点击"使用邀请码注册"

3. **开始使用**
   - 注册成功后自动登录
   - 根据邀请码权限访问相应功能

## 数据库结构

### invitation_codes 表

```sql
- id: 主键
- code: 8位邀请码（唯一）
- created_by: 创建者ID
- max_uses: 最大使用次数
- used_count: 已使用次数
- expires_at: 过期时间
- permissions: 权限设置（JSON）
- description: 描述信息
- is_active: 是否激活
- created_at: 创建时间
- updated_at: 更新时间
```

### invitation_uses 表

```sql
- id: 主键
- code_id: 邀请码ID
- used_by: 使用者ID
- used_at: 使用时间
```

### profiles 表（新增字段）

```sql
- invited_by: 邀请者ID
- invitation_code_id: 使用的邀请码ID
- invitation_used_at: 使用邀请码的时间
```

## API 接口

### 管理员接口

#### 获取邀请码列表

```
GET /api/admin/invitations
Query: page, limit, created_by
```

#### 创建邀请码

```
POST /api/admin/invitations
Body: {
  max_uses: number,
  expires_at?: string,
  permissions: InvitationPermissions,
  description?: string
}
```

#### 更新邀请码

```
PUT /api/admin/invitations/[id]
Body: {
  max_uses?: number,
  expires_at?: string,
  permissions?: InvitationPermissions,
  description?: string,
  is_active?: boolean
}
```

#### 删除邀请码

```
DELETE /api/admin/invitations/[id]
```

#### 获取使用记录

```
GET /api/admin/invitations/[id]/uses
Query: page, limit
```

### 用户接口

#### 验证邀请码

```
POST /api/auth/validate-invitation
Body: { code: string }
```

#### 使用邀请码注册

```
POST /api/auth/register-with-invitation
Body: {
  email: string,
  password: string,
  invitation_code: string,
  username?: string,
  native_lang?: string,
  target_langs?: string[]
}
```

## 权限配置

### 权限模板示例

```typescript
// 基础用户权限
{
  can_access_shadowing: true,
  can_access_cloze: true,
  can_access_alignment: false,
  can_access_articles: false,
  allowed_languages: ['en'],
  allowed_levels: [1, 2],
  max_daily_attempts: 20,
  ai_enabled: false
}

// 高级用户权限
{
  can_access_shadowing: true,
  can_access_cloze: true,
  can_access_alignment: true,
  can_access_articles: true,
  allowed_languages: ['en', 'ja', 'zh'],
  allowed_levels: [1, 2, 3, 4, 5],
  max_daily_attempts: 100,
  ai_enabled: true,
  api_limits: {
    enabled: true,
    daily_calls_limit: 100,
    daily_tokens_limit: 50000,
    daily_cost_limit: 5.00,
    monthly_calls_limit: 2000,
    monthly_tokens_limit: 1000000,
    monthly_cost_limit: 100.00
  },
  api_keys: {
    deepseek: 'sk-xxx...',
    openrouter: 'sk-or-xxx...'
  },
  model_permissions: [
    {
      model_id: 'deepseek-chat',
      model_name: 'DeepSeek Chat',
      provider: 'deepseek',
      daily_limit: 50,
      token_limit: 100000,
      enabled: true
    },
    {
      model_id: 'openrouter/auto',
      model_name: 'OpenRouter Auto (推荐)',
      provider: 'openrouter',
      daily_limit: 30,
      token_limit: 80000,
      enabled: true
    }
  ]
}

// 试用权限
{
  can_access_shadowing: true,
  can_access_cloze: false,
  can_access_alignment: false,
  can_access_articles: false,
  allowed_languages: ['en'],
  allowed_levels: [1],
  max_daily_attempts: 5,
  ai_enabled: false,
  expires_at: '2024-12-31T23:59:59Z'
}
```

## 安全考虑

1. **邀请码生成**：使用安全的随机算法生成8位字母数字组合
2. **权限验证**：每次API调用都会验证用户权限
3. **使用限制**：防止邀请码被重复使用
4. **过期控制**：支持邀请码和权限过期时间
5. **管理员权限**：只有管理员可以创建和管理邀请码

## 部署说明

1. **数据库迁移**

   ```bash
   # 在Supabase控制台执行
   # 运行 supabase/migrations/20250120000010_create_invitation_system.sql
   ```

2. **环境变量**

   ```env
   # 确保已设置
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

3. **权限设置**
   - 确保管理员账号有 `role = 'admin'`
   - 检查RLS策略是否正确应用

## 故障排除

### 常见问题

1. **邀请码验证失败**
   - 检查邀请码格式（8位字母数字）
   - 确认邀请码未过期
   - 检查使用次数是否已达上限

2. **权限不生效**
   - 检查用户权限记录是否正确创建
   - 确认权限检查中间件是否正常工作
   - 查看数据库中的权限数据

3. **管理员无法创建邀请码**
   - 确认用户角色为 `admin`
   - 检查API权限设置
   - 查看控制台错误信息

### 调试方法

1. **查看数据库**

   ```sql
   -- 检查邀请码
   SELECT * FROM invitation_codes WHERE code = 'YOUR_CODE';

   -- 检查用户权限
   SELECT * FROM user_permissions WHERE user_id = 'USER_ID';

   -- 检查使用记录
   SELECT * FROM invitation_uses WHERE code_id = 'CODE_ID';
   ```

2. **查看日志**
   - 浏览器控制台
   - 服务器日志
   - Supabase日志

## 扩展功能

### 未来可添加的功能

1. **批量邀请码生成**
2. **邀请码模板系统**
3. **邀请关系链追踪**
4. **邀请奖励机制**
5. **权限自动升级**
6. **使用分析报告**

## 技术支持

如有问题，请检查：

1. 数据库连接是否正常
2. 环境变量是否正确设置
3. 用户权限是否足够
4. 网络连接是否稳定

---

**注意**：本系统已完全集成到现有项目中，无需额外配置即可使用。建议在生产环境使用前进行充分测试。
