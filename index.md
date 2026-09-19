---
layout: home
title: 牧神的笔记
---

<script setup>
import { data as posts } from './posts.data.js'
import { data as seriesPosts } from './series.data.js'

// 目录只放最新 12 篇：全量归档在 /posts/。
// 首页是杂志目录，不是仓库清单——上百篇时把读者拖进无限滚动是失职。
const LIMIT = 12
const shown = posts.slice(0, LIMIT)

// 系列真卡片：按篇数排，多的在前（与 /series 页同一排序语义）
const map = {}
for (const p of seriesPosts) {
  if (p.series) (map[p.series] ??= []).push(p)
}
const seriesGroups = Object.entries(map).sort(
  (a, b) => b[1].length - a[1].length || String(a[0]).localeCompare(String(b[0]), 'zh')
)

// 标签倒排索引 → 三条错速滚动的标签词带。词词是真链接（/tags#tag-名）。
const tagMap = {}
for (const p of posts) for (const t of p.tags) tagMap[t] = (tagMap[t] || 0) + 1
const tagEntries = Object.entries(tagMap).sort(
  (a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'zh')
)
// 行数随标签量自适应（≥18 三行、≥8 两行、否则一行）——不为凑三行硬拆
const MQ_N = tagEntries.length >= 18 ? 3 : tagEntries.length >= 8 ? 2 : 1
const tagCount = tagEntries.length
const mqRows = Array.from({ length: MQ_N }, () => [])
tagEntries.forEach((t, i) => mqRows[i % MQ_N].push(t))
// 内容重复 6 次做无缝循环：动画位移 -50%，首半 = 3 组内容，宽视口也不露缝
const mqTracks = mqRows.map((r) => Array.from({ length: 6 }, () => r).flat())
</script>

<!-- ① 刊头 masthead：首页顶部唯一的「牧神的笔记」；
     滚动时由 setupHeroFly 飞进导航栏（导航站名由 CSS 守卫隐藏、飞行中交叉溶解交接） -->
<header class="fm-masthead">
  <span class="fm-mast-title">牧神的笔记</span>
  <span class="fm-mast-sub">INVEST · AUTOMATION · ENGINEERING</span>
</header>

<!-- ② 封面 + 目录：左栏宣言钉住（sticky），右栏目录先滚；
     目录滚完，sticky 释放，两侧一起被带走 -->
<section class="fm-cover">
  <div class="fm-left">
    <span class="fm-kicker" aria-hidden="true"></span>
    <h1 class="fm-stmt">夏日蓝色的黄昏里<br>我将走上幽径<br>不顾麦茎刺肤<br>漫步地踏青</h1>
  </div>
  <div class="fm-right">
    <div class="fm-toc-head">
      <h2 class="fm-toc-title">最新文章</h2>
      <span class="fm-toc-count">({{ shown.length }})</span>
      <a class="fm-all" href="/posts/">全部文章 ({{ posts.length }}) →</a>
    </div>
    <ol class="fm-toc-list">
      <li v-for="(post, i) in shown" :key="post.url" class="fm-toc-item" :style="{ '--reveal-i': i }">
        <div class="fm-row">
          <span class="fm-no">{{ String(i + 1).padStart(2, '0') }}</span>
          <div class="fm-main">
            <a :href="post.url" class="fm-title">{{ post.title }}</a>
            <p v-if="post.excerpt" class="fm-excerpt">{{ post.excerpt }}</p>
          </div>
          <span class="fm-meta">{{ post.date }}<em v-if="post.category"> · {{ post.category }}</em></span>
        </div>
      </li>
    </ol>
  </div>
</section>

<!-- ③ 系列横带：真卡片，真的可以横向滑动（scroll-snap） -->
<section v-if="seriesGroups.length" class="fm-series">
  <div class="fm-series-head">
    <h2 class="fm-series-title">系列专题</h2>
    <span class="fm-series-count">({{ seriesGroups.length }})</span>
    <a class="fm-all" href="/series">全部系列 →</a>
  </div>
  <div class="fm-series-track">
    <a
      v-for="[name, list] in seriesGroups"
      :key="name"
      class="fm-series-card"
      :href="`/series#ser-${name}`"
    >
      <span class="sc-no">{{ String(list.length).padStart(2, '0') }} 篇</span>
      <span class="sc-name">{{ name }}</span>
    </a>
  </div>
</section>

<!-- ⑤ 标签词带：三条错速滚动（中排反向），悬停暂停；每个词可点进 /tags 对应锚点 -->
<section v-if="mqTracks[0].length" class="fm-mq" aria-label="标签">
  <div class="fm-mq-head">
    <h2 class="fm-mq-title">标签</h2>
    <span class="fm-mq-count">({{ tagCount }})</span>
  </div>
  <div v-for="(row, r) in mqTracks" :key="r" class="fm-mq-row" :class="`is-${r}`">
    <div class="fm-mq-track">
      <a v-for="(t, i) in row" :key="i" class="fm-mq-tag" :href="`/tags#tag-${t[0]}`">
        {{ t[0] }}<sup>{{ t[1] }}</sup>
      </a>
    </div>
  </div>
</section>

