const { execSync } = require('node:child_process');
const { writeFileSync, readFileSync, existsSync } = require('node:fs');

// 强制禁用所有 pager，避免 CI 中触发 less
process.env.PAGER = 'cat';
process.env.GIT_PAGER = 'cat';
process.env.GH_PAGER = 'cat';
process.env.MANPAGER = 'cat';
process.env.LESS = '-+FXR';

const { DEEPSEEK_API_KEY, OPENROUTER_API_KEY } = process.env;

function run(cmd) {
  return execSync(cmd, {
    encoding: 'utf8',
    env: {
      ...process.env,
      PAGER: 'cat',
      GIT_PAGER: 'cat',
      GH_PAGER: 'cat',
      MANPAGER: 'cat',
      LESS: '-+FXR',
    },
  }).trim();
}

// 找到上一个 tag，如果没有就取第一个 commit
let base;
const gitCfg = "-c core.pager=cat -c pager.diff=false -c pager.log=false -c pager.branch=false";
try {
  base = run(`git ${gitCfg} --no-pager describe --tags --abbrev=0`);
} catch {
  base = run(`git ${gitCfg} --no-pager rev-list --max-parents=0 --max-count=1 HEAD`);
}
const head = 'HEAD';

// 获取 diff（禁用 pager & 外部 diff 工具 & 颜色）
let diff = '';
try {
  diff = run(`git ${gitCfg} --no-pager diff --no-ext-diff --no-color ${base}...${head}`);
} catch (e) {
  console.error('[ai-changelog] git diff 失败，继续使用回退逻辑：', e?.message || e);
  diff = '';
}
console.log(`[ai-changelog] base=${base}`);
console.log(`[ai-changelog] diff_length=${diff.length}`);

// 构造 prompt
const messages = [
  {
    role: 'system',
    content: `你是一个软件发布说明撰写专家。请基于 git diff 生成简洁的 CHANGELOG 条目（中文），格式为 Markdown：
- 概要
- 主要改动（按功能模块）
- 可能的破坏性变更（如有）
- 测试或注意事项`,
  },
  { role: 'user', content: `下面是代码变动：\n\n\`\`\`diff\n${diff}\n\`\`\`` },
];

async function callDeepseek() {
  let url, headers, body;
  if (DEEPSEEK_API_KEY) {
    url = 'https://api.deepseek.com/chat/completions';
    headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_API_KEY}` };
    body = { model: 'deepseek-reasoner', messages, temperature: 0.2, max_tokens: 1200 };
  } else if (OPENROUTER_API_KEY) {
    url = 'https://openrouter.ai/api/v1/chat/completions';
    headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENROUTER_API_KEY}` };
    body = { model: 'deepseek/deepseek-reasoner', messages, temperature: 0.2, max_tokens: 1200 };
  } else {
    throw new Error('No API key provided');
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed: ${res.status} ${res.statusText} - ${text}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

function fallbackSummary() {
  try {
    const shortlog = run(`git --no-pager log --no-color --pretty=format:"- %s" ${base}..${head}`);
    return `### 概要\n\n基于 git 提交信息自动生成（AI 调用失败或被跳过）。\n\n### 主要改动\n\n${shortlog || '- （无提交）'}`;
  } catch (e) {
    return '### 概要\n\n无可用提交或提取失败。';
  }
}

async function main() {
  let summary = '';
  try {
    summary = await callDeepseek();
  } catch (e) {
    console.error('[ai-changelog] AI 生成失败，使用回退摘要：', e?.message || e);
    summary = fallbackSummary();
  }

  // 更新 CHANGELOG.md
  let changelog = existsSync('CHANGELOG.md')
    ? readFileSync('CHANGELOG.md', 'utf8')
    : '# Changelog\n\n';
  changelog += `\n\n## ${new Date().toISOString().split('T')[0]}\n\n${summary}\n`;
  writeFileSync('CHANGELOG.md', changelog);

  console.log('✅ AI Changelog updated');
}

main().catch((err) => {
  console.error('❌ Failed to update AI Changelog:', err);
  process.exit(1);
});
