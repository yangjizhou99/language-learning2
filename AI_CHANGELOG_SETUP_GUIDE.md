# AI Changelog 自动生成功能设置指南

## 功能概述

这个功能会自动在每次合并到 `main` 分支时，使用 DeepSeek Reason AI 分析代码变更并生成 changelog 条目，然后自动提交到仓库。

## 设置步骤

### 1. 配置 GitHub Secrets

在 GitHub 仓库中设置以下环境变量之一：

**选项 A: 使用 DeepSeek 官方 API**
- 进入仓库 → Settings → Secrets and variables → Actions
- 添加 `DEEPSEEK_API_KEY`，值为你的 DeepSeek API 密钥

**选项 B: 使用 OpenRouter API**
- 进入仓库 → Settings → Secrets and variables → Actions  
- 添加 `OPENROUTER_API_KEY`，值为你的 OpenRouter API 密钥

### 2. 文件结构

项目会自动创建以下文件：

```
.github/
├── workflows/
│   └── changelog-ai.yml          # GitHub Actions 工作流
└── scripts/
    └── gen-changelog.js          # AI 生成脚本
CHANGELOG.md                      # 自动更新的变更日志
```

### 3. 工作流程

1. **触发条件**: 每次推送到 `main` 分支
2. **分析范围**: 从上一次 tag 到当前 HEAD 的所有变更
3. **AI 处理**: 使用 DeepSeek Reason 分析 git diff
4. **自动更新**: 将生成的总结追加到 `CHANGELOG.md`
5. **自动提交**: 使用 `[skip ci]` 标记避免循环触发

### 4. 手动触发

你也可以手动触发工作流：
- 进入仓库 → Actions 标签页
- 选择 "AI Changelog" 工作流
- 点击 "Run workflow" 按钮

## 生成的 Changelog 格式

```markdown
## 2025-01-XX

### 概要
- 简要描述主要变更

### 主要改动
- 按功能模块列出具体改动

### 可能的破坏性变更
- 如有破坏性变更会在此说明

### 测试或注意事项
- 测试要点和注意事项
```

## 故障排除

### 常见问题

1. **API 密钥未设置**
   - 确保在 GitHub Secrets 中正确设置了 API 密钥
   - 检查密钥是否有效且有足够额度

2. **权限问题**
   - 确保 GitHub Actions 有 `contents: write` 权限
   - 检查仓库设置中的 Actions 权限

3. **脚本执行失败**
   - 查看 Actions 日志了解具体错误
   - 确保 Node.js 版本兼容（使用 v22）

### 调试模式

如需调试，可以在本地运行脚本：

```bash
# 设置环境变量
export DEEPSEEK_API_KEY="your-api-key"
# 或
export OPENROUTER_API_KEY="your-api-key"

# 运行脚本
node .github/scripts/gen-changelog.js
```

## 自定义配置

### 修改 AI 提示词

编辑 `.github/scripts/gen-changelog.js` 中的 `messages` 数组来自定义 AI 生成的内容格式。

### 修改触发条件

编辑 `.github/workflows/changelog-ai.yml` 中的 `on` 部分来调整触发条件。

### 修改提交信息

编辑工作流文件中的 `commit_message` 来自定义提交信息格式。

## 注意事项

- 脚本会自动跳过空变更（没有实际代码变更）
- 使用 `[skip ci]` 标记避免无限循环触发
- 建议定期检查生成的 changelog 内容质量
- 可以随时手动编辑 `CHANGELOG.md` 文件
