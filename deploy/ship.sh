#!/usr/bin/env bash
# 小内存 VPS 用：在本机构建镜像，连同源码一起推到服务器，服务器只负责运行。
# 用法（在本机项目目录，Git Bash）：
#   JBS_HOST=root@1.2.3.4 [JBS_SSH_KEY=~/.ssh/id_ed25519] bash deploy/ship.sh
# 不会动服务器上的 data/（数据库、证据图）。第一次部署的数据用 deploy/push-data.sh 单独推。
set -euo pipefail
cd "$(dirname "$0")/.."

: "${JBS_HOST:?请设置 JBS_HOST=root@服务器IP}"
REMOTE_DIR=${JBS_REMOTE_DIR:-/opt/jbs-bang}
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
[ -n "${JBS_SSH_KEY:-}" ] && SSH_OPTS+=(-i "$JBS_SSH_KEY")
ssh_() { ssh "${SSH_OPTS[@]}" "$JBS_HOST" "$@"; }

echo ">> 1/4 本机构建镜像 jbs-bang:latest"
docker build -t jbs-bang:latest .

echo ">> 2/4 上传镜像（压缩后约 150 MB，视网速几分钟）"
docker save jbs-bang:latest | gzip | ssh_ 'docker load'

echo ">> 3/4 上传源码与部署文件到 ${REMOTE_DIR}（不含 data/ 和 .env）"
ssh_ "mkdir -p ${REMOTE_DIR}"
tar czf - \
  --exclude=node_modules --exclude=.next --exclude=.git --exclude=.superpowers \
  --exclude=data --exclude=.env --exclude='*.log' \
  . | ssh_ "tar xzf - -C ${REMOTE_DIR}"

echo ">> 4/4 服务器上启动（不在服务器上构建）"
ssh_ "cd ${REMOTE_DIR} && PREBUILT=1 bash deploy/deploy.sh"
