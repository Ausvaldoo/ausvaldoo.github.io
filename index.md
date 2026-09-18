---
layout: home
title: 牧神的笔记
---

<script setup>
import { data as posts } from './posts.data.js'
</script>

<!-- ① 刊头 masthead：首页顶部唯一的「牧神的笔记」；
     滚动时由 setupHeroFly 飞进导航栏（导航站名由 CSS 守卫隐藏、飞行中交叉溶解交接） -->
<header class="fm-masthead">
  <span class="fm-mast-title">牧神的笔记</span>
  <span class="fm-mast-sub">INVEST · AUTOMATION · ENGINEERING</span>
</header>

<!-- ② 封面 + 目录：左栏宣言钉住（sticky），右栏目录先滚；
     目录滚完，sticky 释放，两侧一起被带走 —— 站长点名的分层节奏 -->
<section class="fm-cover">
  <div class="fm-left">
    <span class="fm-kicker">兰波 · RIMBAUD</span>
    <h1 class="fm-stmt">夏日蓝色的黄昏里，<br>我将走上幽径，<br>不顾麦茎刺肤，<br>漫步地踏青</h1>
  </div>
  <div class="fm-right">
    <div class="fm-toc-head">
      <h2 class="fm-toc-title">最新文章</h2>
      <span class="fm-toc-count">({{ posts.length }})</span>
      <a class="fm-all" href="/posts/">全部文章 →</a>
    </div>
    <ol class="fm-toc-list">
      <li v-for="(post, i) in posts" :key="post.url" class="fm-toc-item" :style="{ '--reveal-i': i }">
        <div class="fm-row">
          <span class="fm-no">{{ String(i + 1).padStart(2, '0') }}</span>
          <a :href="post.url" class="fm-title">{{ post.title }}</a>
          <span class="fm-meta">{{ post.date }}<em v-if="post.category"> · {{ post.category }}</em></span>
        </div>
      </li>
    </ol>
  </div>
</section>

<!-- ③ 系列横带 -->
<a class="fm-series" href="/series">
  <span class="fm-series-label">系列专题</span>
  <span class="fm-series-hint">横向滑动浏览 →</span>
</a>

<!-- ④ 主题词 marquee -->
<div class="fm-marquee" aria-hidden="true">
  <div class="fm-marquee-track">
    <span>投资 · 工业自动化 · 工程实践 · 阅读 · 设计 ·&nbsp;</span>
    <span>投资 · 工业自动化 · 工程实践 · 阅读 · 设计 ·&nbsp;</span>
  </div>
</div>

<!-- ⑤ 封底：站长的签名（兰波） -->
<footer class="fm-colophon">
  <p>不过是温柔的疯狂</p>
  <span>—— 兰波</span>
</footer>

<style scoped>
/* ============ 杂志封面 + 目录 ============
   ⚠️ 必须 scoped：裸 <style> 的 .fm-title (0,1,0) 干不过 VitePress 的
   .vp-doc a (0,1,1)，实测标题被压成"rust 下划线"、ol 序号与编号叠显。 */

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

/* ② 左钉右滚的分栏 */
.fm-cover {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: 24px 56px;
  align-items: start;
  margin-top: 56px;
}
/* 左栏宣言：钉在视口内，直到右栏目录滚完、外层高度耗尽后一起被带走 */
.fm-left {
  position: sticky;
  top: 96px;   /* 导航 64px + 余量 */
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
  font-size: clamp(28px, 3.4vw, 46px);
  font-weight: 700;
  line-height: 1.42;
  letter-spacing: 0.01em;
  color: var(--vp-c-text-1);
}

/* 目录 */
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

/* ③ 系列横带 */
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

/* ④ marquee */
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

/* ⑤ 封底 */
.fm-colophon {
  margin-top: 72px;
  padding: 32px 0 16px;
  text-align: center;
  border-top: 1px solid var(--vp-c-divider);
}
.fm-colophon p {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 20px;
  font-style: italic;
  color: var(--vp-c-text-1);
}
.fm-colophon span {
  display: block;
  margin-top: 10px;
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.1em;
  color: var(--vp-c-text-3);
}

@media (prefers-reduced-motion: reduce) {
  .fm-marquee-track { animation: none; }
}
@media (max-width: 880px) {
  /* 窄屏退回单列：宣言在上（不钉住），目录在下 */
  .fm-cover { grid-template-columns: minmax(0, 1fr); }
  .fm-left { position: static; }
  .fm-stmt { font-size: clamp(26px, 7vw, 38px); }
  .fm-row { grid-template-columns: 34px minmax(0, 1fr); }
  .fm-meta { grid-column: 2; }
  .fm-mast-sub { display: none; }
}
</style>
