---
title: 关于
description: 一首诗：叶芝《快乐牧人之歌》
---

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

/* 这首诗按「节」组织。每行是一对 [英文, 中文]。
   注意：数据里只有诗，没有别的东西 —— 关于页上不该有第二样东西。 */
const POEM = [
  {
    no: 'I.',
    lines: [
      ['The woods of Arcady are dead,', '阿卡狄亚的树林已经死了，'],
      ['And over is their antique joy;', '它古老的欢乐也随之消逝；'],
      ['Of old the world on dreaming fed;', '从前，世界靠做梦为生。'],
      ['Grey Truth is now her painted toy.', '灰白的真理如今是她的彩绘玩偶。'],
      ['Yet still she turns her restless head:', '可她依旧不安地转动着脖颈：'],
      ['But O, sick children of the world,', '可是啊，这世上病着的孩子们，'],
      ['Of all the many changing things', '在所有那些变幻不定的东西里——'],
      ['In dreary dancing past us whirled,', '在从我们身边旋转而过的阴郁舞蹈中，'],
      ['To the dreary tune that Chronos sings,', '在和着克洛诺斯所唱的阴郁曲调里——'],
      ['Words alone are certain good.', '唯有词语是确凿的好东西。']
    ]
  },
  {
    no: 'II.',
    lines: [
      ['Where are now the warring kings,', '那些交战的君王如今在哪里，'],
      ['Word be-mockers? — By the Rood', '嘲弄词语的人？——凭着十字架起誓，'],
      ['Where are now the warring kings?', '那些交战的君王如今在哪里？'],
      ['An idle word is now their glory,', '如今他们的荣耀不过是一句空话，'],
      ['By the stammering schoolboy said,', '由一个结结巴巴的学童说出，'],
      ['Reading some entangled story:', '他正念着某个纠缠不清的故事：'],
      ['The kings of the old time are dead;', '旧日的君王都已死去；'],
      ['The wandering earth herself may be', '而这漫游的大地自身，也许不过'],
      ['Only a sudden flaming word,', '是一个骤然燃烧起来的词，'],
      ['In clanging space a moment heard,', '在铿锵作响的空间里被听见一瞬，'],
      ['Troubling the endless reverie.', '惊扰了那无尽的遐思。']
    ]
  },
  {
    no: 'III.',
    lines: [
      ['Then nowise worship dusty deeds,', '那么，切莫去崇拜蒙尘的功业，'],
      ['Nor seek, for this is also sooth,', '也不要——因为这同样是实情——'],
      ['To hunger fiercely after truth,', '去狂热地渴求真理，'],
      ['Lest all thy toiling only breeds', '免得你的一切辛劳只孕育出'],
      ['New dreams, new dreams; there is no truth', '新的梦，新的梦；除了你自己的'],
      ['Saving in thine own heart. Seek, then,', '内心，再没有真理。那么，去寻找吧，'],
      ['No learning from the starry men,', '别向那些星光下的人求学问，'],
      ['Who follow with the optic glass', '他们用望远镜追随着'],
      ['The whirling ways of stars that pass —', '星辰旋转奔行的轨迹——'],
      ['Seek, then, for this is also sooth,', '那么，去寻找吧，因为这同样是实情，'],
      ['No word of theirs — the cold star-bane', '别听他们的话——那冰冷的星毒'],
      ['Has cloven and rent their hearts in twain,', '早已把他们的心劈成两半，'],
      ['And dead is all their human truth.', '他们那属人的真理已经死了。']
    ]
  },
  {
    no: 'IV.',
    lines: [
      ['Go gather by the humming sea', '去那嗡嗡作响的海边，'],
      ['Some twisted, echo-harbouring shell,', '捡一只扭曲的、充满回声的贝壳，'],
      ['And to its lips thy story tell,', '把你的故事说给它听，'],
      ['And they thy comforters will be,', '而它们会成为你的安慰者，'],
      ['Rewarding in melodious guile', '以悦耳的狡黠在片刻之间'],
      ['Thy fretful words a little while,', '报偿你那些烦躁的话语，'],
      ['Till they shall singing fade in ruth', '直到它们在悲悯中歌唱着消逝，'],
      ['And die a pearly brotherhood;', '化作珍珠般的兄弟情谊；'],
      ['For words alone are certain good:', '因为唯有词语是确凿的好东西：'],
      ['Sing, then, for this is also sooth.', '那么，歌唱吧，因为这同样是实情。']
    ]
  },
  {
    no: 'V.',
    lines: [
      ['I must be gone: there is a grave', '我必须走了：那里有一座坟，'],
      ['Where daffodil and lily wave,', '水仙与百合在那里摇曳，'],
      ['And I would please the hapless faun,', '我要去取悦那不幸的 faun（牧神），'],
      ['Buried under the sleepy ground,', '他长眠在这沉睡的土地之下，'],
      ['With mirthful songs before the dawn.', '我要在黎明前献上欢快的歌。'],
      ['His shouting days with mirth were crowned;', '他那呐喊的岁月曾以欢笑加冕；'],
      ['And still I dream he treads the lawn,', '我仍梦见他在草坪上行走，'],
      ['Walking ghostly in the dew,', '在露水中如幽灵般踱步，'],
      ['Pierced by my glad singing through,', '被我的欢歌穿透，'],
      ['My songs of old earth’s dreamy youth:', '我歌唱古老大地如梦的青春：'],
      ['But ah! she dreams not now; dream thou!', '可是啊！她如今不再做梦了；你来做梦吧！'],
      ['For fair are poppies on the brow:', '因为额上的罂粟是美丽的：'],
      ['Dream, dream, for this is also sooth.', '做梦吧，做梦吧，因为这同样是实情。']
    ]
  }
]

