---
layout: home
title: 牧神的笔记
---

<script setup>
import { data as posts } from './posts.data.js'
import { data as seriesPosts } from './series.data.js'
import seriesIntro from './series-intro.js'

// 目录只放最新 12 篇：全量归档在 /posts/。
// 首页是杂志目录，不是仓库清单——上百篇时把读者拖进无限滚动是失职。
const LIMIT = 12
const shown = posts.slice(0, LIMIT)

// 系列真卡片：按篇数排，多的在前（与 /series 页同一排序语义）
const map = {}
for (const p of seriesPosts) {
  if (p.series) (map[p.series] ??= []).push(p)
}
// 系列真卡片：按篇数排，多的在前（与 /series 页同一排序语义）。
// 第三项 = 系列简介，来自 series-intro.js —— 供「居中放大卡」里的小字使用；
// 未登记的系列给空串，卡片照常显示（只是没有简介）。
const seriesGroups = Object.entries(map)
  .sort((a, b) => b[1].length - a[1].length || String(a[0]).localeCompare(String(b[0]), 'zh'))
  .map(([name, list]) => [name, list, seriesIntro[name] || ''])

// 循环副本**必须在模板里渲染**，不能由 JS 追加：首页是 Vue 组件，
// JS 往 stage 里 append 的节点会在下一次 patch 时被 Vue 清掉（实测只剩 11 张）。
// 两份内容 + JS 取模定位 = 首尾相接的无限循环。
const seriesLoop = [...seriesGroups, ...seriesGroups]

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
  <!-- 横向条 v14（2026-09-27 站长四条要求后重写）：
       ① **所有卡平等** —— 取消中心放大/提亮/投影，卡宽恒定、只有位移；
       ② **每张都带简介** —— 简介常显（不再是"只有居中卡有"）；
       ③ **滚轮带惯性** —— 速度驱动模型（摩擦衰减），连滚加速、停手滑行；
       ④ **到头有撞击回弹** —— 阻尼弹簧 + 撞击瞬间的极轻挤压（迪士尼式）。
       滚轮驱动，不做左右箭头、不做桌面拖拽；点击卡片=滑到居中，已在居中的再点进系列页。 -->
  <div class="fm-series-wrap">
    <div
      class="fm-series-stage"
      :data-count="seriesGroups.length"
      tabindex="0"
      role="region"
      aria-label="系列专题，可左右切换"
    >
      <a
        v-for="([name, list, intro], i) in seriesGroups"
        :key="i"
        class="fm-series-card"
        :href="`/series#ser-${name}`"
        draggable="false"
      >
        <span class="sc-no">{{ String(list.length).padStart(2, '0') }} 篇</span>
        <span class="sc-body">
          <span class="sc-name">{{ name }}</span>
          <span class="sc-desc">{{ intro }}</span>
        </span>
      </a>
    </div>
  </div>
</section>

<!-- ⑤ 标签词带：三条错速滚动（中排反向），悬停暂停；每个词可点进 /tags 对应锚点 -->
<section v-if="mqTracks[0].length" class="fm-mq" aria-label="标签">
  <div class="fm-mq-head">
    <h2 class="fm-mq-title">标签</h2>
    <span class="fm-mq-count">({{ tagCount }})</span>
  </div>
  <div v-for="(row, r) in mqTracks" :key="r" class="fm-mq-row" :class="`is-${r}`">
    <div class="fm-mq-track" :style="`--per-copy:${row.length / 6}`">
      <a v-for="(t, i) in row" :key="i" class="fm-mq-tag" :data-copy="Math.floor(i / (row.length / 6))" :href="`/tags#tag-${t[0]}`">
        {{ t[0] }}<sup>{{ t[1] }}</sup>
      </a>
    </div>
  </div>
  <!-- 移动端专用：单行全量标签（桌面隐藏）。窄屏显示，原生横向滚动 + JS 自动循环。
       ⚠️ 2026-10-03：标签**铺 3 份**（v-for 三次、data-copy 0/1/2）而不是 1 份 ——
       JS 自动循环靠"跑完一份就回绕"实现（见 index.mjs setupMarqueeAuto）：
       内容只有 1 份时滚到右端就没有下一份可接，**无法循环**；
       铺 3 份后，无论滚到哪里都能取模回绕到某一份的起点，视觉上首尾相接。
       3 份 = 约 3 倍屏宽，够回绕又不至于让 DOM 过大。桌面 is-m 隐藏，不受影响。 -->
  <div v-if="mqTracks[0].length" class="fm-mq-row is-m" aria-hidden="false">
    <div class="fm-mq-track">
      <template v-for="c in 3" :key="'mc'+c">
        <a v-for="(t, i) in tagEntries" :key="'m' + c + '_' + i" class="fm-mq-tag" :data-copy="c - 1" :href="`/tags#tag-${t[0]}`">
          {{ t[0] }}<sup>{{ t[1] }}</sup>
        </a>
      </template>
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

