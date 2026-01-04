export type AdminNavItem = {
  href: string;
  label: string;
  icon?: string;
  match?: 'exact' | 'startsWith';
  hidden?: boolean;
};

export type AdminNavSection = {
  title: string;
  items: AdminNavItem[];
};

// 保持 SSR/CSR 一致，避免 hydration mismatch
// const showDebug = process.env.NEXT_PUBLIC_SHOW_DEBUG === '1';

export const ADMIN_SECTIONS: AdminNavSection[] = [
  {
    title: '内容',
    items: [
      { href: '/admin', label: '控制台', icon: '🏠', match: 'exact' },
    ],
  },
  {
    title: '用户管理',
    items: [
      { href: '/admin/users', label: '用户列表', icon: '👥', match: 'startsWith' },
      { href: '/admin/users/analytics', label: '用户分析', icon: '📊', match: 'startsWith' },
      { href: '/admin/invitations', label: '邀请码管理', icon: '🎫', match: 'startsWith' },
      { href: '/admin/registration-config', label: '注册配置', icon: '⚙️', match: 'startsWith' },
      { href: '/admin/api-usage', label: 'API用量统计', icon: '📈' },
    ],
  },
  {
    title: '生成 / AI',
    items: [
      { href: '/admin/cloze-shadowing/generate', label: 'Cloze-Shadowing 生成', icon: '🧩', match: 'startsWith' },
      { href: '/admin/alignment/ai', label: '对齐练习生成', icon: '🤝', match: 'startsWith' },
      {
        href: '/admin/alignment/themes',
        label: '对齐主题管理',
        icon: '🧭',
        match: 'startsWith',
      },
      {
        href: '/admin/alignment/subtopics-gen',
        label: '对齐小主题生成',
        icon: '🧱',
        match: 'startsWith',
      },
      {
        href: '/admin/alignment/materials',
        label: '对齐训练包审核',
        icon: '🗂️',
        match: 'startsWith',
      },
      {
        href: '/admin/shadowing/themes',
        label: 'Shadowing 主题管理',
        icon: '📋',
        match: 'startsWith',
      },
      {
        href: '/admin/shadowing/subtopics-gen',
        label: 'Shadowing 批量生成',
        icon: '🚀',
        match: 'startsWith',
      },
      {
        href: '/admin/shadowing/test-continuous',
        label: 'Shadowing 连续故事测试',
        icon: '📖',
        match: 'startsWith',
      },
      {
        href: '/admin/shadowing/quiz-test',
        label: 'Shadowing 理解题测试',
        icon: '❓',
        match: 'startsWith',
      },
      { href: '/admin/alignment/review', label: '对齐草稿审核', icon: '🧾', match: 'startsWith' },
      {
        href: '/admin/shadowing/review',
        label: 'Shadowing 草稿审核',
        icon: '🧾',
        match: 'startsWith',
      },
      { href: '/admin/cloze-shadowing/review', label: 'Cloze-Shadowing 审阅', icon: '🔍', match: 'startsWith' },
    ],
  },
  {
    title: '系统',
    items: [
      { href: '/admin/backup', label: '数据备份', icon: '💾' },
      { href: '/admin/pronunciation-test', label: '发音评测实验', icon: '🗣️', match: 'startsWith' },
      { href: '/admin/test-chunking', label: '分块测试', icon: '🧪', match: 'startsWith' },
      { href: '/admin/lex-profile-test', label: '词汇分析测试', icon: '🔬', match: 'startsWith' },
    ],
  },
  {
    title: '题库管理',
    items: [
      { href: '/admin/pronunciation', label: '发音评测管理', icon: '🎤', match: 'startsWith' },
      { href: '/admin/alignment/packs', label: '对齐训练包', icon: '🧭', match: 'startsWith' },
      { href: '/admin/shadowing/items', label: 'Shadowing 素材', icon: '🎙️', match: 'startsWith' },
      { href: '/admin/question-bank/export', label: '题库导出', icon: '📦', match: 'startsWith' },
    ],
  },
];
