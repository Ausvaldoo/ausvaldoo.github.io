<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()
const API = 'https://blog-likes.inkpaper8x2.workers.dev'

const likes = ref(null) // null = 加载中
const dislikes = ref(null)
const myVote = ref('') // '' | 'like' | 'dislike'
const sending = ref(false)

// 防重复投票：只在访客自己浏览器的 localStorage 里记一笔，不上报任何身份
const storageKey = (p) => 'blog-vote:' + p

async function load(path) {
  myVote.value = localStorage.getItem(storageKey(path)) || ''
  try {
    const r = await fetch(`${API}/?page=${encodeURIComponent(path)}`)
    const d = await r.json()
    likes.value = d.likes
    dislikes.value = d.dislikes
  } catch {
    likes.value = 0
    dislikes.value = 0
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

onMounted(() => load(route.path))
watch(() => route.path, (p) => {
  likes.value = null
  dislikes.value = null
  load(p)
})
</script>

<template>
  <div class="like-bar">
    <span class="lb-tip">这篇文章对你有帮助吗？</span>
    <div class="lb-btns">
      <button
        class="lb-btn"
        :class="{ 'is-mine': myVote === 'like', 'is-locked': !!myVote && myVote !== 'like' }"
        :disabled="!!myVote || sending"
        @click="vote('like')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3zm2 9h8.6a2 2 0 0 0 1.97-1.66l1.2-7A2 2 0 0 0 18.8 9H14V5a2 2 0 0 0-2-2l-3 6v11z" /></svg>
        有帮助<b>{{ likes === null ? '…' : likes }}</b>
      </button>
      <button
        class="lb-btn"
        :class="{ 'is-mine': myVote === 'dislike', 'is-locked': !!myVote && myVote !== 'dislike' }"
        :disabled="!!myVote || sending"
        @click="vote('dislike')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 13V4h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3zm-2-9H6.4a2 2 0 0 0-1.97 1.66l-1.2 7A2 2 0 0 0 5.2 15H10v4a2 2 0 0 0 2 2l3-6V4z" /></svg>
        没帮助<b>{{ dislikes === null ? '…' : dislikes }}</b>
      </button>
    </div>
  </div>
</template>