/* ---------------- 滚轮的几何 ----------------
   行高固定，中文行贴底、英文行只在聚焦时填进「上方那 22px 的固有行距」。
   关键点：展开不改变任何一行的盒高 —— 所以悬停时不会回流，
   兄弟行不会位移，也就不会出现「展开→光标离开→收起」的自激振荡。
   这类效果翻车几乎都翻在这里。 */
const SEC_H = 34
const V_H = 52

const layout = []
let cursor = 0
for (const sec of POEM) {
  layout.push({ kind: 'sec', no: sec.no, top: cursor, h: SEC_H })
  cursor += SEC_H
  for (const [en, zh] of sec.lines) {
    layout.push({ kind: 'v', en, zh, top: cursor, h: V_H })
    cursor += V_H
  }
}
const TOTAL_H = cursor

const poemEl = ref(null)
const recs = []
let wheelEl = null
let trackEl = null
let viewH = 0
let maxOffset = TOTAL_H
let shown = 0 // 已渲染的滚动量（缓动后的值）
let target = 0 // 目标滚动量
let focusY = 0 // 已渲染的「选中线」
let focusYTarget = 0
let focusedIdx = -1
let rafId = 0

// 快速移动冻结用的状态：记下上一帧的指针位置与时间，算瞬时速度。
let lastX = 0
let lastY = 0
let lastT = 0

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

/* 只在「精确指针 + 允许动效」时启用。
   触摸屏、减少动效偏好、以及没有 JS 的读者，都会拿到 SSR 出来的
   静态中英对照列表 —— 所以这个页面不依赖动效也能读。 */
