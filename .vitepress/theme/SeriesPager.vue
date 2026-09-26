<script setup>
import { computed } from 'vue'
import { useData, useRoute } from 'vitepress'
import { data as seriesPosts } from '../../series.data.js'

const { frontmatter } = useData()
const route = useRoute()

// 与 SeriesNav.vue 同一个谓词，必须一致
const IS_POST = /^\/posts\/.+/

// ⚠️ 一篇可以同时属于多个系列（2026-09-26 加，见 series.data.js 顶部注释）。
// 结构与 SeriesNav.vue 保持一致：frontmatter 的 series 可能是标量或列表，
// 这里统一成数组再逐个系列算「上篇 / 下篇」。
const names = computed(() => {
  const v = frontmatter.value.series
  const one = (x) => String(x ?? '').trim()
  return (Array.isArray(v) ? v : [v]).map(one).filter(Boolean)
})

const blocks = computed(() =>
  names.value
    .map((name) => {
      const items = seriesPosts.filter((p) => p.series === name)
      const at = items.findIndex((p) => p.url === route.path)
      return {
        name,
        at,
        prev: at > 0 ? items[at - 1] : null,
        next: at >= 0 && at < items.length - 1 ? items[at + 1] : null,
        ok: at >= 0 && items.length > 1
      }
    })
    .filter((b) => b.ok)
)

const show = computed(() => IS_POST.test(route.path) && blocks.value.length > 0)

// 只有「一篇同属多个系列」时才在每段顶上加系列名。
// 单系列（绝大多数文章）保持零额外的 DOM 与像素 —— 与加这个功能之前一致。
const multi = computed(() => blocks.value.length > 1)
</script>

<template>
  <div v-if="show" class="series-pagers">
    <nav v-for="b in blocks" :key="b.name" class="series-pager">
      <!-- 两段上下篇并排时，读者第一眼要知道「这段是哪个系列的」——
           否则会以为页面上出现了重复的导航。 -->
      <p v-if="multi" class="sp-head">
        <span class="sp-kicker">系列</span>
        <span class="sp-name">{{ b.name }}</span>
      </p>

      <div class="sp-row">
        <a v-if="b.prev" class="sp-link" :href="b.prev.url">
          <span class="sp-dir">← 上篇</span>
          <span class="sp-title">{{ b.prev.title }}</span>
        </a>
        <span v-else class="sp-edge">系列首篇</span>

        <a v-if="b.next" class="sp-link is-next" :href="b.next.url">
          <span class="sp-dir">下篇 →</span>
          <span class="sp-title">{{ b.next.title }}</span>
        </a>
        <!-- 末篇不再给「回到第 1 篇」—— 那多半和左边的「上篇」是同一篇，会重复。
             顶部系列条的展开目录已经提供了跳回任意一篇的入口。 -->
        <span v-else class="sp-edge is-fin">系列完</span>
      </div>
    </nav>
  </div>
</template>

<style scoped>
/* 与 .post-tags 同一套语言：上方细线、等宽小字、宽字距。
   左右两栏对齐，中间留空，读者一眼就知道哪边是前、哪边是后。 */
.series-pager {
  margin-top: 44px;
  padding-top: 18px;
  border-top: 1px solid var(--vp-c-divider);
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.04em;
}

/* 左右两栏的排布从 .series-pager 挪到这里 —— 因为 .series-pager 现在还要容纳
   上面那行「系列」标签（一篇同属两个系列时才出现），不能再自己当 flex 容器。
   单系列文章的 DOM 只是多了一层不产生视觉差异的 .sp-row。 */
.sp-row {
  display: flex;
  align-items: flex-start;
  gap: 24px;
}

/* 一篇同属两个系列时，每段上下篇顶上的系列名（多系列独有，见 script 的 multi）。 */
.sp-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 14px;
  line-height: 1.7;
}
/* 与 SeriesNav 的 .sn-kicker 同一套视觉：赭石色小方块 + 纸色字。 */
.sp-kicker {
  flex: none;
  padding: 1px 6px 2px;
  background: var(--rust);
  color: var(--paper);
  font-size: 10.5px;
  border-radius: 2px;
}
.sp-name {
  color: var(--rust);
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
