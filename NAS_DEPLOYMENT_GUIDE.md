# NAS 部署快速指南

## 部署前检查

### 1. 确认 NAS 环境
- ✅ Docker 已安装
- ✅ Docker Compose 已安装
- ✅ 网络端口 7788 可用
- ✅ 足够的存储空间（建议 100GB+）

### 2. 准备文件
所有文件已在项目中准备就绪：
- `backup-worker/` - Docker 容器源码
- `docker-compose.backup.yml` - 容器编排文件
- Next.js 代理路由和备份页面

## 部署步骤

### 1. 上传项目到 NAS

**方法 A: Git Clone（推荐）**
```bash
# 在 NAS 上执行
git clone <你的仓库地址>
cd language-learning2
```

**方法 B: 文件传输**
- 将整个项目文件夹上传到 NAS
- 确保所有文件权限正确

### 2. 修改 Docker Compose 配置

编辑 `docker-compose.backup.yml`：

```yaml
version: "3.8"
services:
  backup-worker:
    build: ./backup-worker
    container_name: backup-worker
    restart: unless-stopped
    environment:
      # 🔑 重要：修改为安全的随机 API Key
      - API_KEY=your-super-secure-api-key-here-32-chars-min
      - BACKUP_ROOT=/data/backups
      # 🛡️ 重要：设置允许的路径，不要包含系统目录
      - ALLOW_PATHS=/data/audio:/data/questions:/data/backups
      - TZ=Asia/Shanghai
    volumes:
      # 📁 重要：修改为 NAS 实际路径
      - /your-nas-path/project_backups:/data/backups
      - /your-nas-path/audio:/data/audio
      - /your-nas-path/questions:/data/questions
    ports:
      - "7788:7788"
```

### 3. 生成安全的 API Key

```bash
# 在 NAS 上生成随机 API Key
openssl rand -hex 32
# 或者使用在线生成器生成 32+ 字符的随机字符串
```

### 4. 启动容器

```bash
# 在 NAS 项目目录下执行
docker compose -f docker-compose.backup.yml up -d --build

# 检查容器状态
docker compose -f docker-compose.backup.yml ps

# 查看日志
docker logs backup-worker
```

### 5. 验证部署

```bash
# 健康检查
curl http://localhost:7788/healthz
# 应该返回: {"ok":true}

# 测试 API 鉴权
curl -H "x-api-key: your-api-key" http://localhost:7788/healthz
# 应该返回: {"ok":true}
```

## 配置 Next.js 环境变量

在您的 `.env.local` 或生产环境变量中添加：

```dotenv
# NAS 执行器配置
BACKUP_WORKER_URL=http://<NAS内网IP>:7788
BACKUP_WORKER_API_KEY=your-super-secure-api-key-here-32-chars-min

# 数据库连接（使用您现有的配置）
BACKUP_CONN_PROD=postgresql://postgres.yyfyieqfuwwyqrlewswu:yjzyjz925151560@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres
BACKUP_CONN_DEV=postgres://postgres:postgres@127.0.0.1:54322/postgres
```

## 网络安全配置

### 1. 防火墙设置
```bash
# 允许端口 7788 的访问（仅内网）
iptables -A INPUT -p tcp --dport 7788 -s 192.168.0.0/16 -j ACCEPT
iptables -A INPUT -p tcp --dport 7788 -j DROP
```

### 2. 使用 Tailscale（推荐）
```bash
# 安装 Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# 启动服务
sudo tailscale up

# 获取 Tailscale IP
tailscale ip -4
```

然后使用 Tailscale IP 配置 `BACKUP_WORKER_URL`。

## 测试完整功能

### 1. 基础连通性测试
```bash
# 使用测试脚本
node test-backup-system.js
```

### 2. 功能测试
1. 访问备份页面：`https://your-domain.com/admin/backup`
2. 点击"加载生产库表"
3. 选择若干表
4. 测试"生产库 → NAS 备份"
5. 检查 NAS 备份目录是否有文件生成

### 3. 恢复测试（谨慎）
1. 在测试环境先验证
2. 使用小数据集测试
3. 确认恢复流程正确

## 监控和维护

### 1. 日志监控
```bash
# 查看容器日志
docker logs -f backup-worker

# 查看备份日志
ls /data/backups/logs/
tail -f /data/backups/logs/latest.log
```

### 2. 存储监控
```bash
# 检查磁盘使用
df -h

# 检查备份文件
ls -la /data/backups/db/
ls -la /data/backups/files/
```

### 3. 定期维护
- 每周检查备份文件完整性
- 每月清理过期备份
- 定期更新 API Key
- 监控系统资源使用

## 故障排除

### 常见问题

1. **容器启动失败**
   ```bash
   docker logs backup-worker
   # 检查错误信息
   ```

2. **API 鉴权失败**
   ```bash
   # 检查 API Key 是否一致
   echo $BACKUP_WORKER_API_KEY
   ```

3. **数据库连接失败**
   ```bash
   # 测试数据库连接
   psql "your-connection-string"
   ```

4. **路径权限问题**
   ```bash
   # 检查目录权限
   ls -la /data/backups/
   chmod 755 /data/backups/
   ```

### 紧急恢复

如果备份系统出现问题：
1. 检查容器状态：`docker ps`
2. 重启容器：`docker restart backup-worker`
3. 检查网络连通性
4. 查看详细日志

## 安全建议

1. **定期更新 API Key**
2. **限制网络访问**（仅内网或 Tailscale）
3. **监控异常访问**
4. **备份系统本身**（配置文件、脚本等）
5. **测试恢复流程**（确保备份可用）

## 联系信息

- 系统管理员：[您的联系方式]
- 数据库管理员：[联系方式]
- 紧急联系：[联系方式]

---

**部署日期**: _______________  
**部署人员**: _______________  
**验证人员**: _______________