function canWheel() {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

function measure() {
  viewH = wheelEl.clientHeight
  maxOffset = TOTAL_H
}

function focusLimits() {
  // 焦点行允许走的范围：别让放大后的那一行落进顶部/底部的渐隐里
  return [viewH * 0.08, viewH * 0.92]
}
function clampFocus(y) {
  const [lo, hi] = focusLimits()
  return y < lo ? lo : y > hi ? hi : y
}

function onMove(e) {
  const rect = wheelEl.getBoundingClientRect()
  const y = e.clientY - rect.top
  const now = e.timeStamp || (typeof performance !== 'undefined' ? performance.now() : Date.now())
  // 算瞬时速度（像素/毫秒）。鼠标「快速甩动」时速度极高，
  // 这时候即便更新了目标，眼睛也跟不上、没意义 —— 直接冻结，
  // 画面停在原地，等指针慢下来再恢复。这就是「动得快就别动」。
  if (lastT) {
    const dt = Math.max(8, now - lastT) // 下限 8ms：避免极端情况下除零或跳变
    const v = Math.abs(y - lastY) / dt
    if (v > 1.5) {
      lastT = now
      lastY = y
      lastX = e.clientX
      return
    }
  }
  lastT = now
  lastY = y
  lastX = e.clientX
  // 光标在容器里的高度比 = 全诗的进度。把整段行程映射到全诗，
  // 所以「鼠标缓缓下移 → 诗缓缓上滚」，且来回都是连续的、可逆的。
  target = clamp01(y / rect.height) * maxOffset
  focusYTarget = clampFocus(y)
}

function onLeave() {
  // 指针离开后清空速度基线，下次进入重新计速，避免「残留速度」误判
  lastT = 0
}

function onKeys(e) {
  const k = e.key
  if (k === 'ArrowDown' || k === 'PageDown') {
    target = Math.min(maxOffset, target + (k === 'PageDown' ? V_H * 5 : V_H))
    focusYTarget = viewH / 2
  } else if (k === 'ArrowUp' || k === 'PageUp') {
    target = Math.max(0, target - (k === 'PageUp' ? V_H * 5 : V_H))
    focusYTarget = viewH / 2
  } else if (k === 'Home') {
    target = 0
    focusYTarget = viewH / 2
  } else if (k === 'End') {
    target = maxOffset
    focusYTarget = viewH / 2
  } else {
    return
  }
  e.preventDefault()
}

function paint() {
  const pad = viewH / 2 // 与 CSS 里 top: calc(var(--wh)/2 + Npx) 对应
  const half = viewH / 2
  trackEl.style.transform = 'translate3d(0,' + (-shown).toFixed(2) + 'px,0)'

  // 第一遍：定出唯一那一行「离选中线最近」的行。
  // 选中线常常落在两行之间，若只按连续函数算，会出现两行一样大、
  // 而「展开显露英文的那一行」反而不是最突出的那一行 —— 这是错的。
  let best = -1
  let bestD = Infinity
  for (let i = 0; i < recs.length; i++) {
    const cy = pad + recs[i].top + recs[i].h / 2 - shown
    const d = Math.abs(cy - focusY)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  if (best !== focusedIdx) {
    if (focusedIdx >= 0 && recs[focusedIdx]) recs[focusedIdx].el.classList.remove('is-focus')
    focusedIdx = best
    if (best >= 0) recs[best].el.classList.add('is-focus')
  }

  // 第二遍：上变换。聚焦行「钉」在最前，其余按距离显著后退、压暗、缩小 ——
  // 任何时刻都恰好有一行站在最前面，不会有两行并列；同时前后的差距
  // 拉得很大，读者一眼就能看出「现在读的是哪一行」。
  for (let i = 0; i < recs.length; i++) {
    const rec = recs[i]
    const cy = pad + rec.top + rec.h / 2 - shown // 该行中心在容器里的 y
    const d = cy - focusY
    const isB = i === best
    // 旋转按整屏连续算（卷轴的曲面要连贯）；放大/压暗/前后用更窄的半径（焦点更锐）
    const nd = Math.max(-1.7, Math.min(1.7, d / half))
    const an = Math.min(1, Math.abs(d) / (half * 0.55))
    const rot = -Math.max(-1, Math.min(1, nd)) * 14
    // 焦点行：明显放大 + 前移 + 上提（翻译行因此与上一行中文拉开间距）
    const scl = isB ? 1.5 : 0.84 + (1 - an) * 0.14
    const z = isB ? 34 : -8 - (1 - an) * 40
    const ty = isB ? 12 : 0
    const t =
      'rotateX(' + rot.toFixed(2) + 'deg) translateZ(' + z.toFixed(1) + 'px) translateY(' + ty + 'px) scale(' + scl.toFixed(3) + ')'
    if (rec.t !== t) {
      rec.el.style.transform = t
      rec.t = t
    }
    // 远端压到 0.16，近端约 0.56，焦点 1 —— 三个档次的亮度差一眼可辨
    const o = isB ? 1 : Math.round((0.16 + (1 - an) * 0.4) * 100) / 100
    if (rec.o !== o) {
      rec.el.style.opacity = o
      rec.o = o
    }
  }
}

function tick() {
  rafId = requestAnimationFrame(tick)
  const dT = target - shown
  const dF = focusYTarget - focusY
  if (Math.abs(dT) < 0.02 && Math.abs(dF) < 0.02) {
    shown = target
    focusY = focusYTarget
    return // 静止时不再写 DOM —— 省电，也让光标停下时画面真正稳下来
  }
  shown += dT * 0.16
  focusY += dF * 0.16
  paint()
}

onMounted(() => {
  if (!canWheel()) return
  const root = poemEl.value
  wheelEl = root.querySelector('.wheel')
  trackEl = root.querySelector('.wheel-track')
  const kids = trackEl.children
  for (let i = 0; i < layout.length; i++) {
    recs.push({ top: layout[i].top, h: layout[i].h, el: kids[i], t: '', o: -1 })
  }
  root.classList.add('is-live') // 切到滚轮态（SSR / 无 JS 时是静态列表）
  measure()
  shown = 0
  target = 0
  focusY = viewH / 2
  focusYTarget = focusY
  paint()
  window.addEventListener('resize', () => {
    measure()
    focusYTarget = clampFocus(focusY)
    paint()
  })
  wheelEl.addEventListener('pointermove', onMove)
  wheelEl.addEventListener('pointerleave', onLeave)
  wheelEl.addEventListener('keydown', onKeys)
  rafId = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
})
</script>

<div ref="poemEl" class="poem">
  <header class="poem-head">
    <h1 class="poem-zh">快乐牧人之歌</h1>
    <p class="poem-en">The Song of the Happy Shepherd</p>
    <p class="poem-by">W. B. Yeats · 1889</p>
  </header>

  <div class="wheel" tabindex="0" role="group" aria-label="诗全文，可滚动阅读">
    <div class="wheel-track">
      <div
        v-for="(r, i) in layout"
        :key="i"
        class="pl-row"
        :class="r.kind === 'sec' ? 'is-sec' : 'is-v'"
        :style="{ top: 'calc(var(--wh) / 2 + ' + r.top + 'px)', height: r.h + 'px' }"
      >
        <p v-if="r.kind === 'sec'" class="pl-sec">{{ r.no }}</p>
        <template v-else>
          <p class="pl-en">{{ r.en }}</p>
          <p class="pl-zh">{{ r.zh }}</p>
        </template>
      </div>
    </div>
  </div>
</div>

<style scoped>
.poem {
  /* 滚轮视口高度。行高的定值（--wh/2 的居中垫高）由它推出，
     所以它必须是一个「样式里能算出来」的长度，不能只在 JS 里知道。 */
  --wh: clamp(340px, 60vh, 620px);
  /* 整首诗落在页面正中：定宽列 + 水平居中，标题与正文均居中。 */
  max-width: 760px;
  margin: 3vh auto;
  text-align: center;
}

.poem-head {
  margin: 0 0 26px;
}
.poem-zh {
  margin: 0;
  padding: 0;
  border: none;
  font-family: var(--font-serif);
  font-size: 30px;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: var(--vp-c-text-1);
}
.poem-en {
  margin: 7px 0 0;
  font-family: var(--font-serif);
  font-size: 15px;
  font-weight: 600;
  font-style: italic;
  line-height: 1.5;
  letter-spacing: 0.02em;
  color: var(--vp-c-text-2);
}
.poem-by {
  margin: 6px 0 0;
  font-family: var(--font-mono);
  font-size: 11.5px;
  letter-spacing: 0.16em;
  color: var(--vp-c-text-3);
}

/* ============ 滚轮 ============ */
.wheel {
  position: relative;
  height: var(--wh);
  margin: 0 auto;
  max-width: 720px;
  overflow: hidden;
  perspective: 1100px;
  /* 上下渐隐：像真滚轮那样从边缘「化」进纸里。
     只用 10%，中间 80% 是干净的阅读区。 */
  -webkit-mask-image: linear-gradient(
    180deg,
    transparent 0,
    #000 10%,
    #000 90%,
    transparent 100%
  );
  mask-image: linear-gradient(180deg, transparent 0, #000 10%, #000 90%, transparent 100%);
}
.wheel:focus-visible {
  outline: 1px solid var(--vp-c-brand-1);
  outline-offset: 4px;
}
.wheel-track {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  will-change: transform;
}

.pl-row {
  position: absolute;
  left: 0;
  right: 0;
  transform-origin: 50% 50%;
  /* 行内文字不该被选中时抖动，也不该让浏览器去猜是否换行 */
  white-space: nowrap;
}
.pl-row.is-sec {
  display: flex;
  align-items: center;
}
.pl-sec {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.22em;
  color: var(--rust);
}
.pl-sec::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--vp-c-divider);
}

/* 中文行贴底；英文行占的正是「上一行与本行之间的固有行距」，
   所以它出现时不动任何人一根毫毛。 */
.pl-zh {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  margin: 0;
  font-family: var(--font-serif);
  font-size: 16.5px;
  line-height: 30px;
  color: var(--vp-c-text-1);
}
.pl-en {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 30px;
  height: 20px;
  margin: 0;
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: 12.5px;
  line-height: 20px;
  letter-spacing: 0.01em;
  color: var(--vp-c-text-3);
  opacity: 0;
  transform: translateY(5px);
  transition: opacity 0.26s ease, transform 0.26s cubic-bezier(0.22, 0.61, 0.36, 1);
}
/* 聚焦时英文显出：缩进半字，明确它是「本行中文的翻译」而非上一行的。 */
.pl-row.is-focus .pl-en {
  opacity: 1;
  transform: none;
  padding-left: 1.5em;
  text-indent: -1.5em;
}

/* ============ 静态双语版 ============
   SSR 出来、以及触摸屏与「减少动效」读者看到的就是这一版：
   同一份 DOM，只是把绝对定位与变换全部让开，回到正常文档流。
   所以内容一点没少，只是不动。 */
.poem:not(.is-live) .wheel {
  height: auto;
  overflow: visible;
  perspective: none;
  -webkit-mask-image: none;
  mask-image: none;
}
.poem:not(.is-live) .wheel-track {
  position: static;
  transform: none !important;
}
.poem:not(.is-live) .pl-row {
  position: static;
  height: auto !important;
  white-space: normal;
  opacity: 1 !important;
  transform: none !important;
}
.poem:not(.is-live) .pl-row.is-sec {
  margin: 34px 0 10px;
}
.poem:not(.is-live) .pl-row.is-sec:first-child {
  margin-top: 0;
}
.poem:not(.is-live) .pl-zh,
.poem:not(.is-live) .pl-en {
  position: static;
  height: auto;
  overflow: visible;
  opacity: 1;
  transform: none;
}
.poem:not(.is-live) .pl-en {
  margin-bottom: 1px;
}

@media (max-width: 720px) {
  .poem {
    max-width: 100%;
  }
  .wheel {
    max-width: 100%;
  }
  .poem-zh {
    font-size: 25px;
  }
  .poem-en {
    font-size: 14px;
  }
  .pl-zh {
    font-size: 16px;
  }
  .pl-en {
    font-size: 12px;
  }
}
</style>
