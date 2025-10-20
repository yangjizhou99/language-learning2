# DeepSeek API 配置指南

## 问题描述

批量生成句子时出现所有批次都失败的情况，原因是缺少 DeepSeek API 密钥配置。

## 解决步骤

### 1. 获取 DeepSeek API 密钥

1. 访问 [DeepSeek 官网](https://platform.deepseek.com/)
2. 注册/登录账户
3. 进入 API 管理页面
4. 创建新的 API 密钥
5. 复制生成的密钥（格式：`sk-xxxxxxxxxxxxxxxx`）

### 2. 配置环境变量

#### 方法1：创建 .env.local 文件

在项目根目录创建 `.env.local` 文件：

```bash
# DeepSeek API 配置
DEEPSEEK_API_KEY=sk-your-deepseek-key-here
DEEPSEEK_BASE_URL=https://api.deepseek.com

# 其他必需的环境变量
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

#### 方法2：使用现有环境变量文件

如果已有 `.env.local` 文件，添加以下行：

```bash
DEEPSEEK_API_KEY=sk-your-deepseek-key-here
```

### 3. 验证配置

重启开发服务器：

```bash
npm run dev
```

### 4. 测试AI功能

1. 访问 `/admin/pronunciation`
2. 选择语言为 "🇯🇵 日本語"
3. 点击 "开始生成句子"
4. 选择单次生成模式
5. 输入生成数量（如5个）
6. 输入难度等级（如2）

## 预期结果

- 不再出现所有批次失败的情况
- 能够成功生成日语测试句子
- 自动创建句节关联数据

## 常见问题

### Q: 如何获取 DeepSeek API 密钥？
A: 访问 https://platform.deepseek.com/ 注册账户并创建API密钥。

### Q: API密钥格式是什么？
A: DeepSeek API密钥格式为 `sk-` 开头的字符串。

### Q: 配置后仍然失败怎么办？
A: 检查以下几点：
1. 确保API密钥正确复制
2. 重启开发服务器
3. 检查网络连接
4. 验证API密钥是否有效

### Q: 可以使用其他AI提供商吗？
A: 可以，系统支持：
- OpenRouter（推荐）
- OpenAI
- DeepSeek

在环境变量中配置对应的API密钥即可。

## 注意事项

- API密钥请妥善保管，不要提交到代码仓库
- 建议使用 `.env.local` 文件，该文件会被 `.gitignore` 忽略
- 生产环境需要在部署平台配置环境变量

