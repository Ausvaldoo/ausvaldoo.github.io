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

/* ---------- 星座索引 · 第 1 层：频谱 ----------
   23 个标签平铺成 23 行「标签 + 全部标题」，读起来是一堵墙：
   标签区会占掉整页 5 屏，而 64 篇文章的标题被重复渲染 3 遍还多。
   于是这里只保留「这个站在谈什么」—— 一行两档，点谁聚焦谁。 */
const CORE_N = 10
const coreTags = tags.filter(([, list]) => list.length >= CORE_N)
const restTags = tags.filter(([, list]) => list.length < CORE_N)

/* ---------- 星座索引 · 第 2 层：共现 ----------
   关系照旧被表达，只是用「可排序的一维排行」而不是二维图。
   理由：23 节点 / 88 条边的力导向图，密度是经验可读阈值(≈0.1)的 3.5 倍，
   且每次重排都会得到不同拓扑 —— 不可复现的图形不能被引用、也记不住。 */
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

/* ---------- 星座索引 · 第 3 层：聚焦 ---------- */
const names = tags.map(([name]) => name)
const current = ref(names[0] || '')

const currentList = computed(() => {
  const list = tagMap[current.value]
  if (!list) return []
  // 日期降序。posts.data.js 已排过，这里再排一次是为了不依赖上游的顺序约定。
  return [...list].sort((a, b) => String(b.date).localeCompare(String(a.date)))
})
const currentNbrs = computed(() => (neighbors[current.value] || []).slice(0, 6))
const othersOf = (p) => p.tags.filter((t) => t !== current.value)

const starOn = ref(false)

/* ---------- 邻域星图：定角布局，不用力导向 ----------
   只有 1 个中心 + ≤6 个邻居时，方位可以是「定」的：邻居按共现强度降序
   铺在八个固定方位上，半径由强度决定（越强越靠内）。
   所以它可复现 —— 两次刷新长得一模一样，也永远不会互相穿插。 */
const UNIT = [
  [0.62, -0.79],
  [0.95, -0.31],
  [0.95, 0.31],
  [0.62, 0.79],
  [-0.62, 0.79],
  [-0.95, 0.31],
  [-0.95, -0.31],
  [-0.62, -0.79]
]
const star = computed(() => {
  const nb = currentNbrs.value
  const S = 232
  const C = S / 2
  const ROUT = 84
  const maxW = Math.max(1, ...nb.map((x) => x[1]))
  const items = nb.map(([name, w], k) => {
    const u = UNIT[k % UNIT.length]
    const rr = ROUT - (Math.log(1 + w) / Math.log(1 + maxW)) * 24
    return {
      name,
      w,
      x: C + u[0] * rr,
      y: C + u[1] * rr,
      r: 3.4 + Math.sqrt(tagCount[name]) * 1.3,
      ax: u[0],
      ay: u[1],
      op: (0.16 + (0.6 * w) / maxW).toFixed(2),
      sw: (0.6 + (1.7 * w) / maxW).toFixed(2)
    }
  })
  return { S, C, items, cr: 5.6 + Math.sqrt(currentList.value.length) * 1.8 }
})

/* ---------- 聚焦 = 可链接的状态 ----------
   文章底部的标签是链接，指向 /tags#tag-权力 这种锚点（全站 62 处）。
   星座索引一次只渲染一个标签，所以锚点必须挂在「频谱的 chip」上：
   这样锚点仍然存在、深链仍然跳得进来，落点也正好是那个标签。 */
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

<p class="tn-lede">
  标签是浏览入口，不是目录。全部 {{ tags.length }} 个标签按篇数分两档列在下面，
  <strong>点一个，只看那一个</strong>；右上「星图」能看它旁边常站着谁。
</p>

<div class="tn-tier">
  <p class="tn-tier-h">核心主题 · ≥{{ CORE_N }} 篇</p>
  <div class="tn-chips">
    <button
      v-for="[name, list] in coreTags"
      :id="`tag-${name}`"
      :key="name"
      class="tn-chip"
      :class="{ 'is-on': current === name }"
      @click="selectTag(name)"
    >
      {{ name }}<span class="tn-cn">{{ list.length }}</span>
    </button>
  </div>
</div>
<div class="tn-tier">
  <p class="tn-tier-h">其余主题</p>
  <div class="tn-chips">
    <button
      v-for="[name, list] in restTags"
      :id="`tag-${name}`"
      :key="name"
      class="tn-chip"
      :class="{ 'is-on': current === name }"
      @click="selectTag(name)"
    >
      {{ name }}<span class="tn-cn">{{ list.length }}</span>
    </button>
  </div>
</div>

