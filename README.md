# 剧本杀口碑榜（jbs-bang）

剧本杀店家、DM、玩家的红榜与黑榜。先审后发，联系方式自动隐去，下架留痕，事件哈希链可验证。数据全部在你自己的服务器上。

- 设计：`docs/superpowers/specs/2026-10-27-jbs-bang-design.md`
- 技术：Next.js 16（App Router）+ SQLite（Node 内置 `node:sqlite`，无原生依赖）+ Tailwind；Docker + Caddy 自动 HTTPS。

## 一、部署到 VPS（第一次，大约 10 分钟）

前提：一台海外 VPS（Debian/Ubuntu，1 核 1G 起），一个域名，域名的 A 记录已指向 VPS 的 IP。

```bash
# 1. 把项目传到服务器（在本机执行；把 root@IP 换成你的。排除 node_modules/.next/.git，只传源码和 data）
rsync -a --exclude node_modules --exclude .next --exclude .git ./jbs-bang/ root@IP:/opt/jbs-bang/
#    没有 rsync 的话：先删掉本机 jbs-bang/node_modules 和 jbs-bang/.next，再 scp -r ./jbs-bang root@IP:/opt/jbs-bang

# 2. 登录服务器（需要 root 或 sudo），第一次运行会装 Docker 并生成 .env
ssh root@IP
cd /opt/jbs-bang
bash deploy/deploy.sh

# 3. 填 .env：DOMAIN 改成你的域名，ADMIN_PASSWORD 改成长随机串
nano .env

# 4. 再跑一次，构建并启动（首次构建 3 到 5 分钟）
bash deploy/deploy.sh
```

完成后访问 `https://你的域名`，后台在 `https://你的域名/admin`。

`scp` 会连同 `data/` 一起传上去。本机的 `data/app.db` 已经导入了旧表格的数据，服务器直接用它。如果你不想带本机数据，传之前删掉 `data/` 即可，服务器会建一个空库。

## 二、日常

| 要做什么 | 命令 |
|---|---|
| 看日志 | `docker compose logs -f app` |
| 改代码后重新部署 | `bash deploy/deploy.sh` |
| 手动备份 | `bash deploy/backup.sh` |
| 每日自动备份 | `crontab -e` 加一行：`0 4 * * * cd /opt/jbs-bang && mkdir -p data/backups && bash deploy/backup.sh >> data/backups/backup.log 2>&1` |
| 异地备份 | 装 `rclone`，配好远端，然后 `BACKUP_REMOTE=远端名:桶名 bash deploy/backup.sh` |
| 恢复 | `docker compose stop app && rm -f data/app.db-wal data/app.db-shm && cp data/backups/app-某日期.db data/app.db && docker compose start app`（先删 wal/shm，否则旧日志会覆盖恢复的数据） |

## 三、审核

- `/admin`：待审投稿、待审评论与回应。通过前可以直接改正文（去掉辱骂、保留事实）。
- `/admin/entries`：已公开条目可以「下架」（原因必填，会公开显示在墓碑和透明度页）或「标记平台核验」。
- `/admin/subjects`：改名、改城市、加别名。
- 证据图只有登录后台才能看，公开页只显示「附证据 N 张」。

## 四、导入旧表格（已在本机做过一次）

```bash
python -P scripts/xlsx_to_json.py "D:/path/to/dm黑榜.xlsx" data/import.json
npm run import
```

红榜直接公开，黑榜全部进待审队列，由你在 `/admin` 逐条决定。重复运行不会重复插入。

## 五、本地开发

```bash
npm install
cp .env.example .env      # 填 ADMIN_PASSWORD
npm run dev               # http://localhost:3000
npm test                  # 单元测试
```

## 六、环境变量（.env）

| 变量 | 说明 |
|---|---|
| `DOMAIN` | 域名，Caddy 用它申请证书 |
| `SITE_NAME` | 站名，默认「剧本杀口碑榜」 |
| `ADMIN_PASSWORD` | 后台口令 |
| `SESSION_SECRET` | 签名密钥，`deploy.sh` 首次运行自动生成 |
| `DATA_DIR` | 数据目录，容器内固定 `/data`（对应宿主机 `./data`） |
| `DEFAULT_CITY` | 默认城市，默认「西安」 |

## 七、数据在哪

全部在 `data/`：`app.db`（SQLite）、`uploads/`（证据图）、`backups/`。把 `data/` 整个拷走就是完整迁移。
