<script setup>
import { computed } from 'vue'
import { useData, useRoute } from 'vitepress'
import { data as seriesPosts } from '../../series.data.js'

const { frontmatter } = useData()
const route = useRoute()

// 谓词必须与 ViewCount.vue、index.mjs 里的文章页判断保持一致：
// 用 /^\/posts\/.+/ 而不是 startsWith('/posts/')，否则 /posts/ 归档页会被误判成文章。
// （#doc-before 插槽在 /tags、/about、文章页都会渲染，不挡住就会到处冒出来。）
const IS_POST = /^\/posts\/.+/

const name = computed(() => String(frontmatter.value.series ?? '').trim())

// seriesPosts 是构建期常量，不随路由变化；按当前页声明的系列名过滤即可。
// 同一系列在数组里已按 seriesOrder 排好序（见 series.data.js）。
const items = computed(() =>
  name.value ? seriesPosts.filter((p) => p.series === name.value) : []
)
const at = computed(() => items.value.findIndex((p) => p.url === route.path))

// 三个条件同时成立才渲染：文章页 + 当前文章声明了系列 + 该系列至少两篇。
// 单篇不成系列 —— 只有一篇的文章不该出现「第 1 / 1 篇」这种废话。
const show = computed(
  () => IS_POST.test(route.path) && at.value >= 0 && items.value.length > 1
)

// 系列名常常就是标题的前缀（系列「从琴弓到电塔」的三篇标题都以「从琴弓到电塔：」开头）。
// 展开目录时剥掉这段重复前缀 —— 三行都顶着同一串字，读者反而要费劲找差别在哪。
// 完整标题留在 title 属性里，鼠标悬停仍能看到。
const shortTitle = (t) => {
  const n = name.value
  if (!n || !t.startsWith(n)) return t
  return t.slice(n.length).replace(/^[：:，,、\s—–-]+/, '') || t
}
</script>

<template>
  <details v-if="show" class="series-nav">
    <summary>
      <span class="sn-kicker">系列</span>
      <span class="sn-name">{{ name }}</span>
      <span class="sn-pos">第 {{ at + 1 }} / {{ items.length }} 篇</span>
      <span class="sn-more">全部篇目</span>
    </summary>
    <ol class="sn-list">
      <li v-for="(p, i) in items" :key="p.url">
        <a
          :href="p.url"
          :class="{ 'is-current': p.url === route.path }"
          :aria-current="p.url === route.path ? 'page' : undefined"
        >
          <span class="sn-i">{{ i + 1 }}</span>
          <span class="sn-t" :title="p.title">{{ shortTitle(p.title) }}</span>
        </a>
      </li>
    </ol>
  </details>
</template>

<style scoped>
/* 视觉语言与 .post-tags / tags.md 一致：等宽、小字号、宽字距、细线、赭石色。
   颜色全部走变量，暗色模式下 --rust 会自己变成更亮的 #cf6b4a，不能写死。

   刻意**不给背景色**：试过 --vp-c-brand-soft，浅色下是一大块粉、暗色下是一大块棕，
   两种模式都偏重，像提示框而不是元数据。站点其余元数据（.post-tags、tags 页）
   都是"靠一道竖线/横线 + 等宽小字"说话，这里跟同一套。 */
.series-nav {
  margin: 0 0 24px;
  padding-left: 13px;
  border-left: 2px solid var(--rust);
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.series-nav summary {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0 8px;
  padding: 0;
  cursor: pointer;
  list-style: none;
  line-height: 1.7;
}
/* 去掉浏览器默认的三角标记，换成自己画的，才能控制它的位置和颜色 */
.series-nav summary::-webkit-details-marker {
  display: none;
}
.series-nav summary::marker {
  content: '';
}

.sn-kicker {
  flex: none;
  padding: 1px 6px 2px;
  background: var(--rust);
  color: var(--paper);
  font-size: 10.5px;
  border-radius: 2px;
}

.sn-name {
  color: var(--rust);
}

.sn-pos {
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}

.sn-more {
  margin-left: auto;
  flex: none;
  color: var(--ink-faint);
  font-size: 11px;
}
.sn-more::after {
  content: ' ▾';
}
.series-nav[open] .sn-more::after {
  content: ' ▴';
}
.series-nav summary:hover .sn-more {
  color: var(--rust);
}

/* 展开后的篇目清单：编号在左，标题在右，当前篇整行变强调色 */
.sn-list {
  margin: 9px 0 0;
  padding: 7px 0 0;
  list-style: none;
  border-top: 1px solid var(--vp-c-divider);
}
.sn-list li {
  margin: 0;
  padding: 0;
}
.sn-list a {
  display: flex;
  gap: 8px;
  padding: 6px 0;
  color: var(--ink-soft);
  text-decoration: none;
  font-size: 12px;
  line-height: 1.7;
  transition: color 0.2s ease;
}
.sn-list a:hover {
  color: var(--rust);
}
.sn-i {
  flex: none;
  width: 1.4em;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}
.sn-t {
  font-family: var(--font-serif);
  letter-spacing: 0;
  font-size: 13.5px;
}
/* 当前在读的那篇：整行变成强调色，并加粗 —— 读者一眼知道自己在第几篇 */
.sn-list a.is-current {
  color: var(--rust);
}
.sn-list a.is-current .sn-t {
  font-weight: 700;
}
.sn-list a.is-current .sn-i {
  color: var(--rust);
}
</style>
