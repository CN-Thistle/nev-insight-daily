# NEV Insight Daily｜全自动新能源汽车行业每日资讯发布平台

一个适合面试现场演示的开源全栈项目：每天清晨自动抓取新能源汽车公开 RSS，使用 Cloudflare Workers AI 完成语义去重、摘要、分类和润色，生成 Hugo Markdown，提交到 GitHub，并由 GitHub Actions 构建 Hextra 静态站点发布到 GitHub Pages。

> 目标不是再做一个“新闻列表”，而是用一个足够小、可解释、可部署的项目，完整展示 Serverless、AI 内容工程、静态站点与 CI/CD 的组合能力。

## 在线链路

```mermaid
flowchart LR
    A[公开 RSS 信源] -->|并发抓取| B[Cloudflare Worker]
    C[每日 07:00 Cron] --> B
    B --> D[规则预去重]
    D --> E[Workers AI]
    E -->|语义去重 / 摘要 / 五类归档| F[Hugo Markdown]
    E -. AI 异常 .-> G[规则降级处理]
    G --> F
    F -->|GitHub Contents API| H[content/posts]
    H --> I[GitHub Actions]
    I --> J[Hugo + Hextra]
    J --> K[GitHub Pages]
```

每天的正常数据路径是：

```text
RSS 抓取 → 规则预去重 → Workers AI 语义处理 → Markdown → Git 提交 → Hugo 构建 → Pages 发布
```

## 面试展示重点

- ✅ **静态网站**：基于 Hextra（Hugo）的现代化资讯 UI，支持暗色模式、全文搜索、分类、标签、RSS、时间线和移动端。
- ✅ **Serverless 定时任务**：Cloudflare Worker Cron 每天北京时间 07:00 自动执行，不维护服务器。
- ✅ **AI 内容加工**：Cloudflare Workers AI 完成语义去重、五类归档、中文摘要、要点和趋势信号生成。
- ✅ **全链路自动化**：抓取 → AI 处理 → 生成 Markdown → Git 推送 → 自动构建部署，每日自动更新，零人工操作。
- ✅ **可扩展**：可以新增 RSS、替换模型、修改 Prompt、增加资讯分类或切换静态托管平台。
- ✅ **工程可靠性**：单源失败隔离、抓取超时、规则预去重、AI 降级、当天幂等、并发竞态保护、结构化日志和单元测试。
- ✅ **安全意识**：GitHub Token 只存 Cloudflare Secret；手动触发接口使用 Bearer Token；推荐最小化仓库权限。

## 技术栈

| 层 | 技术 | 职责 |
| --- | --- | --- |
| 展示层 | Hugo + Hextra v0.12 | 静态页面、搜索、标签、分类、时间线、响应式 UI |
| 自动化层 | Cloudflare Workers + Cron | 每日调度、RSS 并发抓取、错误隔离 |
| AI 层 | Cloudflare Workers AI | 语义去重、行业分类、摘要与趋势提炼 |
| 内容层 | Hugo Markdown + Front Matter | 让内容天然支持 Git 版本管理与静态构建 |
| 集成层 | GitHub REST Contents API | Worker 自动创建当天 `content/posts/*.md` |
| CI/CD | GitHub Actions + GitHub Pages | 收到新文章后自动构建和发布 |

## 完整目录树与文件用途

```text
.
├── .github/
│   └── workflows/
│       ├── deploy-pages.yml       # main 分支变更后构建 Hugo 并发布 GitHub Pages
│       ├── deploy-worker.yml      # 可选：手动触发部署 Worker 与 Cron
│       └── generate-daily.yml     # 一键调用受保护的 Worker，立即生成当日日报
├── assets/
│   └── css/
│       └── custom.css             # 首页品牌化视觉与移动端样式
├── content/
│   ├── _index.md                  # Hextra 首页：项目定位、分类入口、自动化链路
│   ├── about/
│   │   └── index.md               # 对外解释数据流和内容原则
│   ├── archives/
│   │   └── _index.md              # Hextra v0.12 内置的年度时间线页面
│   ├── categories/
│   │   └── _index.md              # 分类聚合页
│   ├── tags/
│   │   └── _index.md              # 标签聚合页
│   └── posts/
│       ├── _index.md              # 将 posts 级联设置为 Hextra blog 类型
│       └── 2026-08-30-nev-daily.md # 首次部署即可展示的演示文章
├── worker/
│   ├── src/
│   │   └── index.js               # Worker 完整实现：抓取、去重、AI、Markdown、GitHub
│   └── test/
│       └── index.test.js          # RSS/Atom、去重、降级、幂等和推送模拟测试
├── .env.example                   # 本地 `.dev.vars` 环境变量模板
├── .gitignore                     # 忽略构建、密钥和依赖目录
├── config.toml                    # Hextra 资讯博客最小配置
├── go.mod                         # Hugo Module：固定 Hextra v0.12.0
├── LICENSE                        # MIT 开源许可证
├── package.json                   # Worker 命令和 Wrangler 依赖
├── pnpm-lock.yaml                 # Node 依赖锁文件
├── pnpm-workspace.yaml            # 仅允许 esbuild/workerd 执行安装脚本
├── wrangler.toml                  # AI Binding、UTC Cron、非敏感 Worker 配置
└── README.md                      # 部署手册与面试讲解脚本
```