/* 刊头：全宽显示，窄屏由下方 @media 隐藏（见「窄屏不开飞行」那段说明）
   ⚠️ 那条 border-bottom 是**设计师本意里的飞行基线** —— 刊头文字从这里
   起飞、落进导航栏，线就是"地面"。**只在 ≥960px 成立**（飞行只在宽屏跑）。
   窄屏没有飞行，这条 1px 纯黑通栏线就只剩"硬" —— 所以窄屏整个刊头一起隐藏。 */
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
  font-size: var(--fs-h3);
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--vp-c-text-1);
}
.fm-mast-sub {
  font-family: var(--font-mono);
  font-size: var(--fs-micro);
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
  font-size: var(--fs-label);
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
  font-size: var(--fs-h3);
  font-weight: 700;
  color: var(--vp-c-text-1);
}
.fm-toc-count {
  font-family: var(--font-mono);
  font-size: var(--fs-lead);
  color: var(--rust);
}
.fm-all {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: var(--fs-label);
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
  font-size: var(--fs-label);
  color: var(--rust);
}
.fm-title {
  font-family: var(--font-serif);
  font-size: var(--fs-h4);
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
  font-size: var(--fs-small);
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
  font-size: var(--fs-label);
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
  font-size: var(--fs-h3);
  font-weight: 700;
  color: var(--vp-c-text-1);
}
.fm-series-count {
  font-family: var(--font-mono);
  font-size: var(--fs-lead);
  color: var(--rust);
}
/* 包裹层：圆钮的定位上下文 */
.fm-series-wrap {
  position: relative;
  margin-top: 22px;
}
/* 舞台：位移式容器（**不是**原生滚动，所以不会有 scroll-snap 一卡一卡）。
   触屏只锁横轴；禁选（否则拖拽会变成选字）；
   初始 opacity:0，首帧定位完再淡入 —— 否则会先闪一下没排好的卡片。

   ⚠️ 边缘渐隐（mask）**按位置动态收放**（2026-09-27 站长要求）：
     "你滚到头你就把这个两边的这个虚的，你就把这个两边变成实的不就行了吗"
   渐隐的本意是暗示"还有内容"，但滚到端点时那侧已经空了 ——
   渐隐就只剩"把边缘那张卡糊掉"这一个作用，看着像坏了。
   JS（setupSeriesStrip 的 syncEdge）按 pos 打 data-edge：
     head → 收左；tail → 收右；both → 两侧都收（越界拉出橡皮筋时，要看清那道缝）。
   渐隐宽度用 CSS 变量表述，收放就是改这两个变量的值。 */
