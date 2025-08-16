# DEVLOG Step 5

## What we built
- API: /api/generate/shadowing
- Page: /practice/shadowing （TTS + 录音 + 上传）
- Storage: recordings（Private）+ RLS（仅本人 uid/ 前缀可读写）
- Page: /review （近 7 天复盘）

## How to run
- Supabase 控制台创建 recordings 桶（Private）
- 执行 RLS 策略 SQL
- pnpm dev → /practice/shadowing, /review

## Screenshots
- public/step5-shadowing.png
- public/step5-review.png

## Notes / Issues
- 若签名 URL 过期可在复盘页再签发（后续可做：点击“刷新链接”）
- Safari 录音格式兼容性较差，推荐 Chrome
