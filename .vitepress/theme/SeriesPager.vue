<script setup>
import { computed } from 'vue'
import { useData, useRoute } from 'vitepress'
import { data as seriesPosts } from '../../series.data.js'

const { frontmatter } = useData()
const route = useRoute()

// 与 SeriesNav.vue 同一个谓词，必须一致
const IS_POST = /^\/posts\/.+/

const name = computed(() => String(frontmatter.value.series ?? '').trim())

const items = computed(() =>
  name.value ? seriesPosts.filter((p) => p.series === name.value) : []
)
const at = computed(() => items.value.findIndex((p) => p.url === route.path))

const show = computed(
  () => IS_POST.test(route.path) && at.value >= 0 && items.value.length > 1
)

const prev = computed(() => (at.value > 0 ? items.value[at.value - 1] : null))
const next = computed(() =>
  at.value >= 0 && at.value < items.value.length - 1
    ? items.value[at.value + 1]
    : null
)
</script>

<template>
  <nav v-if="show" class="series-pager">
    <a v-if="prev" class="sp-link" :href="prev.url">
      <span class="sp-dir">← 上篇</span>
      <span class="sp-title">{{ prev.title }}</span>
    </a>
    <span v-else class="sp-edge">系列首篇</span>

    <a v-if="next" class="sp-link is-next" :href="next.url">
      <span class="sp-dir">下篇 →</span>
      <span class="sp-title">{{ next.title }}</span>
    </a>
    <!-- 末篇不再给「回到第 1 篇」—— 那多半和左边的「上篇」是同一篇，会重复。
         顶部系列条的展开目录已经提供了跳回任意一篇的入口。 -->
    <span v-else class="sp-edge is-fin">系列完</span>
  </nav>
</template>

<style scoped>
/* 与 .post-tags 同一套语言：上方细线、等宽小字、宽字距。
   左右两栏对齐，中间留空，读者一眼就知道哪边是前、哪边是后。 */
.series-pager {
  display: flex;
  align-items: flex-start;
  gap: 24px;
  margin-top: 44px;
  padding-top: 18px;
  border-top: 1px solid var(--vp-c-divider);
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.sp-link {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  text-decoration: none;
  color: var(--ink-soft);
  transition: color 0.2s ease;
}
.sp-link.is-next {
  margin-left: auto;
  text-align: right;
}
.sp-link:hover {
  color: var(--rust);
}

.sp-dir {
  flex: none;
  font-size: 11px;
  color: var(--ink-faint);
  transition: color 0.2s ease;
}
.sp-link:hover .sp-dir {
  color: var(--rust);
}

/* 标题可能很长（系列名整句都挂在标题里），最多两行，超了截断，
   否则上下篇会把正文末尾撑得很高 */
.sp-title {
  font-family: var(--font-serif);
  font-size: 14px;
  letter-spacing: 0;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 首篇 / 末篇的端点标记：不占可点区域，只是告诉读者「到头了」 */
.sp-edge {
  flex: none;
  align-self: flex-start;
  padding-top: 2px;
  font-size: 11px;
  color: var(--ink-faint);
}
.sp-edge.is-fin {
  margin-left: auto;
  color: var(--rust);
}
</style>
