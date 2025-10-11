# Shadowing 练习功能增强 - 部署指南

本次增强为 Shadowing 练习功能添加了题库列表、录音管理、会话保存和恢复等功能。

## 新增功能

1. **左侧题库列表** - 显示所有可练习的题目，支持筛选和搜索
2. **练习状态管理** - 区分已练习和未练习的题目
3. **录音功能** - 浏览器录音、播放、管理历史录音
4. **会话保存** - 保存草稿和完成状态，包含录音和生词
5. **生词管理** - 选中生词并导入到生词本
6. **随机/顺序练习** - 支持随机选择未练习题目或按顺序练习

## 部署步骤

### 1. 数据库迁移

执行新的数据库迁移文件：

```bash
# 在 Supabase Dashboard 中执行以下 SQL 文件
supabase/migrations/20250120000007_create_shadowing_sessions.sql
```

或通过 Supabase CLI：

```bash
supabase db push
```

### 2. 配置 Supabase Storage

在 Supabase Dashboard > Storage 中：

1. 创建新的 Storage Bucket：
   - 名称：`recordings`
   - Public：`true`（便于播放录音）
   - 文件大小限制：`50MB`
   - 允许的 MIME 类型：`audio/webm, audio/wav, audio/mp3, audio/ogg`

2. 应用存储策略：

```sql
-- 在 Supabase Dashboard > SQL Editor 中执行
-- 内容见 supabase/storage-policies.sql
```

### 3. 文件部署

确保以下新文件已部署到你的项目：

#### API 路由

- `src/app/api/shadowing/catalog/route.ts` - 题库列表API
- `src/app/api/shadowing/session/route.ts` - 会话管理API
- `src/app/api/upload/audio/route.ts` - 录音上传API

#### 组件

- `src/components/AudioRecorder.tsx` - 录音组件

#### 页面

- `src/app/practice/shadowing/page.tsx` - 更新的练习页面

### 4. 验证部署

1. 访问 `/practice/shadowing` 页面
2. 检查左侧是否显示题库列表
3. 选择一个题目进行练习
4. 测试录音功能
5. 测试生词选择和导入功能
6. 测试保存草稿和完成功能

## 主要技术特性

### 数据库设计

`shadowing_sessions` 表结构：

- 记录用户与题目的练习会话
- 支持草稿和完成状态
- 存储录音列表、选中生词、练习时间等
- 实施 RLS 策略保证数据安全

### Storage 设计

- 录音文件按用户ID分文件夹存储
- 支持多种音频格式
- 公开访问便于播放（可选择私有+签名URL）

### 前端设计

- 响应式左右分栏布局
- 可折叠的侧边栏
- 实时状态更新
- 浏览器原生录音API

## 配置选项

### Storage 策略

**公开访问**（当前配置）：

- 优点：简单，录音可直接播放
- 缺点：URL可被猜测访问

**私有访问**（可选）：

- 优点：更安全
- 缺点：需要签名URL，复杂度更高

如需切换到私有访问，在创建bucket时设置为private，并修改 `src/app/api/upload/audio/route.ts` 中的：

```typescript
// 替换 getPublicUrl 为 createSignedUrl
const { data: urlData, error: urlError } = await supabase.storage
  .from('recordings')
  .createSignedUrl(fileName, 3600); // 1小时有效期
```

## 故障排除

### 常见问题

1. **录音功能不工作**
   - 检查浏览器麦克风权限
   - 确保使用 HTTPS 连接
   - 检查浏览器对 MediaRecorder API 的支持

2. **录音上传失败**
   - 检查 Storage bucket 是否正确创建
   - 验证存储策略是否正确应用
   - 检查文件大小是否超出限制

3. **题库列表为空**
   - 确保 `shadowing_items` 表中有数据
   - 检查用户认证状态
   - 验证 RLS 策略配置

4. **会话保存失败**
   - 检查 `shadowing_sessions` 表是否创建
   - 验证外键约束
   - 检查用户权限

### 日志调试

在浏览器开发者工具中查看：

- Console 错误信息
- Network 请求状态
- Application > Storage 查看录音文件

## 下一步优化

1. **语音识别集成** - 添加 Whisper 或其他 ASR 服务
2. **发音评分** - 基于识别结果计算发音准确度
3. **学习进度统计** - 展示练习时长、准确率等数据
4. **社交功能** - 分享录音、对比发音等
5. **离线支持** - PWA 模式支持离线练习

## 技术支持

如遇问题，请检查：

1. Supabase 项目配置
2. 环境变量设置
3. 数据库迁移状态
4. Storage 权限配置
