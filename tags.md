---
title: 分类与标签
description: 按分类与标签索引「牧神的笔记」全部文章
---

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { data as posts } from './posts.data.js'

// 一篇文章只能有一个分类（归属），但可以有多个标签（浏览入口）。
// 所以分类是 1:1 的归组，标签是倒排索引 —— 这也正是两者的分工。
const catMap = {}
const tagMap = {}
for (const p of posts) {
  if (p.category) {
    if (!catMap[p.category]) catMap[p.category] = []
    catMap[p.category].push(p)
  }
  for (const t of p.tags) {
    if (!tagMap[t]) tagMap[t] = []
    tagMap[t].push(p)
  }
}
// 多的排前面；同数量按名称排，保证每次构建顺序稳定（避免无谓的 diff）
const byCount = (a, b) => b[1].length - a[1].length || String(a[0]).localeCompare(String(b[0]), 'zh')
const cats = Object.entries(catMap).sort(byCount)
const tags = Object.entries(tagMap).sort(byCount)

const tagCount = {}
for (const [name, list] of tags) tagCount[name] = list.length

/* ---------- 共现（决定星图里谁和谁连成线） ----------
   同一篇文章的标签两两成一对，共现越多的标签在星图里线段越亮越粗。 */
const pairW = {}
for (const p of posts) {
  const ts = [...p.tags].sort() // 排序后取对，保证 (甲,乙) 与 (乙,甲) 落进同一个键
  for (let i = 0; i < ts.length; i++) {
    for (let j = i + 1; j < ts.length; j++) {
      const k = ts[i] + '\u0000' + ts[j]
      if (!pairW[k]) pairW[k] = 0
      pairW[k] += 1
    }
  }
}
const neighbors = {}
for (const name of Object.keys(tagCount)) neighbors[name] = []
for (const k of Object.keys(pairW)) {
  const a = k.slice(0, k.indexOf('\u0000'))
  const b = k.slice(k.indexOf('\u0000') + 1)
  neighbors[a].push([b, pairW[k]])
  neighbors[b].push([a, pairW[k]])
}
// 权重降序；并列时「篇数多的」在前，再并列按名称 —— 三级排序把顺序钉死，
// 否则同一份数据每次构建都可能给出不同结果，页面就会无谓地抖动。
const byWeight = (x, y) =>
  y[1] - x[1] || tagCount[y[0]] - tagCount[x[0]] || String(x[0]).localeCompare(String(y[0]), 'zh')
for (const name of Object.keys(neighbors)) neighbors[name].sort(byWeight)

/* ---------- 星图布局：向日葵（phyllotaxis）分布 ----------
   23 个标签按黄金角铺在一个圆盘上 —— 这是完全确定的（只依赖于「第几个」），
   所以每次构建都长得一模一样，可被引用、能记住。力导向图每次都不一样，
   不能要。节点大小 ∝ √篇数；共现 ≥2 的对之间连成暗线，就成了「星座」。 */
const VB = 760
const GOLD = Math.PI * (3 - Math.sqrt(5)) // 黄金角 ≈ 2.39996 rad
const CX = VB / 2
const CY = VB / 2
const RMAX = 300
const pos = tags.map(([name, list], k) => {
  const a = k * GOLD
  const rr = RMAX * Math.sqrt((k + 0.5) / tags.length)
  const x = CX + rr * Math.cos(a)
  const y = CY + rr * Math.sin(a)
  const rad = 6 + Math.sqrt(list.length) * 2.6
  const dx = x - CX
  const dy = y - CY
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  return {
    name,
    count: list.length,
    x,
    y,
    rad,
    lx: x + ux * (rad + 7),
    ly: y + uy * (rad + 7) + 3.5,
    anchor: ux > 0.25 ? 'start' : ux < -0.25 ? 'end' : 'middle'
  }
})
const nodeMap = {}
for (const p of pos) nodeMap[p.name] = p

