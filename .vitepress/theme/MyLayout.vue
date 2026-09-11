<script setup>
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import { computed } from 'vue'
import ViewCount from './ViewCount.vue'

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
    <!-- 文章正文上方：一行克制的等宽元数据，跟首页 kicker 同一套语言 -->
    <template #doc-before>
      <ViewCount />
    </template>

    <!-- 正文之后：这篇的归属分类与标签，可点进索引页 -->
    <template #doc-after>
      <div v-if="category || tags.length" class="post-tags">
        <a v-if="category" class="pt-cat" :href="`/tags#cat-${category}`">{{ category }}</a>
        <a v-for="t in tags" :key="t" class="pt-tag" :href="`/tags#tag-${t}`">{{ t }}</a>
      </div>
    </template>
  </Layout>
</template>
