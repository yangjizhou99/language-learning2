# GitHub Actions 自动化部署设置指南

本指南将帮助您设置 GitHub Actions 来自动化 Supabase 迁移的部署流程。

## 部署流程概述

```
本地开发 → 生成迁移 → PR → 合并到 develop → 自动推到 staging
                                    ↓
合并到 main → 自动推到 production
```

## 1. GitHub Secrets 配置

在您的 GitHub 仓库中，需要设置以下 3 个 Secrets（安全默认策略）：

### 1.1 访问 GitHub Secrets 设置
1. 进入您的 GitHub 仓库
2. 点击 **Settings** 标签
3. 在左侧菜单中找到 **Secrets and variables** → **Actions**
4. 点击 **New repository secret** 添加以下变量：

### 1.2 需要添加的 Secrets

| Secret 名称 | 描述 | 获取方式 |
|------------|------|----------|
| `SUPABASE_ACCESS_TOKEN` | Supabase 个人访问令牌 | 在 Supabase Dashboard → Account → Access Tokens 中生成 |
| `STAGING_PROJECT_ID` | Staging 环境项目 ID | 在 Supabase Dashboard 的 Staging 项目设置中找到 |
| `STAGING_DB_PASSWORD` | Staging 环境数据库密码 | 在 Supabase Dashboard → Settings → Database 中找到 |

### 1.3 安全策略说明
- **自动部署**: 仅限 Staging 环境
- **生产部署**: 手动执行，确保安全控制
- **优势**: 避免 CI 误操作生产环境，手动把关生产部署

### 1.3 获取 Supabase Access Token
1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 点击右上角头像 → **Account**
3. 在左侧菜单中点击 **Access Tokens**
4. 点击 **Generate new token**
5. 输入描述（如 "GitHub Actions"）
6. 复制生成的令牌并保存到 GitHub Secrets

## 2. 工作流文件说明

### 2.1 CI 验证工作流 (`.github/workflows/ci.yml`)
- **触发条件**: 创建 Pull Request 到 `develop` 或 `main` 分支
- **功能**: 在本地环境中验证迁移是否能正常应用
- **步骤**:
  1. 启动 Supabase 本地环境
  2. 应用所有迁移
  3. 验证迁移成功应用

### 2.2 Staging 部署工作流 (`.github/workflows/deploy-staging.yml`)
- **触发条件**: 代码推送到 `develop` 分支
- **功能**: 自动将迁移部署到 Staging 环境
- **步骤**:
  1. 连接到 Staging 项目
  2. 推送迁移到 Staging 数据库
  3. 验证部署成功

### 2.3 生产环境手动部署
- **部署方式**: 本地手动执行
- **命令**: `supabase link && supabase db push`
- **优势**: 完全控制生产部署，避免误操作

## 3. 分支策略建议

### 3.1 推荐的分支结构
```
main (production)
├── develop (staging)
    ├── feature/new-feature
    ├── feature/bug-fix
    └── hotfix/critical-fix
```

### 3.2 工作流程
1. **开发新功能**: 从 `develop` 创建功能分支
2. **创建 PR**: 将功能分支合并到 `develop`
3. **自动部署**: 合并到 `develop` 后自动部署到 Staging
4. **生产发布**: 将 `develop` 合并到 `main` 后，**手动**部署到 Production

## 4. 安全注意事项

### 4.1 Secrets 安全
- 永远不要在代码中硬编码敏感信息
- 定期轮换 Access Token
- 使用最小权限原则设置 Token 权限

### 4.2 部署权限
- 确保只有授权人员可以合并到 `main` 分支
- 考虑使用分支保护规则
- 对于生产部署，建议添加人工审批步骤

## 5. 故障排除

### 5.1 常见问题
1. **Secrets 未设置**: 检查 GitHub Secrets 是否正确配置
2. **权限不足**: 确认 Access Token 有足够权限
3. **项目 ID 错误**: 验证项目 ID 是否正确
4. **密码错误**: 确认数据库密码是否正确

### 5.2 调试步骤
1. 查看 GitHub Actions 日志
2. 在本地测试 Supabase CLI 命令
3. 验证项目连接状态

## 6. 高级配置

### 6.1 添加人工审批（可选）
对于生产部署，可以添加人工审批步骤：

```yaml
- name: Manual approval for production
  uses: trstringer/manual-approval@v1
  with:
    secret: ${{ github.TOKEN }}
    approvers: your-username
    minimum-approvals: 1
    issue-title: "Production Deployment Approval"
    issue-body: "Please review and approve this production deployment"
```

### 6.2 添加通知（可选）
可以添加 Slack、Discord 或其他通知方式：

```yaml
- name: Notify deployment success
  uses: 8398a7/action-slack@v3
  with:
    status: success
    text: "Deployment to production completed successfully!"
```

## 7. 验证设置

### 7.1 测试 CI 工作流
1. 创建一个测试分支
2. 对迁移文件进行小修改
3. 创建 PR 到 `develop` 分支
4. 检查 GitHub Actions 是否正常运行

### 7.2 测试部署工作流
1. 将测试分支合并到 `develop`
2. 检查 Staging 部署是否成功
3. 将 `develop` 合并到 `main`
4. 检查 Production 部署是否成功

## 8. 监控和维护

### 8.1 定期检查
- 监控 GitHub Actions 运行状态
- 检查部署日志
- 验证数据库迁移状态

### 8.2 更新维护
- 定期更新 Supabase CLI 版本
- 检查工作流文件是否需要更新
- 审查和更新 Secrets

---

设置完成后，您的项目将拥有完整的自动化部署流程，确保数据库迁移的安全和可靠部署。
