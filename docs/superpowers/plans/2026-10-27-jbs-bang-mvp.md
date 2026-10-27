# 剧本杀口碑榜 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployable Next.js + SQLite site where visitors post moderated red/black-list entries about jubensha shops, DMs and players, with PII scrubbing, tombstones, a hash-chained event log, an admin queue, an importer for the old QQ spreadsheet, and a one-command Docker deploy.

**Architecture:** Next.js App Router server components read SQLite directly through a thin repo layer (`lib/repo/*`) over `node:sqlite`. Mutations are server actions that validate, scrub, write, and append a hash-chained event. Admin is a signed cookie checked by each admin page/action.

**Tech Stack:** Node 26, Next.js (latest, App Router, standalone output), TypeScript, Tailwind, `node:sqlite`, vitest, tsx (scripts), Python openpyxl (xlsx → JSON only), Docker + Caddy.

**Spec:** `docs/superpowers/specs/2026-10-27-jbs-bang-design.md`

## Global Constraints

- Node 26; SQLite via built-in `node:sqlite` (`DatabaseSync`); no native npm modules.
- `DATA_DIR` env (default `./data`) holds `app.db` and `uploads/`.
- `SITE_NAME` default `剧本杀口碑榜`; `ADMIN_PASSWORD`; `SESSION_SECRET`.
- Every user-supplied body passes `scrubPII` before storage.
- Everything user-submitted is `pending` until approved, except endorsements.
- No code path executes `DELETE` on `entries` or `comments`; status changes only, each writing an event.
- Evidence files are only served through `/admin/evidence/...` behind admin auth.
- All UI copy simplified Chinese, mobile-first.

## Review Focus

1. Contact info in disguised forms (`v x：abc_123`, `扣扣 123456789`, `138 1234 5678`, 18-digit ID) must be replaced by `[已隐去联系方式]` → test in Task 2.
2. A non-image file renamed `.png` uploaded as evidence must be rejected by magic bytes → test in Task 6.
3. The same visitor endorsing the same entry twice must leave the count at 1 → test in Task 3.
4. A removed entry must render a tombstone with reason and date, never the body → test in Task 3 (repo) and curl check in Task 7.
5. The 4th submission from one IP within an hour must be refused with a Chinese message and store nothing → test in Task 4.

---

### Task 1: Scaffold, config, database bootstrap

**Files:**
- Create: project via `npx create-next-app@latest jbs-bang --ts --tailwind --app --src-dir --no-eslint --import-alias "@/*" --use-npm`
- Create: `src/lib/config.ts`, `src/lib/db.ts`, `src/lib/schema.sql`, `src/lib/ids.ts`, `vitest.config.ts`, `.env.example`, `.gitignore` additions (`data/`, `.env`)
- Test: `src/lib/__tests__/db.test.ts`

**Interfaces:**
- Produces: `config = { siteName, dataDir, adminPassword, sessionSecret }` from `src/lib/config.ts`; `getDb(): DatabaseSync` (singleton, runs `schema.sql` idempotently, `PRAGMA journal_mode=WAL`) and `openDb(path: string): DatabaseSync` from `src/lib/db.ts`; `newId(): string` (16 hex chars) from `src/lib/ids.ts`.

- [ ] Step 1: Scaffold with create-next-app; `npm i -D vitest tsx`; set `output: 'standalone'` in `next.config.ts`.
- [ ] Step 2: Write `db.test.ts`: `openDb(':memory:')` then `SELECT name FROM sqlite_master WHERE type='table'` contains `subjects, entries, comments, endorsements, events, rate_events`; `newId()` returns 16 hex chars and two calls differ.
- [ ] Step 3: Run `npx vitest run` → FAIL (module not found).
- [ ] Step 4: Write `schema.sql` per spec model (all tables `CREATE TABLE IF NOT EXISTS`, CHECK constraints on `type`, `list`, `status`, `kind`; `endorsements` PK `(entry_id, vid)`; `events.seq INTEGER PRIMARY KEY AUTOINCREMENT`). Implement `db.ts`, `ids.ts`, `config.ts`.
- [ ] Step 5: `npx vitest run` → PASS. `npm run build` → succeeds (proves `node:sqlite` bundles).
- [ ] Step 6: `git init && git add -A && git commit -m "feat: scaffold next app with sqlite bootstrap"`

