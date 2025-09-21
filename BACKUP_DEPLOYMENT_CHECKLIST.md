# 备份系统部署检查清单

## 部署前准备

### ✅ NAS 端准备
- [ ] NAS 已安装 Docker 和 Docker Compose
- [ ] NAS 有足够的存储空间（建议至少 100GB）
- [ ] NAS 网络配置正确，端口 7788 可访问
- [ ] 已准备数据库连接串（生产库和开发库）
- [ ] 已生成安全的 API Key（至少 32 位随机字符串）

### ✅ 项目文件准备
- [ ] `backup-worker/` 目录已创建
- [ ] `backup-worker/Dockerfile` 已创建
- [ ] `backup-worker/package.json` 已创建
- [ ] `backup-worker/src/index.js` 已创建
- [ ] `docker-compose.backup.yml` 已创建
- [ ] Next.js 代理路由 `app/api/backup/[...path]/route.ts` 已创建
- [ ] 备份页面 `app/admin/backup/page.tsx` 已创建

## 部署步骤

### 1. NAS 端部署

#### 1.1 上传文件到 NAS
- [ ] 将整个项目上传到 NAS（或 git clone）
- [ ] 确认 `backup-worker/` 目录在 NAS 上存在

#### 1.2 配置 Docker Compose
- [ ] 编辑 `docker-compose.backup.yml` 中的配置：
  - [ ] 修改 `API_KEY` 为安全的随机字符串
  - [ ] 修改 `BACKUP_ROOT` 路径（如需要）
  - [ ] 修改 `ALLOW_PATHS` 为实际允许的路径
  - [ ] 修改 volumes 映射为实际的 NAS 路径
  - [ ] 确认端口 7788 未被占用

#### 1.3 启动容器
```bash
# 在 NAS 终端执行
docker compose -f docker-compose.backup.yml up -d --build
docker compose -f docker-compose.backup.yml ps
```

- [ ] 容器启动成功
- [ ] 容器状态为 "Up"
- [ ] 端口 7788 已映射

#### 1.4 验证 NAS Worker
```bash
curl http://127.0.0.1:7788/healthz
```
- [ ] 返回 `{"ok":true}`

### 2. Next.js 端配置

#### 2.1 环境变量配置
在 `.env.local` 中添加：
```dotenv
BACKUP_WORKER_URL=http://<NAS内网IP>:7788
BACKUP_WORKER_API_KEY=<与NAS容器相同的API_KEY>
BACKUP_CONN_PROD=<生产库连接串>
BACKUP_CONN_DEV=<开发库连接串>
```

- [ ] 环境变量已正确配置
- [ ] API_KEY 与 NAS 容器一致
- [ ] 连接串格式正确

#### 2.2 重启 Next.js 服务
- [ ] 重启开发服务器或重新部署
- [ ] 确认新的环境变量已加载

### 3. 功能测试

#### 3.1 基础连通性测试
- [ ] NAS Worker 健康检查通过
- [ ] Next.js 代理路由可访问
- [ ] 备份页面可访问

#### 3.2 数据库连接测试
- [ ] 生产库连接测试通过
- [ ] 开发库连接测试通过
- [ ] 表列表加载正常

#### 3.3 备份功能测试
- [ ] 选择表备份到 NAS 成功
- [ ] 备份文件在 NAS 目录中出现
- [ ] 下载备份到本地成功
- [ ] 备份日志显示正常

#### 3.4 恢复功能测试（谨慎操作）
- [ ] 在测试库上测试恢复功能
- [ ] 确认恢复操作不会影响生产数据
- [ ] 恢复日志显示正常

## 安全验证

### ✅ 访问控制
- [ ] API Key 已正确配置且安全
- [ ] 生产数据库连接串不在前端暴露
- [ ] 路径白名单配置正确，不包含系统目录
- [ ] 只有授权用户可访问备份页面

### ✅ 网络安全
- [ ] NAS Worker 仅在内网访问
- [ ] 如需要外网访问，已配置 VPN 或 Tailscale
- [ ] 防火墙规则已正确配置

## 监控和维护

### ✅ 日志监控
- [ ] 设置日志轮转，避免日志文件过大
- [ ] 定期检查错误日志
- [ ] 监控备份任务执行状态

### ✅ 存储管理
- [ ] 设置备份文件保留策略
- [ ] 监控 NAS 存储空间使用情况
- [ ] 定期清理过期备份文件

### ✅ 定期测试
- [ ] 每周测试备份功能
- [ ] 每月测试恢复功能（在测试环境）
- [ ] 定期更新 API Key 和密码

## 故障排除

### 常见问题检查
- [ ] 容器是否正常运行：`docker ps`
- [ ] 日志是否有错误：`docker logs backup-worker`
- [ ] 网络连通性：`ping <NAS_IP>`
- [ ] 端口是否开放：`telnet <NAS_IP> 7788`
- [ ] 环境变量是否正确：检查 `.env.local`
- [ ] 数据库连接是否正常：测试连接串

### 紧急恢复
- [ ] 准备手动备份脚本
- [ ] 准备数据库恢复文档
- [ ] 准备联系信息（数据库管理员等）

## 部署完成确认

- [ ] 所有测试通过
- [ ] 备份功能正常工作
- [ ] 恢复功能已验证（测试环境）
- [ ] 安全配置已确认
- [ ] 监控和维护流程已建立
- [ ] 文档已更新

## 联系信息

- 系统管理员：[姓名] [联系方式]
- 数据库管理员：[姓名] [联系方式]
- 网络管理员：[姓名] [联系方式]

---

**部署日期：** _______________  
**部署人员：** _______________  
**验证人员：** _______________
