<script setup>
import { onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()
const SCRIPT_ID = 'busuanzi-script'

/**
 * 不蒜子（busuanzi）统计：纯第三方计数，不种 Cookie、不存 IP，按 URL 计数。
 *
 * 坑：VitePress 是 SPA，切页不会重新执行 head 里的脚本，
 * 所以这里改成「每次路由变化就重新注入一次脚本」，
 * 否则从第 2 篇文章开始计数就永远停在第一篇的数字上。
 */
function inject() {
  const old = document.getElementById(SCRIPT_ID)
  if (old) old.remove()
  const s = document.createElement('script')
  s.id = SCRIPT_ID
  s.async = true
  s.src = 'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js'
  document.head.appendChild(s)
}

onMounted(inject)
watch(() => route.path, inject)
onBeforeUnmount(() => {
  const s = document.getElementById(SCRIPT_ID)
  if (s) s.remove()
})
</script>

<template>
  <!-- 标准不蒜子结构：脚本会自己填充数字并控制显隐 -->
  <div class="view-count">
    <span id="busuanzi_container_page_pv">
      阅读 <b id="busuanzi_value_page_pv"></b> 次
    </span>
  </div>
</template>
