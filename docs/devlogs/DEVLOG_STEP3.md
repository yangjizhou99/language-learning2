# DEVLOG Step 3

## What we built

- API: /api/generate/sft-task (DeepSeek, model-select)
- API: /api/eval (DeepSeek, model-select)
- Page: /practice/sft
- Home link updated

## How to run

1. Set DEEPSEEK_API_KEY in .env.local
2. pnpm dev
3. Visit http://localhost:3000/practice/sft

## Screenshots

- public/step3-sft.png (see below)

## Notes / Issues

- Successfully handles non-JSON responses with fallback parsing
- Scores normalized to 1..5 range with overall average
- Supports both deepseek-chat and deepseek-reasoner models
- Tested with Japanese and English prompts
- Example evaluation output:
  ```json
  {
    "scores": { "Task": 1, "Naturalness": 2, "Tone": 2 },
    "feedback": "問題：挨拶が短すぎて丁寧さに欠ける。提案：より丁寧な挨拶を使用する。",
    "rewrite_best": "拝啓　春の訪れを感じる今日この頃、いかがお過ごしでしょうか。",
    "overall": 1.7
  }
  ```
