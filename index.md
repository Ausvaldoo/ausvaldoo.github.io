---
layout: home
title: 牧神的笔记
---

<script setup>
import { data as posts } from './posts.data.js'
</script>

<!-- ① 刊头 masthead：小字排版标志，不是 126px 大字 -->
<header class="fm-masthead">
  <span class="fm-mast-title">牧神的笔记</span>
  <span class="fm-mast-sub">INVEST · AUTOMATION · ENGINEERING</span>
</header>

<!-- ② 封面宣言 statement：一句巨型衬线话，替代旧 hero -->
<section class="fm-statement">
  <span class="fm-kicker">关于这本笔记</span>
  <h1 class="fm-stmt">把时间写进复利<br>把工程写成笔记</h1>
</section>

<!-- ③ 目录 index：编号列表，不是卡片网格 -->
<section class="fm-toc">
  <div class="fm-toc-head">
    <h2 class="fm-toc-title">最新文章</h2>
    <span class="fm-toc-count">({{ posts.length }})</span>
    <a class="fm-all" href="/posts/">全部文章 →</a>
  </div>
  <ol class="fm-toc-list">
    <li v-for="(post, i) in posts" :key="post.url" class="fm-toc-item">
      <div class="fm-row">
        <span class="fm-no">{{ String(i + 1).padStart(2, '0') }}</span>
        <a :href="post.url" class="fm-title">{{ post.title }}</a>
        <span class="fm-meta">{{ post.date }}<em v-if="post.category"> · {{ post.category }}</em></span>
      </div>
    </li>
  </ol>
</section>

<!-- ④ 系列横带：sticky 打断单调（结构占位，动效层再钉住） -->
<a class="fm-series" href="/series">
  <span class="fm-series-label">系列专题</span>
  <span class="fm-series-hint">横向滑动浏览 →</span>
</a>

<!-- ⑤ 主题词 marquee：横向缓移，制造反节奏 -->
<div class="fm-marquee" aria-hidden="true">
  <div class="fm-marquee-track">
    <span>投资 · 工业自动化 · 工程实践 · 阅读 · 设计 ·&nbsp;</span>
    <span>投资 · 工业自动化 · 工程实践 · 阅读 · 设计 ·&nbsp;</span>
  </div>
</div>

<!-- ⑥ 封底 colophon：一句签名 -->
<footer class="fm-colophon">
  <p>把复杂的事，写成能读懂的字。</p>
</footer>

<style scoped>
/* ============ 杂志封面 + 目录 ============
   ⚠️ 必须 scoped：裸 <style> 的 .fm-title (0,1,0) 干不过 VitePress 的
   .vp-doc a (0,1,1)，实测标题被压成"rust 下划线"、ol 序号与编号叠显。
   scoped 给每条规则补上 [data-v] 属性，特异性 (0,2,0) 反超。 */

.fm-masthead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0 20px;
  border-bottom: 1px solid var(--vp-c-text-1);
}
.fm-mast-title {
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--vp-c-text-1);
}
.fm-mast-sub {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--vp-c-text-3);
  white-space: nowrap;
}

/* ② 宣言 */
.fm-statement {
  margin: 64px 0 72px;
}
.fm-kicker {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.22em;
  color: var(--rust);
}
.fm-kicker::before {
  content: '';
  width: 26px;
  height: 2px;
  background: var(--rust);
}
.fm-stmt {
  margin: 24px 0 0;
  font-family: var(--font-serif);
  font-size: clamp(40px, 6.2vw, 76px);
  font-weight: 700;
  line-height: 1.12;
  letter-spacing: 0.01em;
  color: var(--vp-c-text-1);
}

/* ③ 目录 */
.fm-toc {
  margin-top: 16px;
}
.fm-toc-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--vp-c-divider);
}
.fm-toc-title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}
.fm-toc-count {
  font-family: var(--font-mono);
  font-size: 20px;
  color: var(--rust);
}
.fm-all {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 12.5px;
  color: var(--vp-c-text-3);
  text-decoration: none;
}
.fm-all:hover { color: var(--rust); }

.fm-toc-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.fm-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 18px;
  padding: 18px 8px;
  border-bottom: 1px solid var(--vp-c-divider);
}
.fm-no {
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--rust);
}
.fm-title {
  font-family: var(--font-serif);
  font-size: 17px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--vp-c-text-1);
  text-decoration: none;
}
.fm-meta {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-3);
  white-space: nowrap;
}
.fm-meta em {
  font-style: normal;
  color: var(--vp-c-brand-1);
}
.fm-row:hover .fm-title { color: var(--rust); }
.fm-row:hover { background: var(--vp-c-bg-soft); }

/* ④ 系列横带 */
.fm-series {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 56px 0;
  padding: 22px 4px;
  border-top: 1px solid var(--vp-c-divider);
  border-bottom: 1px solid var(--vp-c-divider);
  text-decoration: none;
}
.fm-series-label {
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}
.fm-series-hint {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--vp-c-text-3);
}
.fm-series:hover .fm-series-label { color: var(--rust); }

/* ⑤ marquee */
.fm-marquee {
  overflow: hidden;
  white-space: nowrap;
  padding: 8px 0;
}
.fm-marquee-track {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 14px;
  letter-spacing: 0.12em;
  color: var(--rust);
  animation: fm-marquee 30s linear infinite;
}
@keyframes fm-marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}

/* ⑥ 封底 */
.fm-colophon {
  margin-top: 72px;
  padding: 32px 0 16px;
  text-align: center;
  border-top: 1px solid var(--vp-c-divider);
}
.fm-colophon p {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 18px;
  font-style: italic;
  color: var(--vp-c-text-2);
}

@media (prefers-reduced-motion: reduce) {
  .fm-marquee-track { animation: none; }
}
@media (max-width: 640px) {
  .fm-row { grid-template-columns: 34px minmax(0, 1fr); }
  .fm-meta { grid-column: 2; }
  .fm-mast-sub { display: none; }
}
</style>
