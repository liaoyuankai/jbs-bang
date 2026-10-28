#!/usr/bin/env bash
# 第一次部署时把本机 data/（数据库 + 证据图）推到服务器。服务器上已经有数据库时拒绝执行，避免覆盖线上数据。
# 用法：JBS_HOST=root@1.2.3.4 [JBS_SSH_KEY=~/.ssh/id_ed25519] bash deploy/push-data.sh
set -euo pipefail
cd "$(dirname "$0")/.."

: "${JBS_HOST:?请设置 JBS_HOST=root@服务器IP}"
REMOTE_DIR=${JBS_REMOTE_DIR:-/opt/jbs-bang}
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
[ -n "${JBS_SSH_KEY:-}" ] && SSH_OPTS+=(-i "$JBS_SSH_KEY")
ssh_() { ssh "${SSH_OPTS[@]}" "$JBS_HOST" "$@"; }

if ssh_ "test -s ${REMOTE_DIR}/data/app.db"; then
  echo "!! 服务器上 ${REMOTE_DIR}/data/app.db 已存在，拒绝覆盖。要替换请先在服务器上备份并删除它。"
  exit 1
fi
[ -f data/app.db ] || { echo "!! 本机没有 data/app.db"; exit 1; }

# 先把 WAL 并入主文件，保证单个 app.db 就是完整数据
node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('data/app.db');db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();db.close()"

ssh_ "mkdir -p ${REMOTE_DIR}/data/uploads ${REMOTE_DIR}/data/backups"
tar czf - -C data --exclude='app.db-wal' --exclude='app.db-shm' --exclude=backups . | ssh_ "tar xzf - -C ${REMOTE_DIR}/data"
ssh_ "ls -la ${REMOTE_DIR}/data"
echo ">> 数据已推送；如果服务已在运行，执行 ssh ${JBS_HOST} 'cd ${REMOTE_DIR} && docker compose restart app'"