## Worker 核心设计

### 1. RSS 抓取与失败隔离

`worker/src/index.js` 内置新能源汽车、动力电池、自动驾驶、政策、销量以及英文 EV 信源。所有请求通过 `Promise.allSettled` 并发执行，并设置独立超时：一个站点超时、限流或返回错误，不会影响其他来源。

默认只取最近 36 小时，每个来源最多 8 条，避免重复旧闻和过大的 AI 输入。两个参数都可在 `wrangler.toml` 调整。

### 2. 两阶段去重

先规则、后 AI：

1. **规则预去重**：规范化 URL，移除 UTM 等追踪参数；对标题使用中英文 token 和中文 bigram 做 Jaccard 相似度判断。
2. **AI 语义去重**：相同事件的不同媒体报道合并为一条，保留多个来源链接。

这样既降低模型输入和费用，又能处理“标题不同但事件相同”的新闻。

### 3. Workers AI 结构化输出

Worker 使用 JSON Schema 约束模型输出，要求每条结果包含：

- `sourceIndexes`：对应原始 RSS 项，保证来源可追溯；
- `category`：只允许整车、电池、自动驾驶、政策、市场销量；
- `title`、`summary`、`highlights`、`impact`、`tags`；
- 全局 `overview` 与 `trendSignals`。

Prompt 明确要求只依据输入信息，并把 RSS 正文视为不可信数据，降低提示词注入和内容幻觉风险。

### 4. AI 失败自动降级

如果 Workers AI 超时、模型不可用、JSON 不合法或 Schema 无法满足，流程不会中断。系统会改用确定性的关键词分类、RSS 原始摘要和分类模板生成日报，并在文章顶部标记本次为降级生成。

### 5. 同一天不重复生成

文件名固定为：

```text
content/posts/YYYY-MM-DD-nev-daily.md
```

Worker 在抓取之前先调用 GitHub API 检查当天文件：

- 已存在：直接返回 `article_already_exists`，不抓 RSS、不调用 AI；
- 不存在：继续生成并创建文件；
- 并发运行同时创建：GitHub 返回 422 后再次查询，存在则按幂等成功处理。

### 6. 标准 Hugo Front Matter

自动文章包含可直接被 Hugo 读取的字段：

```yaml
---
title: "新能源汽车行业日报｜2026-08-31"
date: 2026-08-31T07:00:00+08:00
lastmod: 2026-08-31T07:00:00+08:00
draft: false
description: "今日摘要……"
summary: "今日摘要……"
categories: ["整车", "电池", "自动驾驶"]
tags: ["新能源汽车", "行业日报", "快充"]
author: "NEV Daily Bot"
generatedBy: "Cloudflare Workers AI"
sourceCount: 12
---
```

## 容错策略

| 场景 | 处理方式 | 结果 |
| --- | --- | --- |
| 单个 RSS 失败 | `Promise.allSettled` 隔离并写结构化日志 | 继续处理其他来源 |
| RSS 请求卡住 | `AbortController` 到时取消 | 该来源失败，主流程继续 |
| RSS XML 字段缺失 | 缺标题或链接的条目丢弃，无日期条目仍可保留 | 避免无效内容破坏文章 |
| AI 调用失败 | 关键词分类 + RSS 摘要降级 | 仍可生成日报 |
| AI 返回脏数据 | Schema + 索引范围 + 分类白名单 + 文本清洗 | 只使用可验证字段 |
| 当天文章已存在 | 发布前查询固定路径 | 直接跳过，不重复调用 AI |
| 两个任务并发 | 422 后再次查询 GitHub | 识别竞态并幂等退出 |
| 所有 RSS 都无内容 | 返回 `no_content` | 不发布空文章 |
| GitHub API 失败 | 输出错误状态与响应摘要 | 不伪造“发布成功” |

