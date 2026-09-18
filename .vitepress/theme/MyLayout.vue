<script setup>
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import { computed } from 'vue'
import ViewCount from './ViewCount.vue'
import SeriesNav from './SeriesNav.vue'
import SeriesPager from './SeriesPager.vue'
import BlogFooter from './BlogFooter.vue'

const { Layout } = DefaultTheme
const { frontmatter } = useData()

// 分类一篇只有一个（归属）；标签可以多个（浏览入口）。两者在这里都做成链接，
// 点击跳到「分类与标签」页的对应锚点，读者才能顺着一个词继续往下逛。
const category = computed(() =>
  typeof frontmatter.value.categories === 'string' ? frontmatter.value.categories : ''
)
const tags = computed(() =>
  Array.isArray(frontmatter.value.tags) ? frontmatter.value.tags : []
)
</script>

<template>
  <Layout>
    <!-- 文章正文上方：系列条在阅读次数之上 —— 它决定「你要按第几篇往下读」，
         是导航性信息，优先级高于统计数字。没有声明 series 的文章不渲染。 -->
    <template #doc-before>
      <SeriesNav />
      <ViewCount />
    </template>

    <!-- 正文之后：先给系列内的上一篇/下一篇（读者刚读完，最可能继续往下读），
         再给分类与标签这些「元数据」。 -->
    <template #doc-after>
      <SeriesPager />
      <div v-if="category || tags.length" class="post-tags">
        <a v-if="category" class="pt-cat" :href="`/tags#cat-${category}`">{{ category }}</a>
        <a v-for="t in tags" :key="t" class="pt-tag" :href="`/tags#tag-${t}`">{{ t }}</a>
      </div>
    </template>

  </Layout>
  <!-- 页脚：colophon 落款式。注意：当前 VitePress 版本没有 footer-* 插槽
       （page-bottom 只挂在 VPPage，首页不渲染），故直接排在 Layout 之后，
       并在 config.mts 移除 themeConfig.footer 让默认 VPFooter 不再出现。 -->
  <BlogFooter />
</template>
