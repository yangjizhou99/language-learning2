# DEVLOG Step 2 (DeepSeek)

## What we built

- API: /api/generate/cloze (DeepSeek Chat Completions)
- Page: /practice/cloze
- Home link to Cloze
- .env.example with DEEPSEEK_API_KEY

## How to run

- pnpm dev
- http://localhost:3000/practice/cloze

## Notes / Issues

- 若 LLM 返回非严格 JSON，我们已做回退解析
- DeepSeek baseURL 与模型名见官方文档（links in code comments）
- 使用 deepseek-reasoner 模型提高生成质量
