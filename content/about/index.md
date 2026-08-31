---
title: "关于这个项目"
toc: true
---

NEV Insight Daily 是一个用于学习与面试演示的开源全栈项目。它把公开 RSS、Cloudflare Workers AI、GitHub API、Hugo 与 GitHub Pages 连接成一条无需人工值守的内容流水线。

## 数据如何流动

1. Cloudflare Cron 在北京时间每天 07:00 触发 Worker。
2. Worker 并发读取可扩展 RSS 列表，单一信源失败不会影响其他信源。
3. 规则层先按链接与标题相似度去重，减少模型输入和费用。
4. Workers AI 再完成语义去重、五类归档、中文摘要与趋势提炼。
5. Worker 生成 Hugo Markdown，并通过 GitHub Contents API 提交到 `content/posts/`。
6. 新提交触发 GitHub Actions，构建 Hextra 站点并发布到 GitHub Pages。

## 内容原则

- 只使用公开 RSS 中的标题、摘要与链接。
- 每条摘要保留原始来源，方便读者核验。
- AI 输出仅用于信息整理，不构成投资建议。
- 同一天使用固定文件名，发布前先检查 GitHub，避免重复生成。

