#!/usr/bin/env bash
# 在 VPS 上、项目目录里执行：bash deploy/deploy.sh
# 第一次运行会安装 Docker、生成 .env；之后每次运行 = 重新构建并重启。
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo ">> 安装 Docker ..."
  curl -fsSL https://get.docker.com | sh
fi

if [ ! -f .env ]; then
  cp .env.example .env
  secret=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
  sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=${secret}/" .env
  sed -i "s#^DATA_DIR=.*#DATA_DIR=/data#" .env
  echo ">> 已生成 .env，请先填好 DOMAIN 和 ADMIN_PASSWORD，然后再跑一次本脚本："
  echo "   nano .env"
  exit 1
fi

domain=$(grep -E '^DOMAIN=' .env | cut -d= -f2-)
pw=$(grep -E '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
if [ -z "$domain" ] || [ "$domain" = "example.com" ] || [ -z "$pw" ] || [ "$pw" = "change-me" ]; then
  echo "!! .env 里的 DOMAIN 或 ADMIN_PASSWORD 还没改，先改好再部署。"
  exit 1
fi

mkdir -p data
docker compose up -d --build
docker compose ps
echo
echo ">> 部署完成：https://${domain}"
echo ">> 后台：https://${domain}/admin"
echo ">> 看日志：docker compose logs -f app"