.fm-series-stage {
  position: relative;
  overflow: hidden;
  touch-action: pan-y;
  cursor: default;  /* 不用 grab 小手：桌面不做鼠标拖拽；grab 在浅底上会渲染成反白一块 */
  user-select: none;
  -webkit-user-select: none;
  opacity: 0;
  /* 渐隐宽度切换做个极短的补间，避免到端点时"啪"地跳变。
     0.18s 比一帧长、比手感阈值短 —— 读者察觉不到"切"，只觉得边缘变实了。 */
  transition: opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1),
              --fm-edge-fade-l 0.18s linear,
              --fm-edge-fade-r 0.18s linear;
  --fm-edge-fade-l: 5%;
  --fm-edge-fade-r: 5%;
  -webkit-mask-image: linear-gradient(90deg,
    transparent, #000 var(--fm-edge-fade-l),
    #000 calc(100% - var(--fm-edge-fade-r)), transparent);
  mask-image: linear-gradient(90deg,
    transparent, #000 var(--fm-edge-fade-l),
    #000 calc(100% - var(--fm-edge-fade-r)), transparent);
}
/* ⚠️ @property 注册后变量才可补间（否则是离散跳变）。
   不支持 @property 的浏览器会退化成"直接切换"，不影响正确性。 */
@property --fm-edge-fade-l { syntax: '<length-percentage>'; inherits: false; initial-value: 5%; }
@property --fm-edge-fade-r { syntax: '<length-percentage>'; inherits: false; initial-value: 5%; }
.fm-series-stage[data-edge='head'] { --fm-edge-fade-l: 0%; }
.fm-series-stage[data-edge='tail'] { --fm-edge-fade-r: 0%; }
.fm-series-stage[data-edge='both'] { --fm-edge-fade-l: 0%; --fm-edge-fade-r: 0%; }
.fm-series-stage.is-ready { opacity: 1; }

/* 卡片：absolute 定位，宽度/位移全部逐帧写 ——
   所以这里**不设** width/transform 的 transition（会被每帧补间拖慢）。
   v14：卡片一律浅色、一律平等（站长否掉了"反相黑卡"与"中间突出"），
   分层只靠留白与景深，**不再**按中心权重放大/提亮。 */
.fm-series-card {
  position: absolute;
  top: 50%;
  left: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;   /* 上对齐：编号 → 标题 → 简介，自上而下 */
  gap: 10px;
  padding: 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 2px;
  background: var(--vp-c-bg);
  color: inherit;
  text-decoration: none;
  will-change: transform;
  /* ⚠️ 只给"非逐帧"的属性加过渡：边框是阈值触发的，必须有过渡。
     width / transform 仍然**不设**过渡（它们由 JS 每帧写，加了会被补间拖慢）。 */
  transition: border-color 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}
.fm-series-card:hover { border-color: var(--rust); }
/* v14：删掉了 .is-front 的投影与 scale —— 所有卡平等。
   但保留「悬停/聚焦」这一层反馈（那是交互态，不是层级态）。 */
.sc-no {
  font-family: var(--font-mono);
  font-size: var(--fs-label);
  letter-spacing: 0.08em;
  color: var(--rust);
}
/* 文字列宽不再需要锁死：v12 起卡片等宽，宽度恒定，文字永不回流。
   （v11 及以前卡片会从 c 涨到 1.25c，才要靠 --measure 压住折行。） */
.sc-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
/* 标题字号**保持原样**（17px / 1.45）—— 2026-09-26 试过放大到 20px，站长否掉 */
.sc-name {
  font-family: var(--font-serif);
  font-size: var(--fs-h4);
  font-weight: 700;
  line-height: 1.45;
  color: var(--vp-c-text-1);
}
/* 简介：**3 行**截断，v14 起**所有卡常显**（站长要求"附有简介"）——
   不再是"只居中卡可见"。因此卡高由最高那张统一决定，
   JS 的 layout() 会按含简介的真实高度取齐。 */
.sc-desc {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: var(--fs-small);
  line-height: 1.55;
  color: var(--vp-c-text-3);
  /* 3 行高度**始终占位**：高度恒定，卡片就不会"跳一下"（"突兀"的来源之一）。 */
  min-height: calc(1.55em * 3);
}

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
  font-size: var(--fs-h3);
  font-weight: 700;
  color: var(--vp-c-text-1);
}
.fm-mq-count {
  font-family: var(--font-mono);
  font-size: var(--fs-lead);
  color: var(--rust);
}
.fm-mq-row {
  overflow: hidden;
  /* ⚠️ 渐隐宽度用 CSS 变量：
       · 桌面端默认 7%（就是原来那条规则）—— 桌面是**动画位移**，
         "永远还有下一个词"，所以两侧渐隐永远成立，JS 不介入；
       · 移动端由 JS 按 scrollLeft 动态改这两个值：已经滑到左端就把左侧渐隐收成 0，
         滑到右端就把右侧渐隐收成 0 —— 否则最后一个词会停在渐隐区里被切掉一截。
         这是"原生滚动 + 边缘渐隐"的经典冲突（渐隐是给容器加的，容器不滚，只有内容滚）。 */
  --mq-fade-l: 7%;
  --mq-fade-r: 7%;
  -webkit-mask-image: linear-gradient(90deg,
    transparent, #000 var(--mq-fade-l),
    #000 calc(100% - var(--mq-fade-r)), transparent);
  mask-image: linear-gradient(90deg,
    transparent, #000 var(--mq-fade-l),
    #000 calc(100% - var(--mq-fade-r)), transparent);
}
/* 移动端专用单行（is-m）：桌面不渲染，窄屏才显示 */
.fm-mq-row.is-m { display: none; }
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
/* 悬停暂停：鼠标停在词带上时别让它继续跑，让人能安心点某个词。 */
.fm-mq:hover .fm-mq-track { animation-play-state: paused; }
/* ⚠️ 键盘可达性（WCAG 2.4.7 Focus Visible，2026-10-03 补）：
   原来只有 :hover 会暂停，**键盘用户 Tab 进词带的链接时动画照跑** ——
   焦点框会被持续位移的轨道带出视野，读屏用户不知道自己在第几个词上。
   :focus-within 让"焦点在词带内（含任一链接）"等价于悬停 → 同样暂停。
   纯 CSS，无需 JS；Tab 走开即恢复（与 :hover 同理）。 */
.fm-mq:focus-within .fm-mq-track { animation-play-state: paused; }
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
  font-size: var(--fs-small);
  letter-spacing: 0.04em;
  white-space: nowrap;
  color: var(--vp-c-text-2);
  text-decoration: none;
  transition: border-color 0.25s cubic-bezier(0.22, 1, 0.36, 1),
              color 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}
.fm-mq-tag sup {
  font-size: var(--fs-small);
  color: var(--rust);
}
.fm-mq-tag:hover {
  border-color: var(--rust);
  color: var(--vp-c-text-1);
}
@media (prefers-reduced-motion: reduce) {
  /* ⚠️ 关动画的同时必须一起放开原生滚动 ——
     否则"停掉动画"就变成"内容冻住且滑不动"（比动效本身更糟）。 */
  .fm-mq-track { animation: none; }
  .fm-mq-row {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    touch-action: pan-x;
  }
  .fm-mq-row::-webkit-scrollbar { display: none; }
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
  font-size: var(--fs-lead);
  font-style: italic;
  color: var(--vp-c-text-1);
}
.fm-colophon span {
  display: block;
  margin-top: 10px;
  font-family: var(--font-mono);
  font-size: var(--fs-label);
  letter-spacing: 0.1em;
  color: var(--vp-c-text-3);
}
.fm-colophon small {
  display: block;
  margin-top: 26px;
  font-family: var(--font-mono);
  font-size: var(--fs-micro);
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

  /* ⚠️⚠️ 2026-09-30 站长反馈：「手机上显示『牧神的笔记』时，加上一条黑线就很难看」。
     根因不是那条线本身，是**窄屏根本不开飞行动画**，导致刊头与导航栏**重名并存**：
       · 宽屏（≥960px）：.VPNav 是 fixed，刊头文字「飞」进导航栏，
         飞行期间导航站名 opacity:0（见 custom.css:535 那条 min-width 守卫）
         → 任一时刻只有一个「牧神的笔记」可见，读起来是「移动」；
         那条黑线是飞行的**起飞基线**，有含义。
       · 窄屏（<960px）：.VPNav 不是 fixed → 没有落点 → JS 的 WIDE 守卫不跑飞行，
         CSS 的藏站名规则也被 min-width:960px 挡住
         → 导航「牧神的笔记」+ 刊头「牧神的笔记」**两个同时显示**，
           中间还夹一条 1px 纯黑通栏线 —— 看着像「两个标题被一刀劈开」。
     所以窄屏**整个刊头隐藏**（含那条线）：
       · 站名不丢 —— 导航栏顶部本来就有；
       · 那三个英文词（已单独隐藏）与黑线在窄屏没有功能，纯装饰，去掉更干净；
       · 诗直接开始，少一层"标题套标题"的噪音。
     ⚠️ 不要只藏线、留着字 —— 那会变成"两个同名标题"直接叠在一起，比现在更差。
     ⚠️ 也不要只藏字、留着线 —— 一条孤零零的纯黑横线横在页面顶部，最难看。 */
  .fm-masthead { display: none; }
  .fm-mast-sub { display: none; }
  /* 手机端词带：只留一行，但**既能循环自动滚、也能手动滑动**。
     三行在 390px 窄屏上会织成一张密网，每行只露 3-4 个词，
     失去"一条一条读"的节奏——所以留 is-0 一行。

     ⚠️⚠️ 2026-10-03 再改（站长："之前手机上都做得好好的，循环滚动，
     然后手也可以滑动"——要恢复两者并存）：
     2026-09-27 曾因「手机上滚动标签，标签会滚到消失、找不回来」把移动端
     动画整个关掉，只留手滑。那次的问题是旧实现让 **CSS 动画写 transform**
     和 **手指滑动写 scrollLeft** 两套位移模型打架：
       · track 是 `width:max-content` 重复 6 遍（约 6 倍屏宽），
         手指滑出去的是 scrollLeft，视觉位置却被 transform 又推走一大截；
       · 结果词带一路滑进空白区，怎么往回拨都回不来（动画还在推）。

     现在的正解：**移动端也自动循环，但位移模型只用 scrollLeft**
     （由 JS 的 setupMarqueeAuto 驱动），**不再有 CSS transform 动画**：
       · 自动滚 = JS 每帧改 scrollLeft；手滑 = 浏览器原生改 scrollLeft；
         两者写的是**同一个量**，天生不打架 → 手滑随时能覆盖、永远滑得回来；
       · 循环靠"到右端就无缝跳回左端"（内容重复排列，跳回处视觉接得上）；
       · 触摸时自动滚**暂停**，松手 idle 一会儿再恢复（不跟手指抢）。
     ⇒ 结果：自动循环 + 手滑并存，且"滚到消失找不回来"的坑结构性消失。 */
  /* 桌面三行错速词带在窄屏会织成密网、每行只露 3-4 词 → 整组隐藏，
     改由 .is-m 单行全量承载（含全部 {{ tagCount }} 个标签）。 */
  .fm-mq-row.is-0,
  .fm-mq-row.is-1,
  .fm-mq-row.is-2 { display: none; }
  .fm-mq-row.is-m {
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    /* 滑动时让浏览器接管横向手势，别被纵向 Lenis 抢走 */
    touch-action: pan-x;
    overscroll-behavior-x: contain;
  }
  .fm-mq-row.is-m::-webkit-scrollbar { display: none; }
  /* ⚠️ 移动端**不挂 CSS transform 动画**（动画 = 写 transform，会和手滑的
     scrollLeft 打架，正是 2026-09-27「滚到消失找不回来」的根因）。
     这里显式 animation:none 只是兜底（防止继承桌面那条），真正的循环由
     index.mjs 的 setupMarqueeAuto 用 scrollLeft 驱动 —— 手滑与自动滚共用
     同一个位置模型，可互相覆盖、永远滑得回来。 */
  .fm-mq-row.is-m .fm-mq-track {
    animation: none;
  }
  /* 自动滚与 scroll-snap 互斥：snap 会在每次 scroll 后把位置"吸"到词边界，
     和 JS 的逐帧推进打架（表现为一顿一顿、或被吸回原位）。
     所以移动端交给原生滚动惯性即可，不加 snap。 */
  .fm-mq-row.is-m {
    scroll-snap-type: none;
  }
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

   ⚠️ 2026-09-22 站长两次决定，把上面那组参数里的两项撤掉了 —— **现在只剩位移 + 两级错峰**：
     ① 去掉 `blur(4px)`：「我说的是不要模糊……我给你的那个网站，它上身就根本没有模糊效果啊」
     ② 去掉 `rotateZ:4`：「我的那个博客就不要倾斜了吧，就学 linearfestivals 错峰」
   两次的依据都是另一参照站 linearfestivals 的 EventHero，它的逐词上升原文是：
     t.fromTo('[data-hero-word]', { yPercent: 110 }, { yPercent: 0, duration: .9, stagger: .05 }, '-=0.45')
   **它没有模糊、也没有几何旋转**，只有错峰。

   ⚠️ 术语务必分清（站长专门纠正过一次，别再把这两件事混为一谈）：
     · **错峰（stagger）= 时间上的先后起步** → 产生「一片词依次起身」的波浪感。**必须保留。**
     · **倾斜（rotateZ）= 几何上的旋转** → 字本身是歪的。**已撤掉。**
   本站的错峰比 linearfestivals **更细**：它是单级（词 `stagger .05`），
   本站是**两级**（行 `--fm-line-step` + 词 `--fm-word-step`），四行起步时刻分得更开，
   这正是下面说的「多段上升」（四行分四段），别顺手删掉。
   另外：撤掉 blur 本身也让四段分先后**看得更清楚** —— 模糊会把它糊成一片。

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
  /* ⚠️ 2026-09-30 站长决定：**升起点从 100% 加深到 110%**（对齐 demo）。
     理由：站长看到 demo 的标题上升，评价「迅捷，曲线，优雅」，
     其中「优雅」有一部分正来自**行程更长** —— 从更低处起、走更远，
     末段收得更有「落定」感。100% 只沉到掩码下沿，110% 多沉一成。
     ⚠️ 多出来的 10% 会不会露字？不会。掩码是 .fm-word 的 overflow:hidden，
     它按**自身内容高度**裁切；字下沉到 110% 时只有上边缘 10% 露在掩码下沿内，
     而那一块本来就是这个字自己的下半部分——仍被裁在掩码内，不会溢出到下一行。

     初始态：沉到地平线以下。**当前值 110%（2026-09-30 起）**。
     ⚠️ 2026-09-22 站长两次决定，这里已经撤掉三项：
        ① 去掉 blur(4px)   —— 参照站 linearfestivals 的逐词上升没有模糊
        ② 去掉 rotate(4deg) —— 「我的那个博客就不要倾斜了吧，就学它错峰」
        ③ 去掉 opacity:0   —— 2026-09-23「不要淡入的效果」
     所以现在只剩**纯位移 + 两级错峰**，与 linearfestivals 的 `yPercent:110 → 0` 同构
     （差别只在它没有行级错峰，本站有）。注意 110% 这个值正是它那边的数 ——
     2026-09-30 之前本站用 100%，现在与它逐字一致。
     注意：错峰（时间先后 / 波浪）必须保留 —— 站长明确「这个肯定是要的」。

     ⚠️ ③ 撤掉 opacity 为什么是安全的：隐藏「尚未升起」的字靠的是
     **.fm-word 的 overflow:hidden 裁切**，不是透明度。translateY(110%) 是
     transform —— 不改布局、但把字整体挪出掩码下沿，所以动画延迟期间
     （animation-fill-mode:both 的 backwards 段）字根本不显示。
     移除 opacity 只是让字**升起过程中始终是全不透明的**，这正是「不要淡入」。 */
  transform: translateY(110%);
  will-change: transform;
}

/* 错峰参数 —— **调节奏只改这一个数**：
     --fm-word-step  **全局词号**的步长（横纵向共用同一个值）

   ⚠️ 2026-09-30 站长第三轮：**行级台阶已取消，「两级错峰」改为「单级」**。
     站长原话：「你这四行不是逐行往上走吗？横向的效果对了，但是纵向没有节奏啊。
     纵向你怎么还是先一行出来、再一行出来？能不能横向和纵向同时进行，
     纵向也用横向那个节奏？」

     → 「一行一行出」的来源就是 `var(--fm-line-i) × --fm-line-step` 那个
       **行号硬台阶**：行首起步时刻被拉成 0 / 320 / 700 / 1020ms，
       行与行之间是大空档（那正是 09-21 想要的「四段分得开」）。
     → 现在把该项**整项删掉**，13 块只剩「全局词号 × 步长」一个量纲，
       横（一行内相邻块）与纵（跨行相邻块）**步长完全相同**，
       整首诗从「每行一停的阶梯」变成**一条连续的斜线**。

     ⚠️ 这与 09-21 那次决定**不矛盾**，别当成推翻：
       09-21 的问题是**行内词步长太小（0.03s）**，行与行几乎同时起步，
       看着像齐步走 → 所以当时加了行级台阶把行分开。
       现在站长要的是**把行内节奏拉长到行间去**：同样是「让眼睛看出先后」，
       但靠的是**一条连续流水**，而不是给每行单独打拍子。
       ⇒ 实现方式是「删台阶 + 加大词步长」，不是「加台阶」。
     ⚠️ 所以 --fm-line-step 这个变量**已废弃**（保留声明仅作兜底，
       calc 里不再引用它；见下方 animation-delay）。别再往回加。 */
.fm-stmt {
  /* 2026-09-30 的值： 0.05s（单级）。
     取值依据：13 块 × 0.05s = 0.60s 错峰窗口 + 0.90s 行程 = **1.50s 落定**
     （站长定「约 1.5s」）。
     ⚠️ 只调这一个数就够，不要去改 animation-delay 里的 calc 结构。 */
  --fm-word-step: 0.05s;
  --fm-line-step: 0s;   /* ⚠️ 已废弃：calc 里不再引用。留着只为兼容旧写法。 */
}

/* 升起动画：只在首页根元素带 .fm-rise-in 时播。
   .fm-rise-in 由 index.mjs 的 setupPoemRise() 在**首屏加载**时挂上。

   ⚠️ 2026-09-30 站长第三轮调整 —— **换曲线、缩行程**（对齐 demo）：
     站长看到 demo 的标题上升后原话：「你现在这个标题上升的效果，比我首页
     上面这首诗上升的效果要更好啊，**迅捷，曲线，优雅**。怎么应用一下」
     逐项归因（不靠感觉，靠曲线逐点取值对比，见 .workbuddy/tmp/zhihu/ease_compare.py）：
       · 「迅捷」 来自**缓动曲线**：power3.out → power4.out。
         t=0.10 时进度 27% → 48%（+21pt）；t=0.20 时 49% → 77%（+28pt）。
         前段冲得快得多，后段两者都极缓（t=0.7 时都已 97%+）—— 这就是「迅捷 + 优雅」
         能同时成立的原因：**快的是前段，稳的是后段**，不是整体加速。
       · 「行程」来自 时长 1.25s → 0.90s，配合位移 100% → 110%。
         末块落定 2330ms → 1980ms（行程 −0.35s、错峰窗口不变）。
     ⚠️ 那一次只动了**曲线 / 时长 / 位移**三项，错峰步长一个都没动。
        （同一轮稍后又改了节奏与切分，见下段。）
     ⚠️ 缓动的语义变了：原 `.33,1,.68,1` ≈ power3.out；现 `.19,1,.22,1` = power4.out
        （GSAP 官方同名曲线的三次贝塞尔近似）。要比 power4.out 再猛一档用
        cubic-bezier(.16,1,.3,1)（expo.out 近似），但那就是另一档脾气了，没站长点头不要换。

   ⚠️ 2026-09-30 同一轮的后半：**改节奏为单级 + 切分加密**。
     站长原话：「你这四行不是逐行往上走吗？横向的效果对了，但是纵向没有节奏啊……
     能不能横向和纵向同时进行，纵向也用横向那个节奏？」
     以及：「你那个词的切分我觉得这也不够碎啊，还可以再碎一点。」
     两件事耦合（块数变了，步长必须重算），所以一起改：
       · 节奏：删掉行号项，13 块共用「全局词号 × 0.05s」一个步长
       · 切分：短语表 9 块 → 13 块（见 index.mjs 的 PHRASES 注释）
     时间线从「每行一停的阶梯」变成一条连续斜线，落定 **1.50s**。 */
html.fm-rise-in .fm-word > span {
  animation: fm-word-rise 0.9s cubic-bezier(0.19, 1, 0.22, 1) both;
  /* 错峰：**单级**（2026-09-30 起）。只有「全局词号 × 步长」一项 ——
     横（行内相邻块）与纵（跨行相邻块）间隔**完全相同**。

     ⚠️ 行号项（var(--fm-line-i) × --fm-line-step）**已被删掉**，不要加回来。
        它就是「一行一行出」的成因：会把行首起步时刻拉成
        0 / 320 / 700 / 1020ms（行与行之间大空档）。
        详见上方 .fm-stmt 里记的站长原话与取舍。

     全诗 4 行 / 13 块，逐个块的起步时刻（ms，步长 50ms）：
        0 · 50 · 100 · 150 │ 200 · 250 · 300 │ 350 · 400 · 450 │ 500 · 550 · 600
     末块 600ms 起步 + 900ms 行程 ≈ **1500ms** 全部落定（站长定「约 1.5s」）。
     相邻块恒定 50ms，占单段行程 5.6% —— 比 09-21 那版（30ms / 2.4%）
     更能看出先后，又不像行级台阶那样一停一顿。

     ⚠️ --fm-word-i 仍是**跨行累加**的全局词号（0..12），由 index.mjs 的
     play() 注入，splitPoem 另注入 --fm-line-i（现在 calc 不再用它，
     但保留注入无害 —— 将来若要恢复行级节奏可直接取回）。
     ⚠️ 若嫌 1.5s 太长/太短：只改 .fm-stmt 里的 --fm-word-step
        （0.04s → 约 1.38s；0.06s → 约 1.68s），不要动下面的 calc 结构。 */
  animation-delay: calc(
    var(--fm-word-i, 0) * var(--fm-word-step, 0.05s)
  );
}

@keyframes fm-word-rise {
  from {
    transform: translateY(110%);
  }
  to {
    transform: translateY(0);
  }
}

/* 动画结束后把元素**钉在终态**。
   ⚠️ 这是实测抓到的 bug（2026-09-19）：原写法只清 will-change，
   于是 .fm-rise-in 一被移除，`animation: ... both` 提供的终态就随之消失，
   元素回落到基础态（translateY(110%)）——**诗句凭空消失**。
   实测时间线：动画在 t=929~1740ms 正常播到 opacity=1，
   紧接着 t=1785ms 就跳回 opacity=0。
   所以 done 态必须显式写死终态值，不能只依赖动画的 fill。 */
html.fm-rise-done .fm-word > span {
  transform: none;
  will-change: auto;
}

/* 尊重系统的减弱动效偏好：直接落到终态，不播动画 */
@media (prefers-reduced-motion: reduce) {
  .fm-word > span {
    transform: none;
  }
  html.fm-rise-in .fm-word > span {
    animation: none;
  }
}

</style>

