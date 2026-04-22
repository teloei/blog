// ============================================
// Database Initialization
// Auto-creates tables and default admin on first run
// ============================================

const SCHEMA_SQL = `
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

-- 点赞表
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

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'editor' CHECK(role IN ('admin', 'editor')),
  avatar TEXT,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  last_login TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  ip TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 操作日志表
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  detail TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 文章-标签关联
CREATE TABLE IF NOT EXISTS article_tags (
  article_slug TEXT NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (article_slug, tag_id),
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_comments_slug ON comments(slug);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_visible ON comments(slug, is_visible);
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_token ON newsletter(confirm_token);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);
CREATE INDEX IF NOT EXISTS idx_article_tags_tag ON article_tags(tag_id);
`;

let initialized = false;
let initPromise: Promise<void> | null = null;

export async function ensureDatabaseInitialized(db: any): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Check if users table exists
      const result = await db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        .first();

      if (!result) {
        console.log("[DB] Initializing database schema...");
        // Run schema in batches (D1 has limits)
        const statements = SCHEMA_SQL.split(";").filter((s) => s.trim());
        for (const stmt of statements) {
          if (stmt.trim()) {
            await db.exec(stmt.trim());
          }
        }
        console.log("[DB] Schema initialized");
      }

      initialized = true;
    } catch (error) {
      console.error("[DB] Initialization error:", error);
      throw error;
    }
  })();

  return initPromise;
}
