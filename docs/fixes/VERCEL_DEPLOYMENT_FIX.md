# Vercel 部署修复报告

**日期**: 2025-01-27  
**问题**: Vercel 部署时 pnpm 安装依赖失败  
**错误**: `ERR_INVALID_THIS` 网络连接问题  

## 问题分析

### 错误现象
```
ERR_PNPM_META_FETCH_FAIL  GET https://registry.npmjs.org/@eslint%2Feslintrc: Value of "this" must be of type URLSearchParams
Error: Command "pnpm i --frozen-lockfile=false" exited with 1
```

### 根本原因
1. **网络连接问题**: pnpm 在访问 npm registry 时遇到 `ERR_INVALID_THIS` 错误
2. **依赖安装失败**: 多个包无法从 registry 下载
3. **重试机制失效**: 即使重试多次仍然失败

## 解决方案

### 1. 切换到 npm 包管理器
**原因**: pnpm 在某些环境下可能存在网络连接问题  
**修改**: 将 Vercel 配置从 pnpm 切换到 npm

```json
// vercel.json
{
  "installCommand": "npm ci --prefer-offline --no-audit --no-fund",
  "buildCommand": "npm run build",
  "nodeVersion": "20.x"
}
```

### 2. 添加 .npmrc 配置优化
**目的**: 优化 npm 的网络连接和缓存策略

```ini
# .npmrc
registry=https://registry.npmjs.org/
fetch-retries=5
fetch-retry-mintimeout=20000
fetch-retry-maxtimeout=120000
fetch-timeout=300000
cache-max=86400000
prefer-offline=true
```

### 3. 安装命令优化
**参数说明**:
- `--prefer-offline`: 优先使用本地缓存
- `--no-audit`: 跳过安全审计（加快安装速度）
- `--no-fund`: 跳过资金信息显示

## 修改文件

1. **vercel.json** - 更新安装和构建命令
2. **.npmrc** - 新增 npm 配置文件

## 预期效果

✅ **更稳定的依赖安装** - npm 比 pnpm 在 Vercel 环境下更稳定  
✅ **更快的安装速度** - 优化了缓存和网络配置  
✅ **更好的错误处理** - 增加了重试和超时配置  
✅ **明确的 Node.js 版本** - 指定使用 Node.js 20.x  

## 测试建议

1. 重新触发 Vercel 部署
2. 监控安装过程是否成功
3. 验证构建是否正常完成
4. 检查应用是否正常运行

## 备选方案

如果问题仍然存在，可以考虑：

1. **使用 yarn**: 切换到 yarn 包管理器
2. **锁定依赖版本**: 使用 `package-lock.json` 锁定版本
3. **分步安装**: 将安装过程分解为多个步骤
4. **使用 Vercel 缓存**: 启用 Vercel 的依赖缓存功能

## 相关链接

- [Vercel 部署配置文档](https://vercel.com/docs/build-step)
- [npm 配置选项](https://docs.npmjs.com/cli/v8/using-npm/config)
- [Node.js 版本管理](https://vercel.com/docs/functions/serverless-functions/runtime#node.js)
