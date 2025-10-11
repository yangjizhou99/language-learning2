# 科大讯飞TTS集成配置说明

## 环境变量配置

**重要：您需要手动创建 `.env.local` 文件并添加以下环境变量：**

1. 在项目根目录创建 `.env.local` 文件
2. 复制 `env.example.bak` 的内容到 `.env.local`
3. 确保包含以下科大讯飞配置：

```bash
# 科大讯飞TTS配置
XUNFEI_APP_ID=bbec0feb
XUNFEI_API_KEY=d5a9fa257bb80840ca029afc6eba47ed
XUNFEI_API_SECRET=OTdmODQzNzIyNGYyNmMyNDk1NDI4ZjFh
```

**注意：** 这些是您提供的真实API密钥，请确保 `.env.local` 文件在 `.gitignore` 中，不要提交到版本控制。

## 音色列表

科大讯飞提供以下5个音色：

| 音色名称   | 显示名称   | 性别 | 描述                 |
| ---------- | ---------- | ---- | -------------------- |
| x4_xiaoyan | 讯飞小燕   | 女声 | 普通话女声，自然清晰 |
| x4_yezi    | 讯飞小露   | 女声 | 普通话女声，温柔甜美 |
| aisjiuxu   | 讯飞许久   | 男声 | 普通话男声，沉稳专业 |
| aisjinger  | 讯飞小婧   | 女声 | 普通话女声，活泼可爱 |
| aisbabyxu  | 讯飞许小宝 | 男声 | 普通话男声，年轻活力 |

## 使用方法

1. **同步音色到数据库**：
   - 在音色管理器中点击"同步科大讯飞"按钮
   - 系统会自动将5个科大讯飞音色添加到数据库中

2. **音色分类**：
   - 科大讯飞音色会按性别自动分类
   - 女声：Xunfei-Female
   - 男声：Xunfei-Male

3. **TTS合成**：
   - 科大讯飞音色支持WebSocket流式合成
   - 支持语速、音量、音调调节
   - 默认参数：语速50、音量50、音调50

## API端点

- `GET /api/admin/shadowing/xunfei-voices` - 获取科大讯飞音色列表
- `POST /api/admin/shadowing/sync-xunfei-voices` - 同步科大讯飞音色到数据库
- `POST /api/admin/shadowing/synthesize-xunfei` - 科大讯飞TTS合成

## 注意事项

1. **服务量限制**：科大讯飞TTS有服务量限制，请合理使用
2. **网络要求**：需要稳定的网络连接以支持WebSocket通信
3. **音质**：科大讯飞音色专门针对中文优化，中文效果较好
4. **费用**：科大讯飞TTS按使用量计费，请注意控制成本

## 故障排除

如果遇到问题，请检查：

1. 环境变量是否正确配置
2. 网络连接是否正常
3. 科大讯飞账户是否有足够的服务量
4. 控制台是否有错误信息
