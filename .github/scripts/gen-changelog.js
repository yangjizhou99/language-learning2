import { execSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { request } from "undici";

const { DEEPSEEK_API_KEY, OPENROUTER_API_KEY } = process.env;

function run(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

// 找到上一个 tag，如果没有就取第一个 commit
let base;
try {
  base = run("git describe --tags --abbrev=0");
} catch {
  base = run("git rev-list --max-parents=0 HEAD | tail -n1");
}
const head = "HEAD";

// 获取 diff
const diff = run(`git diff ${base}...${head}`);

// 构造 prompt
const messages = [
  {
    role: "system",
    content: `你是一个软件发布说明撰写专家。请基于 git diff 生成简洁的 CHANGELOG 条目（中文），格式为 Markdown：
- 概要
- 主要改动（按功能模块）
- 可能的破坏性变更（如有）
- 测试或注意事项`,
  },
  { role: "user", content: `下面是代码变动：\n\n\`\`\`diff\n${diff}\n\`\`\`` },
];

async function callDeepseek() {
  let url, headers, body;
  if (DEEPSEEK_API_KEY) {
    url = "https://api.deepseek.com/chat/completions";
    headers = { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_API_KEY}` };
    body = { model: "deepseek-reasoner", messages, temperature: 0.2, max_tokens: 1200 };
  } else if (OPENROUTER_API_KEY) {
    url = "https://openrouter.ai/api/v1/chat/completions";
    headers = { "Content-Type": "application/json", Authorization: `Bearer ${OPENROUTER_API_KEY}` };
    body = { model: "deepseek/deepseek-reasoner", messages, temperature: 0.2, max_tokens: 1200 };
  } else {
    throw new Error("No API key provided");
  }
  const res = await request(url, { method: "POST", headers, body: JSON.stringify(body) });
  const data = await res.body.json();
  return data?.choices?.[0]?.message?.content || "";
}

const summary = await callDeepseek();

// 更新 CHANGELOG.md
let changelog = existsSync("CHANGELOG.md") ? readFileSync("CHANGELOG.md", "utf8") : "# Changelog\n\n";
changelog += `\n\n## ${new Date().toISOString().split("T")[0]}\n\n${summary}\n`;
writeFileSync("CHANGELOG.md", changelog);

console.log("✅ AI Changelog updated");
