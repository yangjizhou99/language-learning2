# 🗄️ 数据库文档

本目录包含数据库相关的所有文档，包括结构设计、迁移、同步和优化等。

## 📚 文档分类

### 📐 数据库结构
- `DATABASE_STRUCTURE_DOCUMENTATION.md` - 完整的数据库结构文档
- `DATABASE_MIGRATION_GUIDE.md` - 数据库迁移指南
- `MODEL_PERMISSIONS_MIGRATION_GUIDE.md` - 权限模型迁移

### 🔄 数据同步
- `DATABASE_SYNC_GUIDE.md` - 数据同步指南
- `DATABASE_SYNC_PRINCIPLE.md` - 同步原理说明
- `DATABASE_SYNC_ISSUES_GUIDE.md` - 同步问题解决
- `SYNC_ISSUES_SOLUTION.md` - 同步问题方案
- `POSTGRES_COPY_SYNC_GUIDE.md` - PostgreSQL复制同步
- `QUICK_START_SYNC.md` - 快速开始同步
- `ADMIN_DATABASE_SYNC_INTEGRATION.md` - 管理员数据库同步集成

### ⚡ 性能优化
- `DATABASE_OPTIMIZATION_REPORT.md` - 优化报告
- `DATABASE_PERFORMANCE_OPTIMIZATION_GUIDE.md` - 性能优化指南
- `DATABASE_CONFLICT_HANDLING.md` - 冲突处理

### 🔧 操作指南
- `database-operations-guide.md` - 数据库操作指南
- `MANUAL_DATABASE_SETUP.md` - 手动数据库设置
- `MANUAL_DATABASE_UPDATE.md` - 手动数据库更新

## 🚀 快速开始

### 首次设置数据库
1. 阅读 `MANUAL_DATABASE_SETUP.md` 了解基本设置流程
2. 根据 `DATABASE_STRUCTURE_DOCUMENTATION.md` 理解数据库结构
3. 执行必要的初始化脚本

### 数据库迁移
1. 查看 `DATABASE_MIGRATION_GUIDE.md` 了解迁移流程
2. 注意 `MODEL_PERMISSIONS_MIGRATION_GUIDE.md` 中的权限配置
3. 测试迁移结果

### 配置数据同步
1. 阅读 `DATABASE_SYNC_PRINCIPLE.md` 理解同步原理
2. 按照 `DATABASE_SYNC_GUIDE.md` 配置同步
3. 遇到问题参考 `DATABASE_SYNC_ISSUES_GUIDE.md`

### 优化数据库性能
1. 查看 `DATABASE_PERFORMANCE_OPTIMIZATION_GUIDE.md`
2. 参考 `DATABASE_OPTIMIZATION_REPORT.md` 中的优化建议
3. 实施并测试优化效果

## 📊 数据库架构概览

本项目使用 **Supabase (PostgreSQL)** 作为主要数据库。

**主要特性：**
- 行级安全策略 (RLS)
- 实时订阅
- 多用户权限管理
- 自动备份

**核心表：**
- `profiles` - 用户配置
- `shadowing_sentences` - 跟随练习句子
- `study_cards` - 学习卡片
- `vocabulary` - 词汇表
- `cloze_tests` - 完形填空测试

详细信息请查看 `DATABASE_STRUCTURE_DOCUMENTATION.md`。

## ⚠️ 常见问题

### 数据同步失败
→ 查看 `DATABASE_SYNC_ISSUES_GUIDE.md` 和 `SYNC_ISSUES_SOLUTION.md`

### 性能问题
→ 参考 `DATABASE_PERFORMANCE_OPTIMIZATION_GUIDE.md`

### 权限配置
→ 查看 `MODEL_PERMISSIONS_MIGRATION_GUIDE.md`

### 冲突处理
→ 参考 `DATABASE_CONFLICT_HANDLING.md`

## 🔐 安全注意事项

1. **RLS策略** - 确保所有表都配置了正确的行级安全策略
2. **备份** - 定期备份数据库
3. **环境变量** - 不要在代码中硬编码数据库凭据
4. **权限管理** - 遵循最小权限原则

---

**返回**: [文档主页](../README.md)

