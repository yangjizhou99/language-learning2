# GitHub Actions 快速开始指南

## 🚀 5分钟快速设置

### 1. 设置 GitHub Secrets（安全默认策略）

在您的 GitHub 仓库中设置以下 3 个 Secrets：

| Secret 名称             | 获取位置                                                |
| ----------------------- | ------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | Supabase Dashboard → Account → Access Tokens            |
| `STAGING_PROJECT_ID`    | Supabase Dashboard → Staging 项目 → Settings → General  |
| `STAGING_DB_PASSWORD`   | Supabase Dashboard → Staging 项目 → Settings → Database |

**安全策略**: 仅自动部署到 Staging，生产环境手动部署

### 2. 自动设置（推荐）

运行设置脚本：

```bash
# 使用自动设置脚本
./scripts/setup-github-actions.sh

# 或手动验证配置
node scripts/verify-github-actions-setup.js
```

### 3. 手动设置

1. 进入 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions**
2. 点击 **New repository secret** 添加上述 3 个变量

## 🔄 部署流程

```
开发 → PR → 合并到 develop → 自动部署到 Staging
                    ↓
              合并到 main → 手动部署到 Production
```

## 📁 创建的文件

- `.github/workflows/ci.yml` - PR 验证工作流
- `.github/workflows/deploy-staging.yml` - Staging 部署工作流
- `GITHUB_ACTIONS_SETUP_GUIDE.md` - 详细设置指南
- `scripts/setup-github-actions.sh` - 自动设置脚本
- `scripts/verify-github-actions-setup.js` - 配置验证脚本

## ✅ 验证设置

1. 创建测试分支：`git checkout -b test-github-actions`
2. 推送分支：`git push origin test-github-actions`
3. 创建 PR 到 `develop` 分支
4. 检查 GitHub Actions 是否正常运行

## 🆘 需要帮助？

查看详细文档：`GITHUB_ACTIONS_SETUP_GUIDE.md`

---

**注意**: 确保您有 Supabase 项目的适当权限，并且 Access Token 有足够的权限进行数据库操作。
