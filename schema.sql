-- ============================================
-- Teloei's Blog - Database Schema
-- Cloudflare D1 (SQLite)
-- ============================================

-- 文章浏览量表
CREATE TABLE IF NOT EXISTS views (
  slug TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 评论表
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '匿名',
  email TEXT,
  website TEXT,
  content TEXT NOT NULL,
  parent_id INTEGER,
  is_admin BOOLEAN NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
);

-- 点赞表（评论点赞）
CREATE TABLE IF NOT EXISTS comment_likes (
  comment_id INTEGER NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (comment_id, ip_hash),
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

-- Newsletter 订阅表
CREATE TABLE IF NOT EXISTS newsletter (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  confirmed BOOLEAN NOT NULL DEFAULT 0,
  confirm_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_comments_slug ON comments(slug);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_visible ON comments(slug, is_visible);
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_token ON newsletter(confirm_token);
