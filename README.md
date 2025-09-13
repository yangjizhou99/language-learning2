# 🌍 Lang Trainer - 智能语言学习平台

一个基于 AI 的多语言学习平台，支持英语、日语、中文的学习练习，提供多种智能化的学习模式。

## ✨ 核心功能

### 🎯 Shadowing 跟读练习

- **5 级难度递进**：从初学者到高级学习者的完整学习路径
- **AI 智能生成**：自动生成高质量练习内容
- **语音合成**：支持多种 TTS 声音和播放速度
- **智能推荐**：根据学习表现自动推荐合适难度

### 📝 Cloze 挖空练习

- **多语言支持**：英语、日语、中文三种语言
- **智能评分**：AI 容错评分，支持同义词和近义表达
- **管理员审核**：可视化编辑界面，支持内容审核和修改
- **详细反馈**：提供评分理由和改进建议

### 🚀 Alignment 对齐训练

- **6 步递进式训练**：从简单对话到复杂写作的完整训练体系
- **风格定制**：支持正式/非正式、友好/学术等多种风格
- **实用场景**：贴近真实使用场景，学以致用
- **AI 驱动**：自动生成高质量训练内容

### 📚 词汇学习

- **多语言词汇库**：英语、日语、中文词汇资源
- **智能学习**：根据学习进度推荐词汇
- **练习模式**：多种词汇练习方式

## 🛠️ 技术栈

- **前端**：Next.js 15, React 19, TypeScript, Tailwind CSS
- **后端**：Next.js API Routes, Supabase
- **数据库**：PostgreSQL (Supabase)
- **AI 服务**：OpenAI, DeepSeek, Google TTS, 讯飞 TTS
- **部署**：Vercel, Supabase

## 🚀 快速开始

### 环境要求

- Node.js 20+
- pnpm 9+

### 一键设置

```bash
# 克隆项目
git clone <your-repo-url>
cd language-learning2

# 运行设置脚本
npm run setup
# 或
pnpm setup
```

### 手动设置

```bash
# 安装依赖
pnpm install

# 配置环境变量
cp env.example .env.local
# 编辑 .env.local 文件，配置您的环境变量

# 启动开发服务器
pnpm dev
```

### 访问应用

- 开发环境：http://localhost:3000
- 管理员界面：http://localhost:3000/admin

## 📁 项目结构

```
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── admin/             # 管理员界面
│   │   ├── api/               # API 路由
│   │   ├── practice/          # 练习页面
│   │   └── auth/              # 认证页面
│   ├── components/            # React 组件
│   ├── contexts/              # React Context
│   ├── hooks/                 # 自定义 Hooks
│   ├── lib/                   # 工具库
│   └── types/                 # TypeScript 类型定义
├── docs/                      # 项目文档
│   ├── features/              # 功能文档
│   ├── setup/                 # 安装配置文档
│   └── development/           # 开发文档
├── supabase/                  # 数据库迁移文件
└── data/                      # 静态数据
    └── lexicon/               # 词汇数据
```

## 🎮 使用指南

### 学员使用

1. 访问练习页面选择学习模式
2. 根据系统推荐选择合适难度
3. 完成练习并查看详细反馈
4. 跟踪学习进度和表现

### 管理员使用

1. 访问 `/admin` 进入管理界面
2. 使用 AI 生成功能创建练习内容
3. 审核和编辑生成的内容
4. 管理题库和用户数据

## 🔧 开发指南

### 添加新功能

1. 在 `src/app/` 下创建页面
2. 在 `src/components/` 下创建组件
3. 在 `src/lib/` 下添加工具函数
4. 更新 `src/types/` 中的类型定义

### 数据库迁移

```bash
# 运行迁移
supabase db push
```

### 代码检查

```bash
npm run lint
```

## 📚 文档

- [功能文档](./docs/features/) - 详细的功能说明
- [安装配置](./docs/setup/) - 环境配置和部署指南
- [开发文档](./docs/development/) - 开发相关文档

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

**Lang Trainer** - 让语言学习更智能、更高效！ 🚀
