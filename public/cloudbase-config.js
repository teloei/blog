window.XIAOGAI_CLOUDBASE_CONFIG = {
  envId: "cloudflare-pages",
  region: "global",
  functionName: "blogApi",
  adminStorageKey: "xiaogai-admin-token",
  apiUrl: "/blogApi",
  apiFallbackUrls: ["https://blog.teloei35.workers.dev/blogApi"],
  connectLinks: [
    { label: "RSS", href: "/blogApi?action=getRss" },
    { label: "小红书", href: "https://www.xiaohongshu.com/user/profile/61ec2a3a000000001000868f", target: "_blank" },
    { label: "邮箱", href: "mailto:gainubi@gmail.com" },
    { label: "GitHub", href: "https://github.com/", target: "_blank" },
    { label: "哔哩哔哩", href: "https://space.bilibili.com/", target: "_blank" }
  ]
};
