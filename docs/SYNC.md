# 本地与线上同步

同步使用独立 `SYNC_SECRET`，不复用管理员密码或登录 Cookie。两端必须运行相同数据库结构版本。

1. 同时确保本地站点与正式站点可访问。
2. 在 `.env.local` 中配置相同的 `SYNC_SECRET`、`LOCAL_SITE_URL` 和 `SITE_URL`。
3. 运行 `npm run sync`。

`SITE_URL` 必须指向你正在使用的托管站点。当前独立 Cloudflare 站点为
`https://song.jsonghjsongh.workers.dev`；不要误用原 Sites 托管地址。
Windows 上的远程请求使用系统自带的 Windows PowerShell 和系统代理配置。

发布代码不会自动搬运数据库或上传图片。首次迁移到新建站点时，应先备份两端，
以确认的本地内容完成单向迁移，再建立新的同步基线；不要直接用空站点覆盖本地内容。

同步前会分别保存本地和线上完整快照到 `var/backups`。脚本使用内容哈希识别哪一端发生变化：只有一端变化时自动合并；两端修改同一记录时不覆盖，冲突写入本地工作室的“同步冲突”页。

数据记录包含 `version`、`updated_at` 和 `deleted_at`。导入通过基础版本号做乐观并发；结构版本不同立即停止。管理员会话、登录失败记录、密码和密钥从不参与同步。媒体原图与展示图通过受保护的资产接口传输。

当前同步结构版本为 **4**。摄影系列的 `narrative_json` 保存独立导语、章节和收尾；升级时须先备份，再在本地和线上应用 `0004_series_narrative.sql`，并更新两端代码。章节依赖起始照片：同一系列或照片出现版本冲突时，相关修改一并留在冲突中心，避免只删除照片却保留失效章节。导入在事务中校验版本及最终照片关联，失败不会部分写入。

`npm run restore` 支持版本 4 的完整文字恢复，也兼容版本 3 备份。旧备份没有 `narrative_json` 时保留目标端已有新文字；新建系列补为空文字。恢复仍使用目标端当前版本进行冲突检查，不接受其他不兼容结构版本。

同步 API：`GET /api/sync/export`、`POST /api/sync/import`、`GET/PUT /api/sync/assets/...`，全部要求 `Authorization: Bearer <SYNC_SECRET>`。
