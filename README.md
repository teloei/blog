完整中文部署步骤见：[DEPLOY_CLOUDFLARE_CN.md](./DEPLOY_CLOUDFLARE_CN.md)


这个项目已经按 Cloudflare 部署方式拆分好：

- `public/`：前端静态站点（直接用于 Cloudflare Pages）
- `functions/`：Pages 代理层（将 `/blogApi`、`/uploads/*` 代理到 Worker，避免浏览器跨域/网络问题）
- `worker/`：后端 API Worker（`/blogApi` + `/uploads/*`）
- `worker/schema.sql`：D1 表结构（文章、评论）

## 功能

- 首页文章流、分页、主题切换（day/night/sunny）
- 文章详情、评论、嵌套回复
- 轻量 CMS（后台登录、文章增删改、评论管理、示例文章导入）
- 图片上传（R2）
- RSS 输出：`/blogApi?action=getRss`

## 目录结构

```text
public/
  index.html
  post.html
  admin.html
  app.js
  style.css
  cloudbase-config.js
  rednote/
functions/
  blogApi.js
  uploads/[[path]].js
worker/
  src/index.js
  src/sample-posts.js
  schema.sql
  wrangler.toml
```

## 1) 部署 Pages（前端）

1. 在 Cloudflare Pages 创建项目，`Build command` 留空。
2. `Build output directory` 填：`public`。
3. 确保 Pages 项目启用了 Functions（本项目根目录已有 `functions/`）。
4. 发布后先记住 Pages 域名，例如 `https://your-pages.pages.dev`。

## 2) 创建 D1 和 R2（后端存储）

在本地执行：

```bash
npx wrangler d1 create xiaogai-blog
npx wrangler r2 bucket create xiaogai-blog-uploads
```

把 D1 返回的 `database_id` 填到 `worker/wrangler.toml` 的 `database_id`。

初始化数据库：

```bash
npx wrangler d1 execute xiaogai-blog --file worker/schema.sql --config worker/wrangler.toml
```

## 3) 配置 Worker 密钥并部署

```bash
npx wrangler secret put ADMIN_PASSWORD --config worker/wrangler.toml
npx wrangler secret put ADMIN_SECRET --config worker/wrangler.toml
npx wrangler deploy --config worker/wrangler.toml
```

可选变量（在 `worker/wrangler.toml` 中）：

- `SITE_URL`：站点绝对地址，用于 RSS 链接生成
- `R2_PUBLIC_URL`：如果你使用了 R2 公网域名，可填此值

## 4) 绑定 Worker 路由到 Pages 域名

默认不需要配置 Worker 自定义路由：前端走同域 `/blogApi`，由 Pages Functions 代理到 Worker。

如需直连 Worker，可在 [public/cloudbase-config.js](./public/cloudbase-config.js) 中设置：

- `apiUrl`: 主接口地址
- `apiFallbackUrls`: 备用接口地址数组（主地址异常时自动回退）

## 5) CMS 登录

- 打开 `/admin.html`
- 使用你设置的 `ADMIN_PASSWORD` 登录

## 本地调试

```bash
npm run dev:worker
npm run dev:pages
```

> 本地联调时建议把 Worker 和 Pages 都跑起来，确保 `/blogApi` 可达。
