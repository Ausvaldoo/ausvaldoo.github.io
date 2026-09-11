<script setup>
import DefaultTheme from 'vitepress/theme'
import ViewCount from './ViewCount.vue'

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <!-- 文章正文上方：一行克制的等宽元数据，跟首页 kicker 同一套语言 -->
    <template #doc-before>
      <ViewCount />
    </template>
  </Layout>
</template>
