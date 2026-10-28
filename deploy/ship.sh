#!/usr/bin/env bash
# 本机 npm run build → 把 standalone 产物传到服务器 → 服务器用 Dockerfile.prebuilt 秒级打镜像 → 启动。
# 本机只需要 Node，不需要 Docker；服务器不跑 npm、不跑 next build，小内存机器也能用，
# 也绕开了国内拉 Docker Hub 镜像慢的问题。
# 用法（本机项目目录，Git Bash）：JBS_HOST=root@服务器IP bash deploy/ship.sh
#   SSH 密钥、端口写在 ~/.ssh/config 里即可。不会动服务器上的 data/ 和 .env。
set -euo pipefail
cd "$(dirname "$0")/.."

: "${JBS_HOST:?请设置 JBS_HOST=root@服务器IP}"
REMOTE_DIR=${JBS_REMOTE_DIR:-/opt/jbs-bang}
ssh_() { ssh -o StrictHostKeyChecking=accept-new "$JBS_HOST" "$@"; }

echo ">> 1/4 本机构建"
npm run build
[ -f .next/standalone/server.js ] || { echo "!! 没有 .next/standalone/server.js，检查 next.config.ts 的 output: standalone"; exit 1; }

echo ">> 2/4 上传源码与部署文件到 ${REMOTE_DIR}（不含 data/ 和 .env）"
ssh_ "mkdir -p ${REMOTE_DIR}"
tar czf - \
  --exclude=node_modules --exclude=.next --exclude=.git --exclude=.superpowers \
  --exclude=data --exclude=.env --exclude='*.log' \
  . | ssh_ "tar xzf - -C ${REMOTE_DIR}"

echo ">> 3/4 上传构建产物"
# standalone 里被 Next 顺带拷进去的 data/ 不要（线上用 /data 卷）；sharp 的平台二进制不要（没用 next/image）
tar czf - \
  --exclude='standalone/data' --exclude='standalone/node_modules/@img' \
  -C .next standalone static \
  -C .. public scripts/backup.mjs Dockerfile.prebuilt \
  | ssh_ "rm -rf ${REMOTE_DIR}/build-ctx && mkdir -p ${REMOTE_DIR}/build-ctx && tar xzf - -C ${REMOTE_DIR}/build-ctx"

echo ">> 4/4 服务器打镜像并启动"
ssh_ "cd ${REMOTE_DIR} && docker build -q -t jbs-bang:latest -f build-ctx/Dockerfile.prebuilt build-ctx && PREBUILT=1 bash deploy/deploy.sh"
