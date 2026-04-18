/**
 * effects.js - 全局动态交互效果
 * 粒子背景 · 磁吸光标 · 鼠标拖尾 · 涟漪点击 · 滚动入场
 */
(function () {
  "use strict";

  // ─── 粒子背景 ─────────────────────────────────────────────
  function initParticleCanvas() {
    var canvas = document.getElementById("particle-canvas");
    if (!canvas) return;

    var ctx = canvas.getContext("2d");
    var particles = [];
    var raf;
    var W, H;
    var isNight = true;

    function resize() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize, { passive: true });

    function isDark() {
      // Vercel: night mode = dark particles
      var mode = document.documentElement.getAttribute("data-mode");
      return mode === "night";
    }

    function targetCount() {
      return isDark() ? 60 : 30;
    }

    function spawnParticle(fromEdge) {
      return {
        x: fromEdge ? (Math.random() < 0.5 ? 0 : W) : Math.random() * W,
        y: fromEdge ? Math.random() * H : H + 10,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -(Math.random() * 0.5 + 0.1),
        size: Math.random() * 2.5 + 0.5,
        alpha: Math.random() * 0.5 + 0.1,
        decay: Math.random() * 0.002 + 0.001,
        life: 1
      };
    }

    for (var i = 0; i < 40; i++) {
      var p = spawnParticle(false);
      p.y = Math.random() * H;
      p.life = Math.random();
      particles.push(p);
    }

    function drawParticle(p) {
      var accent = isDark() ? "234,88,12" : "180,83,9";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle =
        "rgba(" + accent + "," + (p.alpha * p.life).toFixed(3) + ")";
      ctx.fill();
    }

    function drawLine(p1, p2, alpha) {
      var accent = isDark() ? "234,88,12" : "180,83,9";
      var dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (dist > 120) return;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle =
        "rgba(" + accent + "," + (alpha * (1 - dist / 120)).toFixed(3) + ")";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    function tick() {
      ctx.clearRect(0, 0, W, H);

      var prevDark = isNight;
      isNight = isDark();
      if (prevDark !== isNight) {
        while (particles.length > targetCount()) particles.pop();
      }

      while (particles.length < targetCount()) {
        particles.push(spawnParticle(true));
      }

      var i = 0;
      while (i < particles.length) {
        var p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;

        if (p.life <= 0 || p.y < -20 || p.x < -20 || p.x > W + 20) {
          particles.splice(i, 1);
          continue;
        }
        i++;
      }

      for (var a = 0; a < particles.length; a++) {
        drawParticle(particles[a]);
        for (var b = a + 1; b < particles.length; b++) {
          drawLine(particles[a], particles[b], 0.15);
        }
      }

      raf = requestAnimationFrame(tick);
    }

    tick();

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        tick();
      }
    });
  }

  // ─── 磁吸光标 ─────────────────────────────────────────────
  function initCursorGlow() {
    var glow = document.getElementById("cursor-glow");
    if (!glow) return;
    if (window.matchMedia("(hover: none)").matches) return;

    var sx = 0, sy = 0;
    var cx = -200, cy = -200;
    var raf;

    glow.classList.add("visible");

    function animate() {
      cx += (sx - cx) * 0.12;
      cy += (sy - cy) * 0.12;
      glow.style.left = cx + "px";
      glow.style.top  = cy + "px";
      raf = requestAnimationFrame(animate);
    }

    document.addEventListener("mousemove", function (e) {
      sx = e.clientX;
      sy = e.clientY;
    }, { passive: true });

    document.addEventListener("mouseleave", function () {
      glow.style.opacity = "0";
    });

    document.addEventListener("mouseenter", function () {
      glow.style.opacity = "";
    });

    animate();
  }

  // ─── 鼠标拖尾 ─────────────────────────────────────────────
  function initMouseTrail() {
    if (window.matchMedia("(hover: none)").matches) return;
    var last = 0;

    document.addEventListener("mousemove", function (e) {
      var now = Date.now();
      if (now - last < 60) return;
      last = now;
      createTrailParticle(e.clientX, e.clientY);
    }, { passive: true });
  }

  function createTrailParticle(x, y) {
    var el = document.createElement("div");
    el.className = "trail-particle";
    el.style.left = x + "px";
    el.style.top  = y + "px";
    document.body.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 700);
  }

  // ─── 涟漪点击效果 ─────────────────────────────────────────
  function initRipple() {
    document.addEventListener("click", function (e) {
      var target = e.target.closest("button, a, .connect-item");
      if (!target) return;
      if (target.dataset.hasRipple) return;

      var ripple = document.createElement("span");
      ripple.className = "ripple-wave";

      var rect = target.getBoundingClientRect();
      var size = Math.max(rect.width, rect.height);
      ripple.style.width  = size + "px";
      ripple.style.height = size + "px";
      ripple.style.left = (e.clientX - rect.left - size / 2) + "px";
      ripple.style.top  = (e.clientY - rect.top  - size / 2) + "px";

      target.style.position = "relative";
      target.style.overflow  = "hidden";
      target.dataset.hasRipple = "1";
      target.appendChild(ripple);

      setTimeout(function () {
        if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
      }, 600);
    }, true);
  }

  // ─── 滚动入场动画 ─────────────────────────────────────────
  function initScrollReveal() {
    var els = document.querySelectorAll(
      ".section, .entry-card, .hero"
    );
    if (!els.length) return;

    els.forEach(function (el) {
      if (!el.classList.contains("hero")) {
        el.classList.add("scroll-reveal");
      }
    });

    var observer = new IntersectionObserver(function (items) {
      items.forEach(function (item) {
        if (item.isIntersecting) {
          item.target.classList.add("revealed");
          observer.unobserve(item.target);
        }
      });
    }, { threshold: 0.05, rootMargin: "0px 0px -20px 0px" });

    els.forEach(function (el) {
      if (!el.classList.contains("hero")) {
        observer.observe(el);
      }
    });
  }

  // ─── 平台 SVG 图标 ────────────────────────────────────────
  var PLATFORM_ICONS = {
    rss: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19.01 7.38 20 6.18 20C4.98 20 4 19.01 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z"/></svg>',
    wechat: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.362.303c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89l-.406-.032zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/></svg>',
    xiaohongshu: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 14.36c-.36.78-1.56 1.52-2.64 1.8-.36.1-.72.14-1.08.14-1.12 0-2.2-.44-3-1.2-.4-.36-.68-.84-.88-1.32-.08-.16-.12-.32-.16-.48 1.68-.56 3.32-1.44 3.32-1.44s3.96 2.56 4.44 2.48z"/></svg>',
    github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
    bilibili: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.813 4.653h.854c1.51.054 1.74.264 1.74.998v9.783c0 .734-.23.944-1.74.998v.539l-6.706.001V4.653h1.36c1.613 0 1.813.264 1.813.998v1.7h2.679v-.537zM5.387 9.106c0 .57-.379.806-1.14.806-1.14 0-1.76-.308-1.76-.92 0-.434.24-.73.65-.91.35-.14.89-.24 1.4-.31-.28-.38-.65-.61-1.15-.61-.87 0-1.56.57-1.56 1.43 0 1.72 1.26 2.59 3.21 2.59.68 0 1.27-.13 1.74-.37-.05.35-.13.56-.25.72-.18.27-.49.4-.89.4-.57 0-.86-.19-.86-.74zm-.38-.51c-.08-.29.06-.57.39-.74.39-.18.86.06.97.42-.23.05-.45.15-.61.29-.22.22-.38.5-.38.8 0 .32.16.58.49.78.27.16.68.16.95.04.09-.04.18-.09.24-.15-.08-.28-.29-.54-.61-.67-.34-.13-.72-.11-1.04.03-.31.13-.55.38-.55.73 0 .45.33.77.82.77.44 0 .81-.25 1-.65h.01l.07-.27c-.31.08-.64.11-.95.11-.8 0-1.51-.27-2.05-.8-.49-.5-.75-1.16-.75-1.86 0-1.27.73-2.22 1.89-2.61v.03l.01.05c.36-.03.76.07 1.04.29.33.24.5.63.5 1.02 0 .27-.08.54-.23.76l-.03.04h-.01z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    jike: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>'
  };

  // ─── 平台图标类名映射 ─────────────────────────────────────
  var TYPE_CLASS_MAP = {
    rss:         "icon-default",
    wechat:      "icon-wechat",
    xiaohongshu: "icon-xhs",
    github:      "icon-github",
    mail:        "icon-mail",
    bilibili:    "icon-bilibili",
    x:           "icon-x",
    jike:        "icon-jike"
  };

  // ─── 初始化 ───────────────────────────────────────────────
  function init() {
    initParticleCanvas();
    initCursorGlow();
    initMouseTrail();
    initRipple();
    initScrollReveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // 导出供外部使用
  window.__blogEffects = {
    PLATFORM_ICONS: PLATFORM_ICONS,
    TYPE_CLASS_MAP: TYPE_CLASS_MAP
  };

})();
