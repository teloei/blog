"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Post {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  publishedAt: string;
  updatedAt: string;
  tags: string[];
}

interface Comment {
  id: string;
  author: string;
  content: string;
  postId: string;
  postTitle: string;
  createdAt: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [activeView, setActiveView] = useState<"posts" | "comments">("comments");
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    tags: "",
  });

  useEffect(() => {
    const auth = localStorage.getItem("xiaogai-admin-auth");
    if (auth === "true") {
      setIsAuthenticated(true);
      loadData();
    }
  }, []);

  const loadData = () => {
    const savedPosts = localStorage.getItem("xiaogai-posts");
    const savedComments = localStorage.getItem("xiaogai-comments");
    if (savedPosts) setPosts(JSON.parse(savedPosts));
    if (savedComments) setComments(JSON.parse(savedComments));
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "admin123") {
      setIsAuthenticated(true);
      localStorage.setItem("xiaogai-admin-auth", "true");
      setLoginError("");
      loadData();
    } else {
      setLoginError("密码错误");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem("xiaogai-admin-auth");
    router.push("/");
  };

  const handleSavePost = (e: React.FormEvent) => {
    e.preventDefault();
    const newPost: Post = {
      id: editingPost?.id || Date.now().toString(),
      title: formData.title,
      content: formData.content,
      excerpt: formData.content.slice(0, 150) + "...",
      publishedAt: editingPost?.publishedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: formData.tags.split(",").map(t => t.trim()).filter(Boolean),
    };

    const updatedPosts = editingPost
      ? posts.map(p => p.id === editingPost.id ? newPost : p)
      : [newPost, ...posts];

    setPosts(updatedPosts);
    localStorage.setItem("xiaogai-posts", JSON.stringify(updatedPosts));
    setShowEditor(false);
    setEditingPost(null);
    setFormData({ title: "", content: "", tags: "" });
  };

  const handleDeletePost = (id: string) => {
    if (confirm("确定要删除这篇文章吗？")) {
      const updatedPosts = posts.filter(p => p.id !== id);
      setPosts(updatedPosts);
      localStorage.setItem("xiaogai-posts", JSON.stringify(updatedPosts));
    }
  };

  const handleDeleteComment = (id: string) => {
    if (confirm("确定要删除这条留言吗？")) {
      const updatedComments = comments.filter(c => c.id !== id);
      setComments(updatedComments);
      localStorage.setItem("xiaogai-comments", JSON.stringify(updatedComments));
    }
  };

  const seedPosts = () => {
    const samplePosts: Post[] = [
      {
        id: "1",
        title: "欢迎来到小盖的博客",
        content: "这是一个轻量级的个人博客系统。你可以在这里记录想法、分享经验、展示作品。\n\n博客支持 Markdown 格式的正文，可以插入图片，设置标签。",
        excerpt: "这是一个轻量级的个人博客系统...",
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: ["公告", "介绍"],
      },
      {
        id: "2",
        title: "关于网站重构",
        content: "原站使用腾讯云开发作为后端，现在重构为纯前端版本，数据存储在 localStorage 中。\n\n虽然功能有所简化，但核心体验得以保留。",
        excerpt: "原站使用腾讯云开发作为后端...",
        publishedAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
        tags: ["技术", "重构"],
      },
    ];
    setPosts(samplePosts);
    localStorage.setItem("xiaogai-posts", JSON.stringify(samplePosts));
  };

  if (!isAuthenticated) {
    return (
      <main className="page page-wide admin-page">
        <section className="section">
          <div className="section-head">
            <div>
              <div className="section-title">CMS</div>
              <h1 className="admin-title">小盖内容后台</h1>
            </div>
            <a className="subtle-link" href="/">查看博客</a>
          </div>
        </section>

        <section className="section admin-login-shell">
          <div className="panel">
            <div className="panel-title">管理员登录</div>
            <form onSubmit={handleLogin} className="stack-form">
              <div className="field-row">
                <label className="field-label" htmlFor="admin-password">后台口令</label>
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="默认密码: admin123"
                />
              </div>
              <button className="button" type="submit">进入后台</button>
              {loginError && <div className="feedback error">{loginError}</div>}
            </form>
          </div>
        </section>
      </main>
    );
  }

  if (showEditor) {
    return (
      <main className="page page-wide admin-page">
        <section className="section">
          <div className="section-head">
            <div>
              <div className="section-title">CMS</div>
              <h1 className="admin-title">小盖内容后台</h1>
            </div>
            <button className="button button-ghost" onClick={() => setShowEditor(false)}>
              返回列表
            </button>
          </div>
        </section>

        <section className="admin-view">
          <div className="panel admin-editor-panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">{editingPost ? "编辑文章" : "新建文章"}</div>
                <div className="section-title">只需要填写标题和正文</div>
              </div>
            </div>
            <form onSubmit={handleSavePost} className="stack-form">
              <div className="field-row">
                <label className="field-label">标题</label>
                <input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  maxLength={80}
                  required
                />
              </div>
              <div className="field-row">
                <label className="field-label">正文</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={18}
                  required
                  placeholder="支持基础 Markdown。引用用 > 开头，空行分段。"
                />
              </div>
              <div className="field-row">
                <label className="field-label">标签（用逗号分隔）</label>
                <input
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="例如: 技术, 生活, 随笔"
                />
              </div>
              <div className="form-actions">
                <button className="button" type="submit">
                  {editingPost ? "保存修改" : "发布文章"}
                </button>
                <button className="button button-ghost" type="button" onClick={() => setShowEditor(false)}>
                  取消
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page page-wide admin-page">
      <section className="section">
        <div className="section-head">
          <div>
            <div className="section-title">CMS</div>
            <h1 className="admin-title">小盖内容后台</h1>
          </div>
          <a className="subtle-link" href="/">查看博客</a>
        </div>
      </section>

      <section className="admin-shell">
        <div className="admin-nav">
          <div className="admin-nav-tabs">
            <button
              className={`button button-ghost admin-nav-button ${activeView === "comments" ? "is-active" : ""}`}
              onClick={() => setActiveView("comments")}
            >
              留言列表
            </button>
            <button
              className={`button button-ghost admin-nav-button ${activeView === "posts" ? "is-active" : ""}`}
              onClick={() => setActiveView("posts")}
            >
              文章列表
            </button>
          </div>
          <div className="admin-nav-actions">
            <button className="button" onClick={() => {
              setEditingPost(null);
              setFormData({ title: "", content: "", tags: "" });
              setShowEditor(true);
            }}>
              新建文章
            </button>
            <button className="button button-ghost" onClick={handleLogout}>
              退出
            </button>
          </div>
        </div>

        {activeView === "posts" && (
          <section className="admin-view">
            <div className="panel admin-list-panel">
              <div className="panel-head">
                <div className="panel-title">
                  文章列表
                  <span className="admin-count-badge">{posts.length}</span>
                </div>
                <div className="section-title">按更新时间倒序</div>
              </div>
              {posts.length === 0 && (
                <div className="empty-state py-8">
                  暂无文章
                  <button className="button button-secondary ml-4" onClick={seedPosts}>
                    导入示例文章
                  </button>
                </div>
              )}
              <div className="admin-list">
                {posts.map((post) => (
                  <div key={post.id} className="admin-item">
                    <div className="admin-item-title">{post.title}</div>
                    <div className="admin-item-excerpt">{post.excerpt}</div>
                    <div className="admin-item-actions">
                      <button
                        className="button button-ghost"
                        onClick={() => {
                          setEditingPost(post);
                          setFormData({
                            title: post.title,
                            content: post.content,
                            tags: post.tags.join(", "),
                          });
                          setShowEditor(true);
                        }}
                      >
                        编辑
                      </button>
                      <button
                        className="button button-danger"
                        onClick={() => handleDeletePost(post.id)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeView === "comments" && (
          <section className="admin-view">
            <div className="panel admin-comments-panel">
              <div className="panel-head">
                <div className="panel-title">
                  留言列表
                  <span className="admin-count-badge">{comments.length}</span>
                </div>
                <div className="section-title">按时间倒序</div>
              </div>
              {comments.length === 0 ? (
                <div className="empty-state py-8">暂无留言</div>
              ) : (
                <div className="admin-list">
                  {comments.map((comment) => (
                    <div key={comment.id} className="admin-item">
                      <div className="admin-meta">
                        {comment.author} · {new Date(comment.createdAt).toLocaleDateString()}
                      </div>
                      <div className="admin-item-excerpt">{comment.content}</div>
                      <div className="admin-item-actions">
                        <button
                          className="button button-danger"
                          onClick={() => handleDeleteComment(comment.id)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
