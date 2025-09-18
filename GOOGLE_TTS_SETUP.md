# Google TTS 配置指南

## 问题描述

如果遇到错误：`Google TTS 失败，已回退本地合成：Unexpected token '.', "./service-"... is not valid JSON`

这是因为 `GOOGLE_TTS_CREDENTIALS` 环境变量配置不正确导致的。

## 解决方案

### 方案 1：使用服务账号 JSON 文件（本地开发推荐）

1. **创建 Google Cloud 服务账号**：
   - 访问 [Google Cloud Console](https://console.cloud.google.com/)
   - 创建新项目或选择现有项目
   - 启用 Cloud Text-to-Speech API
   - 创建服务账号并下载 JSON 凭据文件

2. **配置凭据文件**：

   ```bash
   # 将下载的 JSON 文件重命名并放到项目根目录
   cp ~/Downloads/your-project-123456-abc123.json ./service-account.json
   ```

3. **配置环境变量**：
   在 `.env.local` 文件中设置：
   ```env
   GOOGLE_TTS_CREDENTIALS=./service-account.json
   GOOGLE_TTS_PROJECT_ID=your-project-id
   ```

### 方案 2：直接使用 JSON 字符串（云端部署推荐）

1. **将 JSON 内容直接放入环境变量**：
   在 `.env.local` 文件中设置：
   ```env
   GOOGLE_TTS_CREDENTIALS={"type":"service_account","project_id":"your-project-id",...}
   GOOGLE_TTS_PROJECT_ID=your-project-id
   ```

## 云端部署配置

### 🚀 Vercel 部署

1. **在 Vercel 控制台中设置环境变量**：
   - 访问您的 Vercel 项目
   - 进入 Settings → Environment Variables
   - 添加以下环境变量：

```env
GOOGLE_TTS_CREDENTIALS={"type":"service_account","project_id":"your-project-id","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"...","universe_domain":"googleapis.com"}
GOOGLE_TTS_PROJECT_ID=your-project-id
```

2. **重要提示**：
   - 在 Vercel 中，`GOOGLE_TTS_CREDENTIALS` 必须设置为完整的 JSON 字符串
   - 不能使用文件路径，因为云端环境无法访问本地文件
   - 确保 JSON 格式正确，所有引号都要转义

### 🌐 其他云平台

#### Docker 部署

```dockerfile
# 在 Dockerfile 中复制凭据文件
COPY service-account.json /app/service-account.json
ENV GOOGLE_TTS_CREDENTIALS=/app/service-account.json
```

#### Kubernetes 部署

```yaml
# 使用 Secret 存储凭据
apiVersion: v1
kind: Secret
metadata:
  name: google-tts-credentials
type: Opaque
data:
  credentials.json: <base64-encoded-json>

---
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: app
          env:
            - name: GOOGLE_TTS_CREDENTIALS
              value: /secrets/credentials.json
          volumeMounts:
            - name: credentials
              mountPath: /secrets
      volumes:
        - name: credentials
          secret:
            secretName: google-tts-credentials
```

## 注意事项

- **安全性**：`service-account.json` 文件包含敏感信息，确保已添加到 `.gitignore`
- **权限**：服务账号需要 Cloud Text-to-Speech API 的访问权限
- **配额**：Google Cloud 有免费配额限制，超出后需要付费
- **云端环境**：生产环境不支持文件路径，必须使用 JSON 字符串

## 故障排除

1. **检查文件是否存在**：

   ```bash
   ls -la service-account.json
   ```

2. **检查文件权限**：

   ```bash
   chmod 600 service-account.json
   ```

3. **验证 JSON 格式**：

   ```bash
   cat service-account.json | jq .
   ```

4. **重启开发服务器**：

   ```bash
   pnpm run dev
   ```

5. **云端部署检查**：
   - 确认环境变量已正确设置
   - 检查 JSON 格式是否正确
   - 验证服务账号权限

## 回退机制

如果 Google TTS 失败，系统会自动回退到浏览器的 Web Speech API 进行本地语音合成。

## 环境检测

代码会自动检测运行环境：

- **本地开发**：支持文件路径和 JSON 字符串
- **云端生产**：仅支持 JSON 字符串，不支持文件路径
