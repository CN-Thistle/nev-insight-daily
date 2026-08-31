---
title: "NEV Insight Daily"
description: "每天 07:00 自动更新的新能源汽车行业情报站"
toc: false
---

<div class="nev-hero">
  <div class="nev-eyebrow">AUTOMATED · SERVERLESS · AI CURATED</div>
  <h1>每天 5 分钟，读懂新能源汽车行业</h1>
  <p>公开 RSS 信源由 Cloudflare Worker 定时采集，经 Workers AI 去重、归类与摘要后，自动发布为可搜索、可归档的行业日报。</p>
  <div class="nev-actions">
    <a class="nev-button nev-button-primary" href="./posts/">阅读最新日报 →</a>
    <a class="nev-button" href="./archives/">浏览历史时间线</a>
  </div>
</div>

<div class="nev-metrics">
  <div><strong>07:00</strong><span>每日自动发布</span></div>
  <div><strong>5 类</strong><span>行业主题归档</span></div>
  <div><strong>0 人工</strong><span>端到端自动化</span></div>
</div>

## 关注板块

{{< cards >}}
  {{< card link="categories/整车" title="🚙 整车" subtitle="新车、车企战略与产品动向" >}}
  {{< card link="categories/电池" title="🔋 电池" subtitle="动力电池、材料与补能技术" >}}
  {{< card link="categories/自动驾驶" title="🧠 自动驾驶" subtitle="智能驾驶、芯片与软件生态" >}}
  {{< card link="categories/政策" title="📋 政策" subtitle="监管、补贴与产业规划" >}}
  {{< card link="categories/市场销量" title="📈 市场销量" subtitle="销量、价格与竞争格局" >}}
{{< /cards >}}

## 一条完全自动化的内容流水线

`RSS 抓取` → `规则预去重` → `Workers AI 加工` → `Hugo Markdown` → `GitHub API 提交` → `GitHub Pages 发布`

所有日报保留原始来源链接。AI 只负责压缩信息与整理结构，不替代原始报道。
