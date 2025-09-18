# Shadowing草稿打包系统使用指南

## 概述

Shadowing草稿打包系统是专门用于打包Shadowing草稿题目的解决方案，能够将本地草稿箱中的未发布题目完整地同步到远程数据库，包含草稿数据、音频文件和翻译内容。

## 系统特点

### 🎯 专项处理
- **Shadowing草稿题目**：包含草稿数据 + 音频文件 + 翻译内容 + 主题关联

### 📦 完整打包
- **数据完整性**：确保所有相关数据都被同步
- **文件处理**：自动处理音频文件和翻译数据
- **关联数据**：包含主题、子主题等关联信息

### 🔄 智能同步
- **类型识别**：自动识别题目类型并应用相应的打包策略
- **增量同步**：只同步选中的题目，提高效率
- **错误处理**：详细的错误信息和部分成功处理

## 使用方法

### 1. 访问管理页面

访问 `/admin/question-bank/specialized` 页面，您将看到专项题目打包界面。

### 2. 环境变量配置

系统会自动从环境变量中读取数据库连接信息，无需手动填写：

#### 必需的环境变量
```bash
# 本地数据库连接
LOCAL_DB_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres

# 远程数据库连接
PROD_DB_URL=postgresql://postgres:[password]@db.yyfyieqfuwwyqrlewswu.supabase.co:5432/postgres

# Supabase配置
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

#### 环境变量说明
- **LOCAL_DB_URL**：本地数据库连接字符串（源数据库）
- **PROD_DB_URL**：远程数据库连接字符串（目标数据库）
- **NEXT_PUBLIC_SUPABASE_URL**：Supabase项目URL
- **NEXT_PUBLIC_SUPABASE_ANON_KEY**：Supabase匿名密钥

#### 配置验证
页面会自动显示从环境变量读取的配置信息，包括：
- 数据库主机地址和端口
- 数据库名称和用户名
- SSL连接状态
- 完整的连接URL

### 3. 题目类型说明

系统专门处理Shadowing草稿题目：

#### 跟读练习草稿 (Shadowing Drafts)
- ✅ 草稿数据（shadowing_drafts表）
- ✅ 音频文件（从Supabase Storage同步）
- ✅ 翻译内容（translations字段）
- ✅ 主题关联（theme_id, subtopic_id）
- ✅ 大主题数据（shadowing_themes表）
- ✅ 小主题数据（shadowing_subtopics表）
- ✅ 草稿状态（未发布的题目）

### 4. 筛选题目

使用筛选条件选择要打包的草稿题目：

- **搜索标题**：按标题关键词搜索
- **语言**：筛选特定语言的草稿
- **等级**：筛选特定难度等级
- **注意**：只显示草稿状态的题目，无需选择状态

### 5. 选择题目

- **单个选择**：点击题目左侧的复选框
- **全选**：点击顶部的全选复选框
- **类型筛选**：可以按题目类型进行筛选

### 6. 开始打包

点击"开始打包"按钮，系统将：

1. **验证配置**：检查数据库连接配置
2. **按类型分组**：将选中的题目按类型分组
3. **专项处理**：为每种类型应用相应的打包策略
4. **同步数据**：将数据同步到目标数据库
5. **处理文件**：同步音频文件和翻译数据
6. **返回结果**：显示详细的打包结果

## 技术实现

### 专项打包器架构

```typescript
// 打包器工厂
class PackerFactory {
  static createPacker(type: string, config: PackingConfig) {
    switch (type) {
      case 'shadowing': return new ShadowingPacker(config);
      case 'cloze': return new ClozePacker(config);
      case 'alignment': return new AlignmentPacker(config);
    }
  }
}
```

### ShadowingPacker 实现

```typescript
class ShadowingPacker {
  async packShadowingItems(filters) {
    // 1. 获取已发布的题目
    const publishedItems = await this.getPublishedItems(filters);
    
    // 2. 获取草稿题目
    const draftItems = await this.getDraftItems(filters);
    
    // 3. 同步题目数据
    await this.syncItemsToTarget(publishedItems, 'shadowing_items');
    await this.syncItemsToTarget(draftItems, 'shadowing_drafts');
    
    // 4. 处理音频文件
    const audioFiles = await this.processAudioFiles(items);
    
    // 5. 处理翻译数据
    await this.processTranslations(items);
  }
}
```

### 数据表映射

#### Shadowing题目
```sql
-- 已发布题目
shadowing_items: id, lang, level, title, text, audio_url, 
                 duration_ms, tokens, cefr, meta, created_at,
                 translations, theme_id, subtopic_id

