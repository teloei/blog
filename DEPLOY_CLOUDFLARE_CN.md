# Cloudflare 完整部署手册（Pages + Worker + D1 + R2）

适用仓库：`teloei/blog`

适用目标域名：`blog.03518888.xyz`

---

## 0. 最终架构（请先看这个）

- **Pages** 托管前端：`/`、`/admin.html`、`/post.html`
- **Pages Functions** 处理同域接口：`/blogApi`、`/uploads/*`
  - 目录在仓库根：`functions/`
- **Worker** 提供真实 API：`https://blog.teloei35.workers.dev`
  - 绑定 D1 + R2

> 你现在遇到的 “`/blogApi` 找不到” 和 “`Failed to fetch`”，本质是部署路径/绑定/环境有一项没有生效。

---

## 1. 一次性检查（账号与环境）

1. Cloudflare 右上角账号必须是同一个（创建 D1/R2 的那个账号）
2. Worker 配置页面切到 `Production`
3. Pages 项目和 Worker 项目都要连接同一个 Git 仓库：`teloei/blog`

---

## 2. Worker 项目正确配置（重点）

打开：`Workers & Pages -> 你的 Worker (blog)`

### 2.1 Git 构建设置

你截图里现在是：`根目录: /`。这会导致读取不到 `worker/wrangler.toml` 或部署不一致。

请改成下面任一方案（推荐 A）：

- 方案 A（推荐）
  - 根目录：`/worker`
  - 部署命令：`npx wrangler deploy`
  - 版本命令：`npx wrangler versions upload`

- 方案 B
  - 根目录：`/`
  - 部署命令：`npx wrangler deploy --config worker/wrangler.toml`
  - 版本命令：`npx wrangler versions upload --config worker/wrangler.toml`

### 2.2 绑定 D1 和 R2

不要点中间画布的小 `+ 绑定`，请用右上角 `添加绑定+`。

添加两条：

1. D1
- 类型：`D1 Database`
- 变量名：`DB`
- 资源：`xiaogai-blog`

2. R2
- 类型：`R2 Bucket`
- 变量名：`UPLOADS_BUCKET`
- 资源：`xiaogai-blog-uploads`

保存并部署。

### 2.3 变量与密钥

在 `Variables and Secrets`：

普通变量（Variables）：
- `SITE_TITLE = 忒卷`
- `ADMIN_TOKEN_TTL_DAYS = 30`
- `SITE_URL = https://blog.03518888.xyz`

机密（Secrets）：
- `ADMIN_PASSWORD = 你的后台密码`
- `ADMIN_SECRET = 高强度随机串（与密码不能相同）`

> 你之前把 `ADMIN_PASSWORD`、`ADMIN_SECRET` 放在变量里且相同，这不安全。请立刻重设。

---

## 3. 初始化 D1（网页执行）

打开：`Storage & Databases -> D1 -> xiaogai-blog -> Console`

把 `worker/schema.sql` 全部 SQL 粘贴执行一次。

执行后应有两张表：
- `posts`
- `comments`

---

## 4. Pages 项目正确配置

打开：`Workers & Pages -> Pages -> 你的 Pages 项目`

构建设置：
- Git 仓库：`teloei/blog`
- 分支：`main`
- **根目录：`/`（必须是仓库根，不能是 /public）**
- Build command：留空
- Build output directory：`public`

原因：`functions/` 在仓库根目录，如果根目录设成 `/public`，Functions 不会生效，`/blogApi` 就会 404。

---

## 5. 绑定自定义域名

把 `blog.03518888.xyz` 绑定到 **Pages 项目**（推荐）。

本项目默认通过 Pages Functions 同域代理，不强依赖 Worker Route。

---

## 6. 验证清单（按顺序）

1. Worker 直连
- `https://blog.teloei35.workers.dev/blogApi?action=getRss`
- 期望：返回 XML

2. Pages 同域接口
- `https://blog.03518888.xyz/blogApi?action=getRss`
- 期望：返回 XML

3. 后台登录
- `https://blog.03518888.xyz/admin.html`
- 输入 `ADMIN_PASSWORD` 登录

---

## 7. 常见问题与对应修复

### 问题 A：绑定界面一直是空白

- 原因 1：点错入口（点了画布里的小 `+ 绑定`）
- 原因 2：当前不是 Production 环境
- 原因 3：账号不对（资源不在当前账号）

### 问题 B：`/blogApi` 404

- Pages 根目录错误（设成了 `/public`）
- 或 Functions 没部署成功

### 问题 C：后台提示 `Failed to fetch`

- Worker 不可达
- 同域 `/blogApi` 没接通
- 浏览器跨域/网络导致直连失败

本仓库已加入：
- `functions/blogApi.js`
- `functions/uploads/[[path]].js`
- `public/app.js` 的 API 回退逻辑

只要按本手册部署，通常可恢复。

---

## 8. 自动部署规则（你后续只管推代码）

- Worker：连接 Git 后，`main` 新提交会自动触发部署
- Pages：连接 Git 后，`main` 新提交会自动触发部署

也就是说，后续你让我改代码并推送到 `main`，Cloudflare 会自动更新线上。
