import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFallbackDigest,
  buildHugoMarkdown,
  classifyArticle,
  formatDateInZone,
  normalizeUrl,
  parseRssXml,
  ruleBasedDeduplicate,
  runDailyPipeline,
  titleSimilarity,
  utf8ToBase64,
} from "../src/index.js";

const NOW = new Date("2026-08-30T23:00:00.000Z");

test("parseRssXml parses RSS 2.0, strips HTML and keeps source metadata", () => {
  const xml = `
    <rss><channel>
      <item>
        <title><![CDATA[某车企发布全新纯电车型]]></title>
        <link>https://example.com/news?id=1&amp;utm_source=rss</link>
        <description><![CDATA[<p>新车关注续航与补能效率。</p>]]></description>
        <pubDate>Sun, 30 Aug 2026 22:30:00 GMT</pubDate>
        <source>示例媒体</source>
      </item>
    </channel></rss>`;

  const items = parseRssXml(xml, { name: "备用来源", categoryHint: "整车" });
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "某车企发布全新纯电车型");
  assert.equal(items[0].summary, "新车关注续航与补能效率。");
  assert.equal(items[0].url, "https://example.com/news?id=1");
  assert.equal(items[0].sourceName, "示例媒体");
  assert.equal(items[0].categoryHint, "整车");
});

test("parseRssXml supports Atom links and update timestamps", () => {
  const atom = `
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <title>动力电池快充进展</title>
        <link rel="alternate" href="https://example.com/battery" />
        <summary>电池企业公布快充技术进展。</summary>
        <updated>2026-08-30T22:00:00Z</updated>
      </entry>
    </feed>`;

  const [item] = parseRssXml(atom, { name: "Atom Feed", categoryHint: "电池" });
  assert.equal(item.url, "https://example.com/battery");
  assert.equal(item.publishedAt, "2026-08-30T22:00:00.000Z");
});

test("ruleBasedDeduplicate merges exact URLs and highly similar titles", () => {
  const unique = ruleBasedDeduplicate([
    {
      title: "某品牌发布全新纯电 SUV",
      url: "https://example.com/a?utm_source=feed",
      summary: "摘要 A",
      sourceName: "媒体 A",
      alternateSources: [],
    },
    {
      title: "某品牌发布全新纯电 SUV",
      url: "https://example.com/b",
      summary: "摘要 B",
      sourceName: "媒体 B",
      alternateSources: [],
    },
    {
      title: "动力电池企业公布新产线计划",
      url: "https://example.com/c",
      summary: "摘要 C",
      sourceName: "媒体 C",
      alternateSources: [],
    },
  ]);

  assert.equal(unique.length, 2);
  assert.equal(unique[0].url, "https://example.com/a");
  assert.deepEqual(unique[0].alternateSources, [{ name: "媒体 B", url: "https://example.com/b" }]);
  assert.equal(titleSimilarity("车型发布：全新纯电平台", "车型发布｜全新纯电平台"), 1);
});

test("fallback digest classifies content and generates complete Hugo front matter", () => {
  const digest = buildFallbackDigest([
    {
      title: "动力电池企业公布固态电池进展",
      url: "https://example.com/battery",
      summary: "企业公布研发与量产节奏。",
      publishedAt: "2026-08-30T22:00:00.000Z",
      sourceName: "示例媒体",
      categoryHint: "电池",
      alternateSources: [],
    },
  ]);
  const markdown = buildHugoMarkdown({
    dateKey: "2026-08-31",
    digest,
    aiUsed: false,
    aiModel: "fallback",
    fetchedAt: NOW,
    timeZone: "Asia/Shanghai",
  });

  assert.equal(classifyArticle("自动驾驶法规与辅助驾驶监管", ""), "自动驾驶");
  assert.match(markdown, /title: "新能源汽车行业日报｜2026-08-31"/);
  assert.match(markdown, /categories: \["电池"\]/);
  assert.match(markdown, /## 电池/);
  assert.match(markdown, /\[示例媒体\]\(https:\/\/example\.com\/battery\)/);
  assert.match(markdown, /Rule-based fallback/);
});

test("runDailyPipeline falls back when AI fails and pushes one new Markdown file", async () => {
  const calls = [];
  let publishedMarkdown = "";
  const rssXml = `
    <rss><channel><item>
      <title>智能驾驶平台发布测试进展</title>
      <link>https://example.com/adas</link>
      <description>平台公布新一轮道路测试与合规计划。</description>
      <pubDate>Sun, 30 Aug 2026 22:30:00 GMT</pubDate>
    </item></channel></rss>`;

  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || "GET" });
    if (String(url).startsWith("https://api.github.com") && (init.method || "GET") === "GET") {
      return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
    }
    if (String(url) === "https://feeds.example.com/nev.xml") {
      return new Response(rssXml, { status: 200, headers: { "Content-Type": "application/xml" } });
    }
    if (String(url).startsWith("https://api.github.com") && init.method === "PUT") {
      const payload = JSON.parse(init.body);
      publishedMarkdown = Buffer.from(payload.content, "base64").toString("utf8");
      return new Response(
        JSON.stringify({ commit: { sha: "commit-sha", html_url: "https://github.com/demo/commit/1" } }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      );
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const env = {
    GITHUB_TOKEN: "test-token",
    GITHUB_OWNER: "demo",
    GITHUB_REPO: "nev-daily",
    GITHUB_BRANCH: "main",
    RSS_SOURCES_JSON: JSON.stringify([
      { name: "测试 RSS", url: "https://feeds.example.com/nev.xml", categoryHint: "自动驾驶" },
    ]),
    AI_MODEL: "@cf/meta/test-model",
    AI: { run: async () => { throw new Error("AI temporarily unavailable"); } },
  };

  const result = await runDailyPipeline(env, { now: NOW, trigger: "test", fetchImpl });
  assert.equal(result.status, "published");
  assert.equal(result.aiUsed, false);
  assert.equal(result.articlePath, "content/posts/2026-08-31-nev-daily.md");
  assert.equal(calls.filter((call) => call.method === "PUT").length, 1);
  assert.match(publishedMarkdown, /## 自动驾驶/);
  assert.match(publishedMarkdown, /系统已自动降级/);
});

test("runDailyPipeline exits before RSS and AI when today's file exists", async () => {
  let callCount = 0;
  const fetchImpl = async () => {
    callCount += 1;
    return new Response(JSON.stringify({ sha: "existing-sha" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  let aiCallCount = 0;
  const env = {
    GITHUB_TOKEN: "test-token",
    GITHUB_OWNER: "demo",
    GITHUB_REPO: "nev-daily",
    AI: { run: async () => { aiCallCount += 1; } },
  };

  const result = await runDailyPipeline(env, { now: NOW, trigger: "test", fetchImpl });
  assert.equal(result.status, "skipped");
  assert.equal(result.reason, "article_already_exists");
  assert.equal(callCount, 1);
  assert.equal(aiCallCount, 0);
});

test("URL normalization, timezone date and Unicode base64 helpers are deterministic", () => {
  assert.equal(
    normalizeUrl("https://example.com/path?utm_medium=rss&b=2&a=1#section"),
    "https://example.com/path?a=1&b=2",
  );
  assert.equal(formatDateInZone(NOW, "Asia/Shanghai"), "2026-08-31");
  assert.equal(Buffer.from(utf8ToBase64("新能源汽车"), "base64").toString("utf8"), "新能源汽车");
});
