# 在自己的 Cloudflare 账号部署

本项目使用 Vinext 服务端渲染、登录接口和 D1 数据库；图片上传额外需要 R2 文件存储。
应创建 **Cloudflare Worker**，不能仅把 `dist/client` 或仓库文件上传到 Pages。
Pages 显示部署成功只代表文件上传完成，无法代替运行服务端代码。

## 首次配置

使用 Node.js 22.13 或以上版本，安装依赖后登录：

```sh
npm ci
npx wrangler login
npx wrangler d1 create song-db
```

将创建数据库返回的 `database_id` 填入 `wrangler.cloudflare.jsonc`。
如果账号有多个 Cloudflare account，还需在该文件中填写目标 `account_id`。
这些 ID 不是密码，可以随配置提交到 Git。
当前配置已填写本项目账号的真实 D1 数据库；在此账号重新发布无需再次创建。

先应用迁移，再发布：

```sh
npm run db:migrate:cloudflare
npm run deploy:cloudflare
```

命令会输出 `https://song.<账号子域名>.workers.dev`，使用这个网址访问。
公开页面会初始化默认内容；本地数据库、未提交图片和原 Sites 中的数据不会自动迁移。
内容迁移另见 [同步说明](SYNC.md)。

## 启用图片上传

生产配置已声明 `BUCKET` 绑定，指向私有存储桶 `song-media`。
在新账号首次部署时，先在 Cloudflare 控制台开通 R2，再创建存储桶并发布：

```sh
npx wrangler r2 bucket create song-media --config wrangler.cloudflare.jsonc
npm run deploy:cloudflare
```

已存在的存储桶无需重复创建。图片通过网站的 `/api/assets/` 接口访问，
由网站执行访问权限检查；不需要为存储桶开启公共访问。

## 管理员和同步密钥

在 Worker 设置中添加加密环境变量，或在本机运行以下命令并按提示输入值：

```sh
npx wrangler secret put ADMIN_USERNAME --config wrangler.cloudflare.jsonc
npx wrangler secret put ADMIN_PASSWORD --config wrangler.cloudflare.jsonc
npx wrangler secret put SESSION_SECRET --config wrangler.cloudflare.jsonc
npx wrangler secret put SYNC_SECRET --config wrangler.cloudflare.jsonc
```

`SESSION_SECRET`、`SYNC_SECRET` 应使用足够长的随机值，前者至少 32 个字符。
不要将密码、密钥或 `.env.local` 上传到 GitHub。

## 连接 GitHub 自动部署

在 Cloudflare 的 Workers 和 Pages 中选择创建 **Worker** 并导入 `Songhuaitsme/Song`。
生产分支为 `main`，项目根目录留空，构建命令为 `npm run build:cloudflare`，
部署命令为 `npx wrangler deploy --config dist/server/wrangler.json`。
Worker 名称与配置中的 `song` 保持一致，先完成上述数据库和存储配置。
数据库迁移需在新增迁移发布前单独运行。

当前 `song-698.pages.dev` 是独立的 Pages 项目，其地址不会自动变为 Worker 地址。
确认 Worker 可用后，可绑定自己的域名。