const EDGE_MIN = 2
const edges = []
for (const k of Object.keys(pairW)) {
  const sep = k.indexOf('\u0000')
  const a = k.slice(0, sep)
  const b = k.slice(sep + 1)
  const w = pairW[k]
  if (w < EDGE_MIN) continue
  const na = nodeMap[a]
  const nb = nodeMap[b]
  if (!na || !nb) continue
  edges.push({ x1: na.x, y1: na.y, x2: nb.x, y2: nb.y, w })
}
const maxEdgeW = Math.max(1, ...edges.map((e) => e.w))
function edgeOp(w) {
  return (0.1 + 0.55 * (w / maxEdgeW)).toFixed(2)
}
function edgeSw(w) {
  return (0.5 + 1.7 * (w / maxEdgeW)).toFixed(2)
}

/* ---------- 聚焦 = 可链接的状态 ----------
   文章底部的标签是链接，指向 /tags#tag-权力 这种锚点（全站 62 处）。
   星图里每个圆圈都带 `id="tag-<名>"`，所以锚点仍然存在、深链仍跳得进来，
   落点也正好是那个标签对应的圆圈。 */
const current = ref(tags.length ? tags[0][0] : '')
const currentList = computed(() => {
  const list = tagMap[current.value]
  if (!list) return []
  // 日期降序。posts.data.js 已排过，这里再排一次是为了不依赖上游的顺序约定。
  // filter(Boolean) 兜底：万一数据里混进 undefined，也不至于让整页 SSR 崩掉。
  return [...list].filter(Boolean).sort((a, b) => String(b.date).localeCompare(String(a.date)))
})
const currentNbrs = computed(() => (neighbors[current.value] || []).slice(0, 6))
const othersOf = (p) => p.tags.filter((t) => t !== current.value)

function selectTag(name) {
  if (!tagCount[name]) return
  current.value = name
  // replaceState 而不是 location.hash：后者会触发一次跳转滚动，
  // 点个标签就被弹走半屏，很不体面。
  try {
    history.replaceState(null, '', '#tag-' + name)
  } catch (e) {
    /* 某些沙箱 / 预览环境禁用 history，退化为「只有状态、没有锚点」，不影响使用 */
  }
}
function readHash() {
  const raw = (typeof location === 'undefined' ? '' : location.hash || '').replace(/^#/, '')
  let h = raw
  try {
    h = decodeURIComponent(raw)
  } catch (e) {
    /* hash 里有裸 % 时 decode 会抛，退化为原始串 */
  }
  if (h.slice(0, 4) === 'tag-' && tagCount[h.slice(4)]) current.value = h.slice(4)
}
onMounted(() => {
  readHash()
  window.addEventListener('hashchange', readHash)
})
onBeforeUnmount(() => window.removeEventListener('hashchange', readHash))
</script>

# 分类与标签

<p class="idx-count">{{ posts.length }} 篇文章 · {{ cats.length }} 个分类 · {{ tags.length }} 个标签</p>

<div class="idx-cloud">
  <a v-for="[name, list] in cats" :key="name" class="idx-chip is-cat" :href="`#cat-${name}`">
    {{ name }}<span class="idx-chip-n">{{ list.length }}</span>
  </a>
</div>

<h2 class="idx-h2">分类</h2>

<div v-for="[name, list] in cats" :key="name" class="idx-group">
  <h3 :id="`cat-${name}`" class="idx-name">
    {{ name }}<span class="idx-n">{{ list.length }}</span>
  </h3>
  <ul class="idx-list">
    <li v-for="p in list" :key="p.url">
      <span class="idx-date">{{ p.date }}</span>
      <a :href="p.url">{{ p.title }}</a>
    </li>
  </ul>
</div>

<h2 class="idx-h2">标签</h2>

<div class="tn-starwrap">
  <svg class="tn-star" :viewBox="`0 0 ${VB} ${VB}`" role="group" aria-label="标签星图：点一个圆圈，看它下面的文章">
    <g class="tn-edges">
      <line
        v-for="(e, i) in edges"
        :key="'e' + i"
        class="tn-edge"
        :x1="e.x1.toFixed(1)"
        :y1="e.y1.toFixed(1)"
        :x2="e.x2.toFixed(1)"
        :y2="e.y2.toFixed(1)"
        :stroke-opacity="edgeOp(e.w)"
        :stroke-width="edgeSw(e.w)"
      />
    </g>
    <g
      v-for="p in pos"
      :key="p.name"
      :id="`tag-${p.name}`"
      class="tn-node"
      :class="{ 'is-on': current === p.name }"
      @click="selectTag(p.name)"
    >
      <circle class="tn-dot" :cx="p.x.toFixed(1)" :cy="p.y.toFixed(1)" :r="p.rad.toFixed(1)" />
      <text class="tn-lab" :x="p.lx.toFixed(1)" :y="p.ly.toFixed(1)" :text-anchor="p.anchor">{{ p.name }}</text>
    </g>
  </svg>
</div>

<div class="tn-panel-in" :key="current">
    <div class="tn-head">
      <h2 class="tn-name">{{ current }}<span class="tn-num">{{ currentList.length }} 篇</span></h2>
      <p v-if="currentNbrs.length" class="tn-rel">
        <span class="tn-relh">常与它一起出现</span>
        <button
          v-for="[name, w] in currentNbrs"
          :key="name"
          class="tn-rchip"
          :class="{ 'is-strong': w >= 3 }"
          @click="selectTag(name)"
        >
          {{ name }}<span class="tn-rn">{{ w }}</span>
        </button>
      </p>
      <p v-else class="tn-norel">没有共现对象</p>
    </div>
    <ul class="tn-list">
      <li v-for="p in currentList" :key="p.url">
        <div class="tn-row">
          <span class="tn-date">{{ p.date }}</span>
          <a class="tn-ptitle" :href="p.url">{{ p.title }}</a>
        </div>
        <p v-if="othersOf(p).length" class="tn-ptags">
          <button v-for="t in othersOf(p)" :key="t" @click="selectTag(t)">{{ t }}</button>
        </p>
      </li>
    </ul>
  </div>

<style scoped>
.idx-count {
  margin: 8px 0 26px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-3);
}

