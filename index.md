---
layout: home
title: 牧神的笔记
hero:
  name: 牧神的笔记
  text: 投资 · 工业自动化 · 工程实践
  tagline: 记录投资估值复盘与工业自动化工程实践
  actions:
    - theme: brand
      text: 开始阅读
      link: /posts/
    - theme: alt
      text: 关于我
      link: /about
---

<script setup>
import { data as posts } from './posts.data.js'

// 两列布局下，最后一行不该有分隔线；这里算出最后一行起始下标
const COLS = 2
const lastRowStart = Math.floor((posts.length - 1) / COLS) * COLS
</script>

<div class="section-head">
  <span class="kicker">最新文章</span>
  <a class="all-link" href="/posts/">全部文章 →</a>
</div>

<ul class="post-list">
  <li v-for="(post, i) in posts" :key="post.url" class="post-item" :class="{ 'is-last-row': i >= lastRowStart }">
    <div class="post-main">
      <a class="post-title" :href="post.url">{{ post.title }}</a>
      <p v-if="post.excerpt" class="post-excerpt">{{ post.excerpt }}</p>
      <div class="post-meta">
        <span class="post-date">{{ post.date }}</span>
        <a v-if="post.category" class="post-cat" :href="`/tags#cat-${post.category}`">{{ post.category }}</a>
      </div>
    </div>
  </li>
</ul>

<style scoped>
/* 栏目头：等宽小字 kicker + 细线 + 全部文章入口 */
.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin: 8px 0 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--vp-c-text-1);
}
.kicker {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.22em;
  color: var(--rust);
}
.kicker::before {
  content: '';
  width: 26px;
  height: 2px;
  background: var(--rust);
}
.all-link {
  font-family: var(--font-mono);
  font-size: 12.5px;
  color: var(--vp-c-text-3);
  text-decoration: none;
}
.all-link:hover {
  color: var(--rust);
}

/* 两列栅格：单列时一行 60+ 字太宽，两列把每行压到 ~36 字（中文最佳阅读区间） */
.post-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 32px;
}
.post-item {
  padding: 14px 14px 20px;
  border-bottom: 1px solid var(--vp-c-divider);
  transition: background-color 0.25s ease;
}
/* 最后一行的分隔线收掉（下标由脚本按 2 列算好） */
.post-item.is-last-row {
  border-bottom-color: transparent;
}
/* 悬停：整条轻微着色，作为“可展开”的暗示 */
.post-item:hover,
.post-item:focus-within {
  background-color: var(--vp-c-bg-soft);
}
.post-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.post-title {
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.5;
  color: var(--vp-c-text-1);
  text-decoration: none;
}
.post-title:hover {
  color: var(--rust);
}

/* 摘要：默认恰好 3 行，max-height 取 3 倍行高，
   截断落在行边界上，看起来是刻意收起而非被切坏；
   悬停展开到 11 行。transition 只动 max-height（GPU 友好）。 */
.post-excerpt {
  margin: 0;
  font-size: 14px;
  line-height: 1.75;
  color: var(--vp-c-text-2);
  max-height: calc(1.75em * 3);
  overflow: hidden;
  transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
.post-item:hover .post-excerpt,
.post-item:focus-within .post-excerpt {
  max-height: calc(1.75em * 10);
}

.post-meta {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px 14px;
  font-family: var(--font-mono);
  font-size: 11.5px;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-3);
}
/* 分类可点，跳到标签页的对应锚点；标签不在这里铺开，避免每张卡片都糊成一排 */
.post-cat {
  color: var(--vp-c-brand-1);
  text-decoration: none;
}
.post-cat:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* 窄屏回到单列：两列会把每行压到 20 字以内，反而更难读 */
@media (max-width: 720px) {
  .post-list {
    grid-template-columns: minmax(0, 1fr);
    column-gap: 0;
  }
  .post-item.is-last-row {
    border-bottom-color: var(--vp-c-divider);
  }
  .post-item:last-child {
    border-bottom-color: transparent;
  }
}

@media (prefers-reduced-motion: reduce) {
  .post-item,
  .post-excerpt {
    transition: none;
  }
}
</style>
