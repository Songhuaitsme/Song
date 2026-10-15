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

### 浏览器直传

浏览器可直接上传到 R2，再由网站校验文件内容并保存媒体记录，避免大文件经过网站中转。
未配置专用密钥时，自动使用原有上传方式。

1. 在 R2 概述右侧的帐户详细信息中选择 API 令牌旁的管理。
2. 创建用户 API 令牌，授予对象读写权限，范围只选 `song-media`。
3. 在 Windows 项目目录运行 `npm run setup:r2-direct`，
   按提示分别粘贴 Access Key ID 和 Secret Access Key。输入隐藏，脚本直接写入 Worker 的加密环境变量，不写入项目文件。
4. 运行 `npx wrangler r2 bucket cors set song-media --file r2-cors.json --config wrangler.cloudflare.jsonc --force`，允许网站发起直传请求。
5. 发布最新版代码并刷新网站。

存储桶保持私有。上传地址仅对随机生成的新文件有效，有效期 10 分钟，
凭证绑定文件类型、大小、校验值和归属信息；服务端验证原图与展示图后才登记媒体。
以后更换网站域名时，同时更新 `r2-cors.json` 中允许的来源。

如果 Windows 系统代理拖慢了 R2 上传，在确认 R2 可以直连后，可运行
`powershell -NoProfile -File scripts/r2-proxy-exception.ps1`，只为本项目的 R2 存储域名添加代理例外。
脚本先将原规则备份到被 Git 忽略的 `var/`；运行同一命令并加上 `-Restore` 可移除这条例外。

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
