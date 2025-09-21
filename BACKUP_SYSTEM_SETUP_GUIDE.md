# 备份系统设置指南

本指南将帮助您设置"备份页面 + NAS 备份执行器"系统，支持按表备份、压缩、NAS 落地、下载到本地、从本地文件直接恢复、可选上传百度网盘。

## 系统架构

1. **NAS 端 backup-worker（Docker 容器）**：真正执行 pg_dump / 压缩 / 恢复 / 打包
2. **Next.js 项目内的"备份页面 + 代理路由"**：仅负责下发指令与展示进度/拉取下载流；服务端代理添加 API Key，避免在浏览器暴露密钥

## 安全与路径

- **API 鉴权**：所有到 worker 的请求需 `x-api-key`。Next.js 的 `/api/backup/*` 路由在服务端注入该 header
- **路径白名单**：worker 仅允许操作 `ALLOW_PATHS` 中的 NAS 目录，防止任意读写
- **连接串**：**不要**在浏览器暴露生产库连接串；使用服务端预设的 `connPreset` 替换机制

## 部署步骤

### 1. 在 NAS 上部署执行器

在 NAS 上创建 `docker-compose.backup.yml`：

```yaml
version: "3.8"
services:
  backup-worker:
    build: ./backup-worker     # 若 NAS 上直接 git clone 整个仓库，可用 build。本地打镜像也可改成 image: your/backup-worker:latest
    container_name: backup-worker
    restart: unless-stopped
    environment:
      - API_KEY=请替换为超长随机串
      - BACKUP_ROOT=/data/backups
      - ALLOW_PATHS=/data/audio:/data/questions:/data/backups
      - TZ=Asia/Tokyo
    volumes:
      - /data_s001/data/udata/real/13213047181/project_backups:/data/backups
      - /data_s001/data/udata/real/13213047181/audio:/data/audio
      - /data_s001/data/udata/real/13213047181/questions:/data/questions
    ports:
      - "7788:7788"
```

在 NAS 终端执行：

```bash
docker compose -f docker-compose.backup.yml up -d --build
docker compose -f docker-compose.backup.yml ps
curl http://127.0.0.1:7788/healthz   # 看到 {"ok":true} 即成功
```

### 2. 配置 Next.js 环境变量

在 `.env.local` 中添加：

```dotenv
# NAS 执行器地址（Next.js 服务器可访问到）
BACKUP_WORKER_URL=http://<NAS内网IP或tailscale域>:7788
BACKUP_WORKER_API_KEY=请与NAS容器的API_KEY一致

# 生产/测试库连接串（只在服务端使用，不要放 NEXT_PUBLIC_ 前缀）
BACKUP_CONN_PROD=postgresql://user:password@host:5432/db?sslmode=require
BACKUP_CONN_DEV=postgresql://user:password@localhost:5432/devdb
```

### 3. 快速自检

1. `curl http://<NAS>:7788/healthz` → `{ ok: true }`
2. `curl -H "x-api-key: <你的API_KEY>" "http://<NAS>:7788/db/tables?conn=<PG_URI>"` → 返回表清单
3. 打开 `http(s)://<你的前端域名>/admin/backup`：
   - 点"加载生产库表"看到列表
   - 选择若干表 → "生产库 → NAS 备份" → 日志更新，NAS 对应目录出现文件
   - "生产库 → 本地文件夹"→ 浏览器询问选择目录 → 下载流直写入该文件夹
   - "从本地文件 → 恢复到生产"（小库先试，注意权限/只读会失败）

## 功能特性

### 数据库备份
- 支持按表选择性备份
- 支持自定义格式（custom）和纯 SQL 格式
- 支持 zstd 压缩
- 支持备份到 NAS 或下载到本地

### 数据库恢复
- 支持从本地文件恢复
- 自动识别压缩格式（.zst）
- 自动识别备份格式（.dump 或 .sql）

### 文件备份
- 支持多路径打包
- 使用 tar + zstd 压缩
- 路径白名单安全控制

### 任务管理
- 实时任务状态监控
- 详细日志记录
- 支持任务下载

## 安全注意事项

1. **生产连接串**切勿注入到前端：一律通过 `connPreset` 在服务端代理替换
2. **路径白名单**务必正确配置；不要把 `/` 或系统盘根目录放进 `ALLOW_PATHS`
3. **恢复操作**先在测试库演练；生产环境严格授权
4. **长任务**避免通过 Vercel Edge Functions；一切重活都在 NAS 容器里执行

## 可选项功能

- **定时任务**：在 worker 中加入 `node-cron` 或引入 `supercronic`
- **保留策略**：每日/每周/每月分层保留 + 自动清理
- **加密**：使用 `age` 或 `gpg` 对备份文件加密
- **SSE 实时日志**：把 `/jobs/:id/status` 改成 SSE 推送
- **BaiduPCS-Go**：在容器内登录一次保存凭证，再启用 `target: 'baidunetdisk'`
- **IP 白名单/Tailscale**：将 worker 置于内网或 Tailscale，仅允许来自 Next.js 服务器的访问

## 故障排除

### 常见问题

1. **连接超时**：检查 NAS 网络连接和防火墙设置
2. **权限错误**：检查 `ALLOW_PATHS` 配置和文件权限
3. **备份失败**：检查数据库连接串和 PostgreSQL 客户端安装
4. **恢复失败**：检查目标数据库权限和备份文件完整性

### 日志查看

- Worker 日志：`docker logs backup-worker`
- 任务日志：通过 `/jobs/:id/status` API 查看
- 备份页面：实时显示任务进度和日志

## 维护建议

1. 定期检查备份文件完整性
2. 监控 NAS 存储空间
3. 定期清理过期备份文件
4. 更新 API Key 和密码
5. 测试恢复流程确保可用性
