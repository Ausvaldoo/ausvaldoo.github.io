<script setup>
import DefaultTheme from 'vitepress/theme'
import ViewCount from './ViewCount.vue'
import LikeButtons from './LikeButtons.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <!-- 文章正文上方：一行克制的等宽元数据，跟首页 kicker 同一套语言 -->
    <template #doc-before>
      <ViewCount />
    </template>

    <!-- 正文 + 上下篇之后：一篇一票的轻量反馈，数据只存两个数字 -->
    <template #doc-after>
      <LikeButtons />
    </template>
  </Layout>
</template>