## 部署前准备

需要：

- 一个 GitHub 仓库；
- 一个 Cloudflare 账户；
- Node.js 22+ 与 pnpm 11；
- 本地预览站点时需要 Hugo Extended 0.146+、Go 1.21+、Git。

### 1. 创建仓库并替换占位符

把本项目推送到你的 GitHub 仓库，然后修改：

- `config.toml`：`baseURL` 和 GitHub 菜单链接；
- `go.mod`：可选，改为你自己的 GitHub module 路径；
- `wrangler.toml`：`GITHUB_OWNER`、`GITHUB_REPO`、必要时修改分支名。

`deploy-pages.yml` 构建时会用 GitHub Pages 返回的真实地址覆盖 `baseURL`，因此项目页和用户主页仓库都可以工作。

### 2. 创建最小权限 GitHub Token

推荐创建 Fine-grained Personal Access Token：

1. Repository access 只选择这个日报仓库；
2. Repository permissions 只给 `Contents: Read and write`；
3. Worker 只写 `content/posts/`，不需要修改 workflow。

不要把 Token 写入 `.env`、`wrangler.toml` 或 Git 历史。

### 3. 安装与测试 Worker

```bash
pnpm install --frozen-lockfile
pnpm test
cp .env.example .dev.vars
```

编辑 `.dev.vars`，填入测试仓库和 Token。`.dev.vars` 已被 `.gitignore` 忽略。

本地启动：

```bash
pnpm worker:dev
```

健康检查：

```bash
curl http://localhost:8787/health
```

Wrangler 的 Cron 本地模拟入口：

```bash
curl "http://localhost:8787/cdn-cgi/handler/scheduled?format=json"
```

Workers AI 即使在本地也会调用 Cloudflare 远程服务；请使用自己的 Cloudflare 账户并关注使用量。

### 4. 配置 Cloudflare Secrets 并部署

```bash
pnpm exec wrangler login
pnpm exec wrangler secret put GITHUB_TOKEN
pnpm exec wrangler secret put MANUAL_TRIGGER_TOKEN
pnpm worker:deploy
```

`GITHUB_TOKEN` 用于创建日报；`MANUAL_TRIGGER_TOKEN` 用于保护 `/run` 演示接口。非敏感变量保存在 `wrangler.toml`。

Cron 配置是：

```toml
[triggers]
crons = ["0 23 * * *"]
```

Cloudflare Cron 使用 UTC，所以 `23:00 UTC` 对应次日 `07:00 Asia/Shanghai`。

也可以在 GitHub 仓库中配置以下 Actions Secrets，然后手动运行 `Deploy Cloudflare Worker`：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

运行这个 Action 之前，仍需先在 Cloudflare Dashboard 或 CLI 中保存 `GITHUB_TOKEN` 等 Worker Secrets。

### 一键生成今日日报

仓库配置下列 Actions Secrets 后，进入 **Actions → Generate today's NEV daily → Run workflow** 即可现场触发完整链路：

- `WORKER_URL`：部署后的 Worker `https://...workers.dev` 地址；
- `MANUAL_TRIGGER_TOKEN`：与 Cloudflare Worker Secret 中保存的值相同。

密钥只存在 GitHub Actions 和 Cloudflare 的加密 Secret 中，不会出现在前端页面、源码或日志里。

### 5. 开启 GitHub Pages

进入仓库：

```text
Settings → Pages → Build and deployment → Source → GitHub Actions
```

推送到 `main` 后，`Build and deploy Hextra site` 会：

1. 安装 Go 与 Hugo Extended；
2. 通过 Hugo Module 下载固定版本 Hextra；
3. 执行 `hugo --gc --minify`；
4. 上传 `public/`；
5. 发布到 GitHub Pages。

之后 Worker 每次创建新 Markdown，都会自动触发同一条构建链路。

### 6. 本地预览 Hextra

```bash
hugo mod tidy
hugo server --buildDrafts --disableFastRender
```

访问 `http://localhost:1313`。仓库内自带一篇明确标注为演示数据的日报，因此第一次启动即可展示首页、文章、分类、标签和时间线。

