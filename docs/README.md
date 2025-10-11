# 📚 项目文档索引

本目录包含了语言学习应用的所有文档，按照功能和用途进行分类整理。

## 📁 目录结构

### 🎯 [features/](./features/) - 功能文档
存放各个功能模块的详细文档和使用指南：
- **跟随练习 (Shadowing)** - 跟随练习功能的各类文档
- **句子练习** - 句子练习功能的优化和修复记录
- **词汇管理** - 词汇相关功能文档
- **语音功能** - 语音管理和生成相关文档
- **邀请系统** - 用户邀请系统文档
- **完形填空** - 完形填空系统文档
- **UI优化** - 移动端和桌面端UI优化文档

### 🗄️ [database/](./database/) - 数据库文档
数据库相关的所有文档：
- 数据库结构和迁移指南
- 数据同步方案和问题解决
- 数据库性能优化
- 手动数据库操作指南
- RLS（行级安全）配置

### 🚀 [deployment/](./deployment/) - 部署文档
部署相关的配置和指南：
- Vercel 部署指南
- GitHub Actions CI/CD 配置
- 流式API部署
- 生产环境检查清单

### ⚙️ [setup/](./setup/) - 环境配置
环境配置和初始化文档：
- 环境变量设置
- TTS服务配置（Google TTS、Gemini TTS、讯飞TTS）
- 项目初始化指南
- 各种API key配置

### ⚡ [optimization/](./optimization/) - 性能优化
性能相关的优化文档：
- 性能测试报告
- 带宽优化方案
- 缓存实现指南
- 数据库查询优化
- 并发限制分析

### 🔧 [fixes/](./fixes/) - 修复记录
各种bug修复和问题解决记录：
- 认证问题修复
- 备份功能修复
- 超时问题解决
- 安全漏洞修复
- UI问题修复

### 📝 [devlogs/](./devlogs/) - 开发日志
按步骤记录的开发过程：
- DEVLOG_STEP1 到 STEP12 - 完整的开发历程记录

### 🧪 [testing/](./testing/) - 测试文档
测试相关的文档和报告：
- 测试构建报告
- 调试指南
- React Key 问题诊断
- 诊断报告

### 📊 [reports/](./reports/) - 总结报告
各个阶段的完成报告和总结：
- 功能完成总结
- 集成状态报告
- 最终测试报告
- 优化总结

### 📖 [guides/](./guides/) - 操作指南
各种操作和使用指南：
- 备份功能指南
- 故障排查指南
- 音频代理和缓存
- 专项打包指南

### 🇨🇳 [中文文档/](./中文文档/) - 中文文档
中文版本的配置和使用指南：
- 局域网访问配置
- 多设备测试指南
- 配置转换指南
- 科大讯飞TTS集成报告

## 🔍 快速查找

### 新手入门
1. [环境配置](./setup/ENVIRONMENT_SETUP_GUIDE.md) - 首次配置项目
2. [环境变量设置](./setup/ENVIRONMENT_VARIABLES_SETUP.md) - 配置必要的环境变量
3. [数据库初始化](./database/MANUAL_DATABASE_SETUP.md) - 设置数据库

### 部署上线
1. [部署检查清单](./deployment/DEPLOYMENT_CHECKLIST.md) - 部署前检查
2. [Vercel部署](./deployment/VERCEL_DEPLOYMENT_GUIDE.md) - 部署到Vercel
3. [环境变量配置](./deployment/VERCEL_ENV_SETUP.md) - 配置生产环境变量

### 功能开发
- [跟随练习功能](./features/) - 查看跟随练习相关文档
- [语音功能](./features/VOICE_MANAGER_FEATURES.md) - 语音管理功能
- [完形填空](./features/CLOZE_SYSTEM_README.md) - 完形填空系统

### 问题排查
1. [故障排查](./guides/TROUBLESHOOTING_ADMIN.md) - 管理员故障排查
2. [数据库同步问题](./database/DATABASE_SYNC_ISSUES_GUIDE.md) - 解决同步问题
3. [修复记录](./fixes/) - 查看历史问题修复

### 性能优化
1. [性能优化指南](./optimization/PERFORMANCE_OPTIMIZATION_GUIDE.md) - 全面的性能优化
2. [缓存实现](./optimization/CACHE_IMPLEMENTATION_GUIDE.md) - 缓存策略
3. [带宽优化](./optimization/BANDWIDTH_OPTIMIZATION_GUIDE.md) - 减少带宽使用

## 📌 重要文档

| 文档 | 说明 | 位置 |
|------|------|------|
| 环境配置指南 | 项目初始化必读 | [setup/ENVIRONMENT_SETUP_GUIDE.md](./setup/ENVIRONMENT_SETUP_GUIDE.md) |
| 数据库结构文档 | 了解数据库设计 | [database/DATABASE_STRUCTURE_DOCUMENTATION.md](./database/DATABASE_STRUCTURE_DOCUMENTATION.md) |
| 部署检查清单 | 上线前检查 | [deployment/DEPLOYMENT_CHECKLIST.md](./deployment/DEPLOYMENT_CHECKLIST.md) |
| 性能优化总结 | 性能优化汇总 | [optimization/PERFORMANCE_OPTIMIZATION_SUMMARY.md](./optimization/PERFORMANCE_OPTIMIZATION_SUMMARY.md) |
| 最终完成报告 | 项目里程碑 | [reports/FINAL_COMPLETION_REPORT.md](./reports/FINAL_COMPLETION_REPORT.md) |

## 📝 文档贡献

如果你要添加新文档，请遵循以下规则：

1. **选择正确的目录** - 根据文档类型放入对应文件夹
2. **使用清晰的文件名** - 使用大写字母和下划线，如 `FEATURE_NAME_GUIDE.md`
3. **添加到索引** - 在本 README 中添加链接
4. **使用Markdown格式** - 确保格式规范，便于阅读

## 🔄 最近更新

查看 [../CHANGELOG.md](../CHANGELOG.md) 了解项目的最新变更。

---

**提示**: 使用 Ctrl+F (Cmd+F on Mac) 快速搜索本页面内容

