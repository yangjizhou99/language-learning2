# Shadowing 等级系统部署检查清单

## 🚀 部署前检查

### 1. 环境变量配置
- [ ] `OPENROUTER_API_KEY` - OpenRouter API密钥
- [ ] `DEEPSEEK_API_KEY` - DeepSeek API密钥
- [ ] `OPENAI_API_KEY` - OpenAI API密钥
- [ ] `GOOGLE_TTS_CREDENTIALS` - Google TTS凭据（JSON字符串或文件路径）
- [ ] `GOOGLE_TTS_PROJECT_ID` - Google Cloud项目ID
- [ ] `SUPABASE_SERVICE_KEY` - Supabase服务密钥
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Supabase项目URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase匿名密钥

### 2. 数据库设置
- [ ] 运行数据库迁移脚本：`supabase/migrations/20250120000002_create_shadowing_tables.sql`
- [ ] 确认 `shadowing_items` 表创建成功
- [ ] 确认 `shadowing_attempts` 表创建成功
- [ ] 验证行级安全策略（RLS）已启用
- [ ] 确认索引已创建

### 3. 存储配置
- [ ] 在Supabase Storage中创建 `audio` 桶
- [ ] 设置适当的存储策略
- [ ] 确认存储桶可公开访问（或配置正确的CORS策略）

## 🔧 部署步骤

### 1. 数据库迁移
```sql
-- 在Supabase控制台执行
\i supabase/migrations/20250120000002_create_shadowing_tables.sql
```

### 2. 重启应用服务
```bash
# 如果使用PM2
pm2 restart your-app-name

# 如果使用Docker
docker-compose restart

# 如果使用Vercel/Netlify，会自动重新部署
```

### 3. 验证部署
- [ ] 访问 `/practice/shadowing` 确认练习页面正常加载
- [ ] 访问 `/admin/shadowing/ai` 确认管理员页面正常加载
- [ ] 检查浏览器控制台是否有错误

## 🧪 功能测试

### 1. 学生端功能测试
- [ ] 语言切换功能正常
- [ ] 等级选择器显示正确
- [ ] 推荐等级自动获取
- [ ] 获取下一题功能正常
- [ ] 录音功能正常
- [ ] 语音识别功能正常
- [ ] 练习结果记录功能正常

### 2. 管理员端功能测试
- [ ] AI生成题库功能正常
- [ ] TTS音频合成功能正常
- [ ] 题库保存功能正常
- [ ] 批量操作功能正常

### 3. API接口测试
- [ ] `/api/shadowing/recommended` - 获取推荐等级
- [ ] `/api/shadowing/next` - 获取下一题
- [ ] `/api/shadowing/attempts` - 记录练习结果
- [ ] `/api/admin/shadowing/generate` - AI生成题库
- [ ] `/api/admin/shadowing/synthesize` - 合成音频
- [ ] `/api/admin/shadowing/save` - 保存到题库

## 🐛 常见问题排查

### 1. 数据库连接问题
```bash
# 检查Supabase连接
curl -X GET "https://your-project.supabase.co/rest/v1/" \
  -H "apikey: your-anon-key"
```

### 2. TTS服务问题
```bash
# 检查Google TTS凭据
echo $GOOGLE_TTS_CREDENTIALS | jq '.project_id'
```

### 3. AI服务问题
```bash
# 测试OpenRouter API
curl -X POST "https://openrouter.ai/api/v1/chat/completions" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}'
```

### 4. 存储问题
```bash
# 检查Supabase Storage
curl -X GET "https://your-project.supabase.co/storage/v1/bucket/audio" \
  -H "apikey: your-anon-key"
```

## 📊 性能监控

### 1. 关键指标
- [ ] API响应时间 < 2秒
- [ ] TTS合成时间 < 10秒
- [ ] 页面加载时间 < 3秒
- [ ] 音频播放延迟 < 1秒

### 2. 资源使用
- [ ] 数据库连接数正常
- [ ] 存储空间充足
- [ ] API调用频率在限制内
- [ ] 内存使用正常

## 🔒 安全检查

### 1. 认证授权
- [ ] 所有API接口都有适当的认证
- [ ] 管理员功能有权限控制
- [ ] 用户数据隔离正确

### 2. 数据保护
- [ ] 敏感信息不暴露在前端
- [ ] API密钥安全存储
- [ ] 用户数据加密传输

## 📝 部署后配置

### 1. 初始题库生成
1. 访问 `/admin/shadowing/ai`
2. 为每种语言和等级生成基础题库
3. 建议每个等级至少生成10-20条题目

### 2. 用户引导
1. 更新用户手册
2. 添加功能说明
3. 提供使用教程

### 3. 监控告警
1. 设置API错误监控
2. 配置存储空间告警
3. 监控用户使用情况

## 🚨 紧急回滚

如果部署后出现问题，可以快速回滚：

### 1. 数据库回滚
```sql
-- 删除新创建的表
DROP TABLE IF EXISTS shadowing_attempts;
DROP TABLE IF EXISTS shadowing_items;
```

### 2. 代码回滚
```bash
# 回滚到上一个版本
git revert HEAD
git push origin main
```

### 3. 环境变量回滚
- 恢复之前的环境变量配置
- 重启应用服务

## ✅ 部署完成检查

- [ ] 所有功能测试通过
- [ ] 性能指标达标
- [ ] 安全检查通过
- [ ] 用户反馈正常
- [ ] 监控告警配置完成
- [ ] 文档更新完成
- [ ] 团队培训完成

## 📞 技术支持

如遇到部署问题，请：
1. 查看应用日志
2. 检查错误监控
3. 参考故障排除指南
4. 联系技术支持团队

---

**部署日期**: ___________  
**部署人员**: ___________  
**检查人员**: ___________  
**状态**: ⭕ 待部署 / ✅ 已完成 / ❌ 失败
