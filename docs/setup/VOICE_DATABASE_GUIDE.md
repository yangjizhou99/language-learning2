# 音色数据库管理指南

## 概述

现在音色数据已经存储在数据库中，这样可以：
- 提高加载速度（不需要每次都调用Google Cloud TTS API）
- 支持离线查看音色列表
- 提供音色同步功能

## 数据库表结构

### voices 表
- `id`: 音色唯一标识
- `name`: 音色名称（如 cmn-CN-Chirp3-HD-Achernar）
- `display_name`: 显示名称（如 Chirp3-HD-Achernar (女声)）
- `language_code`: 语言代码（如 cmn-CN, en-US, ja-JP）
- `ssml_gender`: 性别（MALE/FEMALE）
- `natural_sample_rate_hertz`: 采样率
- `pricing`: 定价信息（JSON）
- `characteristics`: 音色特征（JSON）
- `category`: 分类（Chirp3HD, Neural2, Wavenet, Standard, Other）
- `is_active`: 是否激活
- `created_at`: 创建时间
- `updated_at`: 更新时间

## 使用方法

### 1. 首次使用
1. 访问 `/admin/test-voices` 页面
2. 点击"同步音色"按钮
3. 等待同步完成（会从Google Cloud TTS获取所有中英日音色）
4. 同步完成后，音色数据将存储在数据库中

### 2. 日常使用
1. 在音色管理器中，点击"刷新列表"从数据库获取音色
2. 如需更新音色数据，点击"同步音色"重新从Google Cloud TTS同步

### 3. API 端点

#### 同步音色
```
POST /api/admin/shadowing/sync-voices
```
- 从Google Cloud TTS获取所有音色并存储到数据库
- 需要管理员权限

#### 获取音色
```
GET /api/admin/shadowing/voices-db?lang=all&category=all
```
- 从数据库获取音色列表
- 支持语言筛选：`lang=cmn-CN|en-US|ja-JP|all`
- 支持分类筛选：`category=Chirp3HD|Neural2|Wavenet|Standard|Other|all`

## 优势

1. **性能提升**: 从数据库获取音色比调用Google Cloud TTS API快得多
2. **离线支持**: 即使没有网络连接，也能查看已同步的音色
3. **数据一致性**: 所有音色信息都经过标准化处理
4. **灵活筛选**: 支持按语言、分类等多维度筛选

## 注意事项

1. 首次使用需要先同步音色数据
2. 同步过程可能需要几分钟时间（取决于网络速度）
3. 音色数据会定期更新，建议定期同步
4. 需要管理员权限才能执行同步操作

## 故障排除

### 同步失败
- 检查Google Cloud TTS配置是否正确
- 确保有管理员权限
- 检查网络连接

### 音色数据不完整
- 重新执行同步操作
- 检查数据库连接是否正常

### 音色显示异常
- 检查音色数据格式是否正确
- 查看浏览器控制台错误信息
