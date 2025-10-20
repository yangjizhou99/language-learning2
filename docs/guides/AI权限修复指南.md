# AI权限修复指南

## 问题描述

在测试日语生成句子功能时，出现错误：
```
AI权限限制: AI功能未启用，请联系管理员开启
```

## 问题原因

用户的AI权限设置中 `ai_enabled` 字段为 `false`，导致无法使用AI功能。

## 解决方案

### 方法1：通过Supabase控制台修复

1. 访问 [Supabase控制台](https://supabase.com/dashboard)
2. 进入您的项目
3. 点击 "SQL Editor"
4. 执行以下SQL：

```sql
UPDATE user_permissions 
SET custom_restrictions = jsonb_set(
  custom_restrictions, 
  '{ai_enabled}', 
  'true'::jsonb
)
WHERE user_id = '29508181-a59a-4a73-be95-0bdfb7b96725';
```

5. 验证修复结果：

```sql
SELECT 
  user_id,
  custom_restrictions->>'ai_enabled' as ai_enabled,
  custom_restrictions->'api_keys' as api_keys
FROM user_permissions 
WHERE user_id = '29508181-a59a-4a73-be95-0bdfb7b96725';
```

### 方法2：通过管理页面修复

1. 访问 `/admin/users` 页面
2. 找到用户 `yangjizhou100@gmail.com`
3. 编辑用户权限
4. 启用AI功能

## 验证修复

修复后，重新测试日语生成句子功能：

1. 访问 `/admin/pronunciation`
2. 选择语言为 "🇯🇵 日本語"
3. 点击 "开始生成句子"
4. 选择单次生成模式
5. 输入生成数量（如10个）
6. 输入难度等级（如2）

## 预期结果

- 不再出现 "AI权限限制: AI功能未启用" 错误
- 能够成功生成日语测试句子
- 自动创建句节关联数据

## 注意事项

- 确保环境变量中配置了 `DEEPSEEK_API_KEY`
- 如果仍有问题，检查API密钥是否正确配置
- 生成过程可能需要30-60秒，请耐心等待

