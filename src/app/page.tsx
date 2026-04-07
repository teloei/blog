"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type DisplayMode = "night" | "day" | "sunny";

export default function Home() {
  const [mode, setMode] = useState<DisplayMode>("sunny");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const router = useRouter();

  // Video and audio refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);

  useEffect(() => {
    // Load mode from localStorage
    const savedMode = localStorage.getItem("xiaogai-display-mode") as DisplayMode | null;
    if (savedMode) {
      setMode(savedMode);
    }

    // Check admin auth
    const auth = localStorage.getItem("xiaogai-admin-auth");
    if (auth === "true") {
      setIsAdmin(true);
    }
  }, []);

  useEffect(() => {
    const body = document.body;
    body.classList.remove("light", "sunny");
    
    if (mode === "day") {
      body.classList.add("light");
    } else if (mode === "sunny") {
      body.classList.add("light", "sunny");
    }
    
    localStorage.setItem("xiaogai-display-mode", mode);
  }, [mode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "d") setMode("day");
      else if (key === "n") setMode("night");
      else if (key === "s") setMode("sunny");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple password check - in production this should be server-side
    if (adminPassword === "admin123") {
      setIsAdmin(true);
      localStorage.setItem("xiaogai-admin-auth", "true");
      setLoginError("");
    } else {
      setLoginError("密码错误");
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem("xiaogai-admin-auth");
  };

  // Video autoplay control based on mode
  useEffect(() => {
    if (videoRef.current) {
      if (mode === "sunny") {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [mode]);

  const toggleAudio = () => {
    if (audioRef.current) {
      if (audioEnabled) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(() => {});
      }
      setAudioEnabled(!audioEnabled);
    }
  };

  return (
    <>
      {/* Audio element - forest ambient sound */}
      <audio 
        ref={audioRef} 
        id="forest-audio" 
        src="/forest.mp3" 
        loop 
        preload="auto"
      />

      {/* Video overlay - leaves falling effect for sunny mode */}
      <video 
        ref={videoRef}
        id="leaves-overlay" 
        src="/leaves.mp4" 
        loop 
        muted 
        playsInline 
        autoPlay
        preload="auto"
        className="leaves-overlay"
      />

      {/* Noise overlay */}
      <div className="noise" />
      
      {/* Sun glow effect */}
      <div className="sun-glow" />
      
      {/* Light shafts */}
      <div className="light-shaft light-shaft-1" />
      <div className="light-shaft light-shaft-2" />
      <div className="light-shaft light-shaft-3" />

      {/* Mode indicator */}
      <div className="mode-indicator">
        {isAdmin ? (
          <button 
            className="mode-link" 
            onClick={() => router.push("/admin")}
            style={{ background: "none", border: "none", cursor: "pointer" }}
          >
            CMS
          </button>
        ) : (
          <span className="mode-link">CMS</span>
        )}
        <div 
          className={`mode-dot ${mode === "night" ? "active" : ""}`}
          onClick={() => setMode("night")}
          title="Night mode"
        />
        <div 
          className={`mode-dot ${mode === "day" ? "active" : ""}`}
          onClick={() => setMode("day")}
          title="Day mode"
        />
        <div 
          className={`mode-dot ${mode === "sunny" ? "active" : ""}`}
          onClick={() => setMode("sunny")}
          title="Sunny mode"
        />
        <button
          className="mode-link"
          onClick={toggleAudio}
          style={{ background: "none", border: "none", cursor: "pointer", marginLeft: "8px" }}
          title={audioEnabled ? "关闭音效" : "开启音效"}
        >
          {audioEnabled ? "🔊" : "🔇"}
        </button>
      </div>

      {/* Main content */}
      <main className="page">
        {/* Hero Section */}
        <section className="hero home-hero">
          <div className="logo">
            <button 
              className="logo-letter" 
              data-mode="day"
              onClick={() => setMode("day")}
            >
              小
              <span className="logo-hint">Something</span>
            </button>
            <button 
              className="logo-letter" 
              data-mode="sunny"
              onClick={() => setMode("sunny")}
            >
              盖
              <span className="logo-hint">Interesting</span>
            </button>
          </div>
          <p className="bio">做有意思的事情。</p>
        </section>

        {/* Divider */}
        <div className="divider" />

        {/* Stream Section - Placeholder for blog posts */}
        <section className="section home-stream-section">
          <div className="section-head">
            <div></div>
          </div>
          <div id="posts-list" className="entries">
            <div className="entry-card visible">
              <a href="#" className="entry-link">
                <h2 className="entry-title">欢迎来到小盖的博客</h2>
                <p className="entry-excerpt">这是一个重建的个人博客站点，原站使用云开发后端...</p>
                <div className="entry-meta">
                  <span className="meta-chip">公告</span>
                  <span>2026-04-07</span>
                </div>
              </a>
            </div>
          </div>
          <div id="posts-empty" className="hidden text-center py-12 text-[var(--mid)] font-mono text-xs uppercase tracking-wider">
            还没有发布文章。你可以先去后台写第一篇。
          </div>
        </section>

        {/* Divider */}
        <div className="divider" />

        {/* Connect Section */}
        <section className="section connect-section">
          <div className="section-title mb-4">Connect</div>
          <div className="links links-connect">
            <a 
              href="/blogApi?action=getRss" 
              target="_blank" 
              rel="noreferrer"
            >
              RSS
            </a>
            <a 
              href="https://www.xiaohongshu.com/user/profile/6720c690000000001c01b883" 
              target="_blank" 
              rel="noreferrer"
            >
              小红书
            </a>
            <a href="mailto:gainubi@gmail.com">
              邮箱
            </a>
          </div>
        </section>
      </main>

      {/* Shortcuts hint */}
      <div className="shortcuts-hint">
        <kbd>D</kbd> day &nbsp; <kbd>N</kbd> night &nbsp; <kbd>S</kbd> sunny
      </div>
    </>
  );
}