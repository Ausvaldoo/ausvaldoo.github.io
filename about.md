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
      ['And I would please the hapless faun,', '我要去取悦那不幸的牧神，'],
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

/* 平铺出全部行：节标 + 诗行。SSR 直接就是完整的双语诗，进来就能读。 */
const layout = []
for (const sec of POEM) {
  layout.push({ kind: 'sec', no: sec.no })
  for (const [en, zh] of sec.lines) layout.push({ kind: 'v', en, zh })
}

/* ---------------- Dock 放大镜 ----------------
   进来时全诗正常大小；鼠标靠近时，以光标所在行为中心隆起：
   最近的行最大，上下按升余弦弧度平滑衰减（不是蹦出来，是一条弧）。
   隆起会让行变高，所以同时把行「推开」——离光标越远的行让出的空隙越多，
   放大的行与两边保持距离。全部只写 transform，不碰布局，零回流。 */
const AMP = 0.55 // 光标处最大放大到 1.55
const RADIUS = 130 // 弧的半径（px）：多远的行还跟着隆起

const poemEl = ref(null)
let box = null
let rows = [] // { el, top, h, s, o, ts, to, t } 当前/目标 的 scale 与位移
let rafId = 0
let lastY = 0
let lastT = 0

function canFish() {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

function measure() {
  const kids = box.children
  // ⚠️ 坐标必须统一到「相对 .poem-body 顶部」。kids[i].offsetTop 是相对 offsetParent（body 之类），
  // 而 onMove 里的 my = e.clientY - box.getBoundingClientRect().top 是「相对 .poem-body 顶部」。
  // 两者差一个 box.offsetTop，不减的话放大行会整体偏上、光标贴哪行哪行不放大 —— 正是之前那个 bug。
  const boxTop = box.offsetTop
  rows = []
  for (let i = 0; i < kids.length; i++) {
    rows.push({
      el: kids[i],
      top: kids[i].offsetTop - boxTop,
      h: kids[i].offsetHeight,
      s: 1, o: 0, ts: 1, to: 0, t: ''
    })
  }
}

function updateTargets(my) {
  const n = rows.length
  const extra = new Array(n)
  for (let i = 0; i < n; i++) {
    const r = rows[i]
    const d = Math.abs(r.top + r.h / 2 - my)
    const a = d < RADIUS ? (Math.cos((d / RADIUS) * Math.PI) + 1) / 2 : 0
    r.ts = 1 + AMP * a
    extra[i] = (r.ts - 1) * r.h
  }
  // 推开：第 i 行的位移 = (上方行多占的高度和 - 下方行多占的高度和) / 2。
  // 这样放大的行两边各让出一半空隙，距离拉开，行与行不重叠。
  let total = 0
  const pre = new Array(n)
  for (let i = 0; i < n; i++) {
    pre[i] = total
    total += extra[i]
  }
  for (let i = 0; i < n; i++) {
    rows[i].to = (pre[i] - (total - pre[i] - extra[i])) / 2
  }
}

function resetTargets() {
  for (const r of rows) {
    r.ts = 1
    r.to = 0
  }
}

function onMove(e) {
  // 快速甩动时冻结：速度超阈值就不更新目标，慢下来再恢复
  const now = e.timeStamp || (typeof performance !== 'undefined' ? performance.now() : Date.now())
  if (lastT) {
    const dt = Math.max(8, now - lastT)
    if (Math.abs(e.clientY - lastY) / dt > 1.5) {
      lastT = now
      lastY = e.clientY
      return
    }
  }
  lastT = now
  lastY = e.clientY
  const rect = box.getBoundingClientRect()
  updateTargets(e.clientY - rect.top)
}

function onLeave() {
  lastT = 0
  resetTargets()
}

function tick() {
  rafId = requestAnimationFrame(tick)
  for (const r of rows) {
    const ds = r.ts - r.s
    const dO = r.to - r.o
    if (Math.abs(ds) < 0.0015 && Math.abs(dO) < 0.15) {
      r.s = r.ts
      r.o = r.to
    } else {
      r.s += ds * 0.22
      r.o += dO * 0.22
    }
    // 归位后把 transform 清空，静止时不写任何样式
    const t = r.s === 1 && r.o === 0 ? '' : 'translateY(' + r.o.toFixed(1) + 'px) scale(' + r.s.toFixed(3) + ')'
    if (t !== r.t) {
      r.el.style.transform = t
      r.t = t
    }
  }
}

onMounted(() => {
  if (!canFish()) return
  box = poemEl.value.querySelector('.poem-body')
  measure()
  window.addEventListener('resize', measure)
  box.addEventListener('pointermove', onMove)
  box.addEventListener('pointerleave', onLeave)
  rafId = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  if (box) {
    box.removeEventListener('pointermove', onMove)
    box.removeEventListener('pointerleave', onLeave)
  }
  window.removeEventListener('resize', measure)
})
</script>

<div ref="poemEl" class="poem">
  <header class="poem-head">
    <h1 class="poem-zh">快乐牧人之歌</h1>
    <p class="poem-en">The Song of the Happy Shepherd</p>
    <p class="poem-by">W. B. Yeats · 1889</p>
  </header>
  <div class="poem-body">
    <div v-for="(r, i) in layout" :key="i" class="pl-row" :class="r.kind === 'sec' ? 'is-sec' : 'is-v'">
      <p v-if="r.kind === 'sec'" class="pl-sec">{{ r.no }}</p>
      <template v-else>
        <p class="pl-zh">{{ r.zh }}</p>
        <p class="pl-en">{{ r.en }}</p>
      </template>
    </div>
  </div>
</div>

<style scoped>
/* 整首诗落页面正中：定宽列 + 水平居中；并用 flex 把诗在「导航栏以下」的区域里垂直居中。
   关于页没有左/右侧栏（sidebar 为空、且本页无 markdown 标题故不生成 outline 右栏），
   所以这首诗在屏幕上是真正居中的 —— 只有顶部那条固定导航占 ~64px。 */
.poem {
  max-width: 760px;
  margin: 0 auto;
  min-height: calc(100vh - var(--vp-nav-height, 64px) - 48px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
  padding: 24px 16px;
}

.poem-head {
  margin: 0 0 30px;
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

/* ============ 诗行（正常文档流，进来就是完整双语诗） ============ */
.pl-row {
  padding: 4px 0;
  transform-origin: 50% 50%;
}
.pl-row.is-sec {
  margin: 30px 0 12px;
}
.pl-row.is-sec:first-child {
  margin-top: 0;
}
.pl-sec {
  display: flex;
  align-items: center;
  gap: 12px;
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
.pl-zh {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 17px;
  line-height: 1.75;
  color: var(--vp-c-text-1);
}
.pl-en {
  margin: 1px 0 0;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.6;
  letter-spacing: 0.01em;
  color: var(--vp-c-text-3);
}

@media (max-width: 720px) {
  .poem {
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
    font-size: 11.5px;
  }
}
</style>
