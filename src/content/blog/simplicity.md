---
title: '关于「简单」这件事'
date: 2025-03-01
tags: ['思考', '随笔']
excerpt: '复杂是容易的，简单才是最难的。在技术中如此，在生活中也是如此。'
---

最近在重构一个项目，删掉了大约 60% 的代码。功能没有减少，性能反而提升了。

这件事让我重新思考了「简单」的价值。

## 简单不等于简陋

我们经常把简单和简陋混为一谈。简单不是偷懒，不是少做，而是在充分理解问题之后，找到最优雅的解决路径。

一个简单的架构背后，往往是对问题的深刻理解。

```javascript
// 复杂的方式
function getUserData(userId) {
  const user = database.query('SELECT * FROM users WHERE id = ?', [userId]);
  const profile = database.query('SELECT * FROM profiles WHERE user_id = ?', [userId]);
  const settings = database.query('SELECT * FROM settings WHERE user_id = ?', [userId]);
  const preferences = database.query('SELECT * FROM preferences WHERE user_id = ?', [userId]);
  return { ...user, ...profile, settings: { ...settings, ...preferences } };
}

// 简单的方式
function getUserData(userId) {
  return database.query(`
    SELECT u.*, p.*, s.*, pref.*
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    LEFT JOIN settings s ON s.user_id = u.id
    LEFT JOIN preferences pref ON pref.user_id = u.id
    WHERE u.id = ?
  `, [userId]);
}
```

这个例子过于简化了，但核心思想是对的：**一个 JOIN 胜过四次查询**。

## 少即是多

Dieter Rams 的设计十诫中有一条：「好的设计是尽可能少的设计」。

这条原则在软件工程中同样适用：

- **更少的依赖** — 意味着更少的维护成本和更小的攻击面
- **更少的抽象** — 意味着更少的认知负担和更容易调试
- **更少的代码** — 意味着更少的 bug 和更快的 review

## 追求简单的代价

简单不是免费的。要达到简单的状态，你通常需要：

1. **深入理解问题** — 不知道本质，就无法简化
2. **多次迭代** — 第一版永远是复杂的，简化需要时间
3. **敢于删除** — 沉没成本是最大的敌人

我的重构过程就是这样：先花时间理解了整个系统，然后一次次地问自己「这段代码真的必要吗？」「这个抽象带来了什么价值？」

最终，60% 的代码被删除了。系统更简单，也更健壮。

## 日常生活中的简单

技术中的简单原则，同样适用于生活：

- **减少选择** — Steve Jobs 每天穿同样的衣服，不是因为他不在乎，而是因为他选择了把注意力留给更重要的事
- **减少 possessions** — 物理空间和心理空间是相通的
- **减少承诺** — 专注做好少数几件事，比什么都想做但什么都做不好要强得多

---

> "Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away."
> — Antoine de Saint-Exupéry

共勉。
