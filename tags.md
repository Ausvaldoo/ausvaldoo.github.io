---
title: 分类与标签
description: 按分类与标签索引「牧神的笔记」全部文章
---

<script setup>
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

// 日期只显示到「月-日」，索引页不需要年份冗余（归档页已有）
const md = (d) => String(d).slice(5)
</script>

# 分类与标签

<p class="idx-count">{{ posts.length }} 篇文章 · {{ cats.length }} 个分类 · {{ tags.length }} 个标签</p>

<div class="idx-cloud">
  <a v-for="[name, list] in cats" :key="name" class="idx-chip is-cat" :href="`#cat-${name}`">
    {{ name }}<span class="idx-chip-n">{{ list.length }}</span>
  </a>
</div>
<div class="idx-cloud is-tags">
  <a v-for="[name, list] in tags" :key="name" class="idx-chip" :href="`#tag-${name}`">
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
      <span class="idx-date">{{ md(p.date) }}</span>
      <a :href="p.url">{{ p.title }}</a>
    </li>
  </ul>
</div>

<h2 class="idx-h2">标签</h2>

<div class="idx-group">
  <p v-for="[name, list] in tags" :key="name" :id="`tag-${name}`" class="idx-tagrow">
    <span class="idx-tagname">{{ name }}<span class="idx-n">{{ list.length }}</span></span>
    <template v-for="(p, i) in list" :key="p.url">
      <span v-if="i" class="idx-sep">·</span><a :href="p.url">{{ p.title }}</a>
    </template>
  </p>
</div>

<style scoped>
.idx-count {
  margin: 8px 0 26px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-3);
}

/* 标签云：分类用品牌色描边，标签用中性描边，一眼能区分两类维度 */
.idx-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
  margin-bottom: 18px;
}
.idx-cloud.is-tags {
  margin-bottom: 8px;
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
}
.idx-list a:hover {
  color: var(--rust);
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* 标签行：一行一个标签 + 所属文章标题内联，比再排一遍长列表紧凑得多 */
.idx-tagrow {
  margin: 0;
  padding: 7px 0;
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 13.5px;
  line-height: 2;
  color: var(--vp-c-text-3);
  scroll-margin-top: 80px;
}
.idx-tagrow:last-child {
  border-bottom: none;
}
.idx-tagname {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  margin-right: 8px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--vp-c-brand-1);
}
.idx-tagrow a {
  color: var(--vp-c-text-2);
  text-decoration: none;
}
.idx-tagrow a:hover {
  color: var(--rust);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.idx-sep {
  margin: 0 6px;
  color: var(--vp-c-text-3);
}
</style>
