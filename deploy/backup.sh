#!/usr/bin/env bash
# 每日备份：数据库快照 + 证据图打包，保留 14 天；设置 BACKUP_REMOTE 时再同步到异地（rclone）。
# crontab 示例（每天 04:00）：
#   0 4 * * * cd /opt/jbs-bang && mkdir -p data/backups && bash deploy/backup.sh >> data/backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p data/backups

stamp=$(date +%Y-%m-%d-%H-%M-%S)
docker compose exec -T app node scripts/backup.mjs

if [ -d data/uploads ]; then
  tar czf "data/backups/uploads-${stamp}.tgz" -C data uploads
fi
find data/backups -name 'uploads-*.tgz' -mtime +14 -delete

# 异地：例如 BACKUP_REMOTE=r2:jbs-bang-backups（先 rclone config 配好远端）
if [ -n "${BACKUP_REMOTE:-}" ] && command -v rclone >/dev/null 2>&1; then
  rclone copy data/backups "$BACKUP_REMOTE" --include 'app-*.db' --include 'uploads-*.tgz'
fi

echo "[$(date -Is)] backup ok"
ls -la data/backups | tail -5