### Task 2: Pure logic — PII scrub, taxonomy, hash chain

**Files:**
- Create: `src/lib/scrub.ts`, `src/lib/taxonomy.ts`, `src/lib/events.ts`
- Test: `src/lib/__tests__/scrub.test.ts`, `src/lib/__tests__/events.test.ts`

**Interfaces:**
- Produces: `scrubPII(text: string): string`; `isLowValue(text: string): boolean` (true for `点了`/`同意`/`+1`-style cells); `SUBJECT_TYPES = ['shop','dm','player'] as const`; `CATEGORIES: Record<SubjectType, { red: string[]; black: string[] }>`; `typeLabel(t): string`; `appendEvent(db, kind: string, refId: string, payload: object): { seq: number; hash: string }`; `latestHash(db): string | null`.

- [ ] Step 1: Write `scrub.test.ts`: each of `13812345678`, `138 1234 5678`, `138-1234-5678`, `微信：abc_123`, `vx: Im13800138000`, `v x：abc_123`, `扣扣 123456789`, `QQ123456789`, `110101199001011234` is replaced with `[已隐去联系方式]`; plain text `客服态度很差，换了两次DM` is unchanged; `isLowValue('点了！！')` true, `isLowValue('开本很认真')` false.
- [ ] Step 2: `npx vitest run scrub` → FAIL.
- [ ] Step 3: Implement with an ordered regex list (ID card first, then phone, then wx/vx/微信/qq/扣扣 handles); strip spaces/dashes inside digit runs before matching phones.
- [ ] Step 4: `npx vitest run scrub` → PASS.
- [ ] Step 5: Write `events.test.ts`: on `:memory:` db, `appendEvent` twice; second row's `prev_hash` equals first `hash`; `hash` is 64 hex; `latestHash` returns the second hash; tamper `UPDATE events SET payload='x' WHERE seq=1` → recomputing with exported `computeHash(prev, kind, refId, payload, createdAt)` for seq 1 no longer equals stored hash.
- [ ] Step 6: FAIL → implement `events.ts` → PASS.
- [ ] Step 7: Commit `feat: pii scrub, taxonomy, hash-chained events`.

### Task 3: Repo layer and labels

**Files:**
- Create: `src/lib/repo/subjects.ts`, `src/lib/repo/entries.ts`, `src/lib/repo/comments.ts`, `src/lib/repo/endorsements.ts`, `src/lib/labels.ts`, `src/lib/types.ts`
- Test: `src/lib/__tests__/repo.test.ts`

**Interfaces:**
- Consumes: `openDb`, `newId`, `appendEvent`, `scrubPII`, `CATEGORIES`.
- Produces (all take `db: DatabaseSync` first):
  - subjects: `findOrCreateSubject(db, { type, name, city, shopName? }): Subject`; `getSubject(db, id)`; `searchSubjects(db, q, city?, limit=20): Subject[]`; `updateSubject(db, id, { name?, city?, shopName?, aliases? })`; `listCities(db): string[]`.
  - entries: `createEntry(db, input: NewEntry): Entry` (validates body 10..2000 chars after trim, category ∈ CATEGORIES[type][list], scrubs, sets status from `input.status ?? 'pending'`, computes `body_hash`, appends event `entry.created`); `getEntry(db, id)`; `listEntries(db, { city?, list?, subjectId?, status='published', limit=50, offset=0 })`; `listPending(db)`; `setEntryStatus(db, id, status, { reason? })` (writes `removed_reason/removed_at` when `removed`, appends `entry.<status>` event); `setVerified(db, id, verified: boolean)`; `updateEntryBody(db, id, body)` (re-scrubs, event `entry.edited`); `setEvidenceCount(db, id, n)`.
  - comments: `createComment(db, { entryId?, subjectId, kind, body, vid, ipHash, status? })`; `listComments(db, { entryId?, subjectId?, kind?, status='published' })`; `listPendingComments(db)`; `setCommentStatus(db, id, status, { reason? })`.
  - endorsements: `endorse(db, entryId, vid): number` (returns new count; idempotent); `endorseCount(db, entryId)`.
  - labels: `confidenceLabel(db, entry): '已撤下'|'平台核验'|'多方印证'|'历史存档·单方陈述'|'单方陈述'`.
  - `Subject`, `Entry`, `Comment` types in `types.ts` mirror columns in camelCase.

