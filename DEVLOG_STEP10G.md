# DEVLOG Step 10G

## What we built

- API: /api/tts/voices（按语言/类型列出 GCP TTS 声音）
- API: /api/tts（Google TTS 合成 MP3，支持 speakingRate/pitch/voiceName）
- UI: Shadowing 页面可选 Voice，优先 Google 合成，失败回退 Web Speech
- Storage: MP3 存入 tts 桶（私有），返回签名 URL

## Notes

- 建议优先 Neural2 声音；Safari/移动端用 MP3 播放最稳
- 服务账号 JSON 放到 GOOGLE_TTS_CREDENTIALS；Vercel 生产环境同样配置
