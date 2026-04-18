# 自定义域名绑定指南

## 目标
将 `https://blog.03518888.xyz` 从 workers.dev 迁移到独立域名，解除单点依赖。

---

## 步骤一：在 Cloudflare 购买/添加域名

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 选择对应账号
3. 点击 **Add a Site** → 输入你的域名（如 `yourdomain.com`）
4. 选择 **Free** 计划（足够个人博客使用）
5. Cloudflare 会给出 Nameservers，登录域名注册商替换 Nameservers
6. 等待 DNS 生效（通常 5 分钟 ~ 24 小时）

---

## 步骤二：配置 DNS 解析（Cloudflare Dashboard → 你的域名 → DNS）

### 方案 A：仅使用 Pages（推荐，最简单）

| 类型 | 名称 | 内容 | 代理状态 |
|------|------|------|----------|
| CNAME | `blog` 或 `@` | `blog.teloei35.pages.dev` | **DNS only（灰色云）** |

> ⚠️ Pages 项目需先在 Dashboard 绑定自定义域才能生效（见步骤三）

### 方案 B：使用 Worker 域名（SSR + 自定义域）

| 类型 | 名称 | 内容 | 代理状态 |
|------|------|------|----------|
| CNAME | `blog-api` | `blog.teloei35.workers.dev` | **DNS only（灰色云）** |
| CNAME | `blog` 或 `@` | `blog.teloei35.pages.dev` | **DNS only（灰色云）** |

> Workers.dev 域名本身不支持自定义域，必须通过 CNAME 指向 pages.dev

---

## 步骤三：在 Cloudflare Pages 绑定自定义域

1. 进入 **Workers & Pages** → 选择 `blog` 项目
2. 点击 **Settings** → **Custom Domains** → **Set up a custom domain**
3. 输入你的域名（如 `blog.yourdomain.com`）
4. Cloudflare 会自动添加 DNS 验证记录
5. 等待 SSL 证书自动签发（通常 1~5 分钟）
6. 验证：访问你的域名，应看到博客首页

---

## 步骤四：更新代码中的硬编码 URL

绑定后需将以下文件中的 `blog.teloei35.workers.dev` 替换为你的自定义域名：

### 4.1 `worker/wrangler.toml`
```toml
[vars]
SITE_URL = "https://blog.03518888.xyz"   # ← 改为你的自定义域
```

### 4.2 `public/cloudbase-config.js`
```js
var apiUrl = '/blogApi'; // 相对路径（推荐）
// 或
var apiUrl = 'https://blog.03518888.xyz/blogApi'; // 绝对路径
```

### 4.3 `public/index.html`
```html
<link rel="canonical" href="https://blog.03518888.xyz/">
<!-- ↓ 改为 -->
<link rel="canonical" href="https://yourdomain.com/">
```

### 4.4 `_worker.js` 中的常量
```js
const SITE_URL = 'https://blog.03518888.xyz';  // ← 改为你的自定义域
const WORKER_API = 'https://blog.03518888.xyz'; // Workers API 同域
```

### 4.5 RSS Feed URL
```html
<!-- index.html / post.html -->
<link rel="alternate" href="https://blog.03518888.xyz/blogApi?action=getRss">
```

---

## 步骤五：配置 Always Use HTTPS

在 Cloudflare Dashboard → 你的域名 → **SSL/TLS** → **Edge Certificates**：

- **Mode**: Full（严格）
- 开启 **Always Use HTTPS**
- 开启 **Automatic HTTPS Rewrites**

---

## 步骤六：重新部署

```bash
# 部署 Worker
cd worker
wrangler deploy

# 部署 Pages
cd ..
npx wrangler pages deploy public --project-name=blog
```

---

## 步骤七：验证

```bash
# 检查 SSL
curl -I https://blog.03518888.xyz

# 检查 SSR（应返回带数据的 HTML）
curl -s https://blog.03518888.xyz/ | grep '__SSR_DATA__'
```

---

## 架构说明

```
用户请求 https://blog.03518888.xyz/
        │
        ▼
Cloudflare Pages（自定义域）
    ↓ 匹配 _worker.js（Pages Functions）
    ↓ 渲染 HTML + 注入 SSR 数据
    ↓
Cloudflare D1（读取文章数据）
    ↓
返回完整 HTML（首字节 ~2KB 含数据）
    ↓
浏览器接收 → 立即渲染（无白屏）
    ↓ JS 加载后接管（水合）
```

---

## 常见问题

### Q: Pages Functions 是什么？和 Workers 有什么区别？
- **Workers**：独立的边缘计算服务，适合 API 请求
- **Pages Functions**：部署在 Pages 项目里的 Serverless 函数，支持 SSR
- 本项目：`_worker.js` 是 Pages Function（用于 SSR），`worker/src/index.js` 是独立 Worker（处理 API）

### Q: 为什么 Worker API 也要绑定自定义域？
当前 API 是 `blog.teloei35.workers.dev`，若 workers.dev 被封/不可达，前端 API 请求会失败。
绑定自定义域后，Worker API 可以通过 `https://blog.yourdomain.com/blogApi` 访问。

### Q: 自定义域 SSL 证书多久刷新？
Cloudflare 自动管理，有效期 3 个月，到期前自动续期。

---

## 建议的最终配置

```
https://blog.yourdomain.com     → 博客前端（SSR）
https://blog.yourdomain.com/blogApi  → API（Workers）
https://blog.yourdomain.com/blogApi?action=getRss  → RSS Feed
```
