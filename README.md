# Song — 摄影与文字

Song 是一个单一管理员维护、访客公开浏览的个人摄影与随笔网站。工程使用 Node.js、React/Vinext、Cloudflare D1 与 R2；本地开发不需要 Docker，并使用 Wrangler 的 D1/R2 持久化模拟。

## 快速开始

本机已完成依赖安装和初始化后，Windows 用户可以直接双击根目录的 **`启动网站.vbs`**：后台启动开发服务并打开浏览器，保存源码后网页自动更新，无需打开终端。用完双击 **`停止网站.vbs`**。详细说明见 [本地开发](docs/LOCAL_DEVELOPMENT.md)。

```powershell
npm install
npm run setup
npm run dev
```

首次执行 `setup` 会在本机询问管理员账号和密码，生成随机会话密钥及同步密钥，并写入被 Git 忽略的 `.env.local`。打开 `http://127.0.0.1:5173` 浏览网站，打开 `/login` 登录工作室。

## 常用命令

- `npm run setup`：准备本地配置、D1/R2 目录、迁移和当前内容种子。
- `npm run dev`：开发模式，代码保存后自动刷新。
- `npm run media:import`：把 `media-source` 的原图导入本地私藏媒体库（先运行本地站点）。
- `npm run sync`：备份后执行本地与正式站点双向同步。
- `npm run backup`：导出本地内容；加 `-- --production` 导出线上内容。
- `npm run restore -- <文件>`：恢复到本地；加 `--production` 指向线上。
- `npm test`：运行自动化检查。
- `npm run release:prepare`：类型检查、测试、生产构建并生成发布清单。

详细说明见 `docs/`。密码与密钥只能放在 `.env.local` 或 Sites 托管环境变量中，禁止写入源码、数据库、浏览器存储或 Git。

## 工程边界

- `src/app`：页面和薄路由入口。
- `src/frontend`：公开页面、工作室组件与设计令牌。
- `src/backend`：认证、内容、同步服务。
- `src/database`：数据库模型与连接。
- `src/storage`：R2/本地 R2 媒体适配。
- `src/config`：品牌、文案、SEO 与功能开关。
- `src/shared`：共享类型与验证工具。
- `drizzle`：只追加的 D1 迁移。
- `scripts`：初始化、备份、同步、媒体导入和发布准备。
- `var`、`media-source`：本机持久化内容，不进入 Git。
- `legacy/site-v1`：迁移前源码快照，不参与构建。
