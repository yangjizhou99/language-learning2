# 音频代理与缓存说明（追加）

## 概览

- 统一通过 `api/storage-proxy` 读取 Supabase Storage 文件。
- 按类型下发缓存头：音频/图片 30 天 immutable；文档 1 天。
- 支持 Range/206 分段传输，浏览器拖动播放更流畅，带宽更省。
- 兼容公开/私有桶：服务端生成短期签名 URL 拉取，上层代理缓存对前端透明。

## 前端使用规范

- 一律使用服务端返回的 `audio_url` 播放（已是代理 URL）。

```tsx
<audio src={audio_url} controls preload="metadata" />
```

- 组件可直接使用 `OptimizedAudio`：

```tsx
<OptimizedAudio src={audio_url} controls />
```

## 代理路由

- 路径：`/api/storage-proxy?path=<filePath>&bucket=<bucket>`
- 关键行为：
  - 透传 Range 请求头，按需返回 200/206；
  - 透传 `Content-Range / Accept-Ranges / ETag / Last-Modified`；
  - 统一设置 `Cache-Control`（音频 30 天 immutable + s-maxage）。

## 验证方法

- 全量：

```bash
curl -I "http://localhost:3000/api/storage-proxy?path=tts/zh/example.mp3"
```

- 分段（206）：

```bash
curl -I -H "Range: bytes=1000-2000" "http://localhost:3000/api/storage-proxy?path=tts/zh/example.mp3"
```

- 期望：`cache-control: public, s-maxage=2592000, max-age=2592000, immutable` 且返回 206 含 `Content-Range`。

## 常见问题

- 看到 404：确认 `bucket` 与 `path` 是否正确（`path` 不要以 `/` 开头）。
- 看到 400：多为参数缺失或路径不合法（含 `..`）。
- 缓存未生效：检查 `next.config.ts` 中是否仍对 `/api/storage-proxy` 强制设置了固定缓存头（应由代理动态设置）。
- CORS：代理已下发 `Access-Control-Allow-Origin: *`，跨域直链访问时也应正常。

## 迁移建议

- 前端、管理端统一改为使用 `audio_url`；不要再拼接 Supabase 直链或签名链。
- 新上传通过 `src/lib/storage-upload.ts`，优先消费 `proxyUrl`。

## 后续增强（可选）

- 按需添加 HEAD 支持用于探测时长/字节范围；
- 在代理加鉴权（读取用户态 token），对敏感资源做访问控制；
- 引入全局 CDN（如 Cloudflare）托管代理层缓存。