## RSS 源扩展

最直观的方式是修改 `worker/src/index.js` 中的 `DEFAULT_RSS_SOURCES`：

```js
{
  name: "你的 RSS 名称",
  url: "https://example.com/feed.xml",
  categoryHint: "电池"
}
```

也可以不改源码，通过 `RSS_SOURCES_JSON` 覆盖。值必须是单行合法 JSON：

```json
[{"name":"示例信源","url":"https://example.com/feed.xml","categoryHint":"整车"}]
```

`categoryHint` 可选，只能是：`整车`、`电池`、`自动驾驶`、`政策`、`市场销量`。系统最多加载 20 个自定义来源。

## 环境变量

| 变量 | 必填 | 是否 Secret | 示例 / 说明 |
| --- | --- | --- | --- |
| `GITHUB_TOKEN` | 是 | 是 | Fine-grained PAT，Contents 读写 |
| `GITHUB_OWNER` | 是 | 否 | GitHub 用户名或组织名 |
| `GITHUB_REPO` | 是 | 否 | 不含 `.git` 的仓库名 |
| `GITHUB_BRANCH` | 否 | 否 | 默认 `main` |
| `AI_MODEL` | 否 | 否 | 默认 `@cf/meta/llama-3.1-8b-instruct-fast` |
| `MANUAL_TRIGGER_TOKEN` | 演示接口需要 | 是 | `/run` 的 Bearer Token |
| `RSS_SOURCES_JSON` | 否 | 否 | 自定义 RSS JSON；空值使用内置列表 |
| `LOOKBACK_HOURS` | 否 | 否 | 默认 36，范围 1–168 |
| `MAX_ITEMS_PER_SOURCE` | 否 | 否 | 默认 8，范围 1–30 |
| `MAX_ARTICLES` | 否 | 否 | 默认 15，范围 1–30 |
| `FETCH_TIMEOUT_MS` | 否 | 否 | 默认 12000，范围 1000–30000 |

## 面试现场怎么演示

建议按下面顺序控制在 4–6 分钟。

### 第一幕：先展示结果

1. 打开首页，说明这是每天自动更新的 Hextra 静态资讯站；
2. 打开一篇日报，展示五类内容、来源链接、标签与摘要结构；
3. 打开“时间线”和“分类”，切换暗色模式，再缩窄浏览器展示移动端适配。

可以这样说：

> “这个站点本身没有数据库和常驻服务器。最终产物都是版本化的 Markdown 和静态文件，访问快、成本低，也方便审计 AI 每天生成了什么。”

### 第二幕：触发自动化

查看 Worker 状态：

```bash
curl https://YOUR_WORKER.workers.dev/health
```

手动触发一次真实流程：

```bash
curl -X POST https://YOUR_WORKER.workers.dev/run \
  -H "Authorization: Bearer YOUR_MANUAL_TRIGGER_TOKEN"
```

然后依次打开：

1. Cloudflare Worker 实时日志；
2. GitHub 新增的 `content/posts/YYYY-MM-DD-nev-daily.md` commit；
3. GitHub Actions 正在执行的 Pages 构建；
4. 部署完成后的新文章。

再次调用 `/run`，展示返回：

```json
{
  "ok": true,
  "status": "skipped",
  "reason": "article_already_exists"
}
```

这一步能直观说明幂等性，而不只是“定时脚本能跑”。

### 第三幕：展示工程深度

重点打开三个位置：

- `worker/src/index.js` 的 `ruleBasedDeduplicate`：解释先规则、后 AI 的成本与质量权衡；
- `processArticlesWithAI`：展示 Prompt 注入防护、JSON Schema 和原始索引映射；
- `runDailyPipeline`：展示当天检查、AI 降级、422 竞态保护和 GitHub 提交。

最后运行：

```bash
pnpm test
```

测试覆盖 RSS 2.0、Atom、URL 清洗、标题去重、分类、Markdown Front Matter、AI 故障降级、GitHub 推送模拟和当天幂等。

## 3 分钟口述版本