<!-- ④ 封底：站长的签名（兰波） -->
<footer class="fm-colophon">
  <p>不过是温柔的疯狂</p>
  <span>—— 兰波</span>
  <small>© 2026 牧神的笔记</small>
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
/* 摘要：默认恰好 2 行（max-height 取 2 倍行高，截断落在行边界上），
   悬停展开到 6 行；过渡只动 max-height（GPU 友好，与旧版同一手法）。
   浮出的错峰延迟在 custom.css 的 reveal 段（比行体慢 0.12s，层次感）。 */
.fm-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.fm-excerpt {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
  max-height: calc(1.7em * 2);
  overflow: hidden;
  transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.fm-row:hover .fm-excerpt,
.fm-row:focus-within .fm-excerpt {
  max-height: calc(1.7em * 6);
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

/* ③ 系列横带：真卡片 + 真横向滚动 */
.fm-series {
  margin: 72px 0 0;
}
.fm-series-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--vp-c-divider);
}
.fm-series-title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}
.fm-series-count {
  font-family: var(--font-mono);
  font-size: 20px;
  color: var(--rust);
}
.fm-series-track {
  display: flex;
  gap: 16px;
  margin-top: 20px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding-bottom: 6px;
}
.fm-series-card {
  flex: 0 0 236px;
  scroll-snap-align: start;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 24px;
  min-height: 128px;
  padding: 18px 18px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 2px;
  text-decoration: none;
  /* color 必须进同一份 transition：VP 默认给 .vp-doc a 挂 color .25s，
     不同步就会出现"边框橘了、字还在黑→橘路上"的两段感 */
  transition: border-color 0.25s cubic-bezier(0.22, 1, 0.36, 1),
              background-color 0.25s cubic-bezier(0.22, 1, 0.36, 1),
              color 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}
.fm-series-card:hover {
  border-color: var(--rust);
  background: var(--vp-c-bg-soft);
}
.sc-no {
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--rust);
}
.sc-name {
  font-family: var(--font-serif);
  font-size: 17px;
  font-weight: 700;
  line-height: 1.45;
  color: var(--vp-c-text-1);
}
.fm-series-card:hover .sc-name { color: var(--rust); }

/* ④ 封底 */
/* ⑤ 标签词带：节头与系列同语法，三行错速滚动，边缘渐隐，悬停暂停 */
.fm-mq {
  margin-top: 64px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.fm-mq-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--vp-c-divider);
}
.fm-mq-title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}
.fm-mq-count {
  font-family: var(--font-mono);
  font-size: 20px;
  color: var(--rust);
}
.fm-mq-row {
  overflow: hidden;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent);
}
.fm-mq-track {
  display: inline-flex;
  gap: 14px;
  width: max-content;
  animation: fm-mq-scroll 62s linear infinite;
}
/* 三行：上 92s 左移 → 中 74s 右移（reverse）→ 下 108s 左移。
   中排反向是刻意的错落感（读者 2026-09-19 明确要保留："逆走参差有致，
   同向过于整齐"）。但**中排不能最快** —— 原先 44s 的 reverse 是全场最急，
   那句"中排跟没吃饭一样"就来自这里。现在中排 74s，比上排快、比下排快，
   仍是最"活跃"的一行，但已经落在从容的区间。 */
.fm-mq-row.is-0 .fm-mq-track { animation-duration: 92s; }
.fm-mq-row.is-1 .fm-mq-track { animation-duration: 74s; animation-direction: reverse; }
.fm-mq-row.is-2 .fm-mq-track { animation-duration: 108s; }
.fm-mq:hover .fm-mq-track { animation-play-state: paused; }
@keyframes fm-mq-scroll {
  to { transform: translateX(-50%); }
}
.fm-mq-tag {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 7px 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 2px;
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: 0.04em;
  white-space: nowrap;
  color: var(--vp-c-text-2);
  text-decoration: none;
  transition: border-color 0.25s cubic-bezier(0.22, 1, 0.36, 1),
              color 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}
.fm-mq-tag sup {
  font-size: 10px;
  color: var(--rust);
}
.fm-mq-tag:hover {
  border-color: var(--rust);
  color: var(--vp-c-text-1);
}
@media (prefers-reduced-motion: reduce) {
  .fm-mq-track { animation: none; }
  .fm-mq-row { overflow-x: auto; }
}

/* ④ 封底：站长的签名 */
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
.fm-colophon small {
  display: block;
  margin-top: 26px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--vp-c-text-3);
  opacity: 0.75;
}

@media (max-width: 880px) {
  /* 窄屏退回单列：宣言在上（不钉住），目录在下 */
  .fm-cover { grid-template-columns: minmax(0, 1fr); }
  .fm-left { position: static; }
  .fm-stmt { font-size: clamp(26px, 7vw, 38px); }
  .fm-row { grid-template-columns: 34px minmax(0, 1fr); }
  .fm-meta { grid-column: 2; }
  .fm-mast-sub { display: none; }
  /* 手机端词带只留一行：三行在窄屏上挤在一起会织成一张密集的网，
     失去"标签是一条一条读"的信息节奏。留第一行（is-0）即可。 */
  .fm-mq-row.is-1,
  .fm-mq-row.is-2 { display: none; }
  /* ⚠️ 必须带 .fm-mq-row 前缀：桌面的 .fm-mq-row.is-0 特异性 (0,2,0)
     会压过裸的 .fm-mq-track (0,1,0)，实测移动端拿到的是 78s 不是这里写的值。 */
  .fm-mq-row.is-0 .fm-mq-track { animation-duration: 46s; }
}
</style>