/* 分类云：分类用品牌色描边，跟下面标签频谱的中性描边区分开 */
.idx-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
  margin-bottom: 18px;
}
.idx-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 3px 10px 4px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
  text-decoration: none;
  border: 1px solid var(--vp-c-divider);
  border-radius: 2px;
  transition: color 0.2s ease, border-color 0.2s ease;
}
.idx-chip.is-cat {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-soft);
}
.idx-chip:hover {
  color: var(--rust);
  border-color: var(--rust);
}
.idx-chip-n {
  font-size: 10.5px;
  color: var(--vp-c-text-3);
  font-variant-numeric: tabular-nums;
}

.idx-h2 {
  margin: 40px 0 4px;
  padding: 0 0 10px;
  border-bottom: 1px solid var(--vp-c-text-1);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.22em;
  color: var(--rust);
}
.idx-group {
  margin-top: 24px;
}
.idx-name {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 6px;
  padding: 0;
  border: none;
  font-family: var(--font-serif);
  font-size: 17px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  scroll-margin-top: 80px;
}
.idx-n {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 400;
  color: var(--vp-c-text-3);
  font-variant-numeric: tabular-nums;
}
.idx-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.idx-list li {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 5px 0;
  border-bottom: 1px solid var(--vp-c-divider);
}
.idx-list li:last-child {
  border-bottom: none;
}
.idx-date {
  flex: none;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--vp-c-text-3);
  font-variant-numeric: tabular-nums;
}
.idx-list a {
  font-size: 15px;
  line-height: 1.6;
  color: var(--vp-c-text-1);
  text-decoration: none;
  /* 干掉 VP 默认的 color .25s 过渡：文字在黑→橘之间渐变，而下划线取
     currentColor 跟着走，看上去就是"先黑再橘"两段式。悬停即达才干净。 */
  transition: none;
}
.idx-list a:hover {
  color: var(--rust);
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* ============ 标签星图 ============ */
.tn-starwrap {
  margin-top: 16px;
  max-width: 760px;
}
.tn-star {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}
.tn-edge {
  stroke: var(--vp-c-divider);
}
.tn-node {
  cursor: pointer;
}
.tn-dot {
  fill: var(--vp-c-bg-elv);
  stroke: var(--vp-c-text-3);
  stroke-width: 1.1;
  transition: fill 0.18s ease, stroke 0.18s ease;
}
.tn-node:hover .tn-dot {
  fill: var(--rust);
  stroke: var(--rust);
}
.tn-node.is-on .tn-dot {
  fill: var(--vp-c-brand-1);
  stroke: var(--vp-c-brand-1);
}
.tn-lab {
  font-family: var(--font-mono);
  font-size: 11px;
  fill: var(--vp-c-text-2);
  pointer-events: none;
  transition: fill 0.18s ease;
}
.tn-node:hover .tn-lab {
  fill: var(--rust);
}
.tn-node.is-on .tn-lab {
  fill: var(--vp-c-brand-1);
}

/* ============ 文章面板（点圆圈后弹出） ============ */
.tn-panel-in {
  margin-top: 30px;
  padding-top: 22px;
  border-top: 1px solid var(--vp-c-text-1);
  /* 神奇移动：面板带 :key="current"，每次切换标签都会新建这个节点，
     于是下面的入场动画重新播放 —— 内容像「形变」一样滑入，而不是硬切。
     用 CSS 动画而非 <Transition>，是为了让首屏 SSR 也能正常输出内容。 */
  animation: mm-in 0.34s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes mm-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tn-panel-in {
    animation: none;
  }
}
.tn-head {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tn-name {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
  margin: 0;
  padding: 0;
  border: none;
  font-family: var(--font-serif);
  font-size: 26px;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.01em;
  color: var(--vp-c-text-1);
}
.tn-num {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--vp-c-text-3);
  font-variant-numeric: tabular-nums;
}
.tn-rel {
  margin: 0;
  line-height: 2.1;
}
.tn-relh {
  margin-right: 10px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.16em;
  color: var(--vp-c-text-3);
}
.tn-rchip {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  margin: 0 6px 0 0;
  padding: 2px 7px 3px;
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--vp-c-divider);
  border-radius: 2px;
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--vp-c-text-2);
  transition: none;
}
.tn-rchip:hover {
  border-color: var(--rust);
  color: var(--rust);
}
/* 权重 ≥3 已经算「强耦合」，给它一层品牌色描边 —— 只用边框色区分，
   不加粗不加重，免得这一行比文章标题还显眼。 */