> “我做的是一个新能源汽车行业的自动日报平台。每天北京时间 7 点，Cloudflare Cron 触发 Worker，并发抓取多个公开 RSS。系统先用 URL 规范化和标题相似度做便宜的预去重，再把候选新闻交给 Workers AI 做语义去重、五类归档、摘要和趋势提炼。AI 输出受 JSON Schema 约束，并通过 sourceIndexes 映射回原始链接。”
>
> “生成结果会被渲染成标准 Hugo Markdown，通过 GitHub Contents API 提交到仓库。新 commit 自动触发 GitHub Actions，构建 Hextra 并部署到 Pages。因此这是一条从外部数据到线上产品的完整 CI/CD 链路。”
>
> “可靠性上，单个 RSS 失败不会拖垮其他源；AI 失败会降级为规则分类和 RSS 摘要；同一天先查固定文件名，避免重复调用模型；并发创建发生 422 时会二次确认。密钥只放 Cloudflare Secret，手动触发也有 Bearer Token。整个项目既能现场看到最终站点，也能看到 Serverless、AI 工程和自动部署的代码实现。”

## 常见面试追问

### 为什么选静态站点，不直接做数据库应用？

日报是读多写少、按天追加的内容。Markdown + Git 天然提供版本记录、差异审计和回滚，Hugo 构建后的站点没有数据库攻击面，部署成本也更低。这里是根据业务读写模型做技术选型，不是为了堆技术。

### 为什么不用 AI 一次性完成全部去重？

URL 和高相似标题是确定性问题，先用规则处理更快、更便宜、可测试；语义相同但措辞不同才交给模型。两阶段方案让 AI 只解决规则不擅长的问题。

### 怎么降低 AI 幻觉？

限制输入为 RSS 标题和摘要；系统 Prompt 禁止引入外部事实；JSON Schema 约束结构；`sourceIndexes` 必须落到合法候选索引；分类使用白名单；最终页面保留原始链接。AI 负责压缩和组织，不被当作事实来源。

### 为什么让 Worker 提交 Git，而不是直接写 Pages？

Git commit 是内容生成和网站部署之间清晰的契约。内容可审计、可回滚，GitHub Actions 只负责可重复构建；抓取、AI、展示三层可以独立替换。

### 下一步如何扩展？

- 用 Cloudflare KV 保存跨天新闻指纹，做更长时间窗口的去重；
- 用 Queue 拆分抓取、AI 和发布，增加重试与死信队列；
- 引入来源可信度和行业影响评分；
- 为中文和英文生成独立内容树；
- 增加周报、月报和趋势图；
- 用 GitHub App installation token 代替个人 PAT。

## 常见问题

### Worker 日志显示 `article_already_exists`

这是预期的幂等保护。当日文件已经存在。若要重新演示，请使用测试分支/测试仓库，或明确删除当日文件后再触发；不要直接让 Worker 覆盖历史文章。

### GitHub 返回 401 / 403

检查 `GITHUB_TOKEN` 是否已通过 `wrangler secret put` 保存、是否选择了正确仓库、是否有 `Contents: Read and write` 权限，以及 `GITHUB_OWNER` / `GITHUB_REPO` 是否与目标仓库一致。

### GitHub Actions 构建成功但 Pages 没更新

确认仓库 `Settings → Pages → Source` 已选择 `GitHub Actions`，并查看 deploy job 的 environment URL。

### 所有 RSS 都失败

Worker 会记录每个来源的错误，并返回 `no_content`，不会发布空文章。可以在 Cloudflare 日志中确认是超时、HTTP 状态码还是源格式变化，再替换或调整对应来源。

## 上游项目与文档

- 结构参考：[Hextra-AI-Insight-Daily](https://github.com/justlovemaki/Hextra-AI-Insight-Daily)
- 主题模板：[Hextra Starter Template](https://github.com/imfing/hextra-starter-template)
- Hextra 文档：[imfing.github.io/hextra](https://imfing.github.io/hextra/)
- Cloudflare Cron：[Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- Workers AI：[Workers AI Bindings](https://developers.cloudflare.com/workers-ai/configuration/bindings/)
- Workers AI 结构化输出：[JSON Mode](https://developers.cloudflare.com/workers-ai/features/json-mode/)
- GitHub 文件提交 API：[Repository contents](https://docs.github.com/en/rest/repos/contents)
- GitHub Pages 自定义工作流：[Publishing with a custom workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## 数据与免责声明

本项目只处理公开 RSS 中的标题、摘要和链接，自动生成内容用于信息整理和技术演示。请遵守各信源的使用条款，保留来源，不抓取受限全文。AI 摘要可能存在遗漏或错误，不构成投资、交易或商业决策建议，请以原始报道和官方信息为准。

## License

[MIT](./LICENSE)
