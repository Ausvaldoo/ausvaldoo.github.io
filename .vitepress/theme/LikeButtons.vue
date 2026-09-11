<!--
  【已停用 · 2026-09-11】此组件当前未挂载到任何布局，保留代码仅供将来参考。

  原因：后端部署在 Cloudflare Worker 的 *.workers.dev 域名上，该域名在中国大陆
  DNS 层面即被拦截（实测 nslookup 直接 "No response from server"，同一时刻
  ausvaldoo.github.io 正常返回 200）。因此点赞数在访客浏览器里永远拿不到，
  按钮会一直显示不出数字——静默失败比没有这个功能更糟，故整体下线。

  若要恢复：backend 必须换到一个国内可达的地址（自有域名 CNAME 到 Worker，
  或改用国内可访问的服务），然后把 API 常量改成新地址，并在 MyLayout.vue 中重新挂载。
  后端代码仍在 tools/like-worker/worker.js，KV namespace id 见 tools/like-worker/wrangler.toml。
-->
<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()
const API = 'https://blog-likes.inkpaper8x2.workers.dev'
// 请求是滚动到才发、且完全不阻塞页面，所以等久一点没有代价；
// 国内到 Cloudflare 的连接经常被丢包，十几秒才通是常事，放宽能显著提高数字出现率
const TIMEOUT = 15000

const likes = ref(null) // null = 还没拿到（此时不显示数字）
const dislikes = ref(null)
const myVote = ref('') // '' | 'like' | 'dislike'
const sending = ref(false)

const root = ref(null)
let io = null
let timer = null

// 防重复投票：只在访客自己浏览器的 localStorage 里记一笔，不上报任何身份
const storageKey = (p) => 'blog-vote:' + p

function reset() {
  likes.value = null
  dislikes.value = null
  sending.value = false
}

async function load(path) {
  myVote.value = localStorage.getItem(storageKey(path)) || ''
  const ac = 'AbortController' in window ? new AbortController() : null
  clearTimeout(timer)
  timer = setTimeout(() => ac && ac.abort(), TIMEOUT)
  try {
    const r = await fetch(`${API}/?page=${encodeURIComponent(path)}`, {
      signal: ac ? ac.signal : undefined,
    })
    const d = await r.json()
    likes.value = d.likes
    dislikes.value = d.dislikes
  } catch {
    /* 超时或网络失败：静默，数字不显示，按钮仍可点 */
  } finally {
    clearTimeout(timer)
  }
}

async function vote(kind) {
  if (myVote.value || sending.value) return
  sending.value = true
  try {
    const r = await fetch(
      `${API}/?page=${encodeURIComponent(route.path)}&vote=${kind}`,
      { method: 'POST' }
    )
    const d = await r.json()
    likes.value = d.likes
    dislikes.value = d.dislikes
    myVote.value = kind
    localStorage.setItem(storageKey(route.path), kind)
  } catch {
    /* 网络失败：静默，按钮回到可点状态 */
  }
  sending.value = false
}

// 只在滚动到按钮附近时才发请求，配合 head 里的 preconnect，延迟基本被消化掉
function watch1() {
  const el = root.value
  if (!el) return
  if (!('IntersectionObserver' in window)) {
    load(route.path)
    return
  }
  io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        stopWatch()
        load(route.path)
      }
    },
    { rootMargin: '300px' }
  )
  io.observe(el)
}

function stopWatch() {
  if (io) {
    io.disconnect()
    io = null
  }
}

onMounted(watch1)
onBeforeUnmount(() => {
  stopWatch()
  clearTimeout(timer)
})

watch(() => route.path, () => {
  reset()
  stopWatch()
  watch1()
})
</script>

<template>
  <div ref="root" class="like-bar">
    <span class="lb-tip">这篇文章对你有帮助吗？</span>
    <div class="lb-btns">
      <button
        class="lb-btn"
        :class="{ 'is-mine': myVote === 'like', 'is-locked': !!myVote && myVote !== 'like' }"
        :disabled="!!myVote || sending"
        @click="vote('like')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3zm2 9h8.6a2 2 0 0 0 1.97-1.66l1.2-7A2 2 0 0 0 18.8 9H14V5a2 2 0 0 0-2-2l-3 6v11z" /></svg>
        有帮助<b v-if="likes !== null" class="lb-num">{{ likes }}</b>
      </button>
      <button
        class="lb-btn"
        :class="{ 'is-mine': myVote === 'dislike', 'is-locked': !!myVote && myVote !== 'dislike' }"
        :disabled="!!myVote || sending"
        @click="vote('dislike')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3zm-2-9H6.4a2 2 0 0 0-1.97 1.66l-1.2 7A2 2 0 0 0 5.2 15H10v4a2 2 0 0 0 2 2l3-6V4z" /></svg>
        没帮助<b v-if="dislikes !== null" class="lb-num">{{ dislikes }}</b>
      </button>
    </div>
  </div>
</template>
