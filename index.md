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
    <!-- 诗句：**逐词**升起（2026-09-19 二次迭代，对齐 ggdesign.it 的做法）。
         行只是换行单位，掩码单位是「词」——所以结构是三层：
           .fm-line   → 换行容器（block，不裁切）
           .fm-word   → 词掩码（inline-block + overflow:hidden，裁掉词的下半部分）
           .fm-word > span → 实际位移的词
         为什么要到「词」这一级：只按行错峰，四行只有 4 个错峰单位，视觉上近乎
         齐步走（实测总错峰窗口仅 0.21s）。拆到词后错峰单位变成 ~14 个，
         才会出现「左端先起、右端被拉着起来」的连续波浪感。
         ⚠️ 词由 JS 在运行时按标点切分并注入（见 index.mjs 的 splitPoemWords），
         不在这里手写死——中文词长不一，手写容易漏且改文案要重排。 -->
    <h1 class="fm-stmt" data-poem aria-label="夏日蓝色的黄昏里，我将走上幽径，不顾麦茎刺肤，漫步地踏青"></h1>
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
  /* 手机端词带：只留一行，但**必须能手动滑动**。
     三行在 390px 窄屏上会织成一张密网，每行只露 3-4 个词，
     失去"一条一条读"的节奏——所以留 is-0 一行。
     但 overflow:hidden 会连手指滑动一起禁掉（上一版的失误），
     窄屏改成 overflow-x:auto + 触摸暂停动画：默认自动滚，
     手指一搭就停下让位给手动滑，松手后动画继续。 */
  .fm-mq-row.is-1,
  .fm-mq-row.is-2 { display: none; }
  .fm-mq-row.is-0 {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .fm-mq-row.is-0::-webkit-scrollbar { display: none; }
  /* ⚠️ 必须带 .fm-mq-row 前缀：桌面的 .fm-mq-row.is-0 特异性 (0,2,0)
     会压过裸的 .fm-mq-track (0,1,0)，实测移动端拿到的是 78s 不是这里写的值。 */
  .fm-mq-row.is-0 .fm-mq-track {
    animation-duration: 46s;
  }
  /* 触屏设备：桌面那条 :hover 暂停规则在这里会失效（无 hover），
     所以补一条 :active —— 手指按住时停住，让手动滑动说了算。 */
  .fm-mq-row.is-0:active .fm-mq-track { animation-play-state: paused; }
}
</style>


<!-- 诗句升起动效的样式必须**独立于上面的 scoped 块**。
     原因：<style scoped> 靠编译期给模板元素打 data-v-xxx 属性来限定作用域，
     而 .fm-line / .fm-word 是 index.mjs 在**运行时**注入的（词要按标点动态切分），
     拿不到那个属性 → scoped 规则永远匹配不上（实测症状：.fm-word 计算出
     display:inline、overflow:visible，掩码完全失效，词直接显示在下方）。
     所以这一块用**裸 style**，选择器自带 .fm- 前缀，不会误伤 VitePress 的类。 -->
<style>
/* ── 诗句逐词升起（2026-09-19 站长指定；对齐 ggdesign.it）────────────
   触发时机：**仅首页首次加载/刷新**。从文章页返回首页时走 View Transitions
   的整页横移，此时不重复播升起 —— 两套空间隐喻（纵向升起 vs 横向平移）
   分属不同触发条件，不会同时发生。

   参数最初取自参照站点 ggdesign.it 的公开实现（GSAP SpliteText 逐词）：
     yPercent:100 · rotateZ:4 · blur(4px) · duration:1.25 · ease:power3 · stagger:.03
   本实现用 CSS animation 而非 GSAP（不引入 60KB 依赖），缓动用
   cubic-bezier(.33,1,.68,1) 逼近 power3（其定义即 ease-out-cubic 的变体）。

   ⚠️ 2026-09-22 站长决定：**只去掉 blur(4px)，保留升起 + 倾斜 + 两级错峰。**
   依据是另一参照站 linearfestivals 的 EventHero —— 它的逐词上升原文是：
     t.fromTo('[data-hero-word]', { yPercent: 110 }, { yPercent: 0, duration: .9, stagger: .05 }, '-=0.45')
   **它没有模糊、也没有倾斜**。站长原话：「这个肯定是要的（升起+倾斜+错峰），
   我说的是不要模糊……我给你的那个网站，它上身就根本没有模糊效果啊」。
   所以这里只删 blur 一项，其余三件（位移 / 4deg 倾斜 / 行+词两级错峰）原样不动；
   连 will-change 里的 filter 一起撤掉 —— 少一个合成层属性。

   ⚠️ 为什么掩码单位必须是「词」而不是「行」（2026-09-19 的结论，仍然成立）：
   只按行错峰时，行内整块齐步，没有「左端先起、右端被拉着起来」的波浪感。
   站长原话：「他的文字从地平线上升时，是左端先上升，然后像把右端拉起来一样……
    咱的好像一下就全上升完了，他的比较缓慢」
   ⚠️ 但**只按词错峰也不够**（2026-09-21 站长二次反馈）：行与行会被压在一起，
   看不出是四段先后起身。所以现在**行、词两级各给一个步长** ——
   行内是波浪，行间是节拍。见下方 --fm-line-step / --fm-word-step。
   这两条不是互相推翻，是同一个问题的两个面：掩码单位选词（细），
   错峰要分行加步长（粗）。 */
