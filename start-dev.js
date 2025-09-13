#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// 找到正确的 next 可执行文件路径
const nextPath = path.join(__dirname, 'node_modules/.pnpm/next@15.5.3_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/next/dist/bin/next');

// 获取命令行参数
const command = process.argv[2] || 'dev';

console.log(`Running Next.js ${command} command...`);
console.log('Using Next.js at:', nextPath);

const child = spawn('node', [nextPath, command], {
  stdio: 'inherit',
  shell: true
});

child.on('close', (code) => {
  console.log(`Next.js process exited with code ${code}`);
  process.exit(code);
});

child.on('error', (err) => {
  console.error('Failed to start Next.js:', err);
  process.exit(1);
});