- [ ] Step 1: Write `repo.test.ts` covering: findOrCreate returns same id for same `(type,name,city,shopName)` case-insensitively; createEntry rejects 9-char body and 2001-char body with Error message containing `正文`; rejects unknown category; scrubs a wechat handle; default status pending; `listEntries` excludes pending; `setEntryStatus(...,'removed',{reason:'当事人申诉成立'})` sets `removedReason` and `removedAt` and `getEntry` still returns the row; `endorse` twice from same vid → 1, different vid → 2; `confidenceLabel` returns `多方印证` after 3 published black entries same subject+category from 3 vids, `单方陈述` with 2, `已撤下` for removed, `平台核验` when verified, `历史存档·单方陈述` for source import.
- [ ] Step 2: FAIL → implement → PASS.
- [ ] Step 3: Commit `feat: repo layer and confidence labels`.

### Task 4: Visitor id, rate limit, admin session

**Files:**
- Create: `src/lib/visitor.ts`, `src/lib/ratelimit.ts`, `src/lib/admin-auth.ts`
- Test: `src/lib/__tests__/ratelimit.test.ts`, `src/lib/__tests__/admin-auth.test.ts`

**Interfaces:**
- Produces: `getVid(): Promise<string>` (reads/sets `vid` cookie via `next/headers`, 32 hex, httpOnly, 1 year); `shortVid(vid): string` → `瓜友#XXXX` (first 4 upper hex); `ipHash(ip: string): string` (sha256 hex with `SESSION_SECRET` as salt, first 16); `getClientIp(): Promise<string>` from `x-forwarded-for`; `checkRate(db, ipHash, kind: 'entry'|'comment', now = Date.now()): boolean` with limits entry 3/h, comment 10/h, records on success; `signAdmin(secret, expiresAt): string`, `verifyAdmin(secret, token): boolean`, `requireAdmin(): Promise<void>` (redirects to `/admin/login` if cookie invalid), `isAdmin(): Promise<boolean>`.

- [ ] Step 1: `ratelimit.test.ts`: 3 `entry` checks pass, 4th false; a check at `now + 3600_001` passes again; `comment` allows 10.
- [ ] Step 2: `admin-auth.test.ts`: `verifyAdmin(secret, signAdmin(secret, future))` true; expired false; tampered token false; different secret false.
- [ ] Step 3: FAIL → implement (HMAC-SHA256 over `expiresAt`, token `expiresAt.hex`) → PASS.
- [ ] Step 4: Commit `feat: visitor id, rate limit, admin session`.

### Task 5: Public pages