.tn-rchip.is-strong {
  border-color: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}
.tn-rn {
  font-size: 10px;
  color: var(--vp-c-text-3);
  font-variant-numeric: tabular-nums;
}
.tn-rchip.is-strong .tn-rn {
  color: var(--vp-c-brand-1);
  opacity: 0.7;
}
.tn-norel {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--vp-c-text-3);
}

/* ============ 文章列表 ============ */
.tn-list {
  list-style: none;
  margin: 18px 0 0;
  padding: 0;
}
.tn-list li {
  padding: 8px 0;
  border-bottom: 1px solid var(--vp-c-divider);
}
.tn-list li:last-child {
  border-bottom: none;
}
.tn-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}
.tn-date {
  flex: none;
  width: 86px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--vp-c-text-3);
  font-variant-numeric: tabular-nums;
}
/* 文章标题与分类区保持一致：常规字重，不抢戏。 */
.tn-ptitle {
  flex: 1;
  min-width: 0;
  font-size: 16px;
  font-weight: 400;
  line-height: 1.55;
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition: none;
}
.tn-ptitle:hover {
  color: var(--rust);
  text-decoration: underline;
  text-underline-offset: 4px;
}
/* 这篇文章的「其他标签」：就是横向跳转的入口。
   用按钮而不是链接 —— 它改变的是本页状态，不产生新地址，也不该被
   搜索引擎当成重复入口。 */
.tn-ptags {
  margin: 1px 0 0 98px;
  font-size: 11px;
  line-height: 1.6;
}
.tn-ptags button {
  margin-right: 9px;
  padding: 0;
  cursor: pointer;
  background: none;
  border: none;
  border-bottom: 1px solid transparent;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--vp-c-text-3);
  transition: none;
}
.tn-ptags button:hover {
  color: var(--rust);
  border-bottom-color: var(--vp-c-brand-soft);
}

@media (max-width: 720px) {
  .tn-starwrap {
    max-width: 100%;
  }
  .tn-ptags {
    margin-left: 0;
  }
  .tn-date {
    width: 78px;
  }
}
</style>