<div class="tn-panel">
  <div class="tn-head">
    <div class="tn-info">
      <div class="tn-title">
        <h2 class="tn-name">{{ current }}</h2>
        <span class="tn-num">{{ currentList.length }} 篇</span>
        <button class="tn-toggle" :class="{ 'is-on': starOn }" @click="starOn = !starOn">
          {{ starOn ? '收起星图' : '星图' }}
        </button>
      </div>
      <p class="tn-rel">
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
        <span v-if="!currentNbrs.length" class="tn-norel">没有共现对象</span>
      </p>
    </div>
    <div v-if="starOn" class="tn-star">
      <svg :viewBox="`0 0 ${star.S} ${star.S}`" role="img" :aria-label="`${current} 的共现邻域`">
        <g v-for="it in star.items" :key="it.name" class="tn-svg-node" @click="selectTag(it.name)">
          <line
            class="tn-svg-edge"
            :x1="star.C"
            :y1="star.C"
            :x2="it.x.toFixed(1)"
            :y2="it.y.toFixed(1)"
            :stroke-opacity="it.op"
            :stroke-width="it.sw"
          />
          <line class="tn-svg-hit" :x1="star.C" :y1="star.C" :x2="it.x.toFixed(1)" :y2="it.y.toFixed(1)" />
          <circle class="tn-svg-dot" :cx="it.x.toFixed(1)" :cy="it.y.toFixed(1)" :r="it.r.toFixed(1)" />
          <text class="tn-svg-w" :x="it.x.toFixed(1)" :y="(it.y + 3.3).toFixed(1)">{{ it.w }}</text>
          <text
            class="tn-svg-lab"
            :x="(it.x + it.ax * (it.r + 5)).toFixed(1)"
            :y="(it.y + it.ay * (it.r + 5) + 3.5).toFixed(1)"
            :text-anchor="it.ax > 0 ? 'start' : 'end'"
          >
            {{ it.name }}
          </text>
        </g>
        <circle class="tn-svg-core" :cx="star.C" :cy="star.C" :r="star.cr.toFixed(1)" />
        <text class="tn-svg-corew" :x="star.C" :y="star.C + 3.3">{{ currentList.length }}</text>
      </svg>
      <p class="tn-starcap">中心＝当前标签 · 半径＝共现强度（越近越强） · 圆面积＝篇数</p>
    </div>
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

/* ============ 标签频谱 ============ */
.tn-lede {
  margin: 14px 0 0;
  font-size: 14px;
  line-height: 1.85;
  color: var(--vp-c-text-2);
}
.tn-lede strong {
  font-weight: 700;
  color: var(--vp-c-text-1);
}
.tn-tier {
  margin-top: 20px;
}
.tn-tier-h {
  display: flex;
  align-items: baseline;
  gap: 9px;
  margin: 0 0 10px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.18em;
  color: var(--vp-c-text-3);
}
.tn-tier-h::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--vp-c-divider);
}
.tn-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 7px 8px;
}
.tn-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  padding: 3px 9px 4px;
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--vp-c-divider);
  border-radius: 2px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
  transition: none;
  /* 深链落点：跟着导航栏下面的留白，别被顶栏盖住 */
  scroll-margin-top: 84px;
}
.tn-chip:hover {
  border-color: var(--rust);
  color: var(--rust);
}
/* 选中态用「品牌色底 + 纸色字」，而不是写死一对颜色：
   明暗两套主题里 --vp-c-brand-1 与 --vp-c-bg 是成对翻转的，对比度两套都成立。 */
.tn-chip.is-on {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-bg);
}
.tn-cn {
  font-size: 10.5px;
  color: var(--vp-c-text-3);
  font-variant-numeric: tabular-nums;
}
.tn-chip.is-on .tn-cn {
  color: var(--vp-c-bg);
  opacity: 0.72;
}

/* ============ 聚焦面板 ============ */
.tn-panel {
  margin-top: 34px;
  padding-top: 24px;
  border-top: 1px solid var(--vp-c-text-1);
}
.tn-head {
  display: flex;
  gap: 30px;
  align-items: flex-start;
}
.tn-info {
  flex: 1;
  min-width: 0;
}
.tn-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
}
.tn-name {
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
.tn-toggle {
  margin-left: auto;
  padding: 3px 9px 4px;
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--vp-c-divider);
  border-radius: 2px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--vp-c-text-3);
}
.tn-toggle:hover,
.tn-toggle.is-on {
  border-color: var(--rust);
  color: var(--rust);
}
.tn-rel {
  margin: 16px 0 0;
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

/* ============ 邻域星图 ============ */
.tn-star {
  flex: none;
  width: 232px;
}
.tn-star svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}
.tn-svg-node {
  cursor: pointer;
}
.tn-svg-edge {
  stroke: var(--vp-c-brand-1);
}
.tn-svg-hit {
  stroke: transparent;
  stroke-width: 12;
}
.tn-svg-dot {
  fill: var(--vp-c-bg-elv);
  stroke: var(--vp-c-brand-1);
  stroke-width: 1.1;
  transition: none;
}
.tn-svg-node:hover .tn-svg-dot {
  fill: var(--vp-c-brand-1);
}
.tn-svg-w {
  font-family: var(--font-mono);
  font-size: 9px;
  fill: var(--vp-c-brand-1);
  text-anchor: middle;
  pointer-events: none;
}
.tn-svg-node:hover .tn-svg-w {
  fill: var(--vp-c-bg);
}
.tn-svg-lab {
  font-family: var(--font-mono);
  font-size: 10.5px;
  fill: var(--vp-c-text-2);
}
.tn-svg-node:hover .tn-svg-lab {
  fill: var(--vp-c-brand-1);
}
.tn-svg-core {
  fill: var(--vp-c-brand-1);
  pointer-events: none;
}
.tn-svg-corew {
  font-family: var(--font-mono);
  font-size: 9px;
  fill: var(--vp-c-bg);
  text-anchor: middle;
  pointer-events: none;
}
.tn-starcap {
  margin: 6px 0 0;
  font-family: var(--font-mono);
  font-size: 10px;
  line-height: 1.7;
  letter-spacing: 0.02em;
  color: var(--vp-c-text-3);
}

/* ============ 聚焦文章列表 ============ */
.tn-list {
  list-style: none;
  margin: 20px 0 0;
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
.tn-ptitle {
  flex: 1;
  min-width: 0;
  font-size: 16px;
  font-weight: 600;
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
   搜索引擎当成 64 个重复入口。 */
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
  .tn-head {
    flex-wrap: wrap;
  }
  .tn-star {
    width: 100%;
  }
  .tn-star svg {
    max-width: 232px;
  }
  .tn-ptags {
    margin-left: 0;
  }
  .tn-date {
    width: 78px;
  }
}
</style>
