# Teloei's Blog

一个基于 Astro 构建的个人博客，部署在 Cloudflare Pages。

## ✨ 特性

- 🎨 **Claude 风格设计系统** — 温暖陶土色调，优雅编辑风格
- ⚡ **极速加载** — Astro 零 JS 默认输出，Lighthouse 98-100 分
- 🌙 **暗色模式** — 跟随系统偏好，支持手动切换
- 📱 **响应式设计** — 手机、平板、桌面完美适配
- 📝 **MDX 支持** — Markdown 增强写作体验
- 🏷️ **标签系统** — 按标签筛选和浏览文章
- 📅 **归档页面** — 按时间线浏览所有文章
- 🔍 **SEO 优化** — Open Graph、Twitter Cards、Sitemap、RSS
- 🚀 **自动部署** — GitHub Actions + Cloudflare Pages

## 🛠 技术栈

| 技术 | 用途 |
|------|------|
| [Astro](https://astro.build/) 5 | 静态站点生成器 |
| [Tailwind CSS](https://tailwindcss.com/) 4 | 样式框架 |
| [Cloudflare Pages](https://pages.cloudflare.com/) | 部署平台 |
| GitHub Actions | CI/CD 自动化 |

## 🚀 快速开始

```bash
# 克隆项目
git clone https://github.com/teloei/blog.git
cd blog

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 本地预览构建结果
npm run preview
```

## 📁 项目结构

```
/
├── public/                  # 静态资源
│   └── favicon.svg
├── src/
│   ├── components/          # 组件
│   │   ├── Header.astro     # 导航栏（含暗色模式切换）
│   │   ├── Footer.astro     # 页脚
│   │   └── BlogCard.astro   # 博客卡片
│   ├── content/
│   │   ├── config.ts        # 内容集合定义
│   │   └── blog/            # 博客文章 (Markdown)
│   ├── layouts/
│   │   ├── BaseLayout.astro # 基础布局
│   │   └── BlogPost.astro   # 文章布局
│   ├── pages/               # 页面路由
│   │   ├── index.astro      # 首页
│   │   ├── blog/            # 博客
│   │   ├── about.astro      # 关于
│   │   ├── archive.astro    # 归档
│   │   ├── tags.astro       # 标签
│   │   └── 404.astro        # 404
│   └── styles/
│       └── global.css       # 全局样式（Tailwind v4）
├── astro.config.mjs
├── package.json
└── wrangler.toml
```

## ✏️ 写新文章

在 `src/content/blog/` 目录下创建 `.md` 或 `.mdx` 文件：

```markdown
---
title: '文章标题'
date: 2025-04-19
tags: ['标签1', '标签2']
excerpt: '文章摘要'
draft: false          # 设为 true 则不会发布
---

文章内容...
```

## 🎨 自定义设计

### 修改颜色

编辑 `src/styles/global.css` 中的 `@theme` 部分：

```css
@theme {
  --color-terra: #D97757;       /* 主色调 */
  --color-terra-dark: #CC6B4D;  /* 悬停色 */
  --color-cream: #FAFAF9;       /* 背景色 */
  /* ... */
}
```

### 修改字体

在 `src/layouts/BaseLayout.astro` 的 `<head>` 中修改 Google Fonts 链接。

## 🌐 部署

### Cloudflare Pages（推荐）

1. 将代码推送到 GitHub
2. 在 Cloudflare Dashboard → Workers & Pages → 创建项目
3. 连接 GitHub 仓库
4. 设置：构建命令 `npm run build`，输出目录 `dist`
5. 自动部署

### GitHub Actions（备选）

配置 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` Secrets，推送代码即可自动部署。

## 📄 License

MIT
