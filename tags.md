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

/* ---------- 词云 ----------
   字号 ∝ √篇数：常用词大、冷门词小，一眼看出权重。
   散开方向按黄金角逐项确定 —— 每次构建、每次点击都一模一样，可复现。 */
const GOLD = Math.PI * (3 - Math.sqrt(5))
function fontSize(n) {
  return Math.min(30, Math.round((13 + Math.sqrt(n) * 3.4) * 10) / 10)
}
const cloud = tags.map(([name, list], i) => {
  const a = i * GOLD
  const d = 90 + (i % 5) * 24
  return {
    name,
    n: list.length,
    fs: fontSize(list.length),
    dx: (Math.cos(a) * d).toFixed(0) + 'px',
    dy: (Math.sin(a) * d).toFixed(0) + 'px',
    delay: ((i % 7) * 14) + 'ms'
  }
})

/* ---------- 点词 → 散开 → 紧凑标题串 ----------
   点一个词：词云散开退场，原位出现这一标签的全部文章标题 ——
   内联排列、小字号，跟分类区的「大标题 + 宽列表」刻意长成两样。 */
const current = ref('')
const open = ref(false)
const currentList = computed(() => {
  const list = tagMap[current.value]
  if (!list) return []
  return [...list].filter(Boolean).sort((a, b) => String(b.date).localeCompare(String(a.date)))
})

function selectTag(name) {
  if (!tagCount[name]) return
  current.value = name
  open.value = true
  // replaceState 而不是 location.hash：后者会触发一次跳转滚动，
  // 点个标签就被弹走半屏，很不体面。
  try {
    history.replaceState(null, '', '#tag-' + name)
  } catch (e) {
    /* 某些沙箱 / 预览环境禁用 history，退化为「只有状态、没有锚点」，不影响使用 */
  }
}
function closeCloud() {
  open.value = false
  try {
    history.replaceState(null, '', location.pathname + location.search)
  } catch (e) {
    /* 同上 */
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
  if (h.slice(0, 4) === 'tag-' && tagCount[h.slice(4)]) {
    current.value = h.slice(4)
    open.value = true
  }
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

<div class="cloud-zone" :class="{ 'is-open': open }">
  <div class="cloud">
    <button
      v-for="c in cloud"
      :key="c.name"
      :id="`tag-${c.name}`"
      class="cw"
      :style="{ fontSize: c.fs + 'px', '--dx': c.dx, '--dy': c.dy, transitionDelay: open ? c.delay : '0ms' }"
      @click="selectTag(c.name)"
    >{{ c.name }}<span class="cw-n">{{ c.n }}</span></button>
  </div>
  <div v-if="open" class="tag-result">
    <p class="tr-head">
      <span class="tr-name">{{ current }}</span>
      <span class="tr-n">{{ currentList.length }} 篇</span>
      <button class="tr-back" @click="closeCloud">返回词云</button>
    </p>
    <p class="tr-list">
      <template v-for="(p, i) in currentList" :key="p.url">
        <span v-if="i" class="tr-sep">·</span><a :href="p.url">{{ p.title }}</a>
      </template>
    </p>
  </div>
</div>

<style scoped>
.idx-count {
  margin: 8px 0 26px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-3);
}

/* 分类云：分类用品牌色描边 */
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

/* ============ 词云 ============ */
.cloud-zone {
  display: grid;
  margin-top: 14px;
}
.cloud {
  grid-area: 1 / 1;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 16px;
  padding: 28px 0 10px;
}
.cw {
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
  font-family: var(--font-serif);
  font-weight: 700;
  line-height: 1.5;
  color: var(--vp-c-text-2);
  transition: color 0.18s ease, opacity 0.32s ease, transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}
.cw:hover {
  color: var(--rust);
}
.cw-n {
  font-family: var(--font-mono);
  font-size: 0.5em;
  font-weight: 400;
  color: var(--vp-c-text-3);
  margin-left: 3px;
  vertical-align: 0.35em;
}
/* 散开：点词后整片云按各自的 (--dx,--dy) 飞出淡去，方向/距离/延迟全是定值 */
.cloud-zone.is-open .cw {
  opacity: 0;
  transform: translate(var(--dx), var(--dy)) scale(0.5);
  pointer-events: none;
}

/* ============ 紧凑标题串（点词后原位出现） ============ */
.tag-result {
  grid-area: 1 / 1;
  align-self: start;
  animation: tr-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes tr-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .tag-result {
    animation: none;
  }
  .cloud-zone.is-open .cw {
    transition: none;
  }
}
.tr-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0 0 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--vp-c-divider);
}
.tr-name {
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}
.tr-n {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--vp-c-text-3);
  font-variant-numeric: tabular-nums;
}
.tr-back {
  margin-left: auto;
  padding: 2px 8px 3px;
  cursor: pointer;
  background: none;
  border: 1px solid var(--vp-c-divider);
  border-radius: 2px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--vp-c-text-3);
  transition: none;
}
.tr-back:hover {
  color: var(--rust);
  border-color: var(--rust);
}
.tr-list {
  margin: 0;
  font-size: 13.5px;
  line-height: 2.05;
  color: var(--vp-c-text-2);
}
.tr-list a {
  color: var(--vp-c-text-2);
  text-decoration: none;
  transition: none;
}
.tr-list a:hover {
  color: var(--rust);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.tr-sep {
  margin: 0 7px;
  color: var(--vp-c-text-3);
}

@media (max-width: 720px) {
  .cloud {
    gap: 5px 12px;
  }
}
</style>
