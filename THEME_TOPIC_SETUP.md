# 主题和题目管理系统设置指南

## 概述

新的主题和题目管理系统已经实现，支持以下功能：

1. **大主题管理**：管理员可以创建和管理主题
2. **小题目生成**：基于选中的主题，AI自动生成具体的学习题目
3. **内容生成**：基于选中的题目生成完整的shadowing内容

## 数据库结构

### 新增表

1. **shadowing_themes** - 主题表
   - 存储大主题信息（中文名、英文名、描述等）
   - 支持按语言、等级、体裁筛选

2. **shadowing_topics** - 题目表
   - 存储具体的学习题目
   - 关联到主题，支持AI生成标记

3. **更新shadowing_drafts** - 草稿表
   - 添加theme_id和topic_id关联字段

## 使用流程

### 1. 创建主题
访问 `/admin/shadowing/themes` 页面：
- 填写主题的中文名和英文名
- 选择目标语言、难度等级、体裁
- 添加主题描述（可选）

### 2. 生成题目
在主题管理页面：
- 选择要生成题目的主题
- 设置生成参数（数量、AI模型等）
- 点击"生成题目"按钮

### 3. 生成内容
在快速生成页面：
- 选择主题（第一步）
- 选择参数（第二步）
- 审核题目（第三步）
- 生成内容（第四步）

## 数据库迁移

运行以下命令应用数据库更改：

```bash
# 如果使用Supabase CLI
npx supabase db push

# 或者直接在Supabase Dashboard中运行SQL
# 文件位置：supabase/migrations/20250120000021_create_theme_topic_structure.sql
```

## 权限要求

- 需要管理员权限才能创建主题和管理题目
- 确保用户账户在profiles表中的role字段为'admin'

## 故障排除

### 1. 权限错误
如果遇到"forbidden"错误：
- 检查用户是否已登录
- 确认用户有管理员权限
- 重新登录管理员账户

### 2. 数据库约束错误
如果遇到约束违反错误：
- 确保所有必填字段都有值
- 检查外键关联是否正确
- 验证数据类型和格式

### 3. 主题不显示
如果主题列表为空：
- 确认已创建主题
- 检查筛选条件是否正确
- 验证主题的is_active状态

## API端点

### 主题管理
- `GET /api/admin/shadowing/themes` - 获取主题列表
- `POST /api/admin/shadowing/themes` - 创建主题

### 题目生成
- `GET /api/admin/shadowing/themes/[themeId]/topics` - 获取题目列表
- `POST /api/admin/shadowing/themes/[themeId]/topics/generate` - 生成题目

## 页面路由

- `/admin/shadowing/themes` - 主题管理页面
- `/admin/shadowing/themes/[themeId]/topics` - 题目管理页面
- `/admin/shadowing/quick-gen` - 快速生成页面（已更新）

## 注意事项

1. 主题创建后需要手动激活（is_active字段）
2. 题目生成会消耗AI API配额
3. 建议先创建少量主题进行测试
4. 定期清理不需要的主题和题目以保持数据库整洁
