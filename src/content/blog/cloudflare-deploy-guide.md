---
title: 'Cloudflare Pages 部署完全指南'
date: 2025-02-01
tags: ['Cloudflare', '部署', 'DevOps']
excerpt: '从零开始，一步步将你的网站部署到 Cloudflare Pages，实现自动化 CI/CD。'
---

Cloudflare Pages 是目前最好的静态网站托管平台之一。全球 CDN、无限带宽（在免费额度内）、自动 HTTPS，而且可以直接连接 GitHub 实现自动化部署。

## 准备工作

你需要：

1. 一个 [Cloudflare](https://dash.cloudflare.com/sign-up) 账号
2. 一个 [GitHub](https://github.com) 账号
3. 一个准备好的项目（本博客使用 Astro）

## 方式一：通过 Cloudflare Dashboard 部署

这是最简单的方式，适合不熟悉命令行的开发者。

### 步骤 1：登录 Cloudflare

访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)，注册或登录账号。

### 步骤 2：创建 Pages 项目

1. 在左侧菜单找到 **Workers & Pages**
2. 点击 **Create application**
3. 选择 **Pages** 标签
4. 点击 **Connect to Git**

### 步骤 3：连接 GitHub

1. 授权 Cloudflare 访问你的 GitHub 账号
2. 选择你的博客仓库
3. 配置构建设置：

| 设置项 | 值 |
|--------|-----|
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |
| Node.js 版本 | `18`（或更高） |

### 步骤 4：部署

点击 **Save and Deploy**，Cloudflare 会自动开始构建。通常 1-2 分钟内完成。

## 方式二：通过 Wrangler CLI 部署

适合喜欢命令行工作流的开发者。

```bash
# 安装 Wrangler
npm install -g wrangler

# 登录
wrangler login

# 部署
wrangler pages deploy dist
```

## 自定义域名

1. 在 Cloudflare Pages 项目设置中，点击 **Custom domains**
2. 添加你的域名
3. 按照提示配置 DNS 记录

如果你使用 Cloudflare 管理 DNS，只需添加一条 CNAME 记录即可。

## 性能优化

Cloudflare Pages 自带一些优化能力，但你也可以进一步优化：

- **缓存策略**：在 `_headers` 文件中设置静态资源的缓存时间
- **图片优化**：使用 Astro 的图片组件配合 Cloudflare Images
- **压缩**：Cloudflare 自动启用 Brotli 和 Gzip 压缩

## 常见问题

**构建失败？**
- 检查 Node.js 版本是否 >= 18
- 确认 package.json 中的构建命令正确
- 查看 Cloudflare 的构建日志

**页面 404？**
- 确认输出目录设置为 `dist`
- 检查 `_redirects` 文件是否存在

**部署速度慢？**
- 利用 Cloudflare 的缓存功能
- 减少不必要的依赖

## 总结

Cloudflare Pages 为个人开发者提供了零成本的全球部署方案。配合 GitHub 的自动化部署，你只需要专注于内容创作，技术基础设施交给 Cloudflare 处理。

这才是现代开发者应该有的体验——把时间花在创造价值上，而不是维护基础设施。
