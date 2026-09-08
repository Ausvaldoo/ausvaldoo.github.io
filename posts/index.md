---
title: 全部文章
layout: page
---

<script setup>
import { data as posts } from '../posts.data.js'

const groups = {}
posts.forEach((p) => {
  const y = String(p.date).slice(0, 4)
  if (!groups[y]) groups[y] = []
  groups[y].push(p)
})
const years = Object.keys(groups).sort((a, b) => Number(b) - Number(a))
</script>

# 全部文章

<p class="archive-count">共 {{ posts.length }} 篇</p>

<div v-for="year in years" :key="year" class="archive-group">
  <h2 class="archive-year">{{ year }}</h2>
  <ul class="archive-list">
    <li v-for="post in groups[year]" :key="post.url" class="archive-item">
      <span class="archive-date">{{ String(post.date).slice(5) }}</span>
      <a class="archive-title" :href="post.url">{{ post.title }}</a>
      <span v-if="post.category" class="archive-cat">{{ post.category }}</span>
    </li>
  </ul>
</div>

<style scoped>
.archive-count {
  margin: 8px 0 32px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-3);
}
.archive-group {
  margin-bottom: 34px;
}
.archive-year {
  margin: 0 0 10px;
  padding: 0;
  border: none;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.22em;
  color: var(--rust);
}
.archive-year::before {
  content: '—— ';
  letter-spacing: 0;
}
.archive-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.archive-item {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--vp-c-divider);
}
.archive-item:last-child {
  border-bottom: none;
}
.archive-date {
  flex: none;
  width: 46px;
  font-family: var(--font-mono);
  font-size: 12.5px;
  color: var(--vp-c-text-3);
  font-variant-numeric: tabular-nums;
}
.archive-title {
  flex: none;
  max-width: 100%;
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.55;
  color: var(--vp-c-text-1);
  text-decoration: none;
}
.archive-title:hover {
  color: var(--rust);
  text-decoration: underline;
  text-decoration-color: rgba(168, 68, 42, 0.45);
  text-underline-offset: 4px;
}
.archive-cat {
  flex: none;
  font-size: 12px;
  color: var(--vp-c-brand-1);
}
@media (max-width: 640px) {
  .archive-item {
    flex-wrap: wrap;
    gap: 4px 10px;
  }
  .archive-title {
    flex-basis: 100%;
  }
}
</style>