.fm-line {
  display: block;
  /* ⚠️ 这一层**不做裁切**：裁切交给 .fm-word。若在此裁切，
     inline-block 的词会被行框的 overflow 整体切掉，
     且带 rotate 的词会在行边界处被削去一角。 */
}
/* 词掩码：inline-block + overflow:hidden。inline-block 是必须的 ——
   inline 元素的 overflow 不生效，掩码会失效（词会直接显示在下方）。 */
.fm-word {
  display: inline-block;
  overflow: hidden;
  vertical-align: bottom;
  /* ⚠️ 不能加 padding 补字距：掩码会连 padding 一起裁，词头被削。
     词间距靠 .fm-word + .fm-word 的 margin，加在掩码**外侧**。 */
}
.fm-word + .fm-word {
  margin-left: 0.04em;
}
.fm-word > span {
  display: inline-block;
  /* 初始态：沉到地平线以下（100% = 自身高度），并轻微倾斜，
     模拟「从远处地平线浮起」的实体感 —— 0 位移的纯透明淡入会显得很平。
     ⚠️ 2026-09-22 起**不再带 blur**：参照站 linearfestivals 的逐词上升没有模糊，
        它只做 yPercent 110 → 0。见本文件上方 style 块开头的说明。 */
  transform: translateY(100%) rotate(4deg);
  opacity: 0;
  will-change: transform, opacity;
}

/* 两级错峰的参数 —— **调节奏只改这两个数**：
     --fm-word-step  词内错峰：保留「左端先起、右端被拉起」的波浪感
     --fm-line-step  行间错峰：让四行被眼睛分别看见（2026-09-21 新增）
   为什么必须两级（这是上一版没想透的地方）：
     上一版只按**词**错峰（0.03s × 全局词号）。波浪感是有了，但四行的起始
     时刻只有 0/0.06/0.15/0.21s —— 而单段行程 1.25s，行与行只差 0.06~0.09s，
     相对 1.25s 几乎等于同时起步。**站长反馈：「这四段出现的时间咬合得太紧，
     能不能让眼睛发现它们是不同时间往上出现的」**，指的就是这个。
     反过来只按**行**错峰，行内就变成整块齐步，波浪感又会丢（注释下段记的旧结论）。
     两者是**不同的视觉任务**（行内=波浪，行间=节拍），必须各给一个步长。 */
.fm-stmt {
  --fm-word-step: 0.03s;
  --fm-line-step: 0.20s;
}

/* 升起动画：只在首页根元素带 .fm-rise-in 时播。
   .fm-rise-in 由 index.mjs 的 setupPoemRise() 在**首屏加载**时挂上。 */
html.fm-rise-in .fm-word > span {
  animation: fm-word-rise 1.25s cubic-bezier(0.33, 1, 0.68, 1) both;
  /* 两级错峰叠加：
       行间 行号 × 0.20s    → 四行各自成拍
       词内 全局词号 × 0.03s → 行内仍是一条波浪
     ⚠️ 但行首的**实测起步时刻不是**整齐的 0 / 200 / 400 / 600 ms：行号那一项
     是加在该行首词「已累加的词号项」**之上**的。实测（_blog-probe/poem_delay_probe.py）：
       第1行 0ms   第2行 260ms   第3行 550ms   第4行 810ms
       （相邻间距 260 / 290 / 260 —— 不匀是算术的必然，不是 bug，别去"修"成 200 整。
         想改成等距要先把词号项从行首扣掉，那是另一套算法，收益只是整齐。）
     全诗 4 行 / 9 块。第 4 行 810ms 起步 + 1250ms 行程 ≈ 2060ms 走完。
     对照上一版（只按词错峰）：首末行起步差 210ms，仅占行程 17%，眼睛分不出；
     现在 810ms，占 65%。这就是 2026-09-21 这次改动的**可验收指标**。
     ⚠️ --fm-word-i 是**跨行累加**的全局词号，--fm-line-i 是行号，
     两者量纲不同、不可互相推导，所以要分别注入（见 index.mjs splitPoem / play）。 */
  animation-delay: calc(
    var(--fm-line-i, 0) * var(--fm-line-step, 0.2s) +
    var(--fm-word-i, 0) * var(--fm-word-step, 0.03s)
  );
}

@keyframes fm-word-rise {
  from {
    transform: translateY(100%) rotate(4deg);
    opacity: 0;
  }
  to {
    transform: translateY(0) rotate(0deg);
    opacity: 1;
  }
}

/* 动画结束后把元素**钉在终态**。
   ⚠️ 这是实测抓到的 bug（2026-09-19）：原写法只清 will-change，
   于是 .fm-rise-in 一被移除，`animation: ... both` 提供的终态就随之消失，
   元素回落到基础态（translateY(100%) + opacity:0）——**诗句凭空消失**。
   实测时间线：动画在 t=929~1740ms 正常播到 opacity=1，
   紧接着 t=1785ms 就跳回 opacity=0。
   所以 done 态必须显式写死终态值，不能只依赖动画的 fill。 */
html.fm-rise-done .fm-word > span {
  transform: none;
  opacity: 1;
  will-change: auto;
}

/* 尊重系统的减弱动效偏好：直接落到终态，不播动画 */
@media (prefers-reduced-motion: reduce) {
  .fm-word > span {
    transform: none;
    opacity: 1;
  }
  html.fm-rise-in .fm-word > span {
    animation: none;
  }
}

</style>