-- 草稿题目
shadowing_drafts: id, lang, level, title, text, notes, 
                  status, created_by, created_at, theme_id, subtopic_id
```

#### Cloze题目
```sql
-- 已发布题目
cloze_items: id, lang, level, topic, title, passage, 
             blanks, meta, created_at

-- 草稿题目
cloze_drafts: id, lang, level, topic, title, passage, 
              blanks, status, created_by, created_at
```

#### Alignment题目
```sql
-- 训练包
alignment_packs: id, lang, topic, level_min, level_max, 
                 preferred_style, steps, status, created_by, created_at
```

### 文件处理

#### 音频文件同步
```typescript
private async processAudioFiles(items) {
  for (const item of items) {
    if (item.audio_url) {
      // 从源Supabase Storage下载
      const { data } = await this.supabase.storage
        .from('tts')
        .download(item.audio_url);
      
      // 上传到目标Supabase Storage
      const fileName = `shadowing/${item.lang}/${item.id}.wav`;
      await this.supabase.storage
        .from('tts')
        .upload(fileName, data);
      
      // 更新音频URL
      item.audio_url = `${targetUrl}/storage/v1/object/public/tts/${fileName}`;
    }
  }
}
```

#### 翻译数据处理
```typescript
private async processTranslations(items) {
  for (const item of items) {
    if (item.translations) {
      // 验证和清理翻译数据
      const translations = typeof item.translations === 'string' 
        ? JSON.parse(item.translations) 
        : item.translations;
      
      // 确保翻译数据完整性
      item.translations = JSON.stringify(translations);
    }
  }
}
```

## 使用场景

### 场景1：Shadowing题目完整迁移
1. 选择"跟读练习"类型
2. 筛选需要迁移的题目
3. 系统自动包含：
   - 题目数据
   - 草稿数据
   - 音频文件
   - 翻译内容
   - 主题关联

### 场景2：Cloze题目批量同步
1. 选择"完形填空"类型
2. 按语言和等级筛选
3. 系统自动包含：
   - 题目数据
   - 草稿数据
   - 空白答案配置

### 场景3：Alignment训练包部署
1. 选择"对齐练习"类型
2. 筛选特定主题的训练包
3. 系统自动包含：
   - 训练包数据
   - 步骤内容
   - 风格偏好

## 注意事项

### 数据安全
- 确保数据库连接信息的安全性
- 建议在同步前备份目标数据库
- 使用HTTPS连接确保数据传输安全

### 性能考虑
- 大量音频文件同步可能需要较长时间
- 建议分批处理大量数据
- 监控网络带宽和存储空间

### 错误处理
- 同步失败时会显示详细错误信息
- 部分成功时会显示成功和失败的统计
- 建议根据错误信息调整数据后重试

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查主机地址和端口是否正确
   - 确认用户名和密码是否正确
   - 检查网络连接和防火墙设置

2. **音频文件同步失败**
   - 检查Supabase Storage配置
   - 确认音频文件是否存在
   - 检查存储桶权限设置

3. **翻译数据丢失**
   - 检查translations字段格式
   - 确认JSON数据是否有效
   - 验证翻译数据完整性

4. **权限错误**
   - 确认数据库用户权限
   - 检查RLS策略设置
   - 验证Supabase服务密钥权限

## 更新日志

### v1.0.0 (2025-01-20)
- 初始版本发布
- 支持三种题目类型的专项打包
- 实现音频文件和翻译数据同步
- 提供完整的管理界面

## 技术支持

如有问题或建议，请联系开发团队或查看项目文档。
