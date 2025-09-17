# 如何获取 Staging 项目信息

## 📍 STAGING_PROJECT_ID 和 STAGING_DB_PASSWORD 获取位置

### 方法1：通过 Supabase Dashboard 网页界面

#### 1. 获取 STAGING_PROJECT_ID

1. **登录 Supabase Dashboard**
   - 访问 [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - 使用您的账户登录

2. **选择 Staging 项目**
   - 在项目列表中点击您的 Staging 项目
   - 如果还没有 Staging 项目，需要先创建一个

3. **进入项目设置**
   - 点击左侧菜单中的 **Settings**
   - 选择 **General** 标签

4. **找到 Reference ID**
   - 在 **Project Configuration** 部分
   - 找到 **Reference ID** 字段
   - 复制这个 ID（格式类似：`abcdefghijklmnop`）

#### 2. 获取 STAGING_DB_PASSWORD

1. **在同一个 Staging 项目中**
   - 确保您已经在 Staging 项目页面

2. **进入数据库设置**
   - 点击左侧菜单中的 **Settings**
   - 选择 **Database** 标签

3. **找到数据库密码**
   - 在 **Connection string** 部分
   - 找到密码字段（通常显示为 `[YOUR-PASSWORD]`）
   - 如果密码被隐藏，点击 **Reset database password** 生成新密码

### 方法2：通过 Supabase CLI

如果您已经配置了 Supabase CLI，可以使用以下命令：

```bash
# 列出所有项目
supabase projects list

# 查看项目详情
supabase projects list --output json
```

### 方法3：通过项目 URL

您也可以从项目 URL 中获取 Project ID：

```
https://supabase.com/dashboard/project/[PROJECT_ID]
```

例如：`https://supabase.com/dashboard/project/abcdefghijklmnop`
其中 `abcdefghijklmnop` 就是您的 PROJECT_ID。

## 🔍 详细步骤截图说明

### 获取 PROJECT_ID 的详细步骤：

1. **登录并选择项目**
   ```
   Supabase Dashboard → 选择 Staging 项目
   ```

2. **进入设置页面**
   ```
   左侧菜单 → Settings → General
   ```

3. **找到 Reference ID**
   ```
   Project Configuration 部分 → Reference ID
   ```

### 获取数据库密码的详细步骤：

1. **进入数据库设置**
   ```
   左侧菜单 → Settings → Database
   ```

2. **查看连接信息**
   ```
   Connection string 部分 → 密码字段
   ```

3. **重置密码（如果需要）**
   ```
   点击 "Reset database password" 按钮
   ```

## ⚠️ 重要注意事项

### 安全提醒
- **不要**将密码提交到代码仓库
- **不要**在公开场所分享这些敏感信息
- 定期轮换数据库密码

### 权限要求
- 确保您有项目的 **Owner** 或 **Admin** 权限
- 如果无法访问设置页面，请联系项目管理员

### 密码重置
- 重置密码后，需要更新所有使用该密码的配置
- 包括 GitHub Secrets 和本地环境变量

## 🧪 验证获取的信息

获取到信息后，可以使用以下命令验证：

```bash
# 测试连接（替换为您的实际值）
supabase link --project-ref YOUR_STAGING_PROJECT_ID --password YOUR_STAGING_DB_PASSWORD

# 如果连接成功，会显示项目信息
supabase projects list
```

## 📝 设置 GitHub Secrets

获取到信息后，在 GitHub 仓库中设置：

1. **进入 GitHub 仓库**
   - 点击 **Settings** 标签
   - 选择 **Secrets and variables** → **Actions**

2. **添加 Secrets**
   - 点击 **New repository secret**
   - 添加以下 3 个变量：
     - `SUPABASE_ACCESS_TOKEN`
     - `STAGING_PROJECT_ID`
     - `STAGING_DB_PASSWORD`

## 🆘 常见问题

### Q: 找不到 Reference ID？
A: 确保您有项目的管理员权限，并且选择的是正确的项目。

### Q: 数据库密码显示为星号？
A: 点击 "Reset database password" 生成新密码。

### Q: 连接测试失败？
A: 检查 Project ID 和密码是否正确，确保网络连接正常。

### Q: 没有 Staging 项目？
A: 需要先在 Supabase Dashboard 中创建一个新项目作为 Staging 环境。

---

**提示**: 如果您在获取这些信息时遇到任何问题，请参考 Supabase 官方文档或联系技术支持。
