# 本地与线上同步

同步使用独立 `SYNC_SECRET`，不复用管理员密码或登录 Cookie。两端必须运行相同数据库结构版本。

1. 同时确保本地站点与正式站点可访问。
2. 在 `.env.local` 中配置相同的 `SYNC_SECRET`、`LOCAL_SITE_URL` 和 `SITE_URL`。
3. 运行 `npm run sync`。

同步前会分别保存本地和线上完整快照到 `var/backups`。脚本使用内容哈希识别哪一端发生变化：只有一端变化时自动合并；两端修改同一记录时不覆盖，冲突写入本地工作室的“同步冲突”页。

数据记录包含 `version`、`updated_at` 和 `deleted_at`。导入通过基础版本号做乐观并发；结构版本不同立即停止。管理员会话、登录失败记录、密码和密钥从不参与同步。媒体原图与展示图通过受保护的资产接口传输。

同步 API：`GET /api/sync/export`、`POST /api/sync/import`、`GET/PUT /api/sync/assets/...`，全部要求 `Authorization: Bearer <SYNC_SECRET>`。
