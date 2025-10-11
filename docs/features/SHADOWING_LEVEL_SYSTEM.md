# Shadowing 练习等级系统

## 概述

本系统为shadowing跟读练习添加了智能等级推荐功能，用户可以根据自己的水平选择合适的练习难度，系统也会根据练习表现自动推荐合适的等级。

## 功能特性

### 1. 等级系统

- **L1**: 超短句（≤80字/词），高频词，适合初学者
- **L2**: 短句（≤120字/词），基础连接词，简单从句
- **L3**: 中等篇幅（≤180字/词），常见并列/从句
- **L4**: 较长（≤260字/词），抽象词，结构更复杂
- **L5**: 长句（≤320+字/词），信息密度高，专业/抽象词汇

### 2. 智能推荐

- 基于用户练习历史自动推荐合适等级
- 升级条件：同级最近3次平均准确率≥92%
- 降级条件：最近一次准确率<75%或未完成
- 默认推荐L2等级

### 3. AI生成题库

- 支持多种AI模型（OpenRouter、DeepSeek、OpenAI）
- 可自定义主题、语言、等级、数量
- 自动生成TTS音频
- 批量导入题库

## 使用方法

### 学生端 - 练习页面

1. 访问 `/practice/shadowing`
2. 选择语言（日语/英语/中文）
3. 系统自动显示推荐等级
4. 可选择其他等级或使用推荐等级
5. 点击"获取下一题"开始练习
6. 完成练习后点击"记录练习结果"

### 管理员端 - AI生成题库

1. 访问 `/admin/shadowing/ai`
2. 配置生成参数：
   - 语言：英语/日语/中文
   - 等级：L1-L5
   - 条数：1-20条
   - 主题：可选
   - AI模型：选择提供商和模型
3. 点击"生成文本"
4. 校对和编辑生成的文本
5. 选择TTS声音和播放速率
6. 点击"批量合成音频"
7. 点击"保存到题库"

## 技术实现

### 数据库表结构

#### shadowing_items（题库表）

```sql
CREATE TABLE shadowing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lang text NOT NULL CHECK (lang IN ('en', 'ja', 'zh')),
  level int NOT NULL CHECK (level BETWEEN 1 AND 5),
  title text NOT NULL,
  text text NOT NULL,
  audio_url text NOT NULL,
  duration_ms int,
  tokens int,
  cefr text,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
```

#### shadowing_attempts（练习记录表）

```sql
CREATE TABLE shadowing_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES shadowing_items(id) ON DELETE CASCADE,
  lang text NOT NULL CHECK (lang IN ('en', 'ja', 'zh')),
  level int NOT NULL CHECK (level BETWEEN 1 AND 5),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
```

### API接口

#### 获取推荐等级

```
GET /api/shadowing/recommended?lang=en
```

#### 获取下一题

```
GET /api/shadowing/next?lang=en&level=3
```

#### 记录练习结果

```
POST /api/shadowing/attempts
{
  "item_id": "uuid",
  "lang": "en",
  "level": 3,
  "metrics": {
    "accuracy": 0.85,
    "complete": true,
    "time_sec": 120,
    "replays": 2
  }
}
```

#### AI生成题库

```
POST /api/admin/shadowing/generate
{
  "lang": "en",
  "level": 3,
  "count": 5,
  "topic": "travel",
  "provider": "openrouter",
  "model": "openai/gpt-4o-mini",
  "temperature": 0.6
}
```

#### 合成音频

```
POST /api/admin/shadowing/synthesize
{
  "text": "练习文本",
  "lang": "en",
  "voice": "en-US-Wavenet-A",
  "speakingRate": 1.0,
  "title": "标题"
}
```

#### 保存到题库

```
POST /api/admin/shadowing/save
{
  "lang": "en",
  "level": 3,
  "items": [
    {
      "title": "标题",
      "text": "文本内容",
      "audio_url": "音频URL"
    }
  ]
}
```

## 环境要求

### 必需的环境变量

- `OPENROUTER_API_KEY` - OpenRouter API密钥
- `DEEPSEEK_API_KEY` - DeepSeek API密钥
- `OPENAI_API_KEY` - OpenAI API密钥
- `GOOGLE_TTS_CREDENTIALS` - Google TTS凭据
- `SUPABASE_SERVICE_KEY` - Supabase服务密钥

### 存储要求

- Supabase Storage需要创建`audio`桶
- 音频文件存储在`shadowing/{lang}/`目录下

## 部署步骤

1. 运行数据库迁移：

   ```bash
   # 在Supabase控制台执行
   \i supabase/migrations/20250120000002_create_shadowing_tables.sql
   ```

2. 确保环境变量已设置

3. 重启应用服务

4. 访问管理员页面生成初始题库

## 注意事项

1. **音频存储**：确保Supabase Storage有足够空间存储TTS音频文件
2. **API限制**：注意各AI提供商的API调用限制和费用
3. **数据备份**：定期备份题库和练习记录数据
4. **性能优化**：大量音频文件可能影响加载速度，建议使用CDN

## 扩展功能

### 未来可添加的功能

- 练习进度追踪
- 个性化学习路径
- 社交功能（排行榜、好友挑战）
- 更多练习模式（跟读、听写、对话）
- 移动端应用

### 自定义配置

- 可调整等级难度标准
- 可自定义推荐算法权重
- 可添加更多语言支持
- 可集成其他TTS服务

## 故障排除

### 常见问题

1. **TTS合成失败**
   - 检查Google TTS凭据
   - 确认网络连接正常
   - 查看控制台错误日志

2. **AI生成失败**
   - 检查API密钥是否有效
   - 确认API配额是否充足
   - 验证模型名称是否正确

3. **数据库连接错误**
   - 检查Supabase配置
   - 确认数据库表是否创建成功
   - 验证RLS策略是否正确

4. **音频播放问题**
   - 检查音频文件URL是否可访问
   - 确认浏览器支持音频格式
   - 验证CORS配置

### 调试工具

- 使用`/api/admin/debug`检查系统状态
- 查看浏览器控制台错误信息
- 检查Supabase日志
- 使用Postman测试API接口

## 联系支持

如遇到技术问题，请：

1. 查看错误日志
2. 检查环境配置
3. 参考故障排除指南
4. 联系技术支持团队
