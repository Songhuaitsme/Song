# 发布与回滚

如需部署到自己的 Cloudflare 账号并连接 GitHub 自动部署，请按 [Cloudflare Workers 部署](CLOUDFLARE.md) 操作。下面的流程适用于原有 Sites 托管。

发布前运行：

1. `npm run backup -- --production`
2. `npm run release:prepare`
3. 检查 `var/release/manifest.json`
4. 确认 Sites 环境含 `ADMIN_USERNAME`、`ADMIN_PASSWORD`、`SESSION_SECRET` 与 `SYNC_SECRET`

正式发布仍由 Codex/Sites 保存并部署到项目 `appgprj_6ac8958fb3ec8191bd9a72d10f72503a`，正式地址保持不变。构建过程不会把本地 D1/R2 内容覆盖到线上；内容迁移必须显式运行同步。

旧源码保存在 `legacy/site-v1`，Sites 旧版本保留为服务端回滚点。新版本验收前不要删除旧版源码、原图、线上数据库或 R2 对象。
