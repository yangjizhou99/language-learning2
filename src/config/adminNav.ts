export type AdminNavItem = {
  href: string;
  label: string;
  icon?: string;
  match?: "exact" | "startsWith";
  hidden?: boolean;
};

export type AdminNavSection = {
  title: string;
  items: AdminNavItem[];
};

// 保持 SSR/CSR 一致，避免 hydration mismatch
const showDebug = process.env.NEXT_PUBLIC_SHOW_DEBUG === "1";

export const ADMIN_SECTIONS: AdminNavSection[] = [
  {
    title: "内容",
    items: [
      { href: "/admin", label: "控制台", icon: "🏠", match: "exact" },
      { href: "/admin/banks", label: "题库总览", icon: "📚", match: "startsWith" },
      { href: "/admin/articles", label: "题库管理", icon: "📝", match: "startsWith" },
      { href: "/admin/drafts", label: "草稿箱", icon: "📋", match: "startsWith" },
    ],
  },
        {
          title: "用户管理",
          items: [
            { href: "/admin/users", label: "用户列表", icon: "👥", match: "startsWith" },
            { href: "/admin/users/analytics", label: "用户分析", icon: "📊", match: "startsWith" },
            { href: "/admin/invitations", label: "邀请码管理", icon: "🎫", match: "startsWith" },
            { href: "/admin/registration-config", label: "注册配置", icon: "⚙️", match: "startsWith" },
            { href: "/admin/api-usage", label: "API用量统计", icon: "📈" },
          ],
        },
  {
    title: "生成 / AI",
    items: [
      { href: "/admin/batch-gen", label: "批量生成中心", icon: "⚡" },
      { href: "/admin/cloze/ai", label: "Cloze 生成/审核", icon: "🎯", match: "startsWith" },
      { href: "/admin/cloze/drafts", label: "Cloze 草稿箱", icon: "🗂️", match: "startsWith" },
      { href: "/admin/alignment/ai", label: "对齐练习生成", icon: "🤝", match: "startsWith" },
      { href: "/admin/shadowing/themes", label: "Shadowing 主题管理", icon: "📋", match: "startsWith" },
      { href: "/admin/shadowing/subtopics-gen", label: "Shadowing 批量生成", icon: "🚀", match: "startsWith" },
      { href: "/admin/alignment/review", label: "对齐草稿审核", icon: "🧾", match: "startsWith" },
      { href: "/admin/shadowing/review", label: "Shadowing 草稿审核", icon: "🧾", match: "startsWith" },
    ],
  },
  {
    title: "系统",
    items: [
      { href: "/admin/setup", label: "系统设置", icon: "⚙️" },
      { href: "/admin/migrate", label: "数据迁移", icon: "🔄" },
      { href: "/admin/performance", label: "性能监控", icon: "📊" },
      { href: "/admin/performance-test", label: "性能测试", icon: "🧪" },
      { href: "/admin/performance-optimization", label: "性能优化", icon: "🚀" },
      { href: "/admin/advanced-optimization", label: "高级优化", icon: "⚡" },
      { href: "/admin/drafts/simple", label: "草稿箱（简）", icon: "🧪", hidden: !showDebug },
      { href: "/admin/drafts/test-fix", label: "草稿诊断", icon: "🔧", hidden: !showDebug },
    ],
  },
  {
    title: "题库管理",
    items: [
      { href: "/admin/cloze/items", label: "Cloze 题库", icon: "🧩", match: "startsWith" },
      { href: "/admin/alignment/packs", label: "对齐训练包", icon: "🧭", match: "startsWith" },
      { href: "/admin/articles/list", label: "广读文章", icon: "📄", match: "startsWith" },
      { href: "/admin/shadowing/items", label: "Shadowing 素材", icon: "🎙️", match: "startsWith" },
      { href: "/admin/question-bank/export", label: "题库导出", icon: "📦", match: "startsWith" },
      { href: "/admin/question-bank/copy-sync", label: "COPY流式同步", icon: "⚡", match: "startsWith" },
      { href: "/admin/question-bank/specialized", label: "专项题目打包", icon: "🎯", match: "startsWith" },
      { href: "/admin/question-bank/test-env", label: "环境变量测试", icon: "🔧", match: "startsWith" },
    ],
  },
];


