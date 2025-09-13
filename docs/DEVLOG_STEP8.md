# DEVLOG Step 8

## What we built
- Pages: /auth, /auth/callback
- Component: TopNav（显示登录态）
- Flows: Email+Password、Magic Link、OAuth(Google/GitHub)
- Upgrade: 匿名账号 -> 正式账号（updateUser 保持同一 user_id）

## How to run
- Supabase Auth: 启用 Email；配置 Site URL 与 Allowed Redirect URLs；（可选）配置 Google/GitHub Provider
- 本地：pnpm dev → /auth
- 生产：设置同样的回调 URL，再触发重新部署

## Notes
- 若开启 Confirm Email，注册后需完成邮箱验证才能登录
- 登出后自动匿名登录，RLS 持续有效
