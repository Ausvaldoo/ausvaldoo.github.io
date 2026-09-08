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
  margin: -10px 0 30px;
  font-size: 13px;
  color: var(--vp-c-text-3);
}
.archive-group {
  margin-bottom: 34px;
}
.archive-year {
  margin: 0 0 10px;
  padding: 0;
  border: none;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--vp-c-text-3);
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
  font-size: 13px;
  color: var(--vp-c-text-3);
  font-variant-numeric: tabular-nums;
}
.archive-title {
  flex: 1;
  font-size: 15px;
  line-height: 1.5;
  color: var(--vp-c-text-1);
  text-decoration: none;
}
.archive-title:hover {
  color: var(--vp-c-brand-1);
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