**Files:**
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/s/[id]/page.tsx`, `src/app/e/[id]/page.tsx`, `src/app/search/page.tsx`, `src/app/rules/page.tsx`, `src/app/transparency/page.tsx`, `src/components/EntryCard.tsx`, `src/components/SubjectHeader.tsx`, `src/components/Nav.tsx`, `src/components/Label.tsx`, `src/app/actions/city.ts` (server action `setCity(city)` → cookie `city`)
- Modify: `src/app/globals.css` (Tailwind only)

**Interfaces:**
- Consumes: repo functions, `confidenceLabel`, `shortVid`, `config.siteName`.
- Produces: `EntryCard({ entry, subject, label, endorseCount })` and `Label({ text })` reused by admin pages.

- [ ] Step 1: Implement layout (header with site name, nav: 红榜/黑榜/投稿/规则, footer link to transparency), home with tabs via `?list=` and city cookie (default 西安; selector lists 西安 plus `listCities`), subject page, entry page (tombstone branch when `status==='removed'`: shows `本条于 {removedAt} 下架，原因：{removedReason}` and no body; `notFound()` for pending/rejected unless admin), search, rules (copy from spec: 先审后发、隐去联系方式、墓碑、三条红线), transparency (counts by status, latest event hash + seq, list of removed entries with date+reason).
- [ ] Step 2: `npm run build` → success. `npm run start` then `curl -s localhost:3000/ | grep -c 剧本杀口碑榜` ≥ 1; `/transparency` 200; `/s/nope` 404.
- [ ] Step 3: Commit `feat: public pages`.

### Task 6: Submit, comment, respond, endorse

**Files:**
- Create: `src/app/submit/page.tsx`, `src/app/submit/SubmitForm.tsx` (client), `src/app/actions/entries.ts` (`createEntryAction(prev, formData)`), `src/app/actions/comments.ts` (`createCommentAction`, `createResponseAction`), `src/app/actions/endorse.ts` (`endorseAction(entryId)`), `src/app/api/subjects/route.ts` (GET `?q=&type=&city=` → JSON), `src/lib/uploads.ts`, `src/components/CommentList.tsx`, `src/components/CommentForm.tsx`, `src/components/EndorseButton.tsx`, `src/app/submit/done/page.tsx`
- Test: `src/lib/__tests__/uploads.test.ts`

**Interfaces:**
- Consumes: Task 3 repo, Task 4 `getVid`/`ipHash`/`checkRate`.
- Produces: `saveEvidence(dataDir: string, entryId: string, files: File[]): Promise<number>` (writes `dataDir/uploads/<entryId>/<n>.<ext>`, max 5 files, each ≤ 5 MB, accepts only files whose first bytes match PNG/JPEG/GIF/WebP; throws `Error('证据必须是图片')` otherwise, `Error('最多 5 张')` on count); `evidencePath(dataDir, entryId, n): string | null`.

- [ ] Step 1: `uploads.test.ts`: a `File` with `.png` name but bytes `hello` → throws `证据必须是图片`; a real 1x1 PNG byte array → returns 1 and file exists under a temp dir; 6 files → throws `最多 5 张`.
- [ ] Step 2: FAIL → implement → PASS.
- [ ] Step 3: Build the submit form: type radio → subject search (debounced fetch to `/api/subjects`, or "新建" with name/city/shopName) → list radio → category select (from `CATEGORIES`, depends on type+list) → body textarea with counter → occurred month input → file input → contact input (helper text: 仅审核可见) → submit. Action order: rate check → createEntry → saveEvidence → `setEvidenceCount` → redirect `/submit/done`. Errors returned via `useActionState` and shown in Chinese.
- [ ] Step 4: Comment form on entry page, response form on subject page (`kind='response'`, helper text: 审核通过后置顶显示), endorse button (server action + `revalidatePath`).
- [ ] Step 5: Manual check with `npm run start`: submit an entry via `curl` multipart against the server action or the browser; confirm it is absent from `/` and present in DB with `status='pending'`.
- [ ] Step 6: Commit `feat: submit, comments, responses, endorsements`.

### Task 7: Admin

**Files:**
- Create: `src/app/admin/login/page.tsx`, `src/app/actions/admin.ts` (`loginAction`, `logoutAction`, `moderateEntryAction`, `moderateCommentAction`, `editEntryBodyAction`, `toggleVerifiedAction`, `updateSubjectAction`), `src/app/admin/page.tsx` (queue), `src/app/admin/entries/page.tsx`, `src/app/admin/subjects/page.tsx`, `src/app/admin/evidence/[entryId]/[n]/route.ts`, `src/components/admin/*`

**Interfaces:**
- Consumes: Task 3 repo, Task 4 admin-auth, Task 6 `evidencePath`.

- [ ] Step 1: Login page posts password; on match set cookie `admin` = `signAdmin(secret, now+7d)`; wrong password shows `口令错误`.
- [ ] Step 2: Queue page: pending entries (subject, list, category, body, contact, evidence thumbnails via evidence route, 通过/驳回/编辑后通过) and pending comments/responses (通过/驳回). Each action calls `requireAdmin()` first.
- [ ] Step 3: Entries page: published entries with 下架(原因必填)/核验 toggle; subjects page: inline edit name/city/shopName/aliases.
- [ ] Step 4: Evidence route: `requireAdmin()` then stream file with content-type by extension; unauthenticated request → 302 to login.
- [ ] Step 5: Curl checks: `/admin` without cookie → 302; evidence route without cookie → 302. Approve a pending entry → appears on `/`. Take it down → `/e/[id]` shows tombstone (Review Focus 4).
- [ ] Step 6: Commit `feat: admin queue, moderation, evidence viewing`.

### Task 8: Import the old spreadsheet

**Files:**
- Create: `scripts/xlsx_to_json.py`, `scripts/import.ts`, `package.json` script `"import": "tsx scripts/import.ts"`

**Interfaces:**
- Consumes: `openDb`, repo functions, `scrubPII`, `isLowValue`.
- Produces: `data/import.json` (gitignored) with `[{ type, list, name, city:'西安', shopName?, category:'其他', body, comments: string[], endorsements: number, status }]`; `import.ts` writes into `DATA_DIR/app.db`, idempotent via `source='import'` + body_hash check.

- [ ] Step 1: `xlsx_to_json.py <xlsx> <out.json>`: sheets 红榜/店家红榜/玩家红榜 → red, `status:'published'`, first comment cell = body, later cells = comments, low-value cells counted as endorsements; `清洗总表` → black entries `status:'pending'` (店家 → shop, 玩家 → player), 主诉原因 = body, 补充评论 split on ` / ` = comments (pending); sheet `黑榜` skipped; rows where body is empty skipped; DM names like `乙丙店 阿甲` split into shopName + name when they contain a space.
- [ ] Step 2: Run it on the real file (`python -P`, UTF-8), print counts per (type, list, status).
- [ ] Step 3: `import.ts`: reads JSON, scrubs every body/comment, creates subjects and entries with `source:'import'`, comments, synthetic endorsements `vid='import-<i>'`; prints counts; second run inserts nothing.
- [ ] Step 4: Run twice; verify counts and idempotence; `npm run start` and open `/` → red entries visible, black entries only in `/admin`.
- [ ] Step 5: Commit `feat: spreadsheet importer` (JSON and db stay untracked).

### Task 9: Docker deploy, backups, README

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `Caddyfile`, `deploy/deploy.sh`, `deploy/backup.sh`, `README.md`

- [ ] Step 1: Dockerfile: `node:26-bookworm-slim` deps → build (`npm ci && npm run build`) → runner copying `.next/standalone`, `.next/static`, `public`; `ENV DATA_DIR=/data`; `EXPOSE 3000`; `CMD ["node","server.js"]`.
- [ ] Step 2: compose: `app` (build, env_file `.env`, volume `./data:/data`, restart always), `caddy` (`caddy:2`, ports 80/443, env `DOMAIN`, volumes Caddyfile + `caddy_data` + `caddy_config`, depends_on app). Caddyfile: `{$DOMAIN} { encode gzip  reverse_proxy app:3000 }`.
- [ ] Step 3: `deploy/deploy.sh`: installs docker via `get.docker.com` if missing, `cp -n .env.example .env`, `docker compose up -d --build`, prints URL. `deploy/backup.sh`: runs `node scripts/backup.mjs` inside the app container (uses `DatabaseSync.backup` into `/data/backups/app-<date>.db`), tars uploads, keeps 14 days, optional `rclone copy` when `BACKUP_REMOTE` set. README: 5-step deploy, cron line, how to approve, how to import, how to restore.
- [ ] Step 4: Verify locally: `docker build -t jbs-bang .` succeeds; `docker compose config` valid; run container with `-p 3001:3000 -v` temp data dir, `curl localhost:3001/` 200.
- [ ] Step 5: Commit `feat: docker deploy and backups`.
