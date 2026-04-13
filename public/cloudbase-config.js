window.XIAOGAI_CLOUDBASE_CONFIG = {
  envId: "cloudflare-pages",
  region: "global",
  functionName: "blogApi",
  adminStorageKey: "xiaogai-admin-token",
  apiUrl: "/blogApi",
  apiFallbackUrls: ["https://blog.teloei35.workers.dev/blogApi"],
  siteName: "忒卷",
  connectLinks: [
    { label: "RSS", href: "/blogApi?action=getRss" },
    { label: "小红书", href: "https://www.xiaohongshu.com/user/profile/61ec2a3a000000001000868f", target: "_blank" },
    { label: "邮箱", href: "mailto:gainubi@gmail.com" },
    { label: "GitHub", href: "https://github.com/", target: "_blank" },
    { label: "哔哩哔哩", href: "https://space.bilibili.com/", target: "_blank" },
    { label: "关于", href: "/about.html" }
  ],
  adSlots: [
    {
      slot: "home",
      label: "合作推广",
      title: "这里可以放你的广告位",
      description: "支持活动宣传、产品推荐、个人品牌曝光。",
      cta: "联系投放",
      href: "mailto:gainubi@gmail.com"
    },
    {
      slot: "post",
      label: "文章赞助",
      title: "内容合作与赞助位",
      description: "如需在文章页展示品牌信息，可联系站长。",
      cta: "马上联系",
      href: "mailto:gainubi@gmail.com"
    }
  ]
};
