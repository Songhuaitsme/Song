# 本地开发

需要 Node.js 22.13+ 和 npm，不需要 Docker、独立 SQLite 或本机对象存储服务。

1. 运行 `npm install`。
2. 运行 `npm run setup`，按提示输入管理员账号和密码。
3. 运行 `npm run dev`。
4. 浏览 `http://127.0.0.1:5173`，登录入口是 `/login`。

本地 D1/R2 数据由 Wrangler 保存于 `.wrangler/state`。停止或重启进程不会丢失。`.env.local`、`.wrangler`、`var` 与 `media-source` 都不会提交到 Git。

本地 HTTP 会自动省略 Cookie 的 `Secure` 属性；线上 HTTPS 始终使用 `HttpOnly + Secure + SameSite=Lax`。认证会话七天无操作过期，修改账号或密码会让旧会话失效。

界面设置位置：

- 品牌、导航、SEO 和功能开关：`src/config/site.ts`
- 字体、颜色、留白、内容宽度和动效：`src/frontend/styles/tokens.css`
- 页面内容：登录 `/studio` 后编辑，不需要重新构建
