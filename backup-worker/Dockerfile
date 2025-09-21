FROM node:20-slim

# 基础工具：PostgreSQL 客户端 + 压缩工具
# 使用 PostgreSQL 官方仓库获取最新版本
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    ca-certificates \
    gnupg \
    lsb-release \
    zstd \
  && wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - \
  && echo "deb http://apt.postgresql.org/pub/repos/apt/ $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client-17 \
  && rm -rf /var/lib/apt/lists/*

# （可选）安装 BaiduPCS-Go；如无需可删除本段，或进入容器后手动安装并登录保存凭证
# RUN curl -L -o /usr/local/bin/BaiduPCS-Go \
#     https://github.com/qjfoidnh/BaiduPCS-Go/releases/download/v3.9.7/BaiduPCS-Go-v3.9.7-linux-amd64 && \
#     chmod +x /usr/local/bin/BaiduPCS-Go

WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN npm i --production --no-audit --no-fund || true
COPY src ./src

ENV PORT=7788
EXPOSE 7788
CMD ["node", "src/index.js"]
