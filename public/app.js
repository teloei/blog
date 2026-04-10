(function () {
  var config = window.XIAOGAI_CLOUDBASE_CONFIG || {};
  var page = document.body.getAttribute("data-page");
  var adminStorageKey = config.adminStorageKey || "xiaogai-admin-token";
  var appInstance = null;
  var authInstance = null;
  var useFallback = false;

  var FALLBACK_POSTS = [
    {
      id: "demo-1",
      slug: "告别总是无言无语",
      title: "告别总是无言无语。",
      excerpt: "三月是一个过渡的月份。花开成海，柳树泛绿，一个内容产品也跟着走到了它的最后一天。",
      content: [
        "三月是一个过渡的月份。前半段，满眼望去大地上仍旧是一片冬日景象，但风开始绵了，有些品种的树，比如玉兰，慢慢长出苞芽。后半段，花开成海，柳树泛绿，春和景明。我脱去穿了一冬的秋裤，轻盈的感觉一下子就有了。",
        "这一次，和春天一起过渡的还有这个内容产品。",
        "今天是最后一天，很开心和大家一起度过三年的时光。三年前，刚开星球时，这里特别热闹，一个帖子下面动辄几百条回复。我们团队为这样的景象欢呼，知识星球的刘容说：\"这是新婚燕尔\"。",
        "她确实说对了。时间如流水般，慢慢冲刷所有的热枕。",
        "> 这人世间，所有的事情，开始时，总是轰轰烈烈，让人刻骨铭心的。但往后的余生，你却需要用无数个平平淡淡来坚守。",
        "后来，星球也慢慢恢复到了平淡。没人能阻挡时间的力量。平淡也好，于是，我把细碎的感受写到了这里，疫情封控的愤慨，奶奶离世的悲痛，创业的迷茫，回老家的见闻，对孩子教育的理解。一切的一切，都在这里。",
        "所以，我得谢谢大家，这是我人生中不可多得的机会。你们都太友好了，很少有人在评论区发出质疑或者其他不友好的评论。对于我这样一个自律能力不强的人而言，如果没有这样的刚性交付要求，那我确定自己很难坚持下来。很多时候的坚持，都是硬扛，没办法。个中辛苦，不多说。"
      ].join("\n\n"),
      status: "published",
      publishedAt: "2026-03-27T00:00:00+08:00",
      updatedAt: "2026-03-27T00:00:00+08:00"
    },
    {
      id: "demo-2",
      slug: "春天就是站在那里就够了",
      title: "春天就是站在那里就够了。",
      excerpt: "三月后半段，花开成海，柳树泛绿。春天不需要特别做什么，光是站在那里就够了。",
      content: "三月后半段，花开成海，柳树泛绿。脱去穿了一冬的秋裤，在街上走，风绵绵绵绵的。春天就是这样，不需要做什么特别的事，光是站在那里就够了。",
      status: "published",
      publishedAt: "2026-03-25T16:40:00+08:00",
      updatedAt: "2026-03-25T16:40:00+08:00"
    },
    {
      id: "demo-3",
      slug: "所有的一直有都有期限",
      title: "所有的一直有都有期限。",
      excerpt: "翻到旧照片时才明白，所有你以为会一直拥有的日子，其实都有期限。",
      content: "整理旧物翻到一张照片，是几年前回老家时在院子里拍的。奶奶站在枣树下，阳光正好。那时候觉得这样的日子会一直有。后来才知道，所有的\"一直有\"都是有期限的。",
      status: "published",
      publishedAt: "2026-03-22T21:15:00+08:00",
      updatedAt: "2026-03-22T21:15:00+08:00"
    }
  ];

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sanitizeMarkdownUrl(rawUrl) {
    var value = String(rawUrl || "").trim();
    if (!value) return "";

    var lower = value.toLowerCase();
    if (
      lower.indexOf("javascript:") === 0 ||
      lower.indexOf("data:") === 0 ||
      lower.indexOf("vbscript:") === 0
    ) {
      return "";
    }

    if (
      value.indexOf("https://") === 0 ||
      value.indexOf("http://") === 0 ||
      value.indexOf("//") === 0 ||
      value.indexOf("/") === 0 ||
      value.indexOf("./") === 0 ||
      value.indexOf("../") === 0 ||
      lower.indexOf("mailto:") === 0 ||
      lower.indexOf("tel:") === 0
    ) {
      return value;
    }

    return "";
  }

  function isVideoUrl(url) {
    return /\.(mp4|webm|ogg|mov|m4v)(?:$|[?#])/i.test(String(url || ""));
  }

  function renderInlineText(text) {
    return escapeHtml(String(text || ""))
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^\n*][\s\S]*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^\n*][^*]*?)\*/g, "<em>$1</em>")
      .replace(/~~([^\n~][^~]*?)~~/g, "<del>$1</del>");
  }

  function renderVideoEmbed(url, title) {
    var safeUrl = sanitizeMarkdownUrl(url);
    if (!safeUrl) return "";

    if (isVideoUrl(safeUrl)) {
      return [
        '<video class="post-video" controls playsinline preload="metadata" src="',
        escapeHtml(safeUrl),
        '"',
        title ? ' title="' + escapeHtml(title) + '"' : "",
        "></video>"
      ].join("");
    }

    if (!/^(https?:)?\/\//i.test(safeUrl)) {
      return "";
    }

    return [
      '<iframe class="post-video-frame" src="',
      escapeHtml(safeUrl),
      '" title="',
      escapeHtml(title || "视频播放器"),
      '" loading="lazy" referrerpolicy="no-referrer" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>'
    ].join("");
  }

  function renderInlineMarkdown(text) {
    var source = String(text || "");
    var output = "";
    var lastIndex = 0;
    var pattern = /@\[video\]\s*\(([^)]+)\)|!\[([^\]]*)\]\s*\(([^)]+)\)|\[([^\]]+)\]\s*\(([^)]+)\)/gi;
    var match;

    while ((match = pattern.exec(source)) !== null) {
      output += renderInlineText(source.slice(lastIndex, match.index));

      if (typeof match[1] === "string" && match[1] !== "") {
        var videoUrl = (match[1] || "").trim();
        var videoHtml = renderVideoEmbed(videoUrl, "内嵌视频");
        if (videoHtml) {
          output += videoHtml;
        } else {
          output += escapeHtml(match[0]);
        }
      } else if (typeof match[2] === "string") {
        var alt = match[2];
        var imageUrl = sanitizeMarkdownUrl((match[3] || "").trim());
        if (imageUrl && isVideoUrl(imageUrl)) {
          var mediaHtml = renderVideoEmbed(imageUrl, alt || "视频");
          output += mediaHtml || escapeHtml(match[0]);
        } else if (imageUrl) {
          output += '<img src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(alt) + '" loading="lazy">';
        } else {
          output += escapeHtml(match[0]);
        }
      } else {
        var label = match[4];
        var linkUrl = sanitizeMarkdownUrl((match[5] || "").trim());
        if (linkUrl) {
          var external = /^(https?:)?\/\//i.test(linkUrl);
          var attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
          output += '<a href="' + escapeHtml(linkUrl) + '"' + attrs + ">" + escapeHtml(label) + "</a>";
        } else {
          output += escapeHtml(match[0]);
        }
      }

      lastIndex = pattern.lastIndex;
    }

    output += renderInlineText(source.slice(lastIndex));
    return output;
  }

  function normalizeBrokenInlineMarkdown(markdown) {
    return String(markdown || "")
      .replace(/@\[video\]\s*\r?\n+\s*\(([^)\r\n]+)\)/gi, "@[video]($1)")
      .replace(/!\[([^\]]*)\]\s*\r?\n+\s*\(([^)\r\n]+)\)/g, "![$1]($2)")
      .replace(/\[([^\]]+)\]\s*\r?\n+\s*\(([^)\r\n]+)\)/g, "[$1]($2)");
  }

  function formatDate(value) {
    if (!value) return "";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function toDateTimeLocal(value) {
    if (!value) return "";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    var offset = date.getTimezoneOffset();
    var localDate = new Date(date.getTime() - offset * 60000);
    return localDate.toISOString().slice(0, 16);
  }

  function markdownToHtml(markdown) {
    var normalized = normalizeBrokenInlineMarkdown(markdown);
    var lines = String(normalized || "").split(/\r?\n/);
    var blocks = [];
    var paragraph = [];
    var quote = [];
    var listItems = [];
    var listType = "";
    var codeFence = [];
    var inCodeFence = false;

    function flushParagraph() {
      if (!paragraph.length) return;
      blocks.push("<p>" + renderInlineMarkdown(paragraph.join("\n")).replace(/\n/g, "<br>") + "</p>");
      paragraph = [];
    }

    function flushQuote() {
      if (!quote.length) return;
      blocks.push("<blockquote>" + renderInlineMarkdown(quote.join("\n")).replace(/\n/g, "<br>") + "</blockquote>");
      quote = [];
    }

    function flushList() {
      if (!listItems.length) return;
      var tag = listType || "ul";
      blocks.push("<" + tag + ">" + listItems.map(function (item) {
        return "<li>" + renderInlineMarkdown(item) + "</li>";
      }).join("") + "</" + tag + ">");
      listItems = [];
      listType = "";
    }

    function flushCodeFence() {
      if (!codeFence.length) return;
      blocks.push("<pre><code>" + escapeHtml(codeFence.join("\n")) + "</code></pre>");
      codeFence = [];
    }

    function flushFlowBlocks() {
      flushParagraph();
      flushQuote();
      flushList();
    }

    lines.forEach(function (line) {
      var trimmed = line.trim();

      if (inCodeFence) {
        if (/^```/.test(trimmed)) {
          inCodeFence = false;
          flushCodeFence();
        } else {
          codeFence.push(line);
        }
        return;
      }

      if (/^```/.test(trimmed)) {
        flushFlowBlocks();
        inCodeFence = true;
        codeFence = [];
        return;
      }

      if (!trimmed) {
        flushFlowBlocks();
        return;
      }

      var headingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed);
      if (headingMatch) {
        flushFlowBlocks();
        var level = headingMatch[1].length;
        blocks.push("<h" + level + ">" + renderInlineMarkdown(headingMatch[2]) + "</h" + level + ">");
        return;
      }

      if (/^(-{3,}|_{3,}|\*{3,})$/.test(trimmed)) {
        flushFlowBlocks();
        blocks.push("<hr>");
        return;
      }

      if (trimmed.indexOf(">") === 0) {
        flushParagraph();
        flushList();
        quote.push(trimmed.replace(/^>\s?/, ""));
        return;
      }

      var unorderedListMatch = /^[-*+]\s+(.*)$/.exec(trimmed);
      var orderedListMatch = /^\d+\.\s+(.*)$/.exec(trimmed);
      if (unorderedListMatch || orderedListMatch) {
        flushParagraph();
        flushQuote();
        var nextType = orderedListMatch ? "ol" : "ul";
        if (listType && listType !== nextType) {
          flushList();
        }
        listType = nextType;
        listItems.push((orderedListMatch || unorderedListMatch)[1]);
        return;
      }

      flushQuote();
      flushList();
      paragraph.push(trimmed);
    });

    if (inCodeFence) {
      flushCodeFence();
    }
    flushFlowBlocks();

    return blocks.join("");
  }

  function excerptFromContent(content) {
    var plain = String(content || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/@\[video\]\(([^)]+)\)/gi, " ")
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1 ")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ")
      .replace(/^>\s?/gm, "")
      .replace(/[>#*_`~-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    var maxLength = 90;
    if (plain.length <= maxLength) return plain;

    var sentenceEnd = -1;
    var punctuation = ["。", "！", "？", ".", "!", "?"];
    punctuation.forEach(function (mark) {
      var index = plain.lastIndexOf(mark, maxLength);
      if (index > sentenceEnd) sentenceEnd = index;
    });

    if (sentenceEnd >= 24) {
      return plain.slice(0, sentenceEnd + 1).trim();
    }

    return plain.slice(0, maxLength).trim();
  }

  function nowShanghaiIso() {
    var now = new Date();
    var shanghai = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    return shanghai.toISOString().slice(0, 19) + "+08:00";
  }

  function buildSlug(title) {
    return String(title || "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[/?#%]/g, "");
  }

  function setFeedback(element, message, type) {
    if (!element) return;
    element.textContent = message || "";
    element.className = "feedback" + (type ? " " + type : "");
  }

  function readCookie(name) {
    var match = document.cookie.match(new RegExp("(^|;\\s*)" + name + "=([^;]*)"));
    return match ? decodeURIComponent(match[2]) : "";
  }

  function persistMode(mode) {
    try {
      localStorage.setItem("xiaogai-display-mode", mode);
    } catch (error) {}

    try {
      document.cookie = "xiaogai-display-mode=" + encodeURIComponent(mode) + "; path=/; max-age=31536000; SameSite=Lax";
    } catch (error) {}
  }

  function getPersistedMode() {
    var mode = "";

    try {
      mode = localStorage.getItem("xiaogai-display-mode") || "";
    } catch (error) {
      mode = "";
    }

    if (!mode) {
      mode = readCookie("xiaogai-display-mode");
    }

    return ["night", "day", "sunny"].indexOf(mode) >= 0 ? mode : "";
  }

  function ensureModeControl() {
    var currentMode = getPersistedMode() || "sunny";
    var modeLabel = document.getElementById("mode-label");
    var modeOrder = ["night", "day", "sunny"];

    function stopSummerMedia() {
      var video = document.getElementById("leaves-overlay");
      var audio = document.getElementById("forest-audio");
      if (video) video.pause();
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    }

    function setMode(mode) {
      currentMode = mode;
      document.body.classList.remove("light", "sunny");
      ["night", "day", "sunny"].forEach(function (item) {
        var dot = document.getElementById("dot-" + item);
        if (dot) dot.classList.remove("active");
      });

      if (mode === "day") {
        document.body.classList.add("light");
        document.getElementById("dot-day").classList.add("active");
        if (modeLabel) modeLabel.textContent = "day";
        stopSummerMedia();
      } else if (mode === "sunny") {
        document.body.classList.add("light", "sunny");
        document.getElementById("dot-sunny").classList.add("active");
        if (modeLabel) modeLabel.textContent = "sunny";
        var video = document.getElementById("leaves-overlay");
        if (video) video.play().catch(function () {});
      } else {
        document.getElementById("dot-night").classList.add("active");
        if (modeLabel) modeLabel.textContent = "night";
        stopSummerMedia();
      }

      persistMode(currentMode);
    }

    function cycleMode() {
      var currentIndex = modeOrder.indexOf(currentMode);
      var nextIndex = currentIndex >= 0 ? (currentIndex + 1) % modeOrder.length : 0;
      setMode(modeOrder[nextIndex]);
    }

    document.addEventListener("keydown", function (event) {
      if (event.target && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      if (event.key === "d" || event.key === "D") setMode("day");
      if (event.key === "n" || event.key === "N") setMode("night");
      if (event.key === "s" || event.key === "S") setMode("sunny");
    });

    document.querySelectorAll(".logo-letter").forEach(function (el) {
      el.addEventListener("click", function () {
        cycleMode();
        if (typeof el.blur === "function") {
          el.blur();
        }
      });
    });

    ["night", "day", "sunny"].forEach(function (mode) {
      var dot = document.getElementById("dot-" + mode);
      if (!dot) return;
      dot.addEventListener("click", function () {
        setMode(mode);
      });
    });

    setMode(currentMode);
  }

  function resolveApiCandidates() {
    var candidates = [];
    var seen = {};

    function addCandidate(value) {
      var normalized = String(value || "").trim();
      if (!normalized || seen[normalized]) return;
      seen[normalized] = true;
      candidates.push(normalized);
    }

    addCandidate(config.apiUrl);

    if (Array.isArray(config.apiFallbackUrls)) {
      config.apiFallbackUrls.forEach(addCandidate);
    }

    if (!candidates.length) {
      addCandidate("/blogApi");
    }

    return candidates;
  }

  // 直接通过 HTTP 触发器调用云函数，无需 SDK 和 access_token
  async function callApi(action, data) {
    var apiCandidates = resolveApiCandidates();
    var body = Object.assign({ action: action }, data || {});
    var lastError = null;

    for (var i = 0; i < apiCandidates.length; i += 1) {
      var apiUrl = apiCandidates[i];

      try {
        var response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        });

        var raw = await response.text();
        var result = null;

        try {
          result = raw ? JSON.parse(raw) : null;
        } catch (parseError) {
          result = null;
        }

        if (!response.ok) {
          // 远端明确返回业务错误时，直接结束，避免覆盖真实报错（如口令错误）
          if (result && typeof result === "object" && result.ok === false) {
            var responseError = new Error(result.message || "请求失败");
            responseError.isApiBusinessError = true;
            throw responseError;
          }
          throw new Error("HTTP " + response.status);
        }

        if (!result || typeof result !== "object") {
          throw new Error("接口响应不是 JSON");
        }

        if (result.ok === false) {
          var businessError = new Error(result.message || "请求失败");
          businessError.isApiBusinessError = true;
          throw businessError;
        }

        return result;
      } catch (error) {
        if (error && error.isApiBusinessError) {
          throw error;
        }
        lastError = error;
      }
    }

    throw lastError || new Error("请求失败");
  }

  function getFallbackPost(identifier) {
    return FALLBACK_POSTS.find(function (item) {
      return item.id === identifier || item.slug === identifier;
    }) || null;
  }

  async function listPosts(opts) {
    opts = opts || {};
    if (useFallback || !config.envId) {
      var fallback = FALLBACK_POSTS.slice();
      return { posts: fallback, total: fallback.length };
    }

    try {
      var params = {};
      if (opts.page) params.page = opts.page;
      if (opts.pageSize) params.pageSize = opts.pageSize;
      var result = await callApi("listPosts", params);
      return {
        posts: result.posts || [],
        total: result.total || 0
      };
    } catch (error) {
      console.warn(error);
      useFallback = true;
      var fb = FALLBACK_POSTS.slice();
      return { posts: fb, total: fb.length };
    }
  }

  async function getPost(identifier) {
    if (useFallback || !config.envId) {
      return { post: getFallbackPost(identifier), comments: [] };
    }

    try {
      var result = await callApi("getPost", { slug: identifier, id: identifier });
      return { post: result.post || null, comments: result.comments || [] };
    } catch (error) {
      console.warn(error);
      useFallback = true;
      return { post: getFallbackPost(identifier), comments: [] };
    }
  }

  function animateEntries(selector) {
    var entries = document.querySelectorAll(selector);
    if (!entries.length || !("IntersectionObserver" in window)) {
      entries.forEach(function (entry) { entry.classList.add("visible"); });
      return;
    }

    var observer = new IntersectionObserver(function (items) {
      items.forEach(function (item) {
        if (item.isIntersecting) item.target.classList.add("visible");
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });

    entries.forEach(function (entry) {
      observer.observe(entry);
    });
  }

  function resolveConnectLinks() {
    var fallbackLinks = [
      { label: "RSS", href: "/blogApi?action=getRss" },
      { label: "小红书", href: "https://www.xiaohongshu.com/user/profile/61ec2a3a000000001000868f", target: "_blank" },
      { label: "邮箱", href: "mailto:gainubi@gmail.com" },
      { label: "GitHub", href: "https://github.com/", target: "_blank" },
      { label: "哔哩哔哩", href: "https://space.bilibili.com/", target: "_blank" }
    ];

    var rawLinks = Array.isArray(config.connectLinks) && config.connectLinks.length
      ? config.connectLinks
      : fallbackLinks;

    return rawLinks
      .map(function (item) {
        if (!item || typeof item !== "object") return null;
        var label = String(item.label || "").trim();
        var href = sanitizeMarkdownUrl(item.href || item.url || "");
        if (!label || !href) return null;

        var target = String(item.target || "").trim();
        if (!target && /^(https?:)?\/\//i.test(href)) {
          target = "_blank";
        }

        return { label: label, href: href, target: target };
      })
      .filter(Boolean);
  }

  function renderConnectLinks() {
    var container = document.getElementById("connect-links");
    if (!container) return;

    var links = resolveConnectLinks();
    container.innerHTML = links.map(function (item) {
      var attrs = "";
      if (item.target) {
        attrs += ' target="' + escapeHtml(item.target) + '"';
      }
      if (item.target === "_blank") {
        attrs += ' rel="noopener noreferrer"';
      }
      return '<a href="' + escapeHtml(item.href) + '"' + attrs + ">" + escapeHtml(item.label) + "</a>";
    }).join("");
  }

  async function initHomePage() {
    renderConnectLinks();

    var pageSize = 10;
    var params = new URLSearchParams(window.location.search);
    var currentPage = Math.max(parseInt(params.get("page") || "1", 10) || 1, 1);
    var list = document.getElementById("posts-list");
    var empty = document.getElementById("posts-empty");
    var pagination = document.getElementById("home-posts-pagination");
    var total = 0;

    async function loadPage(page) {
      var data = await listPosts({ page: page, pageSize: pageSize });
      total = data.total;
      return data.posts;
    }

    var posts = await loadPage(currentPage);
    var totalPages = Math.max(1, Math.ceil(total / pageSize));

    if (currentPage > totalPages) {
      currentPage = totalPages;
      posts = await loadPage(currentPage);
    }

    function updateHomePageUrl(page) {
      var next = new URL(window.location.href);
      if (page <= 1) {
        next.searchParams.delete("page");
      } else {
        next.searchParams.set("page", String(page));
      }
      window.history.replaceState(null, "", next.pathname + next.search + next.hash);
    }

    function renderHomePagination() {
      if (!pagination) return;

      if (totalPages <= 1) {
        pagination.innerHTML = "";
        return;
      }

      var prevDisabled = currentPage <= 1 ? " disabled" : "";
      var nextDisabled = currentPage >= totalPages ? " disabled" : "";
      pagination.innerHTML = [
        '<button class="button button-ghost home-page-button" type="button" data-home-page="prev"' + prevDisabled + '>上一页</button>',
        '<div class="home-page-indicator">第 ' + currentPage + ' / ' + totalPages + ' 页</div>',
        '<button class="button button-ghost home-page-button" type="button" data-home-page="next"' + nextDisabled + '>下一页</button>'
      ].join("");

      pagination.querySelectorAll("[data-home-page]").forEach(function (button) {
        button.addEventListener("click", async function () {
          var action = button.getAttribute("data-home-page");
          if (action === "prev" && currentPage > 1) currentPage -= 1;
          if (action === "next" && currentPage < totalPages) currentPage += 1;
          updateHomePageUrl(currentPage);
          var newPosts = await loadPage(currentPage);
          renderHomePosts(newPosts);
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      });
    }

    function renderHomePosts(postsToRender) {
      postsToRender = postsToRender || posts;

      if (!postsToRender.length) {
        empty.classList.remove("hidden");
        list.innerHTML = "";
        if (pagination) pagination.innerHTML = "";
        return;
      }

      empty.classList.add("hidden");
      list.innerHTML = postsToRender.map(function (post) {
        var href = "./post.html?id=" + encodeURIComponent(post.id);
        return [
          '<article class="entry-card">',
          '  <a class="entry-link" href="' + href + '">',
          '    <h2 class="entry-title">' + escapeHtml(post.title) + "</h2>",
          '    <p class="entry-excerpt">' + escapeHtml(post.excerpt || excerptFromContent(post.content || "")) + "</p>",
          '    <div class="entry-meta">',
          '      <span class="meta-chip">' + escapeHtml(formatDate(post.publishedAt)) + "</span>",
          "    </div>",
          "  </a>",
          "</article>"
        ].join("");
      }).join("");

      renderHomePagination();
      animateEntries(".entry-card");
    }

    updateHomePageUrl(currentPage);
    renderHomePosts();
  }

  async function initPostPage() {
    var params = new URLSearchParams(window.location.search);
    var postId = params.get("id") || params.get("slug");
    var hasIdParam = Boolean(params.get("id"));
    var shell = document.getElementById("post-view");
    var empty = document.getElementById("post-empty");
    var editLink = document.getElementById("post-edit-link");
    var commentsList = document.getElementById("comments-list");
    var commentsEmpty = document.getElementById("comments-empty");
    var form = document.getElementById("comment-form");
    var feedback = document.getElementById("comment-feedback");
    var isAdmin = Boolean(getAdminToken());

    if (!postId) {
      empty.classList.remove("hidden");
      return;
    }

    var data = await getPost(postId);
    if (!data.post) {
      empty.classList.remove("hidden");
      return;
    }

    if (!hasIdParam && data.post.id) {
      var canonicalUrl = "./post.html?id=" + encodeURIComponent(data.post.id);
      window.history.replaceState(null, "", canonicalUrl);
    }

    document.title = data.post.title + " | 忒卷";
    shell.classList.remove("hidden");
    document.getElementById("post-title").textContent = data.post.title;
    if (editLink && getAdminToken() && data.post.id) {
      editLink.href = "./admin.html?edit=" + encodeURIComponent(data.post.id);
      editLink.classList.remove("hidden");
    }
    document.getElementById("post-meta").innerHTML = [
      '<span class="meta-chip">' + escapeHtml(formatDate(data.post.publishedAt)) + "</span>"
    ].join("");
    document.getElementById("post-content").innerHTML = markdownToHtml(data.post.content || "");

    if (isAdmin && form.author) {
      form.author.value = "忒卷";
      form.author.closest(".field-row").classList.add("hidden");
      form.classList.add("author-reply-form");
    }

    function sortCommentsByTime(items, direction) {
      return (items || []).slice().sort(function (a, b) {
        var at = new Date(a.createdAt || "").getTime() || 0;
        var bt = new Date(b.createdAt || "").getTime() || 0;
        return direction === "asc" ? at - bt : bt - at;
      });
    }

    function buildCommentTree(items) {
      var byId = {};
      var roots = [];

      (items || []).forEach(function (comment) {
        byId[comment.id] = Object.assign({}, comment, { replies: [], replyTo: "" });
      });

      // 真正的树形嵌套：每条回复直接挂到父评论下；同时注入 replyTo 用于显示 @名字
      Object.keys(byId).forEach(function (id) {
        var comment = byId[id];
        if (comment.parentId && byId[comment.parentId]) {
          var parent = byId[comment.parentId];
          comment.replyTo = parent.author || "匿名";
          parent.replies.push(comment);
        } else {
          roots.push(comment);
        }
      });

      function sortBranch(list) {
        list.sort(function (a, b) {
          return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
        });
        list.forEach(function (c) {
          if (c.replies && c.replies.length) sortBranch(c.replies);
        });
      }

      roots.sort(function (a, b) {
        return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      });
      roots.forEach(function (c) {
        if (c.replies && c.replies.length) sortBranch(c.replies);
      });
      return roots;
    }

    function renderCommentNodes(items, depth) {
      return (items || []).map(function (comment) {
        var badge = comment.isAuthor ? '<span class="comment-badge">作者</span>' : "";
        // @ 标签：有 replyTo 字段时展示（拍平时注入）
        var replyToTag = comment.replyTo ? '<span class="comment-reply-to">@ ' + escapeHtml(comment.replyTo) + '</span> ' : "";
        // 管理员删除按钮
        var deleteBtn = isAdmin
          ? '<button class="subtle-link subtle-button comment-delete-button" type="button" data-comment-delete="' + escapeHtml(comment.id) + '">删除</button>'
          : "";
        // 深度最多 4 层缩进（防止手机端过窄）
        var depthClass = depth ? "comment-depth-" + Math.min(depth, 4) : "";
        return [
          '<article class="comment-card ' + depthClass + '" data-comment-id="' + escapeHtml(comment.id) + '" data-author="' + escapeHtml(comment.author || "匿名") + '">',
          '  <div class="comment-meta"><span class="comment-author-name">' + escapeHtml(comment.author || "匿名") + "</span>" + badge + " · " + escapeHtml(formatDate(comment.createdAt)) + "</div>",
          '  <div class="comment-content">' + replyToTag + escapeHtml(comment.content || "") + "</div>",
          '  <div class="comment-actions">',
          '    <button class="subtle-link subtle-button comment-reply-button" type="button" data-reply-toggle="' + escapeHtml(comment.id) + '">回复</button>',
          deleteBtn,
          '  </div>',
          '  <form class="comment-reply-form hidden" data-reply-form="' + escapeHtml(comment.id) + '">',
          isAdmin ? "" : '    <div class="field-row"><label class="field-label" for="reply-author-' + escapeHtml(comment.id) + '">名字</label><input id="reply-author-' + escapeHtml(comment.id) + '" name="author" maxlength="24" placeholder="怎么称呼你"></div>',
          '    <div class="field-row"><label class="field-label" for="reply-content-' + escapeHtml(comment.id) + '">回复</label><textarea id="reply-content-' + escapeHtml(comment.id) + '" name="content" rows="3" maxlength="600" placeholder="' + (isAdmin ? "以忒卷身份回复" : "说点什么") + '"></textarea></div>',
          '    <div class="comment-reply-actions"><button class="button" type="submit">' + (isAdmin ? "发布回复" : "提交回复") + '</button><button class="button button-ghost" type="button" data-reply-cancel="' + escapeHtml(comment.id) + '">取消</button></div>',
          '    <div class="feedback"></div>',
          "  </form>",
          comment.replies && comment.replies.length ? '<div class="comment-children">' + renderCommentNodes(comment.replies, (depth || 0) + 1) + "</div>" : "",
          "</article>"
        ].join("");
      }).join("");
    }

    async function reloadComments() {
      var latest = await getPost(data.post.id);
      comments = latest.comments || [];
      renderComments(comments);
    }

    function renderComments(items) {
      commentsList.innerHTML = renderCommentNodes(buildCommentTree(items || []), 0);

      commentsEmpty.classList.toggle("hidden", Boolean((items || []).length));

      commentsList.querySelectorAll("[data-reply-toggle]").forEach(function (button) {
        button.addEventListener("click", function () {
          var id = button.getAttribute("data-reply-toggle");
          var replyForm = commentsList.querySelector('[data-reply-form="' + id + '"]');
          if (!replyForm) return;
          replyForm.classList.toggle("hidden");
          if (!replyForm.classList.contains("hidden")) {
            var textarea = replyForm.querySelector("textarea");
            if (textarea) textarea.focus();
          }
        });
      });

      commentsList.querySelectorAll("[data-reply-cancel]").forEach(function (button) {
        button.addEventListener("click", function () {
          var id = button.getAttribute("data-reply-cancel");
          var replyForm = commentsList.querySelector('[data-reply-form="' + id + '"]');
          if (!replyForm) return;
          replyForm.reset();
          replyForm.classList.add("hidden");
          setFeedback(replyForm.querySelector(".feedback"), "");
        });
      });

      commentsList.querySelectorAll("[data-reply-form]").forEach(function (replyForm) {
        replyForm.addEventListener("submit", async function (event) {
          event.preventDefault();
          var authorInput = replyForm.querySelector('[name="author"]');
          var contentInput = replyForm.querySelector('[name="content"]');
          var localFeedback = replyForm.querySelector(".feedback");
          var payload = {
            postId: data.post.id,
            slug: data.post.slug,
            parentId: replyForm.getAttribute("data-reply-form"),
            token: getAdminToken(),
            author: isAdmin ? "忒卷" : ((authorInput && authorInput.value) || "").trim(),
            content: ((contentInput && contentInput.value) || "").trim()
          };

          if (!payload.author || !payload.content) {
            setFeedback(localFeedback, "名字和内容都要填。", "error");
            return;
          }

          try {
            await callApi("createComment", payload);
            await reloadComments();
          } catch (error) {
            setFeedback(localFeedback, error.message || "回复失败", "error");
          }
        });
      });

      // 管理员删除留言
      if (isAdmin) {
        commentsList.querySelectorAll("[data-comment-delete]").forEach(function (button) {
          button.addEventListener("click", async function () {
            var id = button.getAttribute("data-comment-delete");
            var commentItem = button.closest("[data-comment-id]");
            var author = commentItem ? commentItem.getAttribute("data-author") || "这条留言" : "这条留言";
            var confirmed = await showConfirmDialog("确定删除「" + author + "」吗？此操作不可恢复。");
            if (!confirmed) return;
            try {
              await callApi("adminUpdateCommentStatus", { token: getAdminToken(), id: id, status: "deleted" });
              await reloadComments();
            } catch (err) {
              alert("删除失败：" + (err.message || "未知错误"));
            }
          });
        });
      }
    }

    var comments = data.comments || [];
    renderComments(comments);

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      var payload = {
        postId: data.post.id,
        slug: data.post.slug,
        token: getAdminToken(),
        author: isAdmin ? "忒卷" : (form.author.value || "").trim(),
        content: (form.content.value || "").trim()
      };

      if (!payload.author || !payload.content) {
        setFeedback(feedback, "名字和内容都要填。", "error");
        return;
      }

      if (!config.envId) {
        setFeedback(feedback, "当前是本地演示数据，先配置 CloudBase 再开启留言。", "error");
        return;
      }

      try {
        var result = await callApi("createComment", payload);
        await reloadComments();
        form.reset();
        if (isAdmin && form.author) form.author.value = "忒卷";
        setFeedback(feedback, (result && result.message) || "留言已提交，已显示在下方。", "success");
      } catch (error) {
        setFeedback(feedback, error.message || "留言提交失败", "error");
      }
    });
  }

  function getAdminToken() {
    return localStorage.getItem(adminStorageKey) || "";
  }

  function setAdminToken(token) {
    if (token) {
      localStorage.setItem(adminStorageKey, token);
    } else {
      localStorage.removeItem(adminStorageKey);
    }
  }

  async function initAdminPage() {
    var adminParams = new URLSearchParams(window.location.search);
    var editPostId = adminParams.get("edit") || "";
    var loginShell = document.getElementById("admin-login-shell");
    var adminShell = document.getElementById("admin-shell");
    var postsView = document.getElementById("admin-posts-view");
    var commentsView = document.getElementById("admin-comments-view");
    var editorView = document.getElementById("admin-editor-view");
    var postsViewButton = document.getElementById("admin-view-posts");
    var commentsViewButton = document.getElementById("admin-view-comments");
    var loginForm = document.getElementById("admin-login-form");
    var loginFeedback = document.getElementById("admin-login-feedback");
    var postForm = document.getElementById("post-form");
    var postFormTitle = document.getElementById("post-form-title");
    var postFormSubtitle = document.getElementById("post-form-subtitle");
    var postSubmitButton = document.getElementById("post-submit-button");
    var postFeedback = document.getElementById("post-form-feedback");
    var postsList = document.getElementById("admin-posts-list");
    var postsPagination = document.getElementById("admin-posts-pagination");
    var commentsList = document.getElementById("admin-comments-list");
    var commentsFeedback = document.getElementById("admin-comments-feedback");
    var postsSummary = document.getElementById("admin-posts-summary");
    var commentsSummary = document.getElementById("admin-comments-summary");
    var postsCountBadge = document.getElementById("admin-posts-count");
    var commentsCountBadge = document.getElementById("admin-comments-count");
      var postSearchInput = document.getElementById("admin-post-search");
      var postSortSelect = document.getElementById("admin-post-sort");
      var commentSearchInput = document.getElementById("admin-comment-search");
      var commentPostFilter = document.getElementById("admin-comment-post-filter");
    var commentsPagination = document.getElementById("admin-comments-pagination");
    var newPostButton = document.getElementById("new-post-button");
    var cancelPostEditButton = document.getElementById("cancel-post-edit");
    var seedButton = document.getElementById("seed-posts-button");
    var logoutButton = document.getElementById("logout-button");
    var adminPosts = [];
    var adminComments = [];
    var currentPostPage = 1;
    var currentCommentPage = 1;
    var currentAdminView = "comments";

    if (!config.envId) {
      setFeedback(loginFeedback, "先在 cloudbase-config.js 里填好 envId，再部署云函数。", "error");
    }

    function setAdminView(view) {
      currentAdminView = view;
      postsView.classList.toggle("hidden", view !== "posts");
      commentsView.classList.toggle("hidden", view !== "comments");
      editorView.classList.toggle("hidden", view !== "editor");
      postsViewButton.classList.toggle("is-active", view === "posts");
      commentsViewButton.classList.toggle("is-active", view === "comments");
    }

    function resetPostForm() {
      postForm.reset();
      document.getElementById("post-id").value = "";
      document.getElementById("post-slug").value = "";
      document.getElementById("post-excerpt").value = "";
      document.getElementById("post-published-at").value = "";
      postFormTitle.textContent = "新建文章";
      postFormSubtitle.textContent = "只需要填写标题和正文";
      postSubmitButton.textContent = "发布文章";
      setFeedback(postFeedback, "");
    }

    function updateSummary(element, visibleCount, totalCount, label) {
      if (!element) return;
      if (visibleCount === totalCount) {
        element.textContent = ""; // badge already shows the total
      } else {
        element.textContent = "显示 " + visibleCount + " / " + totalCount + " 条" + label;
      }
    }

    function showConfirmDialog(message) {
      return new Promise(function (resolve) {
        var modal = document.getElementById("confirm-modal");
        var messageEl = document.getElementById("confirm-modal-message");
        var okBtn = document.getElementById("confirm-modal-ok");
        var cancelBtn = document.getElementById("confirm-modal-cancel");

        messageEl.textContent = message;
        modal.classList.remove("hidden");
        okBtn.focus();

        function cleanup() {
          modal.classList.add("hidden");
          okBtn.removeEventListener("click", onOk);
          cancelBtn.removeEventListener("click", onCancel);
          modal.removeEventListener("click", onOverlayClick);
        }

        function onOk() { cleanup(); resolve(true); }
        function onCancel() { cleanup(); resolve(false); }
        function onOverlayClick(e) {
          if (e.target === modal) { cleanup(); resolve(false); }
        }

        okBtn.addEventListener("click", onOk);
        cancelBtn.addEventListener("click", onCancel);
        modal.addEventListener("click", onOverlayClick);
      });
    }

    function openPostEditor(post) {
      if (!post) return;
      document.getElementById("post-id").value = post.id || "";
      document.getElementById("post-slug").value = post.slug || "";
      document.getElementById("post-title-input").value = post.title || "";
      document.getElementById("post-excerpt").value = post.excerpt || "";
      document.getElementById("post-published-at").value = post.publishedAt || post.updatedAt || "";
      document.getElementById("post-content-input").value = post.content || "";
      postFormTitle.textContent = "编辑文章";
      postFormSubtitle.textContent = "修改后会保留这篇文章原有发布时间";
      postSubmitButton.textContent = "保存文章";
      setAdminView("editor");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function renderPostsList(items) {
      postsList.innerHTML = (items || []).map(function (post) {
        return [
          '<article class="admin-item">',
          '  <div class="admin-item-title"><a class="admin-post-link" href="./post.html?id=' + escapeHtml(post.id) + '" target="_blank">' + escapeHtml(post.title) + "</a></div>",
          '  <div class="admin-meta">' + escapeHtml(formatDate(post.publishedAt || post.updatedAt)) + "</div>",
          '  <div class="admin-item-excerpt">' + escapeHtml(post.excerpt || excerptFromContent(post.content || "")) + "</div>",
          '  <div class="admin-item-actions">',
          '    <button class="button button-secondary" type="button" data-edit-post="' + escapeHtml(post.id) + '">编辑</button>',
          '    <button class="button button-danger" type="button" data-delete-post="' + escapeHtml(post.id) + '">删除</button>',
          "  </div>",
          "</article>"
        ].join("");
      }).join("") || '<div class="empty-state">没有符合条件的文章</div>';

      postsList.querySelectorAll("[data-edit-post]").forEach(function (button) {
        button.addEventListener("click", function () {
          var id = button.getAttribute("data-edit-post");
          var post = adminPosts.find(function (item) { return item.id === id; });
          openPostEditor(post);
        });
      });

      postsList.querySelectorAll("[data-delete-post]").forEach(function (button) {
        button.addEventListener("click", async function () {
          var id = button.getAttribute("data-delete-post");
          var post = adminPosts.find(function (item) { return item.id === id; });
          var postTitle = post ? post.title : "这篇文章";
          var confirmed = await showConfirmDialog("确定删除《" + postTitle + "》吗？此操作不可恢复。");
          if (!confirmed) return;
          try {
            await callApi("adminDeletePost", { token: getAdminToken(), id: id });
            resetPostForm();
            setFeedback(postFeedback, "文章已删除。", "success");
            await loadAdminData();
          } catch (error) {
            setFeedback(postFeedback, error.message || "删除失败", "error");
          }
        });
      });
    }

    function renderCommentsList(items) {
      commentsList.innerHTML = (items || []).map(function (comment) {
        var authorBadge = comment.authorRole === "author" ? ' <span class="comment-badge">作者</span>' : "";
        return [
          '<article class="admin-item" data-comment-id="' + escapeHtml(comment.id) + '" data-author="' + escapeHtml(comment.author || "匿名") + '">',
          '  <div class="admin-item-title">' + escapeHtml(comment.author || "匿名") + authorBadge + "</div>",
          '  <div class="admin-meta">' + (comment.postId ? '<a class="admin-post-link" href="./post.html?id=' + escapeHtml(comment.postId) + '" target="_blank">' + escapeHtml(comment.postTitle || comment.postSlug || "查看文章") + '</a>' : escapeHtml(comment.postTitle || comment.postSlug || "")) + " · " + escapeHtml(formatDate(comment.createdAt)) + "</div>",
          '  <div class="admin-item-excerpt">' + escapeHtml(comment.content || "") + "</div>",
          '  <div class="admin-item-actions">',
          '    <button class="button button-ghost" type="button" data-admin-comment-reply="' + escapeHtml(comment.id) + '">回复</button>',
          '    <button class="button button-danger" type="button" data-admin-comment-delete="' + escapeHtml(comment.id) + '">删除</button>',
          "  </div>",
          '  <form class="comment-reply-form hidden" data-admin-reply-form="' + escapeHtml(comment.id) + '">',
          '    <div class="field-row"><label class="field-label" for="admin-reply-content-' + escapeHtml(comment.id) + '">回复内容</label><textarea id="admin-reply-content-' + escapeHtml(comment.id) + '" name="content" rows="4" maxlength="600" placeholder="以忒卷身份回复"></textarea></div>',
          '    <div class="comment-reply-actions"><button class="button" type="submit">发布回复</button><button class="button button-ghost" type="button" data-admin-reply-cancel="' + escapeHtml(comment.id) + '">取消</button></div>',
          '    <div class="feedback"></div>',
          "  </form>",
          "</article>"
        ].join("");
      }).join("") || '<div class="empty-state">没有符合条件的留言</div>';

      commentsList.querySelectorAll("[data-admin-comment-reply]").forEach(function (button) {
        button.addEventListener("click", function () {
          var id = button.getAttribute("data-admin-comment-reply");
          var form = commentsList.querySelector('[data-admin-reply-form="' + id + '"]');
          if (!form) return;
          form.classList.toggle("hidden");
          if (!form.classList.contains("hidden")) {
            var textarea = form.querySelector("textarea");
            if (textarea) textarea.focus();
          }
        });
      });

      commentsList.querySelectorAll("[data-admin-reply-cancel]").forEach(function (button) {
        button.addEventListener("click", function () {
          var id = button.getAttribute("data-admin-reply-cancel");
          var form = commentsList.querySelector('[data-admin-reply-form="' + id + '"]');
          if (!form) return;
          form.reset();
          form.classList.add("hidden");
          setFeedback(form.querySelector(".feedback"), "");
        });
      });

      commentsList.querySelectorAll("[data-admin-reply-form]").forEach(function (replyForm) {
        replyForm.addEventListener("submit", async function (event) {
          event.preventDefault();
          var commentId = replyForm.getAttribute("data-admin-reply-form");
          var currentComment = (adminComments || []).find(function (item) { return item.id === commentId; });
          var localFeedback = replyForm.querySelector(".feedback");
          var content = ((replyForm.querySelector('[name="content"]') || {}).value || "").trim();

          if (!currentComment || !content) {
            setFeedback(localFeedback, "回复内容不能为空。", "error");
            return;
          }

          try {
            await callApi("createComment", {
              token: getAdminToken(),
              postId: currentComment.postId,
              slug: currentComment.postSlug,
              parentId: currentComment.id,
              content: content
            });
            replyForm.reset();
            replyForm.classList.add("hidden");
            await loadAdminData();
            setFeedback(commentsFeedback, "回复已发布。", "success");
            setAdminView("comments");
          } catch (error) {
            setFeedback(localFeedback, error.message || "回复失败", "error");
          }
        });
      });

      commentsList.querySelectorAll("[data-admin-comment-delete]").forEach(function (button) {
        button.addEventListener("click", async function () {
          var id = button.getAttribute("data-admin-comment-delete");
          var commentItem = button.closest("[data-comment-id]");
          var author = commentItem ? commentItem.getAttribute("data-author") || "这条留言" : "这条留言";
          var confirmed = await showConfirmDialog("确定删除「" + author + "」及其所有回复吗？此操作不可恢复。");
          if (!confirmed) return;

          try {
            await callApi("adminUpdateCommentStatus", {
              token: getAdminToken(),
              id: id,
              status: "deleted"
            });
            await loadAdminData();
            setFeedback(commentsFeedback, "留言已删除。", "success");
            setAdminView("comments");
          } catch (error) {
            setFeedback(commentsFeedback, error.message || "删除失败", "error");
          }
        });
      });
    }

    function comparePosts(a, b, sortValue) {
      function timeValue(value) {
        var time = new Date(value || "").getTime();
        return Number.isNaN(time) ? 0 : time;
      }

      if (sortValue === "publishedAt-desc") {
        return timeValue(b.publishedAt || b.updatedAt) - timeValue(a.publishedAt || a.updatedAt);
      }

      if (sortValue === "title-asc") {
        return String(a.title || "").localeCompare(String(b.title || ""), "zh-CN");
      }

      return timeValue(b.updatedAt || b.publishedAt) - timeValue(a.updatedAt || a.publishedAt);
    }

    function renderPostsPagination(totalItems, pageSize, currentPage) {
      var totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      if (totalItems <= pageSize) {
        postsPagination.innerHTML = "";
        return;
      }

      var prevDisabled = currentPage <= 1 ? " disabled" : "";
      var nextDisabled = currentPage >= totalPages ? " disabled" : "";
      postsPagination.innerHTML = [
        '<button class="button button-ghost admin-page-button" type="button" data-page-action="prev"' + prevDisabled + '>上一页</button>',
        '<div class="admin-page-indicator">第 ' + currentPage + ' / ' + totalPages + ' 页</div>',
        '<button class="button button-ghost admin-page-button" type="button" data-page-action="next"' + nextDisabled + '>下一页</button>'
      ].join("");

      postsPagination.querySelectorAll("[data-page-action]").forEach(function (button) {
        button.addEventListener("click", function () {
          var action = button.getAttribute("data-page-action");
          if (action === "prev" && currentPostPage > 1) currentPostPage -= 1;
          if (action === "next" && currentPostPage < totalPages) currentPostPage += 1;
          applyAdminFilters();
        });
      });
    }

    function renderCommentsPagination(totalFiltered, pageSize, currentPage) {
      if (!commentsPagination) return;
      var totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));

      if (totalPages <= 1) {
        commentsPagination.innerHTML = "";
        return;
      }

      var prevDisabled = currentPage <= 1 ? " disabled" : "";
      var nextDisabled = currentPage >= totalPages ? " disabled" : "";
      commentsPagination.innerHTML = [
        '<button class="button button-ghost admin-page-button" type="button" data-comment-page-action="prev"' + prevDisabled + '>上一页</button>',
        '<div class="admin-page-indicator">第 ' + currentPage + ' / ' + totalPages + ' 页</div>',
        '<button class="button button-ghost admin-page-button" type="button" data-comment-page-action="next"' + nextDisabled + '>下一页</button>'
      ].join("");

      commentsPagination.querySelectorAll("[data-comment-page-action]").forEach(function (button) {
        button.addEventListener("click", function () {
          var action = button.getAttribute("data-comment-page-action");
          if (action === "prev" && currentCommentPage > 1) currentCommentPage -= 1;
          if (action === "next" && currentCommentPage < totalPages) currentCommentPage += 1;
          applyAdminFilters();
        });
      });
    }

    function syncCommentPostFilter(comments) {
      var currentValue = commentPostFilter.value || "all";
      var options = ["<option value=\"all\">全部文章</option>"];
      var seen = {};

      (comments || []).forEach(function (comment) {
        var value = comment.postSlug || comment.postTitle || "";
        var label = comment.postTitle || comment.postSlug || "未命名文章";
        if (!value || seen[value]) return;
        seen[value] = true;
        options.push('<option value="' + escapeHtml(value) + '">' + escapeHtml(label) + "</option>");
      });

      commentPostFilter.innerHTML = options.join("");
      commentPostFilter.value = seen[currentValue] ? currentValue : "all";
    }

    function applyAdminFilters() {
      var postKeyword = (postSearchInput.value || "").trim().toLowerCase();
      var postSort = postSortSelect.value || "updatedAt-desc";
      var pageSize = 10;
      var filteredPosts = adminPosts.filter(function (post) {
        var haystack = [post.title, post.excerpt, post.content].join(" ").toLowerCase();
        var matchesKeyword = !postKeyword || haystack.indexOf(postKeyword) !== -1;
        return matchesKeyword;
      }).sort(function (a, b) {
        return comparePosts(a, b, postSort);
      });

      var totalPages = Math.max(1, Math.ceil(filteredPosts.length / pageSize));
      if (currentPostPage > totalPages) currentPostPage = totalPages;
      var startIndex = (currentPostPage - 1) * pageSize;
      var paginatedPosts = filteredPosts.slice(startIndex, startIndex + pageSize);

      renderPostsList(paginatedPosts);
      updateSummary(postsSummary, filteredPosts.length, adminPosts.length, "文章");
      if (postsCountBadge) postsCountBadge.textContent = adminPosts.length + " 篇";
      renderPostsPagination(filteredPosts.length, pageSize, currentPostPage);

      var commentKeyword = (commentSearchInput.value || "").trim().toLowerCase();
      var commentPost = commentPostFilter.value || "all";
      var filteredComments = adminComments.filter(function (comment) {
        var belongsToPost = commentPost === "all"
          || (comment.postSlug || "") === commentPost
          || (comment.postTitle || "") === commentPost;
        var haystack = [comment.author, comment.content, comment.postTitle, comment.postSlug].join(" ").toLowerCase();
        var matchesKeyword = !commentKeyword || haystack.indexOf(commentKeyword) !== -1;
        return belongsToPost && matchesKeyword;
      });

      var commentPageSize = 10;
      var commentTotalPages = Math.max(1, Math.ceil(filteredComments.length / commentPageSize));
      if (currentCommentPage > commentTotalPages) currentCommentPage = commentTotalPages;
      var commentStartIndex = (currentCommentPage - 1) * commentPageSize;
      var paginatedComments = filteredComments.slice(commentStartIndex, commentStartIndex + commentPageSize);

      renderCommentsList(paginatedComments);
      updateSummary(commentsSummary, filteredComments.length, adminComments.length, "留言");
      if (commentsCountBadge) commentsCountBadge.textContent = adminComments.length + " 条";
      renderCommentsPagination(filteredComments.length, commentPageSize, currentCommentPage);
    }

    async function loadAdminData() {
      var token = getAdminToken();
      if (!token) return;

      try {
        var postsResult = await callApi("adminListPosts", { token: token });
        adminPosts = postsResult.posts || [];

        var commentsResult = await callApi("adminListComments", { token: token });
        adminComments = commentsResult.comments || [];
        syncCommentPostFilter(adminComments);
        applyAdminFilters();
        if (editPostId) {
          openPostEditor(adminPosts.find(function (item) { return item.id === editPostId; }));
        }

      } catch (error) {
        setAdminToken("");
        adminShell.classList.add("hidden");
        loginShell.classList.remove("hidden");
        setFeedback(loginFeedback, error.message || "登录已失效，请重新输入口令。", "error");
      }
    }

    loginForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      var password = (loginForm.password.value || "").trim();
      if (!password) {
        setFeedback(loginFeedback, "请输入后台口令。", "error");
        return;
      }

      try {
        var result = await callApi("adminLogin", { password: password });
        setAdminToken(result.token);
        loginShell.classList.add("hidden");
        adminShell.classList.remove("hidden");
        setFeedback(loginFeedback, "");
        resetPostForm();
        setAdminView("comments");
        await loadAdminData();
      } catch (error) {
        setFeedback(loginFeedback, error.message || "登录失败", "error");
      }
    });

    postForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      var token = getAdminToken();
      var postId = document.getElementById("post-id").value || "";
      var existingSlug = document.getElementById("post-slug").value.trim();
      var title = document.getElementById("post-title-input").value.trim();
      var content = document.getElementById("post-content-input").value.trim();
      var existingExcerpt = document.getElementById("post-excerpt").value.trim();
      var existingPublishedAt = document.getElementById("post-published-at").value;
      var post = {
        id: postId,
        slug: existingSlug || buildSlug(title),
        title: title,
        excerpt: excerptFromContent(content),
        publishedAt: existingPublishedAt || nowShanghaiIso(),
        content: content
      };

      if (!post.title || !post.content) {
        setFeedback(postFeedback, "标题和正文都要填。", "error");
        return;
      }

      try {
        await callApi("adminSavePost", { token: token, post: post });
        setFeedback(postFeedback, postId ? "文章已保存。" : "文章已发布。", "success");
        resetPostForm();
        await loadAdminData();
        setAdminView("posts");
      } catch (error) {
        setFeedback(postFeedback, error.message || "保存失败", "error");
      }
    });

    newPostButton.addEventListener("click", function () {
      resetPostForm();
      setAdminView("editor");
    });

    cancelPostEditButton.addEventListener("click", function () {
      resetPostForm();
      setAdminView("posts");
    });

    postsViewButton.addEventListener("click", function () {
      setAdminView("posts");
    });

    commentsViewButton.addEventListener("click", function () {
      setAdminView("comments");
    });

    [postSearchInput, postSortSelect].forEach(function (element) {
      element.addEventListener("input", function () {
        currentPostPage = 1;
        applyAdminFilters();
      });
      element.addEventListener("change", function () {
        currentPostPage = 1;
        applyAdminFilters();
      });
    });

    [commentSearchInput, commentPostFilter].forEach(function (element) {
      element.addEventListener("input", function () {
        currentCommentPage = 1;
        applyAdminFilters();
      });
      element.addEventListener("change", function () {
        currentCommentPage = 1;
        applyAdminFilters();
      });
    });

    seedButton.addEventListener("click", async function () {
      try {
        await callApi("seedSamplePosts", { token: getAdminToken() });
        setFeedback(postFeedback, "示例文章已导入。", "success");
        await loadAdminData();
      } catch (error) {
        setFeedback(postFeedback, error.message || "导入失败", "error");
      }
    });

    logoutButton.addEventListener("click", function () {
      setAdminToken("");
      adminShell.classList.add("hidden");
      loginShell.classList.remove("hidden");
      resetPostForm();
      setAdminView("comments");
      setFeedback(loginFeedback, "已退出后台。", "success");
    });

    // 图片上传
    var imageUploadInput = document.getElementById("image-upload-input");
    var videoTemplateButton = document.getElementById("insert-video-template");
    var imageUploadStatus = document.getElementById("image-upload-status");
    var contentTextarea = document.getElementById("post-content-input");

    function insertEditorText(text) {
      if (!contentTextarea) return;
      var start = contentTextarea.selectionStart;
      var end = contentTextarea.selectionEnd;
      var val = contentTextarea.value;
      contentTextarea.value = val.slice(0, start) + text + val.slice(end);
      contentTextarea.selectionStart = contentTextarea.selectionEnd = start + text.length;
      contentTextarea.focus();
    }

    if (videoTemplateButton) {
      videoTemplateButton.addEventListener("click", function () {
        insertEditorText("\n@[video](https://example.com/your-video.mp4)\n");
        if (imageUploadStatus) {
          imageUploadStatus.textContent = "已插入视频语法";
          imageUploadStatus.className = "editor-toolbar-status";
          setTimeout(function () {
            imageUploadStatus.textContent = "";
            imageUploadStatus.className = "editor-toolbar-status";
          }, 2500);
        }
      });
    }

    if (imageUploadInput) {
      imageUploadInput.addEventListener("change", async function () {
        var file = imageUploadInput.files && imageUploadInput.files[0];
        if (!file) return;

        // 重置 input，允许重复选同一个文件
        imageUploadInput.value = "";

        // 大小限制 5MB
        if (file.size > 20 * 1024 * 1024) {
          imageUploadStatus.textContent = "图片不能超过 20MB";
          imageUploadStatus.className = "editor-toolbar-status error";
          return;
        }

        imageUploadStatus.textContent = "上传中…";
        imageUploadStatus.className = "editor-toolbar-status uploading";

        try {
          // 读取为 base64
          var base64 = await new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function (e) {
              // dataURL = "data:image/jpeg;base64,xxx"，取逗号后面的部分
              resolve(e.target.result.split(",")[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          var result = await callApi("adminUploadImage", {
            token: getAdminToken(),
            filename: file.name,
            base64: base64,
            mimeType: file.type
          });

          // 在光标位置插入 Markdown 图片语法
          var mdImg = "\n![" + file.name.replace(/\.[^.]+$/, "") + "](" + result.url + ")\n";
          insertEditorText(mdImg);

          imageUploadStatus.textContent = "上传成功 ✓";
          imageUploadStatus.className = "editor-toolbar-status success";
          setTimeout(function () {
            imageUploadStatus.textContent = "";
            imageUploadStatus.className = "editor-toolbar-status";
          }, 3000);
        } catch (err) {
          imageUploadStatus.textContent = "上传失败：" + (err.message || "未知错误");
          imageUploadStatus.className = "editor-toolbar-status error";
        }
      });
    }

    if (getAdminToken()) {
      loginShell.classList.add("hidden");
      adminShell.classList.remove("hidden");
      resetPostForm();
      setAdminView("comments");
      await loadAdminData();
    }
  }

  async function init() {
    if (page !== "admin") {
      ensureModeControl();
    }
    if (page === "home") await initHomePage();
    if (page === "post") await initPostPage();
    if (page === "admin") await initAdminPage();
  }

  init();
})();
