# 剧本杀口碑榜（jbs-bang）MVP 设计

日期：2026-10-27。决策人：站长。实现：Claude。

## 意图

把 QQ 在线表格里的剧本杀红榜/黑榜搬到自己的网站上，数据在站长手里，任何人都清不掉。
优先级是「今天就能上线」，部署在站长已有的海外 VPS + 已有域名上，不走备案。

## 目标

- 访客不登录就能看：按城市看红榜/黑榜，搜店家、DM、玩家，看单条详情和评论。
- 访客不登录就能投稿、评论、回应、点「点了/我也遇到过」。
- 所有投稿、评论、回应先进审核队列，站长一键通过/驳回后才公开（先审后发）。
- 手机号、微信号、QQ 号、身份证号在入库前自动隐去。
- 永不硬删：下架只改状态并留墓碑（时间 + 原因），所有状态变化追加到带哈希链的事件表，透明度页公开最新链头和下架记录。
- 证据截图只有审核能看，公开页只显示「附证据 N 张」。
- 旧表格数据导入：红榜直接公开，黑榜进审核队列，玩家黑榜无事由的不导入。
- 一台 VPS 用 docker compose 起来，Caddy 自动 HTTPS，每日备份脚本。

## 非目标（这版不做）

手机号登录、当事人认领验证流程、申诉流程、图片自动打码、全文搜索、多语言、小程序。

## 反目标（做了就算失败）

- 有人能绕过审核直接公开内容。
- 公开页出现手机号/微信号。
- 任何代码路径物理删除投稿或评论。
- 证据原图能被公开访问。

## 约束

- Node 26，SQLite 用内置 `node:sqlite`，不引入原生扩展。
- Next.js App Router + TypeScript + Tailwind，输出 standalone 供 Docker。
- 数据目录由环境变量 `DATA_DIR` 指定，默认 `./data`，放数据库和上传文件。
- 站名由 `SITE_NAME` 指定，默认「剧本杀口碑榜」。管理员口令 `ADMIN_PASSWORD`，会话签名密钥 `SESSION_SECRET`。
- 界面全部简体中文，手机优先（用户从 QQ 群点开）。

## 领域模型

- subject：店家 shop / DM dm / 玩家 player。字段：type, name, city, shop_name（DM 所属店，可空）, aliases。
- entry：一条红榜或黑榜。字段：subject_id, list(red|black), category, body, body_hash, occurred_at(YYYY-MM，可空), evidence_count, contact（仅审核可见）, vid（访客匿名 id）, ip_hash, status(pending|published|rejected|removed), source(web|import), verified(0|1), removed_reason, removed_at。
- comment：挂在 entry 上的评论，或挂在 subject 上的当事人回应 kind(comment|response)。同样有 status。
- endorsement：(entry_id, vid) 唯一，即「点了 / 我也遇到过」。
- event：seq, kind, ref_id, payload, prev_hash, hash, created_at。每次创建/审核/下架都追加一条。

可信度标签：removed → 已撤下；verified=1 → 平台核验；同一 subject 同一 category 下 ≥3 个不同 vid 的已公开黑榜 → 多方印证；source=import → 历史存档·单方陈述；其余 → 单方陈述。

分类表（固定）：
- shop/black：卡车放鸽、临时换DM、乱收费、客服态度、退款纠纷、环境卫生、强制消费、其他
- shop/red：服务好、环境好、氛围好、拼车靠谱、其他
- dm/black：场外骂人、开本摆烂、剧透、骚扰越界、偏袒卡玩家、迟到放鸽、其他
- dm/red：开本认真、演绎好、带新人、性格好、其他
- player/black：放鸽跑车、不补差价、搅局剧透、骚扰他人、言语攻击、其他
- player/red：打本认真、不扫兴、大方靠谱、性格好、其他

## 页面

- `/` 首页：城市切换（cookie，默认西安）、红榜/黑榜 tab、最新已公开条目列表、搜索框。
- `/s/[id]` 对象页：基本信息、当事人回应（置顶）、红/黑榜条目、「写一条」「我是当事人」入口。
- `/e/[id]` 条目页：正文、标签、证据数、点了按钮、评论、评论框；已撤下显示墓碑。
- `/submit` 投稿：选类型 → 搜/建对象 → 红/黑 → 分类 → 正文(10~2000字) → 发生月份 → 证据图(≤5张，≤5MB，仅图片) → 联系方式(可选，仅审核可见)。
- `/search?q=` 搜索对象名和别名。
- `/rules` 社区规范与免责；`/transparency` 透明度页。
- `/admin/login`、`/admin`（待审队列）、`/admin/entries`（已公开，可下架/核验）、`/admin/subjects`（改名、别名、城市）、`/admin/evidence/[entryId]/[n]`（看证据图）。

## 防滥用

- 访客 cookie `vid`，公开页显示为「瓜友#前4位」。
- 同一 ip_hash 每小时最多 3 条投稿、10 条评论。
- 正文少于 10 字或多于 2000 字拒绝；对象名为空拒绝。

## 部署

Dockerfile(多阶段, node:26-bookworm-slim) + docker-compose.yml(app + caddy) + Caddyfile(`{$DOMAIN}` 反代 app:3000) + deploy/deploy.sh + deploy/backup.sh + README。

## 留给实现者的

组件拆分、Tailwind 样式细节、错误文案的措辞、脚本参数命名。
