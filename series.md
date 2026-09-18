---
title: 系列
description: 按阅读顺序组织的连载文章
---

<script setup>
import { data as posts } from './series.data.js'

// 系列与标签的分工，是这一页存在的理由：
//   标签 = 主题词，没有顺序，只提供「顺着一类话题继续逛」的入口；
//   系列 = 有阅读顺序的连载，序号本身就是核心信息。
// 所以这里按系列名归组、组内严格按 seriesOrder 排 —— 绝不按日期猜，
// 同一天发布的多篇分不出先后。
const map = {}
for (const p of posts) {
  if (!map[p.series]) map[p.series] = []
  map[p.series].push(p)
}
// 篇数多的排前面；同数量按名称排，保证每次构建顺序稳定（避免无谓的 diff）
const byCount = (a, b) =>
  b[1].length - a[1].length || String(a[0]).localeCompare(String(b[0]), 'zh')
const groups = Object.entries(map).sort(byCount)
</script>

# 系列

<p class="ser-count">{{ groups.length }} 个系列 · 共 {{ posts.length }} 篇</p>

<section v-for="[name, list] in groups" :key="name" class="ser-group">
  <h2 :id="`ser-${name}`" class="ser-name">
    {{ name }}<span class="ser-n">{{ list.length }} 篇</span>
  </h2>
  <ol class="ser-list">
    <li v-for="(p, i) in list" :key="p.url">
      <span class="ser-i">{{ i + 1 }}</span>
      <a :href="p.url">{{ p.title }}</a>
    </li>
  </ol>
</section>

<p v-if="!groups.length" class="ser-empty">
  还没有声明过系列。在文章开头的元数据里加 <code>series</code> 与
  <code>seriesOrder</code> 两行，它就会出现在这里。
</p>

<style scoped>
.ser-count {
  margin: 8px 0 26px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-3);
}

.ser-group {
  margin-top: 34px;
}
.ser-name {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 8px;
  padding: 0 0 10px;
  border-bottom: 1px solid var(--vp-c-text-1);
  border-top: none;
  font-family: var(--font-serif);
  font-size: 17px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  scroll-margin-top: 80px;
}
.ser-n {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 400;
  color: var(--vp-c-text-3);
  font-variant-numeric: tabular-nums;
}

/* 有序列表：编号是这一页的主角，所以给它固定宽度、等宽、右对齐，
   让标题左边缘整齐对齐 —— 顺序一眼可读，不用逐行找数字。 */
.ser-list {
  list-style: none;
  margin: 0;
  padding: 0;
  counter-reset: none;
}
.ser-list li {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid var(--vp-c-divider);
}
.ser-list li:last-child {
  border-bottom: none;
}
.ser-i {
  flex: none;
  width: 1.6em;
  text-align: right;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--vp-c-brand-1);
  font-variant-numeric: tabular-nums;
}
.ser-list a {
  font-size: 15px;
  line-height: 1.6;
  color: var(--vp-c-text-1);
  text-decoration: none;
  /* 干掉 VP 默认的 color .25s 过渡：它让文字在黑→橘间渐变、
     下划线却瞬时就位，视觉上是"先黑再橘"两段式。悬停即达才干净。 */
  transition: none;
}
.ser-list a:hover {
  color: var(--rust);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.ser-empty {
  margin-top: 30px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-3);
}
</style>
