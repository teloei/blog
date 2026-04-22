---
title: '五个提升编码效率的 VS Code 技巧'
date: 2025-02-15
tags: ['工具', '效率', 'VS Code']
excerpt: '这些技巧我每天都在用，每一个都帮我节省了大量的重复操作时间。'
---

VS Code 是我最常用的编辑器，没有之一。这里分享五个我每天都在用的技巧，它们看起来简单，但积少成多，对效率的提升是显著的。

## 1. 多光标编辑

你可能在某些场景下知道多光标，但它的用法比你想象的更多：

```javascript
// 按住 Alt 点击 — 在任意位置添加光标
// Ctrl + D — 选中下一个相同的词
// Ctrl + Shift + L — 选中所有相同的词

// 实际场景：批量修改变量名
const firstName = 'John';
const lastName = 'Doe';
// 选中 firstName，Ctrl+Shift+L，直接修改所有引用
```

**最有用的场景**：当你需要同时编辑多行相似但不完全相同的代码时，`Alt + 点击` 是最快的。

## 2. 命令面板

按 `Ctrl + Shift + P`（Mac：`Cmd + Shift + P`）打开命令面板。这可能是 VS Code 中最强大的功能。

一些我常用的命令：

- `Format Document` — 格式化当前文件
- `Change All Occurrences` — 批量替换
- `Transform to Uppercase/Lowercase` — 大小写转换
- `Sort Lines Ascending/Descending` — 行排序

## 3. 代码片段（Snippets）

自定义代码片段可以大幅减少重复输入：

```json
// 在 settings.json 中配置
{
  "Console Log": {
    "prefix": "cl",
    "body": ["console.log('$1', $1);"],
    "description": "快速插入 console.log"
  }
}
```

我为自己常用的模式都创建了片段——React 组件模板、API 请求封装、测试用例等。

## 4. 终端分屏

`Ctrl + \`（反引号）快速切换终端面板。但你可能不知道可以分屏：

- `Ctrl + Shift + 5` — 拆分终端
- 这意味着你可以同时运行前端 dev server 和后端 API

## 5. 问题面板的妙用

`Ctrl + Shift + M` 打开问题面板。它不只是显示错误的：

- 点击问题可以直接跳转到对应位置
- 右键可以看到修复建议（ESLint 集成时特别好用）
- 过滤器可以只看 Errors 或 Warnings

## 附加：推荐扩展

| 扩展 | 用途 |
|------|------|
| GitHub Copilot | AI 辅助编码 |
| Error Lens | 行内显示错误信息 |
| GitLens | Git 增强功能 |
| Pretty TypeScript Errors | TypeScript 错误美化 |
| Indent Rainbow | 缩进可视化 |

---

工具是为了服务人的，而不是相反。找到适合自己工作流的技巧，坚持使用，让它成为肌肉记忆。效率的提升不在于知道多少技巧，而在于每天使用的那几个技巧是否真的内化了。
