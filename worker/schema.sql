-- 博客数据库表结构
-- 支持：文章、评论、标签系统、网站配置

-- 文章表
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',  -- JSON数组存储标签
  status TEXT NOT NULL DEFAULT 'published',
  published_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_posts_status_published_at
ON posts(status, published_at DESC);

-- 标签索引（用于搜索）
CREATE INDEX IF NOT EXISTS idx_posts_tags
ON posts(tags);

-- 评论表
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  parent_id TEXT,
  author TEXT NOT NULL,
  author_role TEXT NOT NULL DEFAULT 'visitor',
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'visible',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id)
);

CREATE INDEX IF NOT EXISTS idx_comments_post_status_created
ON comments(post_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_parent
ON comments(parent_id);

CREATE INDEX IF NOT EXISTS idx_comments_status_created
ON comments(status, created_at DESC);

-- 网站配置表（Connect 模块等全局配置）
CREATE TABLE IF NOT EXISTS site_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
