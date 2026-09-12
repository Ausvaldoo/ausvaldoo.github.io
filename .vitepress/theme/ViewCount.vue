<script setup>
import { onBeforeUnmount, onMounted, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()

const SCRIPT_ID = 'busuanzi-script'
const BOX = 'busuanzi_container_page_pv'
const VAL = 'busuanzi_value_page_pv'
const SRC = 'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js'

// 「阅读次数」只在文章页出现。
// 首页是入口、/tags 是索引、/about 是自我介绍 —— 给它们挂一个 PV 数字，
// 读者会读成「这篇文章被读了 N 次」，而这三个页面本来也没什么可统计的。
//
// ⚠️ 用 `/^\/posts\/.+/` 而不是 `startsWith('/posts/')`：归档页 posts/index.md
// 的 URL 正好就是 `/posts/`，用前缀判断会把「全部文章」这个列表页也算成文章。
// 这个正则和 index.mjs 里方向感判定用的是同一个谓词，两边必须保持一致，
// 否则会出现「有方向感但没数字」这种自相矛盾的表现。
const IS_POST = /^\/posts\/.+/
const isArticle = () => IS_POST.test(route.path)

// ⚠️ 本地开发既不显示、也不加载脚本。原因是**不蒜子对 localhost 的计数是全球共用的一个桶**：
// 它按 Referer 归户，而 Referer 里只有主机名，所以全世界所有在本机跑不蒜子的开发者
// 都记到同一本账上。2026-09-13 实测（直接请求 busuanzi 接口）：
//   Referer=http://127.0.0.1:4173/about  → page_pv = 8211   ← 站长看到的「8000 多次」就是它
//   Referer=http://localhost:5173/       → page_pv = 34579507
//   Referer=http://localhost:5173/tags   → page_pv = 13558
//   Referer=https://ausvaldoo.github.io/about → page_pv = 12   ← 线上才是真实值
// 也就是说 dev 里看到的数字全不是自己的，而且每刷新一次还在往那个公共桶里灌水。
const isLocal = () => {
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '[::1]'
}

// show 初值是 false，挂载后才置位 —— 也就是说**静态 HTML 里一律不带这段标记**，
// 文章、标签、关于三种页面的产物完全一样，只有浏览器里跑起来才分化。
// 这是故意的：① 数字本来就是客户端才知道的东西，SSR 阶段渲染出来也是空的；
// ② 如果让 SSR 按 route.path 渲染、客户端再按 hostname 撤掉，
//    本地开发时就会出现「服务端说渲染、客户端说别渲染」的注水失配警告。
// 代价只是文章页的数字晚几毫秒出现 —— 而不蒜子本来还要走一次网络请求。
const show = ref(false)

const sync = () => {
  show.value = isArticle() && !isLocal()
}

// VitePress 是单页应用：换一篇文章不会重新加载脚本，不重拉的话会一直显示上一篇的数字。
// （不蒜子自己不认识前端路由，SPA 下必须每次路由变化重新注入 —— 这是它的用法前提。）
function inject() {
  const old = document.getElementById(SCRIPT_ID)
  if (old) old.remove()

  // 先把上一页的数字藏掉、清掉，否则新数字回来之前会短暂显示旧值
  const box = document.getElementById(BOX)
  if (box) box.style.display = 'none'
  const val = document.getElementById(VAL)
  if (val) val.textContent = ''

  if (!show.value) return
  const s = document.createElement('script')
  s.id = SCRIPT_ID
  s.async = true
  s.src = SRC
  document.head.appendChild(s)
}

onMounted(() => {
  sync()
  // 等 show 触发的这次渲染落地，元素真的在 DOM 里了再注入
  nextTick(inject)
})

watch(
  () => route.path,
  () => {
    sync()
    nextTick(inject)
  }
)

onBeforeUnmount(() => {
  const s = document.getElementById(SCRIPT_ID)
  if (s) s.remove()
})
</script>

<template>
  <div v-if="show" class="view-count">
    <span id="busuanzi_container_page_pv">
      阅读 <b id="busuanzi_value_page_pv"></b> 次
    </span>
  </div>
</template>
