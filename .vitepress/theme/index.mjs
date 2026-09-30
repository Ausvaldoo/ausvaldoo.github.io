import DefaultTheme from 'vitepress/theme'
import MyLayout from './MyLayout.vue'
import Lenis from './vendor/lenis.mjs'
import './custom.css'

/* 模块级状态：记录「诗句是否已经升起过」。
   为什么不用 document.documentElement.dataset：
     · dataset 挂在 DOM 上，任何重建 <html> 的路径（整页重载）都会丢；
     · 而本函数是 enhanceApp 时**闭包捕获一次**的，模块级变量与它同生命周期，
       语义更准确 —— 「这个 JS 实例已经负责过升起」。
   2026-09-19 实测（headless Edge，SPA 内「首页 → 点进文章 → 点回首页」）：
     同一文档内返回首页时 fm-rise-in 不再出现、诗句 y 恒为 0（直接可见），
     守卫生效；只有整页重载（刷新 / 直接贴 URL 进入）才重新播一次 —— 这正是
     用户要的「首次进入，或者是刷新的一瞬间」。 */
let poemRisen = false

/**
 * 首页 Hero 视差：
 * 滚动时把 window.scrollY（clamp 到 [0, hero高度]）写入 .VPHero 的
 * --hero-y 变量；位移系数在 custom.css 中用 calc() 控制。
 * - rAF 节流，passive 监听
 * - prefers-reduced-motion 时不绑定
 * - 路由切换后重新查找 .VPHero（文章页无 hero，自动跳过）
 * - 返回 bind()，交给 enhanceApp 在切页后调用（旧版这里注册钩子注册失败）
 */
function setupHeroParallax() {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  let hero = null
  let raf = null

  const apply = () => {
    raf = null
    // 关键：懒重查。首次绑定若早于 DOM 挂载，hero 会停在 null，
    // 之后滚动就永远 return —— 这正是第一版视差"没反应"的原因。
    if (!hero) hero = document.querySelector('.VPHero')
    if (!hero) return
    const h = hero.offsetHeight || 1
    const y = Math.min(Math.max(window.scrollY || 0, 0), h)
    hero.style.setProperty('--hero-y', y.toFixed(1) + 'px')
    // 滚动进度 0→1：0=页面顶部，1=滚过约 65% hero 高度。
    // 文字左滑消隐、封面放大渐隐都按这个进度走（系数在 custom.css）。
    const p = Math.min(y / (h * 0.65), 1)
    hero.style.setProperty('--hero-p', p.toFixed(3))
  }

  const onScroll = () => {
    if (raf === null) raf = requestAnimationFrame(apply)
  }

  const bind = () => {
    hero = document.querySelector('.VPHero')
    if (hero) apply()
    else hero = null
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  window.addEventListener('load', bind)
  requestAnimationFrame(bind)

  // 把 bind 交回去，由 enhanceApp 里**唯一**的 onAfterRouteChange 统一调用。
  // ⚠️ 不要在这里自己赋值 router.onAfterRouteChange ——
  // 它是单值属性（不是事件总线），多处赋值会互相覆盖，
  // 而旧代码用 `typeof router.onAfterRouteChanged === 'function'` 做守卫，
  // 该属性初始就是 undefined，守卫恒为 false，于是回调从未注册。
  return bind
}

/**
 * 滚动渐显（MutationObserver 版）：
 * - 直接盯 body 的 DOM 变化，列表/归档元素一出现就处理——
 *   无论首次加载、SPA 切页、浏览器前进后退，都不存在时序竞态
 * - 视口内的立即显示；视口外的交给 IntersectionObserver
 * - 先给 <html> 加 has-reveal 再藏内容：JS 挂了内容照常显示
 * - prefers-reduced-motion 时不启用
 */
function setupReveal() {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (!('IntersectionObserver' in window) || !('MutationObserver' in window)) return

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('revealed')
          io.unobserve(e.target)
        }
      }
    },
    { threshold: 0.08 }
  )

  const SEL = '.post-item:not(.revealed), .archive-group:not(.revealed), .fm-toc-item:not(.revealed)'
  let scheduled = false

  const handle = () => {
    scheduled = false
    // ⚠️ 2026-09-18 修：先加 has-reveal（内容藏起来），**再等一帧**才揭示视口内元素。
    // 原版把「隐藏」和「揭示」写在同一个 rAF 回调里 → 同一帧内 opacity 直接从 1 到 1，
    // 浏览器没有中间态可补间，首屏文章**直接出现**，这就是读者反馈的「没有动效」。
    // 拆成两层 rAF 后，隐藏态先绘制一次，下一帧加 .revealed 才会真正播过渡。
    document.documentElement.classList.add('has-reveal')
    requestAnimationFrame(() => {
      document.querySelectorAll(SEL).forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.top < window.innerHeight && r.bottom > 0) {
          el.classList.add('revealed') // 已在视口：下一帧揭示 → 播错峰上浮
        } else {
          io.observe(el) // 视口外：滚动到再显示
        }
      })
    })
  }

  const mo = new MutationObserver(() => {
    if (!scheduled) {
      scheduled = true
      requestAnimationFrame(handle)
    }
  })
  mo.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('load', handle)
}

/**
 * 首页诗句逐词升起（2026-09-19 站长指定；同日二次迭代改为逐词）。
 *
 * 与 setupHeroFly 的分工：
 *   - setupHeroFly 是**滚动触发**的（刊名飞进导航栏），与本次无关；
 *   - 本函数是**首屏加载触发**的，从地平线逐词升起。
 *
 * ⚠️ 与 View Transitions 的互斥（这是设计里最容易搞错的地方）：
 *   从文章页返回首页时，ViewTransitions 会让**整页从左侧飞入**（vt-back）。
 *   如果此时再叠一层逐词升起，就是「页面在横移、文字在纵升」两套空间隐喻打架。
 *   所以**已经播过一次就不重播**（见下方的 poemRisen 模块级守卫）。
 *
 * 关于「升起」为什么必须两层 span：
 *   外层 overflow:hidden 做掩码，内层 transform 做位移。如果只有一层，
 *   位移会把掩码一起带走，看到的是整行平移而非「从地平线下钻出来」。
 *
 * ── 为什么从「逐行」改成「逐词」（2026-09-19 站长反馈）──────────────
 *   站长原话：「他的文字从地平线上升时，是左端先上升，然后像把右端
 *   拉起来一样。而且他的没那么紧凑，速度没那么快。咱的好像一下就全升
 *   完了，他的比较缓慢」——指的是参照站点 ggdesign.it。
 *
 *   查其公开实现（`laiv.ggdesign.it/js/ggdesign/global.js`）确认：
 *     SplitText.create(el, { type:'words', mask:'words' })   ← **按词拆**
 *     gsap.from(words, { yPercent:100, rotateZ:4, filter:'blur(4px)',
 *                        duration:1.25, ease:'power3', stagger:.03 })
 *   ⚠️ 2026-09-22 站长决定把 `filter:'blur(4px)'` 去掉（其余三项原样保留）——
 *      依据是另一参照站 linearfestivals 的 EventHero：它的逐词上升**没有模糊**，
 *      只做 `yPercent:110 → 0`（它有错峰 stagger .05，但没有几何旋转）。
 *      ⚠️ 错峰（时间先后 / 波浪）与倾斜（几何 rotate / 字是歪的）是两件事，别混。
 *      这是个"只删一项"的改动，别顺手把 rotateZ 也删了。
 *      详见 index.md 那份 style 块开头的说明。
 *
 *   ⚠️ 2026-09-30 站长第三轮调整：**曲线换 power4.out、行程 1.25s→0.9s、
 *      位移 100%→110%**（三项一起，对齐站长认可的那个 demo 的手感）。
 *      归因与逐点曲线对比写在 index.md 的 style 块注释里，这里不重复。
 *      **错峰步长（--fm-word-step / --fm-line-step）一项都没动** ——
 *      那是站长 09-21、09-23 两次明确要「更明显」的结果，不在本轮范围内。
 *   逐行版只有 4 个错峰单位（4 行 × 0.07s = 0.21s 窗口），视觉上近乎齐步走；
 *   逐词版错峰单位 ~14 个（0.03s × 13 = 0.42s 窗口），才有了「波浪」质感。
 *   这里用 CSS animation 复刻，不引 GSAP（省 60KB 依赖）。
 */
function setupPoemRise() {
  if (typeof window === 'undefined') return

  const root = document.documentElement

  /* prefers-reduced-motion：**不 return**，而是直接标 done。
     为什么不能直接 return：.fm-word > span 的基础态是 translateY(110%)
     （隐藏），CSS 的 reduce 媒体查询会覆盖成可见，但那是纯 CSS 保证；
     而 SPA 从文章页切回首页时诗句 DOM 是**新建**的，如果我们什么都不做，
     就完全依赖 CSS 媒体查询生效 —— 一旦有偏差（例如用户中途改系统设置、
     或样式表加载顺序问题），诗句就是一片空白且无人兜底。
     所以这里照样返回 play()，由它把 done 类挂上，用**显式终态**兜住可见性。 */
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /**
   * 把 [data-poem] 的文本切成词并注入三层 DOM。
   *
   * 为什么不手写在 index.md 里：中文词长不一（"夏日蓝色的黄昏里" 该切成
   * "夏日/蓝色/的/黄昏里" 还是 "夏日蓝色的/黄昏里"？），且改文案就要重排
   * 一堆 span。交给 JS 按标点切分，文案改了也不用动结构。
   *
   * 切分规则：按**语义短语**切，而不是按固定字数硬切。
   *   中文没有空格词边界，而参照站（ggdesign.it）是英文按空格分词。第一版
   *   按 3 字硬切成 "夏日蓝 | 色的黄"，把词切碎了 —— 视觉上断得莫名其妙，
   *   朗读节奏也乱。所以这里改用一份**短语清单**（下方 PHRASES）。
   *
   *   为什么用清单而不是分词算法：整首诗就这 4 句、14 个字块，且每句的
   *   自然断点（"夏日蓝色的/黄昏里"）是固定的。硬塞一个中文分词库（几 MB）
   *   只为切 4 句话，是杀鸡用牛刀；而正则分词（按常见虚词）在这么短的
   *   诗里也切不准。文案极少变，清单最省且最准。
   *   ⚠️ 改诗句文案时**必须同步改 PHRASES**，否则切分对不上（下方有兜底：
   *   清单匹配不上就退回按标点整句成块，至少不会切碎）。
   *
   * ⚠️ 幂等：已切过就跳过。SPA 切回首页时 DOM 是新建的，会重新切一次。
   */
  const splitPoem = (el, phrases = []) => {
    if (!el || el.dataset.poemSplit === '1') return
    const text = el.getAttribute('aria-label') || el.textContent || ''
    if (!text.trim()) return

    const frag = document.createDocumentFragment()

    /* 优先按短语清单切：逐句用清单里的短语「逐条吃字符」，能完整吃完才算匹配。
       任何一句吃不动 → 整体退回兜底（不半路混用两套切法）。 */
    const byPhrases = () => {
      const out = []
      for (const line of text.split(/[，。、；！？…—]+/).map((s) => s.trim()).filter(Boolean)) {
        let rest = line
        const picked = []
        while (rest.length) {
          const hit = phrases.find((p) => p && rest.startsWith(p))
          if (!hit) return null // 清单不匹配 → 整体退回兜底
          picked.push(hit)
          rest = rest.slice(hit.length)
        }
        out.push(picked.length ? picked : [line])
      }
      return out
    }

    // 兜底：按标点整句成块（宁可错峰单位少，也不把词切碎）
    const bySentence = () =>
      text
        .split(/[，。、；！？…—]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => [s])

    const lines = byPhrases() || bySentence()

    let lineIndex = 0
    for (const picked of lines) {
      if (!picked.length) continue
      const lineEl = document.createElement('span')
      lineEl.className = 'fm-line'
      /* 行序号：行间错峰用（见 index.md 的 --fm-line-step）。
         ⚠️ 与 --fm-word-i 是两个不同量纲的量，**不能互相推导**，所以分别注入：
           · --fm-line-i 是本行在整首诗里的序号（0..3），**结构性**的，切分时就定；
           · --fm-word-i 是**全局**词序号（0..8，跨行累加），在 play() 里才定。
         最终 delay = 行号 × 行步长 + 全局词号 × 词步长 ——
         行内错峰只由词步长决定（保住波浪），行与行之间额外拿到一个行步长
         （拉开节拍）。这就是「行内是波浪、行间是节拍」两级节奏的来源。
         custom property 会继承，所以挂在 .fm-line 上即可被 .fm-word > span 读到。 */
      lineEl.style.setProperty('--fm-line-i', String(lineIndex))
      lineIndex += 1
      for (const chunk of picked) {
        const w = document.createElement('span')
        w.className = 'fm-word'
        w.setAttribute('aria-hidden', 'true')
        const inner = document.createElement('span')
        inner.textContent = chunk
        w.appendChild(inner)
        lineEl.appendChild(w)
      }
      frag.appendChild(lineEl)
    }
    el.textContent = ''
    el.appendChild(frag)
    el.dataset.poemSplit = '1'
  }

  /* 诗句的语义短语表（顺序无关，靠 startsWith 逐条吃）。
     ⚠️ 改 index.md 里的诗句文案时**必须同步改这里**；漏改不会崩，
     但会退回「整句一块」的兜底切法（错峰单位骤减，波浪感变弱）。

     ⚠️ 2026-09-30 站长第三轮：**切分粒度加密**（9 块 → 13 块）。
     站长原话：「你那个词的切分我觉得这也不够碎啊，还可以再碎一点。」
     要求「碎到词组」而不是「碎到单字」—— 单字会把「的」「里」这类虚词
     孤立出来，朗读节奏被打断（09-19 就否过「夏日蓝 | 色的黄」那种硬切）。
     所以虚词跟着前一词成组：「的黄昏」而不是「的」+「黄昏」。

     新切分（4 行 / 13 块）：
       夏日 | 蓝色 | 的黄昏 | 里
       我 | 将 | 走上 | 幽径
       不顾 | 麦茎 | 刺肤
       漫步地 | 踏青
     ⚠️ 「的黄昏」是一条**跨词短语**：把「蓝色的」的「的」与「黄昏」并成一块。
        这是刻意的 —— 让「的」不单独跳，但整句仍比原来的「夏日蓝色的」碎。
        「漫步地」保留整块同理：拆成「漫步|地」会让「地」孤立。
     错峰窗口现在是**单级**（13 块 × 一个步长 = 0.60s），
     行级台阶已取消（见 index.md 的 --fm-word-step 注释）。 */
  const PHRASES = [
    '夏日',
    '蓝色',
    '的黄昏',
    '里',
    '我',
    '将',
    '走上',
    '幽径',
    '不顾',
    '麦茎',
    '刺肤',
    '漫步地',
    '踏青',
  ]

  /**
   * 播一次升起。
   *
   * 两种「找不到诗句」的情形要区分，处理方式相反：
   *   a) 当前页不是首页（文章页/归档页）→ 什么都不做，等下一次调用；
   *   b) 是首页但 DOM 还没渲染完 → 短暂等待后重试。
   * 分不清时就当作 (b) 重试几次，超时后再按 (a) 处理（标 done 保证可见）。
   *
   * ⚠️ 不能用 document.startViewTransition 的 update 回调那套 rAF 等待 ——
   * 那种场景下浏览器抑制渲染、rAF 永不触发（已知会卡死）。
   */
  const play = (retries = 6) => {
    const poem = document.querySelector('[data-poem]')
    if (!poem) {
      if (reducedMotion) return true
      // 首页 DOM 可能尚未提交（首屏 hydration 与路由钩子都可能早于渲染）。
      // 用 rAF 轮询重试而非靠单次时机碰运气，避免「刷新时诗句根本没升起」。
      if (retries > 0) {
        requestAnimationFrame(() => play(retries - 1))
        return true
      }
      // 重试耗尽仍无诗句 → 判定为非首页。标 done 让文字保持终态可见，
      // 避免「从文章页切回首页时诗句消失」。
      root.classList.add('fm-rise-done')
      return false
    }

    // 结构由 JS 注入（幂等，见 splitPoem 注释）。必须在取 .fm-word 之前做，
    // 因为词节点是这里才生成的。
    splitPoem(poem, PHRASES)
    const words = poem.querySelectorAll('.fm-word')
    if (!words.length) {
      root.classList.add('fm-rise-done')
      return false
    }

    // 若已经播过，不重复播：直接落终态。
    // 覆盖「SPA 从文章页切回首页」——此时首页 DOM 是新建的，诗句处于 CSS 初始态,
    // 必须显式挂 done 它才可见（这也正是这里要 requestAnimationFrame 兜一帧的原因）。
    if (poemRisen) {
      root.classList.add('fm-rise-done')
      return true
    }

    words.forEach((el, i) => el.style.setProperty('--fm-word-i', String(i)))

    // 减弱动效偏好：跳过动画，直接落终态（CSS 里也已同步禁用 animation）
    if (reducedMotion) {
      root.classList.add('fm-rise-done')
      poemRisen = true
      return true
    }

    // ⚠️ 两层 rAF：初始态是 CSS 静态定义的，首次绘制已「看到」它。
    // 同一帧挂类会让起止值合并——与 setupReveal 踩过的坑同源。
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.add('fm-rise-in')
        poemRisen = true

        // 用**最后一个词**的 animationend 收尾：它的 delay 最大，
        // 所以它结束时全部词都已落位。用第一个词会在其余词还在动时就移除
        // 触发类，后半句直接跳回终态（一次明显的「啪」）。
        const last = words[words.length - 1]
        if (last && last.firstElementChild) {
          last.firstElementChild.addEventListener(
            'animationend',
            () => {
              root.classList.add('fm-rise-done')
              root.classList.remove('fm-rise-in')
            },
            { once: true }
          )
        }
      })
    })
    return true
  }

  return play
}

/* 指针状态的**模块级共享槽**。
   setupHeroPointer 每帧把它 lerp 后的当前值写进来，粒子引擎直接读。
   为什么不各读各的 CSS 变量（--o-l/--o-r 就挂在 .VPHero 上）：
   那意味着粒子每帧一次 getComputedStyle() —— 一次**强制同步样式计算**。
   倾斜 + 开门 + 粒子同时在动时，正是最不该加这类强制重排的时刻。
   同模块两个函数共享一个普通对象，是这里最省的一条路。 */
const heroPointer = { oL: 0, oR: 0, mx: 0, my: 0, follow: false, mactive: false }

/**
 * Hero 粒子场 —— hakim 的「Particles」思路（2026-09-12 替换掉原来的「鼠标墨痕」）。
 *
 * 来源：hakim.se「Particles」，他第一个 canvas 作品（2011）。原始行为：
 * 粒子匀速漂移、撞边反弹，**离鼠标越近越大**（distanceFactor），
 * 点击可以把最近的一颗「钉住」。原版源码：assets/hakim/_lab/src/particles_01.html。
 *
 * ⚠️ 2026-09-19 改版（站长原话）：「门打开的缝隙，粒子往前涌吧，别再跟随鼠标了，
 *    因为鼠标控制门，门挡住粒子了」。
 *    原版的「离鼠标越近越大」被**整套拆掉**：同一个鼠标既开门的开合、又要放大它
 *    跟前的粒子，而粒子就在被门盖住的那片区域里 —— 两个功能抢同一个输入，
 *    结果是「放大最明显的地方正好被门挡着」，白做工。现在粒子只被**开门量**驱动：
 *    门开得越大，粒子越往观者方向涌（变大、变快、从门缝那侧散开）。
 *    输入源单一化之后，"鼠标 → 门 → 粒子"是一条清晰的因果链，而不是两个抢指针的系统。
 *
 *    实现要点：涌出的调制是**乘性叠加**，surge=0 时全部退化为 1（等比于旧版底纹），
 *    所以门一关就连续地回到原来的样子，不需要任何状态复位、也不会跳。
 *    见 draw() 里 surge 那段与 build() 里的 p.z。
 *
 * 为什么换掉更早那层「鼠标墨痕」：原墨痕峰值 alpha 只有 0.10，是**设计上就看不见的**
 * 「触感层」。它技术上完全正确，但读者永远注意不到 —— 属于本站 2026-09-12
 * 总结的那条教训：只满足「技术上能跑通」不算数。
 *
 * 按本站设计语言改了五处，每一处都是「照搬会出问题」的地方：
 * 1. **配色**：原版是黑底上的 #000 / #FF0000 / #FFFF00 三色亮点（黑底上黑点其实
 *    看不见，暗底上真正可见的只有红黄）。这里是米白纸底，只留「墨」——
 *    取 --ink 变量，明暗主题自动跟随；.dark 切换由 MutationObserver 重做精灵。
 * 2. **渲染**：原版用 arc 填实心圆。搬到米白纸上，放大到十几像素的实心黑圆会聚成
 *    一片「污渍」（实测截图的观感），所以改用预渲染的软边径向渐变精灵 + drawImage
 *    —— 墨渗进纸本来就是软边的，顺带把每帧几百次 createRadialGradient 降到
 *    一次 drawImage。
 * 3. **节奏**：原版 setInterval(40) 定帧，直接换到 60fps 的 rAF 会快 2.4 倍。
 *    这里用 delta 时间推进，速度与帧率解耦，压到 ~14px/s —— 是「墨点浮在纸上」，
 *    不是星空。
 * 4. **密度**：原版固定 400 颗铺满整窗（含导航与正文）。这里只铺 hero，按面积算
 *    （约每 6200px² 一颗，1440×480 的 hero ≈ 111 颗），夹在 70~260 之间。
 * 5. **放大倍率**：原版最近处放大 10 倍（40px 圆斑）。软边精灵比实心圆更"占面积"，
 *    所以收到 5 倍。第一版曾用 74 颗 + alpha 0.16~0.38，实测只剩「灰尘」——
 *    可见度是这一版反复调过的地方，别再往下调。
 *
 * 保留原版最讨喜的那个交互：点击把最近的一颗钉住，再点一下放开。
 * 触屏 / prefers-reduced-motion 时完全不画，hero 退回纯 CSS 墨彩。
 */
function startHeroParticles(canvas) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const SPEED = 22 // 漂移速度 px/s（原 14：读者要「更强」，动感更足）
  /* 「往前涌」的强度常数。三个都是 surge=1（门开到 90°）时的**满幅增益**，
     平时按 surge 线性缩放 —— surge=0 时全部等于 1，也就是旧的静态底纹。
       ZOOM 透视放大：粒子离消失点越远，被推得越开（"冲出来"的主要线索）
       RUSH 速度增益：涌出来的粒子更快，底纹不再是匀速飘
       PUFF 尺寸增益：靠近观者 = 更大 */
  const ZOOM = 0.85
  const RUSH = 1.25
  const PUFF = 0.7
  // 旧版（hakim Particles）鼠标附近的放大上限。点牧神后粒子恢复的就是这套机制
  // ——原版 10 倍，软边精灵更"占面积"，当年收到 5 倍（见 09-13 提交 7d0ef3d）。
  const GROW = 5
  // 每多少 px² 一颗。原 6200（1440×480 hero ≈ 111 颗），2026-09-18 读者反馈
  // 「太少了、太疏了，弄密一点、效果弄强烈一点」→ 收到 1500，约 4 倍密度
  // （1440×340 的新 hero ≈ 384 颗；实测画布非透明像素 ~1 万）。
  const DENSITY = 1500

  let w = 0
  let h = 0
  let raf = null
  let last = 0
  let parts = []

  // 粒子用一组调色板（--hero-dots，逗号分隔），逐颗随机取色 —— 不能用 --ink：
  // 浅色模式下 --ink 是 #0a0a0b（近黑），而 hero 标题 .VPHero .name/.text 也是 --ink，
  // 于是粒子跟标题同色，黑点围着黑字，读者反馈「黑色不就和文字打架了吗」。
  // 同色必然抢，靠调透明度救不回来。改中性灰又被否（「非得不是黑就是白就是灰这种？」），
  // 所以最终是五色颜料点 —— 配色依据写在 custom.css 的 --hero-dots 注释里。
  const FALLBACK = {
    light: ['#b0552f', '#c9931f', '#4f7a4a', '#2f6187', '#a63e6b'],
    dark: ['#d97a4a', '#e0b356', '#8fbd7e', '#7aa7d4', '#d98ab0'],
  }
  const dotColorList = () => {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--hero-dots')
      .trim()
    const list = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (list.length) return list
    const isDark = document.documentElement.classList.contains('dark')
    return isDark ? FALLBACK.dark : FALLBACK.light
  }

  // 把颜色解析成 rgb：用一个 1×1 的画布「问」浏览器，而不是自己写 hex 解析 ——
  // 调色板将来换成 rgb() / oklch() / 具名色都不会失效。
  // （非法值会让 fillStyle 保持上一个合法值，所以这里不做校验 —— 调色板就在上面，
  //   是写死的 hex；真写错了，肉眼一眼就能看出来，没必要在这里加一层防御。）
  const probe = document.createElement('canvas')
  probe.width = 1
  probe.height = 1
  const pctx = probe.getContext('2d')
  const toRGB = (css) => {
    pctx.fillStyle = css
    pctx.fillRect(0, 0, 1, 1)
    const d = pctx.getImageData(0, 0, 1, 1).data
    return [d[0], d[1], d[2]]
  }
  const palette = () => dotColorList().map(toRGB)

  // 粒子 alpha 的全局系数（--hero-dot-alpha）。暗色必须比浅色低 ——
  // 浅色模式下颜料叠在 L≈0.86 的米白纸上，合成结果被纸**冲淡**；暗色下底是
  // #161616（L≈0.008），没有纸来冲，合成色基本就是颜料自己的亮度，
  // 同一组 alpha 在暗底上明显更抢（实测对纸底 4.65:1 vs 浅色 2.93:1）。
  // 理由与数据见 custom.css 的 .dark 注释。跟着主题重取，见 makeSprites。
  let alphaScale = 1
  const readAlphaScale = () => {
    const v = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--hero-dot-alpha')
    )
    alphaScale = Number.isFinite(v) && v > 0 ? Math.min(v, 1) : 1
  }

  // 软边墨点精灵：预渲染一次，之后每帧只做 drawImage 缩放。
  // 每种颜色一张精灵（预渲染一次，之后每帧只做 drawImage 缩放）。
  // 原版是 arc 填实心圆 —— 在它的黑底星空里没问题，但搬到米白纸上，
  // 放大到十几像素的实心圆会聚成一片「污渍」（2026-09-12 实测截图的观感）。
  // 颜料渗进纸是软边的，所以这里用径向渐变做精灵；顺带把成本从
  // 每帧几百次 createRadialGradient 降到一次 drawImage。
  let sprites = []
  const makeSprites = () => {
    readAlphaScale()
    const S = 64
    sprites = palette().map(([dr, dg, db]) => {
      const c = document.createElement('canvas')
      c.width = S
      c.height = S
      const g = c.getContext('2d')
      const dot = (a) => `rgba(${dr}, ${dg}, ${db}, ${a})`
      const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
      grad.addColorStop(0, dot(1))
      grad.addColorStop(0.4, dot(0.9))
      grad.addColorStop(0.75, dot(0.26))
      grad.addColorStop(1, dot(0))
      g.fillStyle = grad
      g.fillRect(0, 0, S, S)
      return c
    })
  }
  makeSprites()

  const build = () => {
    // 下限/上限同步上调（原 70/260）：读者要「更密」，大屏也不封顶太低
    const n = Math.max(120, Math.min(520, Math.round((w * h) / DENSITY)))
    parts = []
    for (let i = 0; i < n; i++) {
      const dir = Math.random() * Math.PI * 2
      const sp = SPEED * (0.45 + Math.random() * 0.9)
      parts.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: Math.cos(dir) * sp,
        vy: Math.sin(dir) * sp,
        // 逐颗随机取色。刻意均匀取（不是加权）：五色各占约 20%，
        // 任何一种颜色都不会在某片区域扎堆成「一滩色」。
        ci: Math.floor(Math.random() * Math.max(1, sprites.length)),
        r: 2.2 + Math.random() * 2.6, // 原 1.5~3.4：读者要「更强」，点更大
        // alpha「浅色基准」0.46~0.82（原 0.34~0.68）：彩色点要浓度才认得出颜色，
        // 读者 2026-09-18 反馈「效果弄强烈一点」，整体上浮一档。
        // 实际绘制时还会乘主题系数 alphaScale（暗色 0.78），见 draw()。
        // 仍是 z-index:1 的底纹层、软边精灵，永远在文字（z-index:2）之下，不糊字。
        a: 0.46 + Math.random() * 0.36,
        grow: 1,
        frozen: false,
        /* 「深度」0..1：0 = 最远（贴在画布上，等于旧版底纹），1 = 最近。
           门开时它随时间推进，粒子沿"离消失点越远被推得越开"的方向冲出来；
           推到 1 就从 0 重新开始 —— 重生点正好在消失点（门缝那侧），
           配合首尾淡入淡出，观感是「从门缝里新生一颗」而不是「凭空跳出来」。
           ⚠️ 只有 surge>0 时才推进：门关着的时候 z 冻住，粒子完全退回旧版行为。 */
        z: Math.random(),
        // 每颗粒子的推进速率略有差异，避免整场粒子像一堵墙一起压过来
        zv: 0.55 + Math.random() * 0.9,
      })
    }
  }

  const resize = () => {
    w = canvas.clientWidth
    h = canvas.clientHeight
    if (!w || !h) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.round(w * dpr))
    canvas.height = Math.max(1, Math.round(h * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    build()
  }

  const draw = (dt) => {
    ctx.clearRect(0, 0, w, h)

    /* ---- 开门量 → 涌出强度 ----------------------------------------------
       取两扇门里开得大的那一边。为什么用 max 而不是相加：两扇门是可以同时开的
       （鼠标在中间，各开 11.25°），相加会让"中点"反而比"贴边"更汹涌，
       与站长的口径冲突 —— 他强调的是「移到最边上就打开到 90°」。
       max 保证涌出强度单调跟着"最大开门角"走，中点最弱、贴边最强。 */
    // 点击牧神后开启的「恢复旧版」模式：门控涌出整体归零，粒子回到 hakim 原版
    // 运动 —— 匀速漂移、离鼠标越近越大（GROW），不再有透视投影与深度推进。
    const follow = heroPointer.follow
    const oL = follow ? 0 : heroPointer.oL
    const oR = follow ? 0 : heroPointer.oR
    const surge = oL > oR ? oL : oR
    const fx = heroPointer.mx
    const fy = heroPointer.my

    /* 消失点（"往前涌"的透视原点）：门开哪边，粒子就从那边涌出来。
       左门开 → 原点贴近左铰链（x≈0）；右门开 → 贴近右铰链（x≈w）；
       两门等开量 → 落在正中。按开启量加权，所以原点会随指针平滑横移，
       不会在"哪边更大"翻转的瞬间跳一下。
       （门是绕左/右铰链转开的，缝就在铰链那一侧，所以原点贴边是对的。） */
    const wsum = oL + oR
    const vx = wsum > 1e-4 ? (oR * w) / wsum : w / 2
    const vy = h / 2

    // surge≈0 时这三项都退化成 1，等价于旧版静态底纹（乘性叠加，无跳变）
    const speedMul = 1 + surge * RUSH
    const sizeMul = 1 + surge * PUFF

    for (const p of parts) {
      if (!p.frozen) {
        // 深度推进：门开得越大、"冲"得越快。dt 已夹到 50ms，切标签页不会瞬移。
        if (surge > 0.001) {
          p.z += surge * p.zv * dt
          if (p.z > 1) p.z -= 1
        }
        const sp = speedMul
        p.x += p.vx * sp * dt
        p.y += p.vy * sp * dt
        if (p.x < 0) {
          p.x = 0
          p.vx = Math.abs(p.vx)
        } else if (p.x > w) {
          p.x = w
          p.vx = -Math.abs(p.vx)
        }
        if (p.y < 0) {
          p.y = 0
          p.vy = Math.abs(p.vy)
        } else if (p.y > h) {
          p.y = h
          p.vy = -Math.abs(p.vy)
        }
      }

      /* 透视投影：离消失点越远，被推得越开 —— 这正是"朝观者冲过来"的视觉线索
         （近大远小 + 向外扩散），比单纯把整场粒子等比放大更像"涌"。
         e 是这颗粒子的涌出量：surge 门控 × 自身深度。 */
      const e = surge * p.z
      const s = 1 + e * ZOOM
      const px = vx + (p.x - vx) * s
      const py = vy + (p.y - vy) * s

      /* 首尾淡入淡出，消掉 z 回绕时的"凭空跳出来"：
         z 从 0 起步时 alpha 从 0 涨起（在门缝处新生），接近 1 时又淡下去
         （已经贴到观者眼前、该退场了）。中段恒为 1，不影响常态底纹。
         FADE 取 0.18：只在两端各 18% 的行程里生效，中间 64% 是全亮的。 */
      const FADE = 0.18
      const edge = Math.min(p.z, 1 - p.z) / FADE
      // 门关着时（surge≈0）不参与淡出 —— 否则 z 冻在两端的那批粒子会永久变暗
      const fade = surge > 0.001 ? Math.max(0, Math.min(1, edge)) : 1

      // grow 保留（点击钉住那类放大仍走它），鼠标跟随的 target 已整体移除
      // hakim 原版的「离鼠标越近越大」：target = max(min(15 - d/10, GROW), 1)。
      // 门控期鼠标不参与（target 恒 1，grow 只会走回 1）；点完牧神才接管。
      // 超出 PAD 缓冲带（mactive=false）等同旧版 pointerleave，全场缩回 1 倍。
      let target = 1
      if (follow && heroPointer.mactive) {
        const dx = p.x - fx
        const dy = p.y - fy
        target = Math.max(Math.min(15 - Math.sqrt(dx * dx + dy * dy) / 10, GROW), 1)
      }
      p.grow += (target - p.grow) * Math.min(1, dt * 7)
      const r = p.r * p.grow * sizeMul * s
      /* alpha：门控期随涌出量略升（e 项）；旧版模式改为随 grow 略加深 ——
         软边精灵把「变大」的视觉冲击削掉了一截（实测鼠标区 alpha 总量只涨 6.9 倍），
         靠这一项把对比补回来。 */
      const growBoost = follow ? 1 + (p.grow - 1) * 0.16 : 1
      ctx.globalAlpha = Math.min(
        1,
        p.a * alphaScale * fade * (1 + e * 0.16) * growBoost
      )
      ctx.drawImage(sprites[p.ci] || sprites[0], px - r, py - r, r * 2, r * 2)
    }
    ctx.globalAlpha = 1
  }

  const loop = (t) => {
    // dt 夹到 50ms：切回标签页时 t 会跳很大，不夹的话粒子会瞬移
    const dt = Math.min((t - last) / 1000, 0.05)
    last = t
    draw(dt)
    raf = requestAnimationFrame(loop)
  }
  const start = () => {
    if (raf !== null) return
    last = performance.now()
    raf = requestAnimationFrame(loop)
  }
  const stop = () => {
    if (raf !== null) cancelAnimationFrame(raf)
    raf = null
  }

  resize()

  // ⚠️ 2026-09-19：原来这里挂了三条鼠标监听（pointermove 放大 / pointerleave 复位 /
  // pointerdown 钉住最近一颗），现已**全部移除**。粒子层不再有任何鼠标输入 ——
  // 它的唯一驱动是 heroPointer（= 开门量），见文件上方 heroPointer 与 draw()。
  // 移除 pointerdown 钉住的另一个原因：canvas 是 pointer-events:none，监听只能挂在
  // .VPHero 上，于是"点 hero 里任何按钮"都会顺手钉住一颗远处的粒子 —— 它从来就不是
  // 一个干净的交互，只是原版 demo 的遗留。真要恢复，得先把它挂到不会和按钮抢事件的地方。
  window.addEventListener('resize', resize)
  document.addEventListener('visibilitychange', () =>
    document.hidden ? stop() : start()
  )
  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), {
    threshold: 0.02,
  }).observe(canvas)
  // 明暗主题切换时重做精灵（--hero-dots 整组换了，精灵里的 rgb 也得跟着换）
  new MutationObserver(() => {
    makeSprites()
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
}

/**
 * 往 .VPHero 追加粒子画布。
 * 坑（踩过）：必须追加为末尾节点——插在最前面会破坏 Vue 子节点对位，内容层会消失。
 */
function ensureHeroParticles() {
  if (document.readyState === 'loading') return false
  const hero = document.querySelector('.VPHero')
  if (!hero) return false // 不在首页：返回 false，让轮询继续等着
  if (hero.querySelector('.hero-field')) return true
  const c = document.createElement('canvas')
  c.className = 'hero-field'
  c.setAttribute('aria-hidden', 'true')
  hero.appendChild(c)
  startHeroParticles(c)
  return true
}

/* 封面照片（门的图案来源）。2000×480，q82 WebP，187KB。
   两张原图（母版，不发布、只存档）：
     _master/zhihu_cover_panel.jpg  271KB —— 本图的 JPG 母版
     _master/zhihu_cover.jpg        1.59MB —— 站长原始整图，从未用于页面
   ⚠️ 两张母版都放在 _master/ 而不是 public/：public/ 下的文件会被 VitePress
      原样拷进 dist，等于把 1.59MB 从未引用的死重发布给每个访客（实测踩过）。 */
const COVER_SRC = '/zhihu_cover_panel.webp'
let coverPreloaded = false

/**
 * 往 .VPHero 追加「封面两扇门」+「纸纱」（纯装饰）。
 *
 * 站长需求（第三版，最终口径）：「一张完整的图片从中间劈开，中间不要留缝隙，
 * 刚进入首页时其实是一张完整的照片。图片不是在两边，而是铺满整个 cover。
 * 然后鼠标移动到哪里，哪扇门就打开，打开的角度大一点，后面的粒子全部都透出来。
 * 鼠标在中间，那就两扇门都打开一点……鼠标移到最边上，就打开到 90°。」
 *
 * 为什么只能用 JS 注入：.VPHero 里没有可用的插槽。唯一能塞自定义内容的
 * home-hero-image 插槽会让 .VPHero 拿到 has-image 类，而 VPHero.vue 里有
 * `.VPHero.has-image .container { text-align: left }` —— 布局立刻变成两栏左对齐，
 * 正好毁掉刚复原的居中排版。所以走 appendChild（与 .hero-field 同一条路）。
 *
 * ⚠️ 必须 appendChild 到**末尾**：Vue 靠子节点顺序定位，插在最前面会破坏对位，
 *    内容层会消失（.hero-field 那个坑，见 ensureHeroParticles 的注释）。
 *    ⚠️ 但"追加在末尾"正是层序的雷：门/纸纱的 DOM 顺序都在 .container 之后，
 *    若 z-index 同级就由顺序决定胜负 —— 见 ㉕ 与 ③ 段（.container 已提到 4）。
 *
 * 追加三块东西，各有各的 z-index（墨彩 0 < 粒子 1 < 门 2 < 纸纱 3 < 文字 4）：
 *   .cover-door--l / .cover-door--r  两扇门，各自内含一张 200% 宽的 <img>
 *   .cover-veil                     纸色柔光，保证文字在任何开门角度可读
 *
 * 为什么门里放真 <img> 而不是 CSS background-image：
 *   要拿到 load 事件，加载完再挂 is-loaded 淡入。照片是这里注入之后才开始下载的，
 *   270KB 落地前若门已经"敞开"，观感是先看见一块空门、再"啪"地跳出整幅照片。
 *   两扇门同 src ⇒ 浏览器只发一次请求，两份解码实例。
 *
 * ⚠️ 开启量不在这里算：由 setupHeroPointer 每帧写 --o-l / --o-r（CSS 默认 0 =
 *    首帧紧闭 = 一张完整照片）。这里只管"把东西摆上去"。
 *
 * 返回 true 表示"该做的都做了"；不在首页时返回 false，让轮询继续等。
 * 幂等：门与纸纱各自判存，任一块缺了就只补那一块。
 */
function ensureHeroCover() {
  if (document.readyState === 'loading') return false
  const hero = document.querySelector('.VPHero')
  if (!hero) return false

  const hasDoors = !!hero.querySelector('.cover-door')
  const hasVeil = !!hero.querySelector('.cover-veil')
  if (hasDoors && hasVeil) return true

  // 先把下载请求发出去，缩短"空门"的时间窗。
  // 与下面两个 <img> 同 URL ⇒ 命中同一份响应，不会重复下载。
  if (!coverPreloaded) {
    coverPreloaded = true
    const warm = new Image()
    warm.decoding = 'async'
    warm.src = COVER_SRC
  }

  if (!hasDoors) {
    for (const side of ['l', 'r']) {
      const door = document.createElement('span')
      door.className = 'cover-door cover-door--' + side
      door.setAttribute('aria-hidden', 'true')
      const img = document.createElement('img')
      img.className = 'cover-door__img'
      img.src = COVER_SRC
      img.alt = ''
      img.decoding = 'async'
      img.draggable = false
      img.setAttribute('aria-hidden', 'true')
      // 缓存命中时 load 可能已经过去（甚至同步完成），再兜一道 complete。
      const mark = () => img.classList.add('is-loaded')
      img.addEventListener('load', mark, { once: true })
      if (img.complete) mark()
      door.appendChild(img)
      hero.appendChild(door)
    }
  }

  if (!hasVeil) {
    const veil = document.createElement('span')
    veil.className = 'cover-veil'
    veil.setAttribute('aria-hidden', 'true')
    hero.appendChild(veil)
  }

  return true
}

/**
 * 把刊名「牧神的笔记」拆成「牧神」+ 右侧栏（三个 BBC 主题色块 +「的笔记」），
 * 好让前两字格外大，同时把 index.md 的 text 段标（投资 · 工业自动化 · 工程实践）
 * 变成刊名右上方三个醒目的实底色块。
 *
 * 结构（不对称双栏）：
 *   .name
 *     .wm-major   牧神（大，左侧）
 *     .wm-tail    ┐ 右栏，inline-flex 列，整列高度撑到与牧神等高
 *       .wm-chip  投资
 *       .wm-chip  工业自动化
 *       .wm-chip  工程实践
 *       .wm-minor 的笔记（栏底）
 *                  ┘
 * 这样「三个色块 + 的笔记」恰好补满牧神旁边的竖直空位（站长要求的"补齐身高差"）。
 *
 * 为什么用 JS 拆、不改 index.md：
 *   hero.name 在 VPHero 里是 `v-html` 渲染的整串，CSS 没有"只选前两个字符"的
 *   手段（::first-letter 只管一个字符）。在 markdown 里塞 <span> 会绕过 v-html、
 *   也会让导航栏那个同名字符串对不上（㉔ 的滚动飞行靠两者文本一致）。
 *   色块文案则来自 .VPHero .text（index.md 的 text 字段），JS 解析它得到三个词，
 *   解析失败回退到固定清单，不依赖任何外部文案形态。
 *
 * ⚠️ 只改结构、文本一字不改：滚动飞行量的是 .VPHero .name **这个元素**的矩形
 *    （见 setupHeroFly），元素还在、class 不变，拆分不影响它。
 * ⚠️ 飞行替身必须**去掉 .wm-chips**（buildGhost 复制前先删掉色块行）：飞行落点是
 *    导航栏里的「牧神的笔记」纯文字，带着三个色块飞过去会既宽又错位。替身只留
 *    .wm-major + .wm-minor（见 custom.css 的 .hero-fly-ghost .wm-* 两条）。
 *    .wm-minor「的笔记」在 .wm-tail 内、要保留，只删色块行。
 *
 * 名字短于 3 字就不拆：那只会在一两个字之间硬造一个字号跳变，比不拆更难看。
 * 返回 true 表示"该做的都做了"；不在首页时返回 false，让轮询继续等。
 */
function ensureHeroWordmark() {
  if (document.readyState === 'loading') return false
  const name = document.querySelector('.VPHero .name')
  if (!name) return false
  if (name.querySelector('.wm-major')) return true
  const raw = (name.textContent || '').trim()
  if (raw.length < 3) return true
  const major = document.createElement('span')
  major.className = 'wm-major'
  major.textContent = raw.slice(0, 2)

  // 右侧栏：三个 BBC 主题色块横排成一行（等宽正方形，文案来自 .text 的
  // 「投资 · 工业自动化 · 工程实践」），「的笔记」在色块下方，整体作为一个
  // 小单元傍在「牧神」右侧。只有「牧神」放大，三个色块与「的笔记」都缩小。
  const tail = document.createElement('span')
  tail.className = 'wm-tail'
  const chips = document.createElement('span')
  chips.className = 'wm-chips'
  for (const label of readHeroChips()) {
    const chip = document.createElement('span')
    chip.className = 'wm-chip'
    chip.textContent = label
    chips.appendChild(chip)
  }
  tail.appendChild(chips)
  const minor = document.createElement('span')
  minor.className = 'wm-minor'
  minor.textContent = raw.slice(2)
  tail.appendChild(minor)

  name.textContent = ''
  name.append(major, tail)
  return true
}

// 从 hero 段标 .text 取三个主题词；解析失败回退到固定清单（不依赖外部文案形态）。
function readHeroChips() {
  const t = document.querySelector('.VPHero .text')
  if (t) {
    const parts = (t.textContent || '')
      .split(/[·•・・｜|]/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.length >= 2) return parts
  }
  return ['投资', '工业自动化', '工程实践']
}

/**
 * 点击「牧神」→ 两扇门像彩带一样裂开消失，随后粒子切回「跟随鼠标」模式。
 *
 * 实现要点：
 *  - 每扇门被切成 N 条竖向彩带（.ribbon），每条用 background 把整幅封面按
 *    「本扇门显示的横向区间」切片还原 —— 背景尺寸 = hero 整宽×整高，
 *    background-position-x = -(本扇门左缘在封面里的横坐标 + 第 i 条左缘)，
 *    于是每条彩带显示的正是门关着时那一条位置的画面，对齐无缝。
 *  - 门本体在 .dissolving 下瞬间摊平（transform:none）+ overflow:visible，
 *    彩带继承门的坐标系、从平的门上裂开飞走，不会跟着 3D 旋转错位。
 *  - 每条彩带终态：向外平移 + 轻微旋转 + scaleX→0.05（收成一条细带），
 *    transition-delay 按 i 递增 → 由铰链向自由边依次裂开，像被撕开的彩带。
 *  - 动画结束（超时兜底）后 display:none 真门与纸纱，置 heroPointer.follow=true 交棒。
 *
 * 幂等：.wm-major 只绑一次（data-ribbon-bound）；门已消失则二次点击无事发生。
 * prefers-reduced-motion：跳过彩带，直接隐藏门并开启 follow（粒子层本身不跑动画）。
 */
function onRibbonClick() {
  const hero = document.querySelector('.VPHero')
  if (!hero) return
  const doors = hero.querySelectorAll('.cover-door')
  if (!doors.length) return

  // 粒子运动**立刻**切换到旧版跟随，不等彩带散完 —— 站长原话「门一倒下就改过来」
  heroPointer.follow = true

  const r = hero.getBoundingClientRect()
  const W = r.width
  const dh = r.height
  const N = 14 // 每扇门彩带条数

  const finish = () => {
    doors.forEach((d) => (d.style.display = 'none'))
    const veil = hero.querySelector('.cover-veil')
    if (veil) veil.style.display = 'none'
    heroPointer.follow = true
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finish()
    return
  }

  let pending = doors.length
  doors.forEach((door) => {
    const isLeft = door.classList.contains('cover-door--l')
    const baseX = isLeft ? 0 : W / 2 // 本扇门在「整幅封面」里的左缘横坐标
    const dw = W / 2
    const sw = dw / N
    const img = door.querySelector('.cover-door__img')
    if (img) img.style.opacity = '0'
    for (let i = 0; i < N; i++) {
      const strip = document.createElement('span')
      strip.className = 'ribbon'
      strip.style.left = i * sw + 'px'
      strip.style.width = sw + 'px'
      strip.style.backgroundImage = 'url("' + COVER_SRC + '")'
      strip.style.backgroundSize = W + 'px ' + dh + 'px'
      // 整幅封面按 W×dh 缩放铺开，取负位移露出本扇门第 i 条位置的画面
      strip.style.backgroundPosition = '-' + (baseX + i * sw) + 'px 0'
      const dir = isLeft ? -1 : 1
      const rx = dir * (sw * (1.0 + i * 0.45)) // 距铰链越远飘得越远
      const ry = (i % 2 ? -1 : 1) * (6 + Math.random() * 24)
      const rr = dir * (16 + Math.random() * 38)
      strip.style.setProperty('--rx', rx + 'px')
      strip.style.setProperty('--ry', ry + 'px')
      strip.style.setProperty('--rr', rr + 'deg')
      strip.style.transitionDelay = i * 0.022 + 's' // 由铰链向自由边依次裂开
      door.appendChild(strip)
    }
    // 强制回流：确保彩带先以「平铺」初态渲染，再加 .dissolving 才会产生过渡
    void door.offsetWidth
    door.classList.add('dissolving')
    // transition 总时长 ≈ 0.95s + 最大 delay(N*0.022)；超时兜底收尾
    setTimeout(() => {
      door.style.display = 'none'
      if (--pending <= 0) finish()
    }, 1000 + N * 22)
  })
}

/** 幂等地把点击监听绑到「牧神」二字上（刊名存在即绑，已绑则跳过）。 */
function ensureHeroRibbon() {
  if (document.readyState === 'loading') return false
  const major = document.querySelector('.VPHero .name .wm-major')
  if (!major) return false
  if (major.dataset.ribbonBound) return true
  major.dataset.ribbonBound = '1'
  major.style.cursor = 'pointer'
  major.title = '点击：门如彩带般散开'
  // 审计 major①：可点击元素必须键盘可达 —— span 升格为按钮语义，
  // 否则触屏/键盘/读屏用户完全无门路（彩带特效对他们等于不存在）。
  major.setAttribute('role', 'button')
  major.tabIndex = 0
  major.setAttribute('aria-label', '牧神的笔记：点击后封面两门如彩带散开')
  major.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onRibbonClick()
    }
  })
  major.addEventListener('click', onRibbonClick)
  return true
}

/**
 * 顶部滚动进度条：细线随阅读进度从左往右生长。
 * 用 transform:scaleX 而非 width，避免触发布局重排。
 */
function setupScrollProgress() {
  if (typeof window === 'undefined') return
  const bar = document.createElement('div')
  bar.className = 'scroll-progress'
  bar.setAttribute('aria-hidden', 'true')
  document.body.appendChild(bar)
  let raf = null
  const update = () => {
    raf = null
    const h = document.documentElement
    const max = h.scrollHeight - h.clientHeight
    const p = max > 0 ? Math.min(window.scrollY / max, 1) : 0
    bar.style.transform = `scaleX(${p.toFixed(4)})`
  }
  const onScroll = () => {
    if (raf === null) raf = requestAnimationFrame(update)
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  update()
}

/**
 * 导航栏滚动态：滚过阈值后加 is-scrolled，触发毛玻璃 + 细分隔线。
 * 只切 class，不碰 DOM 结构。
 */
function setupNavState() {
  if (typeof window === 'undefined') return
  let raf = null
  const update = () => {
    raf = null
    const nav = document.querySelector('.VPNav')
    if (!nav) return
    const y = window.scrollY || window.pageYOffset || 0

    /* ── 导航线（is-scrolled 的 border-bottom）什么时候才允许亮？ ──────────
     ⚠️⚠️ 阈值不能是写死的 `y > 8`。这是站长 2026-10-01 抓到的视觉缺陷：
        「在那根黑线飞到顶栏底部的位置之前，顶栏底部的线已经出现了」。
        根因：`is-scrolled` 在 y>8 就亮（几乎是刚开始滚），而此刻刊头黑线的
        替身**还在 127px 处往上飘**（要到 y≈251 才追上导航底 64px）。
        ⇒ y ∈ (9, 251) 这 240px 里同屏两条线：
            127px 处的近黑线 + 64px 处的浅灰线，垂直差最大 63px。
        这是**部分遮挡**，不是叠成一条 —— 所以「让替身盖住导航线」这个
        原假设不成立：替身在页面流里比导航线低 63px，根本盖不住它，
        两条都露着。原先的补救是飞行期间用 `!important` 把导航线压成
        transparent（custom.css 的 fm-rule-flying），那属于"藏"而非"接"。

    ✅ 正确判据（经三轮校正，最终结论）：让导航线等到**替身飞完全程**那一刻再亮。
        站长 2026-10-01 第二次校正的原话：
          「我想顶栏底线先别出现，让我的这条线飞到位，顶栏底线再出现」

        · 第一轮取 t* 的位置解（t*=0.8368 → y≈251，替身位置追到导航底）
          —— 被否。位置到位 ≠ 飞完。
        · 第二轮取 0.875（y≈262，位置与颜色双双对齐）—— 仍被否。
          数值上确实"双双对齐"了，但站长判断"飞到位没有"的依据是
          **线的存在感/透明度**，不是像素坐标：t=0.875 之后替身还要继续
          飞到 t=1，且它的 α 从 t=0.88 起就在往下掉（1.0 → 0）。
          他看到的正是「黑线还在半路变淡，顶栏底线已经冒出来了」。
        · 第三轮取 **t=1（y=300，= TRIGGER）** —— 站长认可。
          替身完整、不透明地走完全部行程，导航线在它飞完那一刻才出现。

    ⚠️⚠️ 配套：index.mjs 的 setupHeroFly 里替身的**淡出已彻底删除**
       （原 ruleOut 在 t∈[0.88,1] 让 α 1→0）。实测证明淡出会让导航底边
       那一像素在最后一刻被稀释成纸底色，然后导航线突然显形 ——
       帧间亮度跳变 18.0，肉眼可见"闪一下"。改成全程 α=1 + 换手交接后，
       t=1 时替身与导航线同位同色同宽，撤替身与亮导航线同帧画一样的像素
       ⇒ 跳变 0.0（截图像素级验证：y=299 与 y=300 帧逐位相同）。
       详见 index.mjs 交棒段与 custom.css 的 :root 说明。

    ⚠️ 阈值来自 CSS 变量 `--fm-fly-handoff-y`（在 .vitepress/theme/custom.css
       的 :root 里定义，**= TRIGGER**），**唯一真源**，不在这里写魔数：
       TRIGGER 是可调的，写死会让它一改就失效；而 CSS 变量既能被这个
       scroll 处理器读到，又能被 setupHeroFly 共用，两边永不失配。

    ⚠️ 非首页 / 窄屏必须退回 `y > 8`：那些页没有飞行、没有替身，
       导航线就是唯一的线，早亮才对（页面滚起来才有毛玻璃 + 分隔线）。
       判据：页面里存不存在刊头 `.fm-masthead` 且它在宽屏可见。 */
    const mast = document.querySelector('.fm-masthead')
    const hasFly = !!mast && window.matchMedia('(min-width: 960px)').matches
    let threshold = 8
    if (hasFly) {
      const v = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--fm-fly-handoff-y')
      )
      if (isFinite(v) && v > 0) threshold = v
    }
    // ⚠️ 带滞回：亮在 threshold，灭在 threshold − 40。
    //    不加滞回的话，用户在交接点附近来回滚，线会一闪一闪。
    const wasOn = nav.classList.contains('is-scrolled')
    const on = wasOn ? y > threshold - 40 : y > threshold
    nav.classList.toggle('is-scrolled', on)
  }
  const onScroll = () => {
    if (raf === null) raf = requestAnimationFrame(update)
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  update()
}

/**
 * 回到顶部按钮 + 阅读进度环：右下角浮钮，圆环随进度画满。
 * prefers-reduced-motion 时降级为瞬间跳转（无平滑滚动）。
 */
function setupBackToTop() {
  if (typeof window === 'undefined') return
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const btn = document.createElement('button')
  btn.className = 'to-top'
  btn.type = 'button'
  btn.setAttribute('aria-label', '回到顶部')
  btn.innerHTML =
    '<svg class="tt-ring" viewBox="0 0 44 44" aria-hidden="true">' +
    '<circle class="tt-track" cx="22" cy="22" r="19"/>' +
    '<circle class="tt-fill" cx="22" cy="22" r="19"/></svg>' +
    '<svg class="tt-arrow" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M12 19V5M5 12l7-7 7 7"/></svg>'
  document.body.appendChild(btn)
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' })
  })
  const C = 2 * Math.PI * 19
  const fill = btn.querySelector('.tt-fill')
  fill.style.strokeDasharray = String(C)
  let raf = null
  const update = () => {
    raf = null
    const h = document.documentElement
    const max = h.scrollHeight - h.clientHeight
    const p = max > 0 ? Math.min(window.scrollY / max, 1) : 0
    fill.style.strokeDashoffset = String(C * (1 - p))
    btn.classList.toggle('visible', window.scrollY > 400)
  }
  const onScroll = () => {
    if (raf === null) raf = requestAnimationFrame(update)
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
  update()
}

/**
 * 【已回撤 · 2026-09-12】正文动效三件套：引用块竖线画入 / 表格逐行错峰显入 / 首字下沉。
 *
 * 全部实测后删除，原因逐条记录，避免以后有人（包括 AI）再捡回来：
 * - 首字下沉：`::first-letter` 无法可靠处理中文排版。全站 39 篇里只有 29 篇首段
 *   以中文字开头，另 10 篇是「1966年…」（只会放大数字 1）或「“打江山…”」（引号被
 *   吞进下沉字）。为这 10 篇另写规则会让下沉字出现在文章中间，反而更怪。
 *   结果是「同一套模板，有的文章有下沉、有的没有」—— 不一致本身就是缺陷。
 * - 引用块竖线画入：站点里量最大的是行内小引用，2px 竖线 0.5s 划入在视觉上
 *   无法感知；用户原话「我怎么没看到效果」。
 * - 表格逐行错峰显入：原以为该文有 25 行大表，实测 tableCount=5，全是 3~4 行小表 ——
 *   错峰步进 45ms × 3 行 = 135ms，等同于没有。
 *
 * 教训：动效必须同时满足「可感知」「有用途」「全站一致」，只满足「技术上能跑通」
 * 是不够的。判断可感知性要用像素 / 时长去量，不能靠猜。
 *
 * 保留的是 View Transitions 切页过渡（见下方 setupViewTransitions）—— 用户实测
 * 唯一的正面反馈就是它。下面这段保险机制在这个项目里仍有参考价值：
 * JS 先加类再藏内容（has-* 门控），保证 SSR / 无 JS / 降级三种情况都没有隐形内容。
 */

/**
 * 正文选区聚光（Fokus 思路，hakim，2026-09-12）
 *
 * 在选中正文文字时，用一层全屏 canvas 把其余部分压暗，只把选区「挖」亮出来，
 * 像一束聚光灯打在引文上。选完自动淡出、canvas 从 DOM 里摘掉。
 *
 * 与 hakim 原版（lab.hakim.se/fokus）的三处不同，都是有意为之：
 * 1. **颜色**：原版是 rgba(0,0,0,0.75)。本站是米白纸底，纯黑压下来会发灰、很脏，
 *    所以换成暖墨色 rgba(20,15,10) 且降到 0.55 —— 是「暗下来」而不是「涂黑」。
 * 2. **柔边**：原版用 clearRect 挖硬边矩形，近看很生硬。这里改成
 *    destination-out + filter: blur(7px)，挖口是羽化的，才是聚光灯而不是补丁。
 * 3. **坐标**：原版靠遍历节点链累计 offsetLeft/offsetTop 算文档坐标（2012 年的写法，
 *    今天容易算歪）。这里直接用 Range.getBoundingClientRect() —— 它本来就返回
 *    整段选区的并集矩形，视口坐标，不用自己减 scroll。
 *
 * 触屏设备直接不启用：那儿没有「按住拖选」这个手势，装了也只是碍事。
 * 只在 .vp-doc 正文内触发 —— 在导航条、页脚里选中文字不该把整页压暗。
 *
 * 返回 reset()，由 enhanceApp 在切页后调用（否则旧选区会留在新页上）。
 */
function setupSelectionSpotlight() {
  const noop = () => {}
  if (typeof window === 'undefined' || typeof document === 'undefined') return noop
  if (!window.getSelection) return noop
  if (window.matchMedia('(pointer: coarse)').matches) return noop

  const canvas = document.createElement('canvas')
  if (!canvas.getContext || !canvas.getContext('2d')) return noop

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const MAX = 0.55 // 遮罩最大不透明度（原版 0.75，米白纸上太狠）
  const PAD = 8 // 选区四周留出的余量（px）
  const SCRIM = '20, 15, 10' // 暖墨
  const EASE = reduce ? 1 : 0.12

  let cv = null
  let ctx = null
  let raf = null
  let cur = 0
  let target = 0
  let box = null

  const stop = () => {
    if (raf !== null) {
      cancelAnimationFrame(raf)
      raf = null
    }
  }

  const destroy = () => {
    stop()
    if (cv && cv.parentNode) cv.parentNode.removeChild(cv)
    cv = null
    ctx = null
    box = null
  }

  const resize = () => {
    if (!cv) return
    const w = window.innerWidth
    const h = window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    cv.style.width = w + 'px'
    cv.style.height = h + 'px'
    cv.width = Math.round(w * dpr)
    cv.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const ensure = () => {
    if (cv) return
    cv = document.createElement('canvas')
    cv.className = 'selection-spotlight'
    cv.setAttribute('aria-hidden', 'true')
    ctx = cv.getContext('2d')
    document.body.appendChild(cv)
    resize()
  }

  const draw = () => {
    if (!cv || !ctx) return
    const w = window.innerWidth
    const h = window.innerHeight
    ctx.clearRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'source-over'
    ctx.filter = 'none'
    ctx.fillStyle = 'rgba(' + SCRIM + ', ' + cur.toFixed(3) + ')'
    ctx.fillRect(0, 0, w, h)
    if (box) {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.filter = 'blur(7px)'
      ctx.fillStyle = '#000'
      ctx.fillRect(box.left - PAD, box.top - PAD, box.width + PAD * 2, box.height + PAD * 2)
      ctx.globalCompositeOperation = 'source-over'
      ctx.filter = 'none'
    }
  }

  const tick = () => {
    raf = null
    const d = target - cur
    if (Math.abs(d) < 0.004) cur = target
    else cur += d * EASE
    if (target === 0 && cur <= 0.004) {
      cur = 0
      destroy()
      return
    }
    draw()
    raf = requestAnimationFrame(tick)
  }

  const start = () => {
    if (raf === null) raf = requestAnimationFrame(tick)
  }

  const measure = () => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      target = 0
      start()
      return
    }
    let range = null
    let el = null
    try {
      range = sel.getRangeAt(0)
      const node = range.commonAncestorContainer
      el = node && node.nodeType === 1 ? node : node && node.parentElement
    } catch (e) {
      target = 0
      start()
      return
    }
    // 只在正文里生效
    if (!el || !el.closest || !el.closest('.vp-doc')) {
      target = 0
      start()
      return
    }
    let r = null
    try {
      r = range.getBoundingClientRect()
    } catch (e) {
      target = 0
      start()
      return
    }
    if (!r || (r.width < 4 && r.height < 4)) {
      target = 0
      start()
      return
    }
    box = { left: r.left, top: r.top, width: r.width, height: r.height }
    target = MAX
    ensure()
    start()
  }

  // 拖选：按下 → 跟着 mousemove 实时长大（这是 Fokus 的招牌观感）→ 松手落定
  const onMove = () => measure()
  const onUp = () => {
    document.removeEventListener('mousemove', onMove, true)
    document.removeEventListener('mouseup', onUp, true)
    window.setTimeout(measure, 0)
  }
  const onDown = (e) => {
    if (e.button !== 0) return
    document.addEventListener('mousemove', onMove, true)
    document.addEventListener('mouseup', onUp, true)
  }
  // 键盘选区（Shift+方向键）、双击选词、Ctrl+A 都靠这两个兜住
  const onKeyUp = () => measure()
  const onSelChange = () => measure()
  const onResize = () => {
    resize()
    measure()
  }
  const onScroll = () => {
    if (target > 0) measure()
  }

  document.addEventListener('mousedown', onDown, true)
  document.addEventListener('keyup', onKeyUp, true)
  document.addEventListener('selectionchange', onSelChange)
  window.addEventListener('resize', onResize)
  window.addEventListener('scroll', onScroll, { passive: true })

  return () => {
    const sel = window.getSelection()
    if (sel && sel.removeAllRanges) sel.removeAllRanges()
    target = 0
    start()
  }
}

/**
 * 页面切换过渡（View Transitions API）。
 *
 * 思路：取消 VitePress 这次导航，改用 startViewTransition 包住 router.go(to)，
 * 让 DOM 更新发生在 update 回调里 —— 浏览器才能「拍旧帧 → 等回调 → 拍新帧 → 补间」。
 * 列表页被点的标题会以 vt-title 飞到文章大标题的位置（共享元素），其余部分交叉淡入。
 * 2026-09-12 追加方向感（Kontext 思路）：进文章时旧页向左退、新页从右进，返回时反向，
 * 同层级横跳仍走交叉淡入。方向只是 <html> 上的一个类，动画全在 custom.css 里。
 *
 * 已核对 vitepress 1.6.4 源码后确认的运行时事实（别凭印象改）：
 * - `onBeforeRouteChange` 只在 router.go() 里被调用，返回 false 会**直接 return**，
 *   既不 pushState 也不 loadPage → 取消之后必须自己把 go() 补上。
 * - popstate（浏览器前进/后退）**不经过** onBeforeRouteChange，是直接 loadPage，
 *   所以这里不会破坏后退语义；代价是前进后退没有过渡，属可接受降级。
 * - `onAfterRouteChange` 是单值属性，本函数不碰它（由 enhanceApp 单独持有）。
 *
 * 降级：不支持该 API（如 Firefox）、或 prefers-reduced-motion 时完全不介入，退化为硬切。
 */
function setupViewTransitions(router) {
  if (typeof window === 'undefined' || !router) return
  if (typeof document.startViewTransition !== 'function') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const path = (u) => {
    try {
      return new URL(u, window.location.href).pathname
    } catch (e) {
      return String(u)
    }
  }

  // view-transition-name 用完必须撤：下一次导航时新旧两帧里出现同名元素，
  // 整段过渡会被浏览器直接跳过（这是最容易被忽略的坑）。
  const clearTitle = () => {
    document.querySelectorAll('[style*="view-transition-name"]').forEach((el) => {
      el.style.removeProperty('view-transition-name')
    })
  }

  // ---------- 方向感（Kontext 思路，2026-09-12 加；09-13 改语义判定）----------
  // ⚠️ 判定必须看「内容是什么」，不能看「URL 有几层」。
  // 上一版是 `depth = 路径段数`，`/` 算 0 层、`/tags` 算 1 层，于是：
  //   首页(0) → 标签页(1)  被当成「前进」，滑动
  //   归档页(1) → 标签页(1) 被当成「横跳」，不滑
  // 同一个标签页，从不同地方点进去表现不一样 —— 读者只看到
  // 「有时候能看到滑动进入的效果，有时候看不到，不知道为啥」。
  // 现在只剩两句话，任何入口进来都一致：
  //   目标是文章 → 从右侧滑入（前进）；从文章出去 → 向右侧滑走（后退）；
  //   其余（栏目与栏目之间横跳）→ 不加位移，退回交叉淡入。
  // 「栏目之间横跳硬塞一个方向」是在撒谎，看的人会觉得页面走错了方向。
  // ⚠️ 用 `/^\/posts\/.+/` 而非 `startsWith('/posts/')`：归档页 posts/index.md
  // 的 URL 就是 `/posts/`，用前缀判断会把「全部文章」列表页误判成文章。
  // 这个谓词与 ViewCount.vue 里判断「要不要显示阅读次数」用的是同一个，必须一致。
  const IS_POST = /^\/posts\/.+/
  const dirTo = (from, to) => {
    if (IS_POST.test(to)) return 'fwd'
    if (IS_POST.test(from)) return 'back'
    return 'none'
  }

  // 方向只写在 <html> 的两个类上，CSS 用 `html.vt-fwd::view-transition-old(root)`
  // 这样的 class 前缀去选伪元素。该写法已在 headless Edge 实测有效
  // （见 _blog-probe/vt_probe.py：probeCls(::view-transition-old(root)) 确实出现在
  // document.getAnimations() 里），不是凭印象写的。
  const setDir = (dir) => {
    const cl = document.documentElement.classList
    cl.toggle('vt-fwd', dir === 'fwd')
    cl.toggle('vt-back', dir === 'back')
  }
  const clearDir = () => {
    document.documentElement.classList.remove('vt-fwd', 'vt-back')
  }

  // 同一时刻只允许一个「待接管」的导航；我们自己发起的那次 go 会被放行。
  let pending = null

  // 用户「实际点中的那个链接」。
  // ⚠️ /tags 页上同一篇文章会同时出现两处：上面分类区的 .idx-list a 和
  // 下面标签结果区的 .tr-list a。querySelectorAll 按文档序返回，find() 会抓到
  // 分类区那个（可能在视口外很远）—— 神奇移动从一个你没看着的位置起飞，
  // 看起来就像「没有神奇移动」。系列总览页同理只有一处，但之前干脆没被覆盖。
  // 捕获阶段先于 VitePress 的委托监听执行，路由钩子触发时 clickedLink 已经是它。
  // 注意：这里的 getBoundingClientRect 只用来「判断哪个元素在视口内」，
  // 不是手搓 FLIP 动画 —— 动画本身仍完全交给原生 View Transitions。
  let clickedLink = null
  document.addEventListener(
    'click',
    (e) => {
      clickedLink = (e.target && e.target.closest && e.target.closest('a')) || null
    },
    true
  )

  // 神奇移动的源选择器：被点的标题会以 vt-title 飞到文章页大标题。
  // 新增文章入口链接时，必须把它的选择器补进这一行，否则点了不 morph。
  const TITLE_SOURCES =
    '.post-title, .archive-title, .idx-list a, .idx-tagrow a, .fm-title, .tr-list a, .ser-list a, .series-nav a, .series-pager a'
  const inViewport = (a) => {
    try {
      const r = a.getBoundingClientRect()
      return (
        r.width > 0 &&
        r.height > 0 &&
        r.bottom > 0 &&
        r.top < window.innerHeight &&
        r.right > 0 &&
        r.left < window.innerWidth
      )
    } catch (e) {
      return false
    }
  }

  router.onBeforeRouteChange = (to) => {
    if (pending !== null && path(pending) === path(to)) {
      pending = null
      return // 放行：这次才是真正执行的导航
    }
    // 同页（只变 hash / query）交给 VitePress 自己处理，不介入
    if (path(to) === window.location.pathname) return

    clearTitle()

    setDir(dirTo(window.location.pathname, path(to)))
    // 源元素优先级：你点中的那个 > 视口内的第一个 > 文档序第一个。
    // 只改「从哪儿起飞」，动画仍由原生 View Transitions 补间。
    const candidates = Array.from(document.querySelectorAll(TITLE_SOURCES)).filter(
      (a) => a.href && path(a.href) === path(to)
    )
    const src =
      candidates.find((a) => a === clickedLink) ||
      candidates.find(inViewport) ||
      candidates[0]
    if (src) src.style.setProperty('view-transition-name', 'vt-title')

    pending = to
    let vt = null
    try {
      vt = document.startViewTransition(async () => {
        await router.go(to)
        // ⚠️ 这里**绝对不能** await requestAnimationFrame ——
        // View Transition 的 update 回调期间浏览器抑制渲染，rAF 不会触发，
        // 回调会一直挂到超时，然后整段过渡报
        // 「TimeoutError: Transition was aborted because of timeout in DOM update」。
        // 正确做法：等新页的 h1 真的出现在 DOM 里（MutationObserver 是微任务级，
        // 比 rAF 快且不受抑制影响），拿不到就在 400ms 后放弃 morph。
        await new Promise((resolve) => {
          const nameIt = () => {
            const h1 = document.querySelector('.vp-doc h1')
            if (!h1) return false
            if (src) h1.style.setProperty('view-transition-name', 'vt-title')
            resolve()
            return true
          }
          if (nameIt()) return
          const mo = new MutationObserver(() => {
            if (nameIt()) mo.disconnect()
          })
          mo.observe(document.body, { childList: true, subtree: true })
          window.setTimeout(() => {
            mo.disconnect()
            resolve()
          }, 400)
        })
      })
    } catch (e) {
      // 过渡创建失败也要把导航做掉，否则点击等于「点了没反应」
      pending = null
      clearTitle()
      clearDir()
      router.go(to)
      return false
    }

    // 三个 promise 都挂上拒绝处理：过渡被跳过（例如后台标签页 / 无可见变化）时
    // finished 会以 AbortError 拒绝，不接住就会冒成 unhandledrejection。
    if (vt.ready && vt.ready.catch) vt.ready.catch(() => {})
    if (vt.updateCallbackDone && vt.updateCallbackDone.catch) vt.updateCallbackDone.catch(() => {})
    vt.finished
      .catch(() => {})
      .then(() => {
        clearTitle()
        clearDir()
        if (pending === to) pending = null
      })

    // 安全阀：万一 update 回调压根没执行，URL 又没变，1.2s 后补一次导航。
    // 用 pending === to 判定「还没被消费」，避免把用户后来的新导航劫持回来。
    window.setTimeout(() => {
      if (pending !== to) return
      pending = null
      if (path(window.location.href) === path(to)) return
      clearTitle()
      clearDir()
      router.go(to)
    }, 1200)

    return false // 取消本次导航，改由上面那次 router.go 发起
  }
}

/**
 * Hero 指针：鼠标驱动的（a）文字立体倾斜 + 彩色错版阴影、（b）封面两扇门开合。
 * 几何与配色全在 custom.css ㉔ / ㉕ 段，这边只负责一件事 —— **指针在哪**。
 *
 * 站长原话：「不要太枯燥……鼠标移动上面去的时候出现相应角度，不同颜色的阴影」，
 * 以及「鼠标移动到哪里，哪扇门就打开……鼠标移到最边上，就打开到 90°」。
 *
 * 两组变量，同一个指针源、同一条 lerp 曲线：
 *   --mx / --my   指针相对 hero **中心**的归一化位置（-1..1）→ 文字倾斜与错版
 *   --o-l / --o-r 指针相对左/右**铰链**的接近度（0..1）    → 门开启量
 * 两者在边缘处并不等价（--mx 被 clamp 到 ±1 会丢信息），所以分开算、不互相派生。
 *
 * 为什么必须 lerp（每帧只向目标插值 0.12）而不是把指针位置直写进去：
 *   原始指针值又碎又抖，直写会有「手一抖、字就抖」的廉价感。插值带来一点惯性与
 *   回弹，手感的高级感就来自这里。收敛到阈值内自动停掉 rAF，不常驻占帧。
 * —— 也正因如此，CSS 侧**不能**再加 transition：两次缓动叠加会发黏，像在拖。
 *   门也共用同一个 EASE：门那么大一块，若给它单独的缓动，门和字的动作会错开，
 *   读起来是"两个系统"，而不是"同一个指针在推整幅画面"。
 *
 * 只在「精确指针 + 可悬停」的设备上启用：触屏没有 hover 语义，倾斜只会变成
 * 跟着点击乱错位。prefers-reduced-motion 也直接跳过（变量保持 0：字是平的、
 * 门是紧闭的 —— 关着就是一张完整照片，正好是最稳的静态态）。
 *
 * 与滚动飞行的关系：飞行期间原刊名隐身、由 body 上的替身出面，而替身不读这两个
 * 变量（永远笔直），所以倾斜不会污染落点；飞行那侧还会把原刊名的 inline
 * transform 钉成 none，保证量到的是**未倾斜**的布局盒。见 setupHeroFly。
 */
function setupHeroPointer() {
  const noop = () => {}
  if (typeof window === 'undefined') return noop
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return noop
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return noop

  const hero = () => document.querySelector('.VPHero')
  const GAIN = 1.35 // 归一化增益：指针走到约七成宽处即到满幅，不必顶到屏幕边缘才有反应
  /* 门的开启曲线指数。pow 3 把行程压向**外侧三分之一**，落点：
       边 nx=0/1  → 1.000 = 90°    ← 站长指定「移到最边上打开到 90°」
       1/4 处     → 0.422 = 38°
       中点       → 0.125 = 11.25° ← 站长指定「鼠标在中间，两扇门都打开一点」
     若用线性映射，中点直接是 0.5 = 45°，那是「开了一半」，不是「一点」。
     指数越大越像"平时关着、贴到边缘才猛地打开"，这正是要的手感。 */
  const DOOR_POW = 3
  const EASE = 0.12 // 每帧向目标插值的比例
  const STILL = 0.0015 // 收敛阈值（0.0015 × 90° = 0.135°，看不出最后一跳）
  let raf = null
  let tx = 0 // 目标值（-1..1）
  let ty = 0
  let cx = 0 // 当前值（lerp 之后真正写进 CSS 变量的那个）
  let cy = 0
  let toL = 0 // 门开启量的目标值（0..1）
  let toR = 0
  let coL = 0 // 门开启量的当前值
  let coR = 0

  const write = () => {
    const h = hero()
    if (!h) return
    h.style.setProperty('--mx', cx.toFixed(4))
    h.style.setProperty('--my', cy.toFixed(4))
    h.style.setProperty('--o-l', coL.toFixed(4))
    h.style.setProperty('--o-r', coR.toFixed(4))
    // 同一份 lerp 后的开门量，广播给粒子引擎（它据此决定"涌出"强度）。
    // ⚠️ 走这个共享对象、而不是让粒子去读 --o-l/--o-r：后者是每帧一次
    // getComputedStyle 强制同步样式计算。详见文件上方 heroPointer 的说明。
    heroPointer.oL = coL
    heroPointer.oR = coR
  }

  const tick = () => {
    cx += (tx - cx) * EASE
    cy += (ty - cy) * EASE
    coL += (toL - coL) * EASE
    coR += (toR - coR) * EASE
    // 收敛就停：阈值既保证「停得掉」，又小到看不出最后一跳。
    // 四个量都收住才停 —— 只盯文字的话，门还在动就把 rAF 掐了。
    if (
      Math.abs(tx - cx) < STILL && Math.abs(ty - cy) < STILL &&
      Math.abs(toL - coL) < STILL && Math.abs(toR - coR) < STILL
    ) {
      cx = tx
      cy = ty
      coL = toL
      coR = toR
      write()
      raf = null
      return
    }
    write()
    raf = requestAnimationFrame(tick)
  }

  const start = () => {
    if (raf === null) raf = requestAnimationFrame(tick)
  }

  // 归零 = 字放平 + 两扇门关回去（门一关就重新盖住粒子，回到"一张完整照片"）
  const release = () => {
    tx = 0
    ty = 0
    toL = 0
    toR = 0
    // 指针算作"离开 hero"：旧版粒子对鼠标的放大效应同步失效（grow 自己走回 1）
    heroPointer.mactive = false
    start()
  }

  // 出界回落：指针跑到 hero 区域之外（外扩 PAD 作缓冲）就不再跟随，字自己走回平放。
  // 没有这道闸的话，监听挂在 window 上，鼠标移到 hero 下方的文章列表、或上方导航栏
  // 时，刊名仍在背景里跟着指针歪 —— 语义上就成了「全页跟鼠标」，不是「移上去才有反应」。
  const PAD = 80
  const onMove = (e) => {
    const h = hero()
    if (!h) {
      // 不在首页（文章/归档页没有 hero）：把字放平，免得带着上一页的值回来
      release()
      return
    }
    const r = h.getBoundingClientRect()
    if (!r.width || !r.height) return
    // follow 模式（点击牧神后开启）：实时把指针映射成 hero 局部坐标广播给粒子引擎。
    // 放在出界闸门之前 —— 只要 hero 还在 DOM，指针坐标就持续刷新，粒子不会卡死。
    heroPointer.mx = e.clientX - r.left
    heroPointer.my = e.clientY - r.top
    if (
      e.clientX < r.left - PAD || e.clientX > r.right + PAD ||
      e.clientY < r.top - PAD || e.clientY > r.bottom + PAD
    ) {
      release()
      return
    }
    tx = Math.max(-1, Math.min(1, ((e.clientX - (r.left + r.width / 2)) / (r.width / 2)) * GAIN))
    ty = Math.max(-1, Math.min(1, ((e.clientY - (r.top + r.height / 2)) / (r.height / 2)) * GAIN))
    // 指针确认在 hero 缓冲带内：旧版粒子的鼠标放大效应在此生效
    heroPointer.mactive = true
    /* 门的开启量：用**整幅 hero 的归一化横坐标**，不加 GAIN。
       GAIN 是给文字准备的"走到七成宽就到满幅"；门要的是站长那句
       「鼠标移到最边上，就打开到 90°」—— 归一化才是它的字面意思。
       左门看"离左铰链多近"、右门看"离右铰链多近"，两侧互不干扰，
       所以鼠标贴在左边时右门是**完全关上**的（0），不是"开一点"。 */
    const nx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
    toL = Math.pow(1 - nx, DOOR_POW)
    toR = Math.pow(nx, DOOR_POW)
    start()
  }

  // 指针移出窗口不会再有 mousemove，靠 relatedTarget 为空判定离开
  const onOut = (e) => {
    if (!e.relatedTarget) release()
  }

  window.addEventListener('mousemove', onMove, { passive: true })
  window.addEventListener('mouseout', onOut)
  window.addEventListener('blur', release)
  window.addEventListener('resize', release)

  // 切页只**归位**、不解绑：监听挂在 window 上、跟着 app 存活一辈子，
  // 解绑会让首页第二次进来就再也没有倾斜。新页的 hero 应当从平的状态起步
  // —— 门也一样，从"紧闭 = 一张完整照片"起步，而不是带着上一页的开合度。
  return () => {
    tx = 0
    ty = 0
    toL = 0
    toR = 0
    cx = 0
    cy = 0
    coL = 0
    coR = 0
    write()
  }
}

/**
 * Hero 刊名 → 导航栏站名的「神奇移动」（滚动驱动）。
 *
 * 与本站文章点击的 vt-title 是**同一种**魔法移动（同一元素从 A 位形变到 B 位），
 * 只是触发条件不同：
 *   - 文章点击：离散的一次导航 → 交给 View Transitions（拍新旧两帧、浏览器补间）。
 *   - 滚动：连续过程，View Transitions 不适用 → 用 FLIP 思路每帧实时
 *     「测首末矩形 → invert → play」，把刊名的 translate/scale 映射到导航站名。
 *
 * 关键实现点（都踩过）：
 * 1) 飞行对象必须是**挂在 body 上的固定定位替身**，不能直接飞原刊名 ——
 *    导航栏是 .VPNav（fixed; z-index: 30），滚动后 .VPNavBar 有不透明底色
 *    （实测 rgb(241,239,234)），而 hero 内容被关在 .VPHero .container
 *    （transform + z-index: 2）的层叠上下文里，z-index 怎么调都抬不到导航栏之上。
 *    实测后果：刊名一进导航栏区间就被整段吞掉，「标题飞到一半凭空消失」
 *    （染色法实测顶部 120px 品红像素 = 0）。详见 buildGhost()。
 * 2) 替身离开了 .VPHero 的选择器作用域，类名不再生效 → 样式必须逐条抄计算值。
 * 3) 落点取**文字 span**，不取 .VPNavBarTitle .title：那个 .title 是包着头像 + 站名的
 *    <a>，取它会整体左偏一个头像的宽度（实测盒中心 88.8 vs 文字中心 104.8，差 16px）。
 * 4) 缩放比只能取「导航站名字号 ÷ 刊名字号」，**不能取矩形高度比**：导航标题容器
 *    占满整条导航高度（实测 64px），比刊名（54px）还高，会越缩越大（实测 1.17 倍）。
 * 5) 末段交叉溶解：替身淡出、导航站名同步淡入（同一个 out，窗口压在最后 22%）。
 *    共享元素变形的铁律是**任一时刻只有一个实例可见** —— 顶部若让 hero 大字与导航
 *    站名同框，读起来就是「复制」而不是「移动」。CSS 里已用 html:has(.VPHero) 首帧
 *    就把站名藏起（避免加载闪一下），JS 的 inline opacity 再接管飞行。
 * 6) 原刊名带 hero-rise 入场动画（fill: both），动画结束后它会持续压过 inline style
 *    → 飞行时把 name.style.animation 置 none，inline 的隐身才生效。
 * 7) 每次读元素用 querySelector 现取（不做一次捕获）：SPA 首页→文章→首页往返后
 *    hero 是重建的节点，捕获的旧引用会失效（同 .hero-field 那个坑）。
 * 8) 只在 ≥960px 跑：VitePress 的 .VPNav 仅在宽屏是 position: fixed，窄屏是 relative，
 *    整条导航随页面滚走 —— 没有固定落点，飞行无意义。CSS 侧的同款守卫见 custom.css。
 * 9) 切页必须清场并重算（返回的 cleanup）：SPA 导航不触发 scroll，残留的 inline
 *    opacity 会把新页站名锁成隐形。enhanceApp 的 onAfterRouteChange 里调用。
 */
/**
 * 线替身的颜色端点（黑 → 灰），在 setupHeroFly 里做逐帧插值。
 * ⚠️ 这两个值必须**取自实际用到的 CSS 变量**，不要凭印象写死：
 *    · 起点：刊头 border 的颜色，实测 rgb(10,10,11) = --vp-c-text-1（纯黑）；
 *    · 终点：导航栏 border 的颜色，实测 rgb(224,221,213) = --vp-c-divider
 *      （本项目自定义值 #e0ddd5，**不是** VitePress 默认的 #e2e2e3）。
 * 下面在运行时优先从变量里读，读不到才退回这两个兜底值。
 * （解析成 [r,g,b] 数组是为了做逐通道插值，见 update() 里的 mix()。）
 */
let RULE_FROM = [10, 10, 11]
let RULE_TO = [224, 221, 213]

/**
 * 压制导航栏那条真线用的类名。
 *
 * ⚠️⚠️ 为什么必须有这个类 —— 这是实测抓到的**最难看的一个 bug**：
 *    导航栏的分隔线由 `.VPNav.is-scrolled .VPNavBar` 控制，
 *    `is-scrolled` 的触发条件是 **window.scrollY > 8**（几乎是刚开始滚）。
 *    而线替身此刻还在刊头位置（实测 y=9 时替身在 127px，导航线在 64px），
 *    于是 y∈(9, 69) 这一段里**同屏两条线**：一条近黑的在 127px 往上飘、
 *    一条浅灰的钉在 64px。垂直差最多 63px、色差 195 —— 一眼就是两根线，
 *    比不做这个改动还难看。
 *    （只靠「位置重合后自然重叠」是不够的：`is-scrolled` 亮得太早，
 *      替身至少还要滚 60px 才追上导航底，这 60px 里就是实打实的双线。）
 *
 * 所以：**替身存在期间，把导航栏那条线压掉**；替身一撤，类一移除，
 * 它自然回来。交接点选在替身淡出窗口（t=0.88）之前 —— 那时替身已经
 * 与导航底同位、同色，导航线此时接管，视觉上严丝合缝。
 *
 * 实现上不用 inline style（那是给 .VPNavBar 这个 VitePress 自己的节点写样式，
 * 会与它的响应式逻辑打架），改为在 <html> 上挂一个类，由 custom.css 写规则。
 * 这样样式归属清晰，也方便以后在 CSS 里调整。
 */
const NAV_LINE_HOLD = 'fm-rule-flying'

/**
 * 把 'rgb(r, g, b)' / '#rrggbb' 解析成 [r,g,b]；解析失败返回 null。
 * 用来把 CSS 变量的实际值喂给颜色插值，避免写死的兜底值在改主题后失真。
 */
const parseColor = (s) => {
  if (!s) return null
  const t = s.trim()
  const rgb = t.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i)
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3]]
  const hex = t.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const h = hex[1]
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  return null
}

function setupHeroFly() {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  // ⚠️ TRIGGER 与「导航线何时亮」的阈值 `--fm-fly-handoff-y` 是**联动**的，
  //    而且**两者必须相等**（handoff = TRIGGER）：替身飞完全程（t=1）那一刻，
  //    导航线才出现。custom.css 的 :root 里 `--fm-fly-handoff-y: 300px`
  //    就是 TRIGGER 的值。
  //    ⚠️ 改 TRIGGER 时必须同步改那个变量，否则导航线会早亮或晚亮。
  //    这个"等于 TRIGGER"的结论是站长 2026-10-01 第二次校正定的，
  //    中间试过 0.875×TRIGGER（替身位置到位但还没飞完）—— 数值合理、
  //    观感错误，详见 custom.css 里那段说明。
  const TRIGGER = 300 // 滚动多少 px 内完成整段飞行
  // ⚠️ 与 custom.css 里那条 html:has(.VPHero) 的守卫必须一致：只在 ≥960px 跑。
  const WIDE = window.matchMedia('(min-width: 960px)')
  let raf = null
  let ghost = null // 挂在 body 上的固定定位替身（文字）
  let ruleGhost = null // 同上，刊头那条 1px 黑线的替身
  // 线替身的**锁存起点**：只在进入飞行的第一帧取一次，之后全程复用。
  // ⚠️ 不能每帧从刊头的 rect 现取 —— 刊头自己会随滚动上升，起点跟着跑，
  //    插值就会过冲（详见 update() 里那段「两个坑」的说明）。
  let ruleStartBottom = 0
  let ruleStartLeft = 0
  let ruleStartWidth = 0
  // 这趟飞行是否已跑完（替身淡出、已交棒给导航线）。
  // ⚠️ 它只用来**抑制"落定后每帧重建替身"**这件事，绝不能用它永久性地
  //    关闭飞行 —— 实测抓到的 bug：只在 t<=0（完全回顶）才复位它，
  //    结果从 y=250 往回滚到 y=150/80/30 时替身全程不存在，
  //    **往回滚的整段路线上那条线都消失了**（只剩导航栏的灰线）。
  //    正解：t 一旦掉出"已落定"区间（t < 0.995）就立即复位，
  //    让替身能重新按当前滚动位置建起来 —— 这样 scrubbing 可逆。
  let ruleDone = false

  const heroName = () => document.querySelector('.fm-masthead .fm-mast-title')
  // 刊头那条 1px 通栏线（.fm-masthead 的 border-bottom）。
  // ⚠️ 线不是独立元素 —— 它是 .fm-masthead 盒子的下边框，取不到 rect。
  //    所以量的是 .fm-masthead 的**下沿**（rect.bottom 即线的位置）。
  const heroRule = () => document.querySelector('.fm-masthead')
  // ⚠️ 落点必须是**文字 span**，不能取 `.VPNavBarTitle .title`。
  // 实测那个 .title 是同时包着头像与站名的 <a>：
  //   <a class="title"><img class="VPImage logo" src="/zhihu_avatar.jpg"><span>牧神的笔记</span></a>
  // 取它的中心会让刊名整体左偏一个头像的宽度 —— 实测盒中心 88.8 vs 文字中心 104.8，
  // 差 16px（正好是 24px 头像 + 8px 间距的一半）。这种偏差算样式看数字是看不出来的。
  const navTitle = () => {
    const link =
      document.querySelector('.VPNavBarTitle .title') ||
      document.querySelector('.VPNavBarTitle a') ||
      document.querySelector('.VPNavBar .title')
    if (!link) return null
    return link.querySelector('span') || link
  }
  // 导航栏本体（用来取「底边」当线的落点）。取 .VPNavBar 而不是 .VPNav —— 前者
  // 就是那条 64px 高的实心条，底边即分隔线所在；后者还包着移动端菜单等节点。
  const navBar = () => document.querySelector('.VPNavBar')

  /**
   * 造一个**固定定位替身**挂在 body 上，用来承载飞行。
   *
   * 为什么不能直接飞原刊名：导航栏是 .VPNav（position: fixed; z-index: 30），
   * 滚动后 .VPNavBar 有不透明底色（实测 rgb(241,239,234)），而 hero 内容被关在
   * .VPHero .container（transform + z-index: 2）的层叠上下文里 —— 无论怎么调
   * z-index 都抬不到导航栏之上（父级 transform 必然建立层叠上下文，这是死结）。
   * 实测后果：刊名一进导航栏区间就被整段吞掉，「标题飞到一半凭空消失」
   * （染色法实测顶部 120px 品红像素 = 0）。替身是 body 的直接子节点
   * （z-index: 60 > 导航栏 30），不受 hero 层叠上下文约束，能稳稳压在导航栏之上。
   *
   * 样式必须逐条复刻计算值：替身离开了 .VPHero 的选择器作用域，类名不再生效；
   * 尤其 .clip 的渐变文字（background-clip: text + -webkit-text-fill-color:
   * transparent）必须把 background-image 一起抄过去，否则会退化成实色字。
   * 字号只抄一次，所以视口变化（clamp() 会改字号）时必须重建 —— 见 onResize。
   */
  const buildGhost = (name) => {
    const cs = getComputedStyle(name)
    const g = document.createElement('span')
    g.className = 'hero-fly-ghost' // 只为可调试性（无样式绑定），排查时一眼能认出
    // ⚠️ 必须抄 innerHTML 而不是 textContent：刊名已被 ensureHeroWordmark 拆成
    // 「牧神」（大）+「的笔记」（0.4em）两段。若只抄纯文本，替身会用整个刊名的
    // 字号（~112px）去排 5 个字，比真实刊名宽 40%，起飞瞬间会横向跳一下。
    // 抄 innerHTML 后两段各自的 em 字号在替身上照样成立（见 custom.css 里
    // .hero-fly-ghost .wm-major / .wm-minor 那两条）。
    // ⚠️ 但**先删掉 .wm-chips**（右侧三个 BBC 色块行）：飞行落点是导航栏里的
    // 「牧神的笔记」纯文字，带着色块飞过去既宽又错位。替身只留 major + minor
    // —— .wm-minor「的笔记」在 .wm-tail 内、要保留，只删色块行。
    const ghostSrc = name.cloneNode(true)
    const chipsNode = ghostSrc.querySelector('.wm-chips')
    if (chipsNode) chipsNode.remove()
    g.innerHTML = ghostSrc.innerHTML
    // ⚠️ line-height 必须抄成**比值**，不能抄计算后的 px —— 和上面 innerHTML 是同一
    // 类陷阱（抄算好的值 = 丢掉 em / 比值的语义）。
    // .VPHero .name 写的是 `line-height: 1`（无单位），无单位值会作为「数字」继承，
    // 于是 .wm-minor 按自己的 0.4em 字号重算成 44.7px；若替身抄的是绝对值 111.84px，
    // .wm-minor 就原样继承 111.84px → 行盒高出 28px（实测 139.84 vs 111.84）。
    // 后果不是横向跳，而是**纵向错位**：行盒向下多出 28px 使中心下移 14px，
    // 而 transform-origin 是 center center，落点算的是「盒中心 → 导航文字中心」，
    // 于是飞行末段（交叉溶解窗口）替身墨水落在导航站名下方约 12px 处 —— 溶解时
    // 明显看得出两个位置。抄成比值就与 .name 完全同构，行盒回到 111.84px。
    const fsPx = parseFloat(cs.fontSize)
    const lhPx = parseFloat(cs.lineHeight)
    const lhRatio = fsPx > 0 && isFinite(lhPx) ? lhPx / fsPx : null
    g.setAttribute('aria-hidden', 'true')
    g.style.cssText = [
      'position:fixed',
      'left:0',
      'top:0',
      'margin:0',
      'padding:0',
      'white-space:pre',
      'pointer-events:none',
      'transform-origin:center center',
      'will-change:transform,opacity',
      'z-index:60',
      'font-family:' + cs.fontFamily,
      'font-size:' + cs.fontSize,
      'font-weight:' + cs.fontWeight,
      'font-style:' + cs.fontStyle,
      'letter-spacing:' + cs.letterSpacing,
      // 比值优先；cs.lineHeight 是 'normal' 等无法解析的值时退回原串。
      'line-height:' + (lhRatio !== null ? lhRatio : cs.lineHeight),
      'color:' + cs.color,
      // ㉔ 段给刊名加了三层墨彩错版阴影，替身必须一起抄走 ——
      // 否则标题一进入飞行就"褪成单色"，交接瞬间会看到明显跳变。
      'text-shadow:' + cs.textShadow,
      '-webkit-text-fill-color:' + cs.webkitTextFillColor,
      'background-image:' + cs.backgroundImage,
      'background-size:' + cs.backgroundSize,
      'background-position:' + cs.backgroundPosition,
      'background-repeat:' + cs.backgroundRepeat,
      '-webkit-background-clip:' + cs.webkitBackgroundClip,
      'background-clip:' + cs.backgroundClip,
    ].join(';')
    document.body.appendChild(g)
    return g
  }

  const dropGhost = () => {
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost)
    ghost = null
  }

  /**
   * 线替身：刊头那条 1px 黑线，跟着刊名**一起飞进导航栏**，
   * 最终变成导航栏底部那条分隔线。
   *
   * 站长的原话：「你电脑端首页的那个黑线，能不能和那个『牧神的笔记』一样，
   * 一起神奇移动啊，那根黑线变成顶栏的底部的那根线」。
   *
   * ⚠️ 为什么线必须**也是替身**，不能直接动 .fm-masthead 的 border：
   *    ① 那条 border 长在 hero 的层叠上下文里（.VPHero .container 有 transform），
   *       滚进导航栏区间就被 .VPNavBar 的不透明底色吞掉 —— 与刊名同一个死结，
   *       见 buildGhost 顶部那段说明；
   *    ② 线的目标态是**全屏宽 + 贴视口顶**，而刊头盒子的宽度只有内容栏宽。
   *       要改的是「位置 + 宽度 + 颜色」三件事，替身一次说完最干净。
   *
   * ⚠️ 颜色要跟着走：起点是刊头的**纯黑**（--vp-c-text-1），
   *    终点是导航栏分隔线的**灰**（--vp-c-divider）—— 直接抄 targetColor 即可。
   *    如果固定成黑，线落到导航栏底部会像一道疤（导航栏自己那条线是灰的，
   *    两条深浅不同的线在同一位置重叠，反而更显眼）。 */
  const buildRule = (color, width) => {
    const r = document.createElement('div')
    r.className = 'hero-fly-rule' // 只为可调试性（无样式绑定）
    r.setAttribute('aria-hidden', 'true')
    r.style.cssText = [
      'position:fixed',
      'left:0',
      'top:0',
      'margin:0',
      'padding:0',
      'height:1px',
      // ⚠️⚠️ width 必须显式给，且必须是**线的真实起始长度**（内容栏宽），
      //    不是 1px。
      //
      //    · 为什么必须显式给：div 是块级、又脱离文档流且没有内容，
      //      `width:auto` 会收缩成 **0**（离线实测不写这行时
      //      getBoundingClientRect().width = 0），scaleX 乘任何数都还是 0
      //      —— 线飞过去**完全看不见**，但位置与透明度的读数却全都正常，
      //      只看数字根本发现不了。
      //
      //    · 为什么基准不能是 1px（这是站长 2026-10-01 亲自指出的：
      //      「这个线一直是这么细吗？它应该是有一个伸缩的过程的」）：
      //      基准 1px 时 scaleX 是乘在 1px 上的 —— 就算 scaleX 从 1 拉到 1.3，
      //      实测宽度也只有 1.0 → 1.2px，**肉眼根本看不出"线在伸长"**，
      //      只剩下"一根细线在平移"。完全丢掉了"线被拉长、接上导航栏"的意思。
      //      改成基准 = 起始长度后，scaleX 才是真正的**长度倍数**
      //      （实测 1080 → 1414，即 scaleX 1.000 → 1.309），伸长可见。
      'width:' + width + 'px',
      'pointer-events:none',
      // ⚠️ transform-origin 必须是 left center，不能是 center center：
      //    线的形变主要是**横向拉伸**（内容栏宽 → 全屏宽）。若以中心为原点，
      //    scaleX 会让线从两端同时向外长，左端会先脱离刊名左沿、看着像漂移；
      //    以左缘为原点则左端钉死、只有右端在延伸，读起来才是「线被拉长接上导航栏」。
      'transform-origin:left center',
      'will-change:transform,opacity',
      // z-index 与文字替身同级（60 > 导航栏 30），保证始终压在导航栏之上
      'z-index:60',
      'background-color:' + color,
    ].join(';')
    document.body.appendChild(r)
    return r
  }

  const dropRule = () => {
    if (ruleGhost && ruleGhost.parentNode) ruleGhost.parentNode.removeChild(ruleGhost)
    ruleGhost = null
    // 替身一撤，导航栏那条线就该回来 —— 两者的生命周期**严格绑定**，
    // 所以复位放在这里，而不是散落在 update() 的各个 return 分支里。
    document.documentElement.classList.remove(NAV_LINE_HOLD)
  }

  const update = () => {
    raf = null
    const nav = navTitle()
    if (!nav) {
      const mastNoNav = heroRule()
      if (mastNoNav) mastNoNav.style.borderBottomColor = ''
      dropGhost()
      dropRule()
      ruleDone = false
      return
    }
    const name = heroName()

    // 非首页（文章/归档/标签/关于都没有 hero），或窄屏（.VPNav 只在 ≥960px 是
    // position: fixed，窄屏整条导航随页面滚走，没有固定落点）：交还站名 + 收起替身。
    // ⚠️ SPA 切页不触发 scroll 事件，这里的兜底不能省：否则残留的 inline opacity
    // 会把新页站名锁成隐形，那页就永远没有站名了。
    if (!name || !WIDE.matches) {
      if (nav.style.opacity) nav.style.opacity = ''
      const mastOff = heroRule()
      if (mastOff) mastOff.style.borderBottomColor = ''
      dropGhost()
      dropRule()
      ruleDone = false
      return
    }

    const y = window.scrollY || window.pageYOffset || 0
    const t = Math.min(Math.max(y / TRIGGER, 0), 1)

    if (t <= 0.0005) {
      // 回到顶部：撤掉飞行痕迹，把刊名交还给 hero 本体。
      // ⚠️ 这里**不要**把 name.style.animation 恢复成 ''：animation-name 从 none
      // 改回 hero-rise 会让 CSS 动画**重新播放一遍**（回到顶部时刊名会再"升起"一次）。
      // 入场动画早已播完，永久停在 'none' 才是正确状态。
      name.style.transform = ''
      name.style.opacity = ''
      name.style.transformOrigin = ''
      // ⚠️ 顶部静止时站名必须完全让位给 hero 大字：两者是同一串字
      //（「牧神的笔记」），同时显示就变成「复制」而不是「移动」。
      // 这一点靠计算样式是发现不了的，实测截图才看得出来。
      nav.style.opacity = ''
      // 线交还给刊头本体（替身已收起，原地那条 border 必须重新显形）
      const mastTop = heroRule()
      if (mastTop) mastTop.style.borderBottomColor = ''
      dropGhost()
      dropRule()
      // 回顶 = 这趟飞行作废，允许下次滚动重新起飞（含重新锁存起点）
      ruleDone = false
      return
    }

    // ⚠️ 飞行期间原刊名隐身、由替身出面。hero-rise 是 fill:both，动画结束后它的
    // to 态 opacity 会**一直压过 inline style**（CSS 动画优先级高于 inline），
    // 必须先把动画置 none，inline 的 opacity:0 才生效。
    if (name.style.animation !== 'none') name.style.animation = 'none'
    // ⚠️ 钉成 none，不是清成 ''。㉔ 段给刊名挂了鼠标倾斜的 transform
    //（由 --mx/--my 算出来），若清成 '' 会让那套 CSS 重新生效 —— 量到的就是
    // **被旋转之后的外接矩形**，替身起点与落点都会偏几个像素。置 none 锁死成
    // 布局盒才是准的；反正此刻原刊名已经隐身，它自己怎么变都看不见。
    name.style.transform = 'none'
    name.style.opacity = '0'
    // 刊头的黑线同样隐身，交给线替身（否则远处还留着一条不动的黑线 → 双线）。
    // ⚠️ 用 inline 而不是 CSS 类：只有 t>0（真在飞）时才该隐身，
    //    页面停在顶部时线必须原样可见。
    const mastEl = heroRule()
    if (mastEl && mastEl.style.borderBottomColor !== 'transparent') {
      mastEl.style.borderBottomColor = 'transparent'
    }

    if (!ghost) ghost = buildGhost(name)

    // 原刊名不再被施加任何 transform，读到的就是**稳定的未变形矩形**（也不存在
    // 旧版那个「读到含 transform 的 rect 形成反馈环」的问题）。该 rect 已包含
    // 页面滚动位移与 .container 的视差 transform，所以 dx/dy 直接算
    // 「刊名中心 → 导航站名中心」即可，不必再补滚动量。
    const h = name.getBoundingClientRect()
    const n = nav.getBoundingClientRect()
    if (!h.height || !h.width || !n.height) {
      dropGhost()
      return
    }

    const dx = n.left + n.width / 2 - (h.left + h.width / 2)
    const dy = n.top + n.height / 2 - (h.top + h.height / 2)
    // 缩放取「导航站名字号 ÷ 刊名字号」。⚠️ 不能用矩形高度比：导航标题容器
    // 占满整条导航高度（实测 64px），比刊名（54px）还高，会越缩越大（实测 1.17 倍）。
    const s =
      parseFloat(getComputedStyle(nav).fontSize) /
      parseFloat(getComputedStyle(name).fontSize)
    const e = 1 - Math.pow(1 - t, 3) // easeOutCubic，与站点 cubic-bezier(.22,1,.36,1) 同感

    // 落点前的「交叠段」：替身淡出、导航站名同步淡入 —— 一次交叉溶解完成交接。
    // 共享元素变形的铁律是**任一时刻只有一个实例可见**；同一串字同框出现两遍
    // 读起来就是「重影 / 复制」，而不是「移动」。
    // 窗口刻意压在最后 22%：此时位形已重合到 1px 内（e=0.989），溶解看不出接缝；
    // 若把窗口提前到 38%（e=0.945，横向还差 5px）就会露出淡淡的双层字。
    const out = Math.min(Math.max((t - 0.78) / 0.22, 0), 1)

    ghost.style.left = h.left + 'px'
    ghost.style.top = h.top + 'px'
    ghost.style.transform = `translate(${dx * e}px, ${dy * e}px) scale(${1 + (s - 1) * e})`
    ghost.style.opacity = String(1 - out)
    nav.style.opacity = String(out)

    // ── 那条黑线：跟着刊名一起飞，最终变成导航栏底部那条分隔线 ────────────
    // 站长的原话：「你电脑端首页的那个黑线，能不能和那个『牧神的笔记』一样，
    // 一起神奇移动啊，那根黑线变成顶栏的底部的那根线」。
    //
    // 线的**起点**是刊头盒子的下沿（border-bottom 就长在那儿，取 rect.bottom）；
    // **终点**是导航栏的底边（navBar.bottom）。
    //
    // ⚠️⚠️ 纵向运动的**唯一正确公式**是「锁存起点 + 用文字的同一个 e 插值」：
    //        lineBottom = startBottom + (导航底 − startBottom) × e
    //
    //    这里踩过两次坑，都记下来，别再走回去：
    //
    //    坑① 「起点每帧现取」→ 过冲。刊头下沿自己会随滚动上升（实测 y=120 时
    //        已到 12.6px，而导航底是 64px）。起点跑过终点后 (终点−起点) 变负，
    //        插值就把线**往回拽**，出现冲上去又掉回来的抖动
    //        （实测 y=120 线在 52.9、y=180 在 56.9、y=240 才 62.6）。
    //        ⇒ 起点必须在**进入飞行的第一帧锁存**（ruleStartY），之后不再重取。
    //
    //    坑② 「贴滚动走 + max 钳位」→ 节奏与文字脱节。线从 133 到 64 只有 69px
    //        的行程，而它是 1:1 跟着滚动走的 ⇒ y≈69（t≈0.23）就到位了，
    //        之后 77% 的滚动里一直钉着不动。而文字要飞到 t=1 ——
    //        读起来就是「线早早就到了，字还在慢慢飞」，完全不像同一个动作。
    //        ⇒ 线也必须吃 e 缓动，与文字**共享同一个进度 e**，
    //          这样两者同时起步、同时落定。
    //
    //    现在的写法两条都避开了：起点锁存（坑①），用 e 插值（坑②）。
    //    落定时刻与文字天然一致（同为 t=1），中途也不会越过 64。
    // ⚠️ 宽度不能只做平移。起点线长 = 内容栏宽，终点线长 = 全屏宽。
    //    若只平移不拉伸，线飞过去后会在导航栏底部留出两边空档，
    //    读起来像「一条短线漂到了那儿」，而不是「这根线变成了导航栏的底边」。
    //    ⇒ 必须同时做 scaleX（以左缘为原点，见 buildRule 里的 transform-origin）。
    const mast = heroRule()
    // ⚠️ ruleDone 的复位放在这里，而不是只在 t<=0（回顶）那个分支里 ——
    //    原因是 scrubbing 可逆：用户滚到底再往回滚到中途时，t 会从 1 掉回
    //    0.3/0.5 这种中间值，此时**必须让替身重新建起来**，否则
    //    "往回滚的整段路线上那条线都不见了"（实测 y=250 → 150 → 80 → 30
    //    全程替身 = 无，只剩导航栏的灰线）。
    //    所以复位条件放宽成"只要还没落定就复位"，与交接判据严格互补。
    // ⚠️⚠️ 条件是 `t < 1`（**不是**曾经的 t < 0.995），必须与下面的
    //    `if (t >= 1) { dropRule(); ruleDone = true }` **严格互补**：
    //    这两个条件合起来必须恰好覆盖实数轴，不能有缝、不能重叠。
    //    · 若有缝（如交接用 t>=1、复位用 t<0.995）⇒ y∈[299.5,300) 之间
    //      替身已撤但 ruleDone 仍为 true ⇒ 往回滚这 1px 时替身建不起来，
    //      线在这 1px 行程里消失。
    //    · 若重叠（复位条件太宽、含 t>=1）⇒ 交接后下一帧又把 ruleDone
    //      复位成 false ⇒ 每帧重建替身再立刻 drop，白耗性能且起点锁存
    //      被反复重置（回顶时跳位）。
    //    ⇒ 参照系统一为「交接点 t=1」。
    if (t < 1) ruleDone = false
    if (mast && !ruleDone) {
      const r = mast.getBoundingClientRect()
      const nb = navBar() ? navBar().getBoundingClientRect() : null
      const targetBottom = nb ? nb.bottom : 0
      const targetW = window.innerWidth
      // 当前滚动量。锁存起点与算终点都要用它把「视口坐标 ↔ 页面坐标」对齐。
      const yNow = window.scrollY || window.pageYOffset || 0

      if (!ruleGhost) {
        // 起点色：从 CSS 变量读（此时刊头 border 已被写成 inline transparent，
        // 直接读盒子会得到 rgba(0,0,0,0)，所以取变量更稳、语义也更正确）。
        const cs = getComputedStyle(document.documentElement)
        RULE_FROM = parseColor(cs.getPropertyValue('--vp-c-text-1')) || RULE_FROM
        RULE_TO = parseColor(cs.getPropertyValue('--vp-c-divider')) || RULE_TO
        // ⚠️ 基准宽度必须是**线的真实起始长度**（刊头盒宽，= border-bottom 的跨度），
        //    不是 1px —— 否则 scaleX 乘在 1px 上，全程只有 1.0→1.2px 的变化，
        //    "伸缩"完全看不见（站长 2026-10-01 指出）。详见 buildRule 的注释。
        ruleGhost = buildRule(`rgb(${RULE_FROM.join(',')})`, Math.max(1, r.width))
        // 锁存起点：`ruleStartBottom` 是「**页面在顶部时**刊头下沿的视口坐标」。
        // ⚠️⚠️ 这个值必须是**与当前滚动位置无关的常量**，整趟飞行只用它算
        //    （见下方 lineBottom 的「方案 C」说明）。所以不能直接锁存 r.bottom：
        //    那拿到的是"此刻滚动位置下的下沿"。正常从头往下滚时碰巧差不多
        //    （首帧 y 还很小），但**往回滚时会错得很离谱**：
        //    从 y=250 往回滚到 y=150 时重建替身，锁到的 r.bottom 是
        //    "y=250 那会儿的位置"（已经在视口外），算出的线冲到屏幕上方 ——
        //    实测 bottom = −7.5 / −68.2 / −99.9，整段回滚路线上都看不到它。
        //    正解：刊头是 1:1 跟随滚动的 ⇒ 顶部的下沿 = 当前下沿 + scrollY。
        //    加回 scrollY 就是那个常量，任意滚动位置、任意方向都成立。
        ruleStartBottom = r.bottom + yNow
        ruleStartLeft = r.left   // 横向不随滚动变，直接锁存即可
        ruleStartWidth = r.width
        // ⚠️ 替身一出现就压掉导航栏那条真线（详见 NAV_LINE_HOLD 的说明）：
        //    在替身还没追上导航底之前，导航线绝不能亮 —— 否则同屏两条。
        //    （导航线本身现在也被 --fm-fly-handoff-y 推迟到 y=300 才亮，
        //      这里是第二道保险：替身存在期间一律压住。）
        document.documentElement.classList.add(NAV_LINE_HOLD)
      }

      // 纵向位置（**方案 C：锁存起点 + 用文字的同一个 e 插值**）。
      //
      //     lineBottom = startBottom + (导航底 − startBottom) × e
      //
      // 这个式子里 startBottom 是「**页面在顶部时**刊头下沿的视口坐标」——
      // 一个与当前滚动位置无关的**常量**（本站实测 133px）。一旦锁存好，
      // 整条轨迹就固定了：y 从 0 滚到 300 的过程中它单调地从 133 收到 64。
      //
      // ⚠️⚠️ 对比过的另外两种写法（都错，别再走回头路）：
      //
      //   写法 A「钳位」: lineBottom = max(刊头当前下沿, 导航底)
      //     单调、无过冲，但它只在 y<69 这 69px 里动 —— 之后 77% 的滚动里
      //     完全静止。而文字要飞到 t=1（y=300）⇒ 读起来是
      //     「线早早就到了，字还在慢慢飞」，完全是两个动作。
      //
      //   写法 B「起点每帧现取 + 插值」: lineBottom = 刊头当前下沿 + (导航底 − 刊头当前下沿)×e
      //     刊头当前下沿**自己会越过终点**（y=120 时已到 12.6，而导航底 64），
      //     越过之后 (终点 − 起点) 变负，插值把线**往回拽**：
      //     实测 y=90 → 56.8、y=120 → 53.0、y=150 → 53.9、y=180 → 56.9，
      //     深深冲过 64 再回来，肉眼可见的过冲抖动。
      //
      // 写法 C 同时避开两者：起点恒定 ⇒ 不会过冲；起点够远（133）⇒
      // 整段飞行都在动，且与文字共享 e ⇒ 同起步、同落定。
      const lineBottom = ruleStartBottom + (targetBottom - ruleStartBottom) * e
      const lineLeft = ruleStartLeft + (0 - ruleStartLeft) * e
      const scaleX =
        ruleStartWidth > 0 ? 1 + (targetW / ruleStartWidth - 1) * e : targetW

      // 替身自身 left/top 钉在视口原点，位置全交给 transform ——
      // 每帧只写一个 transform，属性更少，也不会出现 left/top 与 transform
      // 两条定位通道互相打补丁的情况。
      ruleGhost.style.left = '0px'
      ruleGhost.style.top = '0px'
      ruleGhost.style.transform =
        `translate(${lineLeft}px, ${lineBottom - 1}px) scaleX(${scaleX})`

      // ── 颜色：黑 → 灰，与位置同步渐变 ────────────────────────────────
      // 站长要的是「黑线**变成**顶栏底部那根线」。顶栏那根线是灰的
      // （--vp-c-divider = #e0ddd5），而刊头的线是纯黑的（--vp-c-text-1
      // = #0a0a0b）。如果替身一路黑到底，它会和导航栏的灰线在颜色上对不上，
      // 交接瞬间能看到"黑线突然变淡"的跳变 —— 那就不是"变成"，是"换了一条"。
      // ⇒ 颜色也走 e 插值，落定时正好等于导航线的颜色，交接零跳变。
      //
      // ⚠️ 用两次 setProperty 逐个通道插值，不要用 CSS transition 去做：
      //    这是每帧手动驱动的 scrubbing（滚动可正可逆），
      //    transition 会引入"追不上滚动"的滞后，来回滚时尤其明显。
      const mix = (a, b, k) => Math.round(a + (b - a) * k)
      const col =
        'rgb(' +
        mix(RULE_FROM[0], RULE_TO[0], e) + ',' +
        mix(RULE_FROM[1], RULE_TO[1], e) + ',' +
        mix(RULE_FROM[2], RULE_TO[2], e) + ')'
      ruleGhost.style.backgroundColor = col

      // ── 交棒：替身**飞完全程**之后，导航线才出现 ──────────────────────
      // 站长 2026-10-01 的原话（两次，第二次才说准）：
      //   ①「在那根黑线飞到顶栏底部的位置之前，顶栏底部的线已经出现了」
      //   ②「我想顶栏底线先别出现，让我的这条线飞到位，顶栏底线再出现」
      // ⇒ 诉求是：**黑线先完整飞到位，顶栏底线才登场**。
      //
      // 修法分两层，两层**必须锚定同一个阈值**（= TRIGGER = 300px，t=1）：
      //
      //   第一层（setupNavState / --fm-fly-handoff-y）：把导航线的点亮
      //     阈值从 y>8 推迟到 y=300（t=1）。在那之前导航线是 `style:none`，
      //     根本不存在 —— 站长的"顶栏底线抢跑"从源头消除。
      //
      //   第二层（这里）：**同一个 y 阈值**上撤掉 NAV_LINE_HOLD，
      //     让导航线在替身底下显形。
      //
      // ⚠️⚠️ 为什么阈值是 t=1（替身飞完）而不是"位置刚到位"（t≈0.84）：
      //    位置到位 ≠ 飞完。t=0.84 时替身位置确实贴到了导航底，
      //    但它还要继续"飞"到 t=1，而且它的 α 从 t=0.88 起就在往下掉
      //    （1.0 → 0）。站长判断"飞到位没有"的依据是**线的存在感/透明度**，
      //    不是像素坐标 —— 他看到替身在半路上开始变淡、导航线同时冒出来，
      //    结论就是"没飞到位就出现了"。中间那版 0.875 就是栽在这里。
      //    ⇒ 取 t=1：替身完整、不透明地走完全部行程，导航线在它飞完那一刻
      //      才出现。此时替身 @64.0、色 rgb(224,221,213)（与导航线逐位相同）、
      //      宽度满幅 —— 导航线显形与它完全重合，看不出接缝。
      //
      // ⚠️ 判据必须用**同一个 y 阈值**（读 CSS 变量 --fm-fly-handoff-y），
      //    不能用 e 之类的进度量：否则两层会出现"其中一层到了、另一层还没到"
      //    的错配区间，结果是「一条线都没有」或「两条线同框」。
      //
      // ⚠️⚠️ 交接必须**原子完成**：撤 NAV_LINE_HOLD 与加 .is-scrolled
      //    必须在**同一帧里一起做**，否则中间会露出「一条线都没有」的空窗帧。
      //    这是 2026-10-01 第四次实测（probe_t1.mjs，本地 dev 逐 1px 扫）抓到的：
      //      y=299  cnt=1  替身@64.0 色 rgb(224,221,213) α1  hold=Y isScrolled=-
      //      y=300  cnt=0  替身（已撤）        导航线 rgb(10,10,11)(未亮) hold=- isScrolled=-
      //      y=301  cnt=1  替身（无）          导航线 rgb(224,221,213)(亮) hold=- isScrolled=Y
      //    y=300 那一帧 **cnt=0** —— 画面上一根线都没有。
      //    根因：撤 hold 的是 setupHeroFly 的 rAF，加 .is-scrolled 的是
      //    setupNavState 的 rAF —— **两个独立 rAF，先后顺序不保证**。
      //    这里先撤了 hold、那边还没跑，就露了一帧真空（约 16ms，慢速滚动时
      //    肉眼可见一闪；站长做的正是慢速 scrubbing）。
      //
      //    ⇒ 修法：撤 hold 的那一帧，**顺手把 .is-scrolled 一起加上**。
      //      导航线本来就是"该亮了"，谁先亮都一样；主动加不会与 setupNavState
      //      冲突 —— 它下一帧读到 wasOn=true，用滞回判据（y > threshold-40）
      //      会得出 on=true，结果一致，不会来回抖。
      //    ⚠️ 判据仍然只看 yNow >= handoffY（同一个 CSS 变量、同一个真源），
      //      绝不引入第二套进度量。
      const handoffY = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--fm-fly-handoff-y')
      )
      if (isFinite(handoffY) && yNow >= handoffY &&
          document.documentElement.classList.contains(NAV_LINE_HOLD)) {
        // ⚠️ 撤 hold 之前先确认导航线此刻的颜色**确实等于**替身的最终色。
        //    不等就成了两条深浅不同的线叠在一起（比不撤更难看）。
        //    RULE_TO 就是导航线的色（--vp-c-divider）；替身此刻 e≈1，
        //    颜色恰好 rgb(224,221,213)，与导航线**逐位相同**（离线实测）。
        // ① 先把导航线点亮（加 .is-scrolled）—— 此刻它还被 hold 压成透明，
        //    所以加了也看不见，不会闪。
        const navEl = document.querySelector('.VPNav')
        if (navEl) navEl.classList.add('is-scrolled')
        // ② 同一帧再撤 hold —— 导航线从"被压住"直接变成"亮着"，
        //    与替身撤除同帧，中间没有空窗帧。
        document.documentElement.classList.remove(NAV_LINE_HOLD)
      }

      // ── 替身**不淡出**，保持全可见飞到终点，靠"换手"完成交接 ────────
      //
      // ⚠️⚠️ 这里曾经有一个 `ruleOut` 淡出（窗口 t∈[0.88,1]，α 1→0）。
      //    2026-10-01 第三次实测（handoff_t1.py，0.5px 步长的帧间连续性分析）
      //    证明**淡出本身就是错的**，必须彻底删掉。推导：
      //
      //    原以为"替身与导航线同位同色，所以淡出看不出接缝"。但把每一帧
      //    实际画在导航栏底边那 1px 上的**最终颜色**算出来（替身 α 与
      //    纸底 --paper 做 over 合成）就露馅了：
      //
      //      y=294.0  α=0.167  ⇒ 底边呈 rgb(236,234,229)  亮度 234.8
      //      y=297.0  α=0.083  ⇒ 底边呈 rgb(240,238,232)  亮度 238.0
      //      y=299.5  α=0.014  ⇒ 底边呈 rgb(241,239,234)  亮度 239.1 ← 几乎=纸底
      //      y=300.0  导航线亮 ⇒ 底边呈 rgb(224,221,213)  亮度 221.1
      //      ⇒ **帧间亮度跳变 18.0**。视觉上是：线在最后 6px 里悄悄化掉、
      //        变成一条几乎看不见的浅痕，然后导航线"啪"地显形。
      //        这跟站长抱怨的"抢跑"是同一个病的两面（一个是早出现，
      //        一个是先消失再出现）——都是**线的存在感不连续**。
      //
      //    ⇒ 正解：**替身全程 α=1**，一路不透明地飞到导航栏底边；
      //      到 t=1 时它的位置 = 64.0px、颜色 = rgb(224,221,213)、宽度 = 满幅，
      //      与此刻亮起的导航线**逐位相同**。撤替身 + 亮导航线是同一帧，
      //      画面上那个像素**一点没变** ⇒ 帧间跳变严格为 0。
      //      这才是真正的"我的线飞到位，顶栏底线再出现"——
      //      读者看到的是线一直飞、飞到顶栏底，然后它就成了顶栏的底线。
      //
      //    ⚠️ 前提必须成立（否则撤替身会闪）：
      //       ① 替身位置在 t=1 恰好落于导航栏底边 —— 由 targetBottom 保证；
      //       ② 替身颜色在 t=1 恰好等于导航线色 —— 由 RULE_TO 保证；
      //       ③ 宽度在 t=1 恰好等于满幅 —— 由 targetW = window.innerWidth 保证。
      //       三者任一不成立，交接就会露出错位/错色。改这段代码时必须三查。
      //    ⚠️ 所以下面不再给 ruleGhost 写 opacity（保持 buildRule 里的 1）。
      //       dropRule() 里也**不要**加任何"先淡出再删"的逻辑 —— 一次删干净。

      // ⚠️⚠️ 交接点：t >= 1 才撤替身（**不是** ruleOut>=1，因为淡出已删）。
      //    这一帧里替身与导航线画的是同一像素，撤掉替身 = 亮起导航线，
      //    画面零变化。若改成 t>=0.98 之类提前交接，位置/宽度尚未到位，
      //    撤掉的瞬间会看到线"缩短一截+上跳几像素"。
      //    ⚠️ 同时置 ruleDone：不加这个标记的话，下一帧 `!ruleGhost` 又会成立、
      //      重新建替身再立刻 drop，每帧反复建删节点（无谓开销，且替身的
      //      起点锁存会被重置 —— 回顶那次会因锁存丢失而跳位）。
      if (t >= 1) {
        dropRule()
        ruleDone = true
      }
    }
  }

  const onScroll = () => {
    if (raf === null) raf = requestAnimationFrame(update)
  }
  // 视口一变，刊名的 clamp() 字号就与替身定格时的字号对不上了，必须重建替身
  // （线替身同样要靠新宽度重算，一并丢掉）
  const onResize = () => {
    dropGhost()
    dropRule()
    // 视口变了 → 线的起点/终点都变了，锁存值作废，必须允许重新起飞重锁
    ruleDone = false
    onScroll()
  }
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize)
  if (WIDE.addEventListener) WIDE.addEventListener('change', onScroll)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(onScroll)
  onScroll()

  // enhanceApp 早于布局渲染执行，此刻 hero 还没进 DOM，上面那次 onScroll 拿不到节点。
  // 若不补一次，首屏停在顶部时就永远不会执行"隐藏导航站名"的分支 →
  // 顶部会出现「hero 大字 + 导航站名」两个「牧神的笔记」同框。
  // 这里轮询到 hero 出现为止（正常 1~2 帧，最多约 1s 收手）。
  let tries = 0
  const armFly = () => {
    if (heroName() || ++tries > 60) {
      onScroll()
      return
    }
    requestAnimationFrame(armFly)
  }
  armFly()

  // 切页清场：SPA 导航不触发 scroll 事件，残留的 inline opacity/transform 与替身
  // 会把新页站名锁在隐形状态。清完再按当前滚动量重算一次（回首页且已滚动时能自愈）。
  return () => {
    const nav = navTitle()
    if (nav) nav.style.opacity = ''
    const name = heroName()
    if (name) {
      // 不恢复 animation（见上面 t<=0 分支的说明）：改回 hero-rise 会重播入场动画。
      name.style.transform = ''
      name.style.opacity = ''
      name.style.transformOrigin = ''
    }
    const mastClean = heroRule()
    if (mastClean) mastClean.style.borderBottomColor = ''
    dropGhost()
    dropRule()
    ruleDone = false
    requestAnimationFrame(onScroll)
  }
}

/**
 * 词带滚动行为（手机端）。
 *
 * ⚠️⚠️ 2026-09-27 重写（站长反馈："手机上滚动标签，标签会滚到消失、找不回来"）。
 *
 * 旧版做的是「触摸时暂停 CSS 动画、松手恢复」—— 那是在**动画 + 手滑并存**的前提下的补丁。
 * 那个前提本身就是错的：CSS 动画写 `transform`，手指滑动写 `scrollLeft`，
 * 两套位移模型叠加，词带会一路飞出可视区且**怎么拨都回不来**（动画还在推）。
 * 现在移动端已经**彻底关掉动画**（`index.md` 窄屏规则里 `animation: none`），
 * 唯一的位置真相就是 `scrollLeft` —— 滚到哪停哪，永远能滑回来。
 *
 * 所以这个函数的职责只剩一件正事：**边缘渐隐的按需收放**。
 *   · 容器加了 `mask-image` 左右各渐隐 7%（桌面端动画用，永远成立）；
 *   · 但移动端是原生滚动，**容器不滚、只有内容滚** ——
 *     一旦滑到两端，最边上的那个词会停在渐隐区里，被切掉一截（看着像"坏了"）。
 *   · 所以按 scrollLeft 动态改 `--mq-fade-l` / `--mq-fade-r`：
 *     贴左端 → 左侧渐隐归 0；贴右端 → 右侧渐隐归 0；中间 → 两侧都恢复 7%。
 */
function setupMarqueeTouch() {
  const rows = () => Array.from(document.querySelectorAll('.fm-mq-row.is-0, .fm-mq-row.is-m'))
  const EDGE_SLOP = 2   // 判定"贴边"的容差（px）：滚动有亚像素，不能要求严格 === 0
  const updateFade = (row) => {
    const max = row.scrollWidth - row.clientWidth
    /* 不能滚（内容比容器窄）→ 两侧都不渐隐（没有"还有更多"可言） */
    if (max <= 1) {
      row.style.setProperty('--mq-fade-l', '0px')
      row.style.setProperty('--mq-fade-r', '0px')
      return
    }
    const atStart = row.scrollLeft <= EDGE_SLOP
    const atEnd = row.scrollLeft >= max - EDGE_SLOP
    row.style.setProperty('--mq-fade-l', atStart ? '0px' : '7%')
    row.style.setProperty('--mq-fade-r', atEnd ? '0px' : '7%')
  }
  const bind = (row) => {
    if (row.dataset.touchBound) return
    row.dataset.touchBound = '1'
    /* 滚动中：只更新渐隐。用 rAF 节流，避免高频 scroll 事件里连环写样式。 */
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => { ticking = false; updateFade(row) })
    }
    row.addEventListener('scroll', onScroll, { passive: true })
    /* 首屏 + 断点切换时也要对一次（初始 scrollLeft=0 → 左侧渐隐归 0） */
    updateFade(row)
    row._mqUpdateFade = () => updateFade(row)
  }
  const arm = () => {
    /* ⚠️ 桌面端不要碰：桌面是动画位移，两侧渐隐永远成立。
       这里只处理窄屏真正可滚的行：桌面/窄屏通用的 .is-0，以及移动端专用单行 .is-m。
       判断"是否真的可滚"由 updateFade 内部按 scrollWidth 决定，天然安全。 */
    rows().forEach(bind)
  }
  /* ⚠️⚠️ 必须多帧重试：enhanceApp 早于首页组件挂载，
     此刻 .fm-mq-row 还不存在 —— 只调一次 arm() 会空跑，
     于是 --mq-fade-l/r 永远停在默认的 7%，贴边的那个词被渐隐切掉。
     （2026-09-27 实测踩到：贴左端 fl 仍是 7%。）
     bind 内有 dataset.touchBound 守卫，重复调用无害；找不到就重试若干帧。 */
  arm()
  let tries = 0
  const armRetry = () => {
    arm()
    if (!document.querySelector('.fm-mq-row.is-0[data-touch-bound], .fm-mq-row.is-m[data-touch-bound]') && ++tries < 20) {
      requestAnimationFrame(armRetry)
    }
  }
  requestAnimationFrame(armRetry)
  /* 断点切换（桌面 ↔ 手机）会换掉哪一行可见、也会改变可滚宽度 → 重新对一次 */
  window.addEventListener('resize', () => {
    arm()
    rows().forEach((r) => r._mqUpdateFade && r._mqUpdateFade())
  }, { passive: true })
  return arm
}

/**
 * 系列专题横带（2026-09-26 v8 —— **逐行对照 linearfestivals 的实现**）。
 *
 * 参考站组件（`原站存档/…/_files/0zqrn7anp54_4.js.下载`，搜 `data-card` / `Previous event`）
 * 的真实逻辑，逐条抄在下面（左侧是它的原表达式，右侧是本实现的对应）：
 *
 *   它的 b()（布局）：
 *     t = e.clientWidth >= 1280 ? 5 : 3            → 可见张数按**容器宽**分档
 *     u = (c = p / t) * a.length                   → 基准卡宽 c；环形模长 u = c×卡数
 *     f = y() ;  y = () => p / 2 - c / 2           → 首张居中的初始偏移
 *     height = 1.25c*1.1 ; 卡高 = 1.25c            → 竖版卡，容器留给放大
 *
 *   它的 v()（每帧）：
 *     r = ((t*c + e + c) % u + u) % u - c          → 环形包裹（**按均匀 c 取模**）
 *     o[t] = r + c/2                               → 卡中心（均匀网格）
 *     i = power1.inOut(max(0, 1 - |o[t] - p/2| / c))  → 权重
 *     v[t] = c*(1 + .25*i)                         → 宽只放大 25%
 *     b[t] = 1 + (1.1-1)*i                         → scale 1.1
 *     y[t] = v[t]*b[t]                             → 有效宽（含 scale）
 *     O[n] = O[t] ± y[t]/2 ± y[n]/2                → 从中心向两端半宽相加铺排（**无间隙**）
 *     zIndex = 1 + round(10*i)                     → 越靠中心越上层
 *     脏检查：|v-g|>.1 才写 width；zIndex 变了才写
 *
 *   它的交互：
 *     Draggable.create(s,{type:"x", inertia:true, allowNativeTouchScrolling:true,
 *                         snap: e => Math.round(e/c)*c, ...})   ← **移动感来自这里**
 *     圆钮 onClick → gsap.to(s,{x:'+='+delta, duration:.6, ease:'power3.out', onUpdate:v})
 *     focusin → 把聚焦卡拉到中心
 *
 * ── 我之前的两个自作聪明（都已被站长否掉，记在这里别再犯）────────────────
 *   1. 加了 `kg = k^1.8` 让"弹出滞后" → 与他的连续曲线不符，反而造成"先滚完再弹"的割裂感；
 *   2. 把中心卡放大到 1.6 倍 → 他只放大 1.25，是"展开一点"而不是"撑满"。
 *   现在宽度/缩放/简介**全部直接用权重 i**（连续、跟手）。
 *
 * ── 与参考站的两处有意偏离（都是站长明确要求的）──────────────────────
 *   · 可见张数取 **5**：他的是**通栏**容器，我们在内容栏内；
 *   · v14 起**所有卡都带简介**（他本来就是所有卡都带副行），
 *     且**取消中心放大** —— 卡片一律平等。
 */

/* ══ v14「迪士尼」横带（2026-09-27 第 N 轮重写）═════════════════════
 *
 * 站长四条要求，逐条对应的技术手段：
 *
 *   ① 「不要中间那个突出来了，所有都平等吧」
 *      → 删掉一切**按中心权重**的差异：scale、opacity 衰减、is-front 阴影、zIndex 阶梯。
 *        所有卡同宽同高同亮度。位移**只有** translate3d。
 *        副作用是好的：paint() 从"每卡 8 次样式写"降到"每卡 1 次 transform"，
 *        弱机不再掉帧（旧版 11 张卡最多 88 次写/帧）。
 *
 *   ② 「附有简介」
 *      → 简介从"仅居中卡可见（opacity:var(--o)）"改为**常态显示**。
 *        因此卡高由最高那张统一决定，舞台高度要**重新算**（v13 的高度是为
 *        "只有一行简介"设计的，不改会截断）。
 *
 *   ③ 「滚轮滚动的时候，有加速和减速的惯性」
 *      → 位移模型从**位置驱动**换成**速度驱动**（这是本轮的核心改动）：
 *        旧：wheel → target += amt      （每个事件直接改位置，格子感）
 *        新：wheel → vel += amt * KICK  （事件只"推一把"）
 *            每帧：vel *= FRICTION        （摩擦：手指离开后自己减速）
 *                  pos += vel             （积分出位移）
 *        连续滚动时 vel 会累积 → 越滚越快（加速）；
 *        停手后 FRICTION 指数衰减 → 滑行一段再停（减速）。
 *
 *   ④ 「到头后会有撞击的反弹」
 *      → 撞到端点（0 或 N-1）时把 |vel| 的一部分**反向**打回去（衰减反弹），
 *        同时进入**弹簧**状态：位置被拉出边界后，弹簧力把它拉回。
 *        两者叠加 = 撞墙 → 弹回 → 余振衰减 → 停稳。
 *
 * ── 迪士尼那套（12 条基本原则）里真正用到的几条 ──────────────────
 *   · **Squash & Stretch（挤压拉伸）**：只在**撞击瞬间**给卡片一层极轻的
 *     横向挤压（scaleX 0.985）+ 纵向补偿（scaleY 1.012），幅度小到几乎看不见，
 *     但手感上就是"碰了一下有质量"。**不做**夸张形变（那是卡通，不是杂志）。
 *   · **Slow In / Slow Out（缓入缓出）**：靠摩擦模型天然获得 ——
 *     指数衰减的尾巴就是最好的缓出，不需要手动配贝塞尔。
 *   · **Anticipation / Follow Through（预备 / 跟随）**：
 *     撞击前速度先降（摩擦）、撞击后余振（弹簧阻尼）—— 这两段本身就是
 *     预备与跟随，不需要额外关键帧。
 *   · **Exaggeration（夸张）适度**：所有系数都取**小值**。
 *     站长的审美是克制的，迪士尼的"夸张"在这里=幅度足够被感知，而不是刺眼。
 *
 * ── 为什么不用 GSAP / 不引依赖 ──────────────────────────────────
 *   需要的只是一阶摩擦 + 一阶弹簧，不到 30 行。引一个 60KB 的库进来，
 *   在沙箱里还是个构建风险（本站构建走 CI，本地跑不动 emptyDir）。
 *   自己写反而可控：每个常数都能被解释、被复算。
 */

/* 手感常数（都小、可解释；改这里就是调手感，别去动逻辑）
 *
 * ⚠️ 这些数不是拍脑袋来的，是**解出来的**（2026-09-27）：
 *   一次滚轮的总位移 = 速度的几何级数和 = v₀ / (1 − FRICTION)  （单位：卡位）
 *   而 v₀ = delta × KICK。所以「一格滚轮走几张卡」=
 *       delta × KICK / (1 − FRICTION)
 *   要求「**一格 = 一张卡**」（符合同步直觉），代入 delta=120：
 *       120 × KICK / (1 − 0.90) = 1  →  KICK = 0.000833
 *
 *   我第一版随手取 KICK=0.0052 / FRICTION=0.935，算下来单格 = 120×0.0052/0.065
 *   = **9.6 张卡** —— 一格滚轮直接飞到列表尽头。实测（仿真）才抓到，
 *   肉眼在浏览器里只会觉得"怎么老是跳到最后"，很难定位到是这两个常数。
 */
const STRIP = {
  /* ③ 惯性
     ⚠️ 手感旋钮的**分工**（2026-09-27 站长反馈"滚太快"，据此调）：
       · 慢拨一格走多远 —— 由 KICK 决定（要**准**，所以不动）
       · 快滚最多冲多远 —— 由 MAX_VEL 决定（要**稳**，所以砍了）
     两个数是不同职责，别把"太快"错怪到 KICK 上：
       KICK 一改，慢拨就不准了（一格走不满一张卡）；快滚失控是 MAX_VEL 的锅。 */
  KICK: 0.000833,    // wheel delta(px) → 速度增量(卡/帧)。反推自"一格=一卡"，见上
  FRICTION: 0.90,    // 每帧速度保留率。0.90 比 0.935"刹车更灵"，
                     // 否则滑行尾巴太长（单格要 1.5 秒才停，观感是"飘"）
  /* MAX_VEL：0.18 卡/帧 ≈ 10.8 卡/秒。
     （原 0.30 = 18 卡/秒，站长嫌"滚太快"；饱和滑行从 3.0 卡位降到 1.8 卡位。）
     慢拨一格仍 ≈1 卡（KICK 未动），但连滚最多只多滑不到 2 张 —— 手感变沉。 */
  MAX_VEL: 0.18,
  VEL_EPS: 0.0004,   // 小于此速度视为静止（防浮点尾巴永远不收敛）
  /* ④ 橡皮筋越界（2026-09-27 站长最终定稿）
     站长原话：「像把一个布袋弹簧拉开，然后它又归拢 —— 拉到头了再往上拉，
               就会像弹簧一样把你拉回去，然后会有一个小口子。」
     所以要做到三件事，缺一不可：
       a) 拉的时候**越拉越拉不动**          → RUBBER_K（事件侧吃速度）
       b) 松手**弹回去**                    → SPRING_K / SPRING_D（帧侧回位）
       c) 回弹**冲过一点点再收住**（小口子） → SPRING_RETAIN
     ⚠️⚠️ 这三个数的关系是数学性的，别凭感觉调（2026-09-27 用模拟器定标，
         踩过一个致命坑，见 spring() 上方注释）：
         旧值 SPRING_K=0.10 / SPRING_D=0.88 → 越界后**永远回不来**，
         实测「狂滚 40 格本该停在 0，却停在 +1.00」——
         因为弹簧只在 pos<0 时施力，过冲到正侧后它把 vel 留成正值，
         带着这个速度一路滑走（滑了 0.52 卡才停）。
         这不是"过冲太大"，是**结构错误**。
     现在的组合 K=0.12 / D=0.70 / RETAIN=0.62 经模拟定标：
         拉深 0.2 卡 → 过冲 1.8px；0.3 卡 → 3.9px；0.6 卡 → 17.7px；1.0 卡 → 34.6px；
         且**终值一律收敛到 0.0007**（再由吸附收到整卡位）。
         就是"轻拉小口子、狠拉大回弹"。 */
  SPRING_K: 0.12,      // 弹簧刚度：越界后的回位加速度系数
  SPRING_D: 0.70,      // 弹簧阻尼：保留率。<1 才收敛。越小回弹越快、过冲越小
  SPRING_RETAIN: 0.62, // ⚠️「小口子」的来源：刚回到界内那一帧，把回弹速度打个折，
                       //    剩下的那点速度就是过冲的量。越大口子越大（0.62 → 数 px 到数十 px）
  RUBBER_K: 6.0,       // 橡皮筋阻力系数：越界 1 卡位时，后续推进只剩 1/7。
                       // 越大越"拉不动"（越像拉紧的筋），越小越松。
  SQUASH: 0.015,       // 撞击瞬间的挤压幅度（scaleX 减、scaleY 补偿）—— 极小
}
function setupSeriesStrip() {
  if (typeof window === 'undefined') return () => {}
  /* ⚠️ VER 是热更新的命门（2026-09-27 踩到，坑了一整晚）：
     VitePress HMR 时 **DOM 元素会被复用**，若只用 `dataset.stripBound` 判"绑过没"，
     新代码会被旧标记挡在门外 —— 页面继续跑旧闭包，改了等于没改。
     典型症状：明明修好了点击，读者那边点了还是直接跳转。
     所以：版本号变了就先 dispose（AbortController 一次性解绑全部监听）再重绑。 */
  const VER = 'v16'
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
  const gac = new AbortController()

  const bind = (stage) => {
    if (stage.dataset.stripBound === VER) return
    if (stage.__fmStrip && stage.__fmStrip.dispose) stage.__fmStrip.dispose()
    const cards = Array.from(stage.querySelectorAll('.fm-series-card'))
    if (!cards.length) return
    const N = cards.length
    stage.dataset.stripBound = VER
    /* Lenis 的**官方**跳过约定（双保险，见 vendor/lenis.mjs 的 onVirtualScroll）：
       它在 window 上收 wheel，然后沿 event.composedPath() 找这个属性，
       找到了就当没看见。有了它，即使将来 stopPropagation 因为别的原因失效
       （比如监听器挂到了 document 上、或 Lenis 换实现），页面也不会被带走。
       注意：只挂 prevent-wheel，不挂 prevent —— 后者会把触屏滑动也一起废掉。 */
    stage.setAttribute('data-lenis-prevent-wheel', '')

    const ac = new AbortController()
    const on = (el, ev, fn, o) =>
      el.addEventListener(ev, fn, Object.assign({}, o || {}, { signal: ac.signal }))

    /* ── 几何（v14：卡宽下限由「三行简介排得下」反推，不是拍脑袋）──────
       简介最长 41 字，要排满 3 行 → 每行 ≥ 41/3 = 13.67 字。
       13px 字号下汉字全宽 13px → 列宽 ≥ 13.67 × 13 = 177.7px。
       加左右 padding 32px → **卡宽下限 210px**。
       ⚠️ 我第一版随手写了 176 —— 那是"列宽"不是"卡宽"，漏了 padding，
          会直接把简介截断（实测 176px 卡 → 列宽只 144px → 每行 11 字 → 只能放 33 字）。
       上限 232px 是"别只剩 4 张"的约束（内容栏 1152px / 5 张 = 218px 才是理想值）。 */
    const GAP = 12
    const CARD_MIN = 210
    const CARD_MAX = 232
    let cardW = 218
    let step = 230
    const metrics = () => {
      const W = stage.clientWidth || 1
      const vw = window.innerWidth || 1280
      /* v14：卡片必须够宽才装得下三行简介，所以可见张数不再往上堆：
         5 张已是上限（1152/5 = 218px，正好落在上下限之间）。 */
      const visible = vw >= 1180 ? 5 : vw >= 900 ? 4 : vw >= 620 ? 3 : 2
      const raw = W / visible - GAP
      cardW = Math.round(Math.max(CARD_MIN, Math.min(CARD_MAX, raw)))
      step = cardW + GAP
    }
    const layout = () => {
      metrics()
      /* 高度：先让内容自然撑开，取最高的那张当统一高度 ——
         否则长标题的卡高、短标题的卡矮，看着就不齐。
         ⚠️ v14：简介已**全部常显**，这里是"含简介"的真实高度（旧版不是）。
         卡片在容器里**垂直居中**，卡片内部**自上而下**（编号 → 标题 → 简介）。 */
      cards.forEach((el) => { el.style.width = cardW + 'px'; el.style.height = 'auto' })
      let h = 0
      cards.forEach((el) => { if (el.offsetHeight > h) h = el.offsetHeight })
      cards.forEach((el) => { el.style.height = h + 'px' })
      /* v14：舞台高度 = 卡高 + 上下各 14px 呼吸。旧版那个 ×1.06 是为
         "中心卡被放大"留的余量，现在卡片不再放大，用固定 padding 更准。 */
      stage.style.height = Math.round(h + 28) + 'px'
    }

    /* ── 位置/速度状态（v14 核心）──────────────────────────
       pos  ：当前渲染位置（浮点卡位，0 = 第 0 张居中）
       vel  ：当前速度（卡/帧）。**唯一的状态机** —— 位置由它积分而来。
       squash：撞击挤压量 0..1，逐帧衰减到 0。 */
    let pos = 0
    let vel = 0
    let squash = 0
    let dragging = false
    const MAXP = N - 1

    /* ── 橡皮筋越界（rubber band）───────────────────────────
       站长要的是「拉到头再拉，像橡皮筋被拽住、然后弹回去」——
       不是"撞一下"，是**持续对抗 + 松手回弹**。做法学 iOS：
       越界越远，能继续推进的量越小（阻尼），松手后欠阻尼弹回。

       阻力施加在「往界外推的**速度增量**」上（事件侧），不是硬改 pos
       —— 硬改 pos 会跳帧。于是"越拉越拉不动"来自 velocity 被吃掉，
       "松手弹回"来自 spring()。 */
    const rubber = (out, dirSign) => {
      /* out    : 本次事件想给界外方向加的速度（带符号）
         dirSign: +1 = 往"头"外推（pos 想变负）；-1 = 往"尾"外推 */
      const over = dirSign > 0 ? Math.max(0, -pos) : Math.max(0, pos - MAXP)
      const ease = 1 / (1 + over * STRIP.RUBBER_K)   // over=0 → 1（全给）；越大越吃
      return out * ease
    }

    /* 弹簧回位：把越界的位置往边界里拉（每帧一步）。
       ⚠️⚠️ 结构性坑（2026-09-27 实测抓出，比"调参数"严重得多）：
       早先写成「pos<0 时给回位力」，看似合理，实则是**弹射器**：
         拉到 -0.40 松手 → 弹簧把它往回推 → 推到 pos 刚过 0 的那一帧，
         弹簧条件 `pos<0` 不再成立 → **停止施力**，
         但 vel 此刻已经是正值（约 0.09/帧）→ 它带着这个速度一路正滑，
         靠 FRICTION 慢慢衰减，滑出 0.52 卡才停。
       症状：滚到头再滚，本该弹回 0，结果**跑到 +1.00 去**（实测轨迹
             0.00 → -0.40 → -0.20 → +0.07 → +0.24 → +0.63 → +1.00）。
       这不是阻尼不够，是**弹簧没在回到边界时收掉速度**。
       修法（本版）：记一个 `wasOut` 标记 —— 当 pos 从界外**回到界内的那一帧**，
       把 vel 乘以 SPRING_RETAIN 打掉大部分速度，只留一点点当过冲（"小口子"）。
       剩下的小速度由吸附（|vel|<0.004 时收到整卡位）兜底收回 0。 */
    let wasOut = false
    const spring = () => {
      const lo = 0, hi = MAXP
      const over = pos < lo ? -1 : pos > hi ? 1 : 0
      if (over) {
        wasOut = true
        vel += (over < 0 ? lo - pos : hi - pos) * STRIP.SPRING_K  // 朝界内的加速度
        vel *= STRIP.SPRING_D                                     // 阻尼
        return true
      }
      /* 刚回到界内这一帧：把"回弹攒出来的速度"打掉大半 → 只留下微小过冲。 */
      if (wasOut) { wasOut = false; vel *= STRIP.SPRING_RETAIN }
      return false
    }

    /* ── 越过边界时：只做一次"触感提示"，**不再反向速度** ─────────
       ⚠️⚠️ 为什么把 vel 反向去掉了（2026-09-27 定稿）：
       这一版改成**橡皮筋**手感（站长明确要求："拉到头像橡皮筋被拽住"）。
       橡皮筋的正确物理是：
         往界外拉 → 阻尼（rubber，事件侧）＋ 回位力（spring，帧侧）；
         松手 → 欠阻尼弹回（带 overshoot）。
       而"把速度反向"是**刚性碰撞**的物理（台球撞库），
       它和"弹簧回位"是两套互斥的模型 —— 两套同时上，就在边界上对冲 = 抖
       （实测：连推时 pos 在 −0.038 来回、squash 卡在 0.348 不衰减）。
       所以只留弹簧那条线。squash 仍给一次（撞上的那个瞬间有"咯"一下的触感），
       但它不再和速度反向绑定，纯装饰、快速衰减。 */
    let wasOver = false
    const collide = () => {
      const nowOver = pos < 0 || pos > MAXP
      if (nowOver && !wasOver) squash = 1   // 刚越界：记一次挤压（触感），不改速度
      wasOver = nowOver
    }

    /* ⚠️ 边缘渐隐的收放（2026-09-27 站长要求）：
       "你滚到头你就把这个两边的这个虚的，你就把这个两边变成实的不就行了吗"
       —— stage 上加了 mask-image 左右各 5% 渐隐（暗示"还有内容"）。
       但滚到端点时，那侧已经**没有内容**了，渐隐就变成了"把边缘那张卡糊掉"，
       看着像坏了（实测 pos=0 时第 0 张左边缘距 stage 只有 6px，
       正好落在 5% 渐隐区里）。
       所以按 pos 给 stage 打两个标记，CSS 用它们把对应侧的渐隐收成 0：
         data-at-head → 左渐隐 0（首卡完整）
         data-at-tail → 右渐隐 0（末卡完整）
       越界（拉出橡皮筋）时**两侧都收**—— 这时候要看清"那道缝"，
       渐隐会把缝糊掉（站长要的正是"拉开一道缝隙"）。
       用属性而不是直接写 style：CSS 侧改起来更集中，也便于 :hover 等状态叠加。 */
    let edgeState = ''
    const syncEdge = () => {
      const head = pos <= 0.05
      const tail = pos >= MAXP - 0.05
      const over = pos < -0.001 || pos > MAXP + 0.001
      const next = over ? 'both' : head && tail ? 'both' : head ? 'head' : tail ? 'tail' : ''
      if (next === edgeState) return
      edgeState = next
      if (next) stage.setAttribute('data-edge', next)
      else stage.removeAttribute('data-edge')
    }

    const paint = () => {
      const W = stage.clientWidth || 1
      const half = W / 2
      /* v14：不再把 pos 钳到范围内 —— 越界要**看得见**（那就是回弹）。
         但仍要算边界平移，保证首尾不出现空档。 */
      const p = clamp(pos, 0, MAXP)
      let shift = 0
      if (N > 1) {
        const c0 = half + (0 - p) * step
        const cN = half + (MAXP - p) * step
        const minC = step / 2
        const maxC = W - step / 2
        if (c0 > minC) shift = minC - c0
        else if (cN < maxC) shift = maxC - cN
      }
      syncEdge()   // 端点/越界 → 收放该侧的边缘渐隐（见上方注释）
      /* 挤压：撞击瞬间 scaleX 略缩、scaleY 略涨（体积守恒的轻量版）。
         幅度 SQUASH=0.015 → 最大约 1.5%，肉眼几乎看不出，但手感有质量。 */
      const sq = squash * STRIP.SQUASH
      const sx = 1 - sq
      const sy = 1 + sq
      for (let i = 0; i < N; i++) {
        const el = cards[i]
        const d = i - pos           // ⚠️ 用 pos（含越界），这样回弹时整体一起弹
        const ad = Math.abs(d)
        if (ad > 5.2) {             // 远处藏掉：省样式写（弱机不掉帧）
          if (el.style.visibility !== 'hidden') {
            el.style.visibility = 'hidden'
            el.style.pointerEvents = 'none'
          }
          continue
        }
        if (el.style.visibility === 'hidden') el.style.visibility = ''
        const cx = half + d * step + shift
        /* v14：**唯一**的 transform 写 —— 位移 + （撞击时的）轻微形变。
           没有 scale 权重、没有 opacity 衰减：所有卡一律平等。
           translate3d 带负 y 半高是为了 top:50% 后居中。 */
        el.style.transform =
          `translate3d(${(cx - cardW / 2).toFixed(2)}px, -50%, 0)` +
          (sq > 0.0001 ? ` scale(${sx.toFixed(4)}, ${sy.toFixed(4)})` : '')
        el.style.pointerEvents = 'auto' // 屏幕内的卡一律可点
      }
    }

    /* ── 动效主循环（v14：摩擦积分 + 弹簧 + 挤压）────────────
       一个 rAF 循环里同时跑四件事，因为它们是**耦合**的，顺序有意义：
         collide（判撞，可能把 vel 反向）
         → spring（越界回位）
         → 积分（pos += vel）
         → 摩擦（vel *= FRICTION）

       ⚠️⚠️ 这里踩过一个**会让整个效果完全失效**的坑（2026-09-27，实测抓到）：
         旧写法在**第一帧**就做"收敛判定"，而第一帧跑在滚轮事件**之前** ——
         此刻 pos/vel/squash 全为 0、pos 又正好是整卡位，于是立刻判定 settled → 停帧。
         接着滚轮事件到来、`kick()` 想重启循环，但状态已经被清成静止，
         下一帧又立刻 settled —— **循环永远只跑一帧**，读者什么都看不到。
         症状极像"改了个寂寞"：代码全对，就是没效果。
         修法：引入 `needFrames` 显式计数 —— 只要有滚轮/点击/拖动灌进来，
         就至少把它跑完；**收敛判定只在"本帧没有被灌过"时才允许触发**。 */
    let raf = 0
    let needFrames = 0
    const tick = () => {
      /* ⚠️ 顺序有讲究，改之前先读完（2026-09-27 反复踩）：
         1) collide：先判"这一步是不是撞墙了"，撞了就把速度反向（反弹）；
         2) 积分 + 摩擦；
         3) spring：若已越界，给一个回位力；
         4) 吸附：速度停了就收到整卡位 —— 这一步**不能**被 spring 的 active 挡住，
            否则会停在 0.077 这种"差一点点到不了位"的地方（P9 轨迹实测）。 */
      collide()
      if (!dragging) {
        pos += vel                       // ③ 积分：位置来自速度
        vel *= STRIP.FRICTION            // ③ 摩擦：手离开后自然减速
        if (Math.abs(vel) < STRIP.VEL_EPS) vel = 0
      }

      /* 越界中 → 弹簧回位（在积分之后判，保证读到的是本帧真实位置）。
         v15：这里就是**橡皮筋**的回弹力来源。
         越界时每帧给一个朝内的力 + 阻尼 → 松手后欠阻尼弹回（有过冲）。
         ⚠️ 不再有"只在冷却期外才加力"那套 —— 那套是为上一版的"速度反向"服务的，
            反向撤掉后，弹簧可以直接、唯一地负责回位（单一模型才不抖）。 */
      const overNow = pos < 0 || pos > MAXP
      let active = overNow
      if (overNow) spring()

      if (!dragging && !overNow) {
        /* 中段：自由停，**不再吸附到整卡位**（站长 2026-09-27：要"停到哪里就是哪里"）。
           只在紧贴左/右端点时轻推回边界 —— 这是橡皮筋回弹的收口，
           顺便保证边缘渐隐变实（data-edge: head / tail）。 */
        const atHead = pos < 0.12
        const atTail = pos > MAXP - 0.12
        if (atHead || atTail) {
          const target = atHead ? 0 : MAXP
          const dd = target - pos
          if (Math.abs(dd) > 0.0006) {
            pos += dd * 0.22              // 收口尾巴（Slow Out），仅端点附近
            active = true
          } else {
            pos = target
            vel = 0
          }
        }
        if (vel !== 0) active = true
      }

      squash *= 0.86                     // 挤压衰减（≈ 每帧留 86%）
      if (squash < 0.002) squash = 0

      paint()

      /* 本帧是被"灌进来的"（滚轮/点击刚发生）→ 无条件继续跑 */
      if (needFrames > 0) { needFrames--; raf = requestAnimationFrame(tick); return }

      /* 收敛判定：速度没了、没在越界、挤压也归零 → 停帧。
         ⚠️ 只有 needFrames 归零后才允许判定（见上方大注释）。 */
      const settled =
        !active && !dragging && vel === 0 && squash === 0
      if (settled) {
        pos = clamp(pos, 0, MAXP)   // 中段保留分数位（自由停），不取整
        vel = 0
        squash = 0
        paint()
        raf = 0
        return
      }
      raf = requestAnimationFrame(tick)
    }
    /* kick(n)：请求 n 帧"保底运行"。
       ⚠️ 之所以要保底帧数，见 tick 上方那段大注释 ——
       否则第一帧的收敛判定会在滚轮生效前就把循环掐死。 */
    const kick = (n) => {
      needFrames = Math.max(needFrames, n || 3)
      if (!raf) raf = requestAnimationFrame(tick)
    }

    /* ── 滚轮：只"推速度"，不直接改位置（v14 核心改动）──────────
       ⚠️ 这一条是本轮手感的命门：
       旧版 `target += amt` 是**位置驱动** —— 每个事件直接决定"停在哪"，
       所以无论滚多快，结果都是"一格一格挪"，没有加速度、没有惯性。
       新版 `vel += amt * KICK` 是**速度驱动** —— 事件只推一把，
       连滚时 vel 累积（加速），停手后摩擦衰减（减速滑行）。
       这才是"有惯性"的物理来源。 */
    /* ⚠️ 这里原来有一行 `if (now - lastWheelT > GESTURE_GAP) residue = 0`，
       而 `const GESTURE_GAP = 240` 在改版时被删掉了 —— 常量没了引用还在，
       wheel 回调**第一行就抛 ReferenceError**，于是「滚轮完全滚不动」。
       2026-09-27 已删掉那行：碎 delta 累积（residue）本来就不需要手势间隔清零 ——
       一次滚动结束，residue 自然被消费回 0（见下方 `residue = 0`），
       两个手势之间的时间间隔并不影响折算，留着只是隐患。 */
    let residue = 0
    /* ── 到端点的「撞一次 → 放行」计数（v15 定稿，2026-09-27）────────
       这一处**前后改了三版**，把三版的错都记下来，别再走回去：

       ── 第 1 版 `pushedAtEnd` + GESTURE_GAP 复位
          错在：复位条件是"两次 wheel 间隔 > 240ms"。
          慢滚（一格隔 300ms+）每次都算"新手势" → 永远 `不到 1` → 永不放行。
          症状：慢悠悠滚到头，再怎么滚页面都不动，像卡死。

       ── 第 2 版 `wallT` + COOLDOWN(420ms) 时间窗
          错在：手速只要"比 420ms 慢一点点"（真人常是 400ms 左右），
          每次推都刚好落在窗口外 → 被当成"新一次撞击" → 反复撞。
          症状：**到头再滚会抖**（站长原话），squash 反复卡在 0.348，
          pos 在 −0.038 来回，且 scrollY 永远是 0（不放行）。实测复现：
          推1 -0.0384 / 推2 -0.0345 / 推3 -0.0348 / 推5 -0.0384。

       ── 第 3 版（本版）纯计数 + 逃逸
         核心认识：**判据不能用时间**。
         真人推滚轮的间隔（约 400ms）恰好横跨一切"合理"的时间窗，
         用时间必然会误判。改成**纯计数**：
           同一个方向、连续推到第 ESCAPE_N 次还没离开端点 → 放行给页面。
         好处：慢滚快滚都一致，不受手速影响，没有时间刺客。
         离开端点（往界内滚）→ 计数清零，下次到边重新开始。

       ⚠️ 2026-09-27 补记：这一版原本在开头还留了一句
          `if (now - lastWheelT > GESTURE_GAP) residue = 0`（第 1 版的遗物），
          而常量 GESTURE_GAP 早已被删 —— 结果 wheel 回调**第一行就 ReferenceError**，
          表现为「滚轮完全滚不动」。已整段删除，见下方状态声明处的注释。 */
    let wallDir = 0        // 已拉过的方向：-1 头 / 1 尾 / 0 没拉过
    let wallPushes = 0     // 同一方向连续推了几次（用于"逃逸"，见滚轮回调）
    const ESCAPE_N = 4     // 连推这么多次还没离开端点 → 放行给页面（别把人困住）
    on(stage, 'wheel', (e) => {
      /* 归一化 deltaMode：Firefox 用「行」(1)，部分环境用「页」(2)，Chrome 是像素(0)。
         不归一化的话 Firefox 上一格只有 deltaY≈3，滚半天不动一格。 */
      const mult = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? (stage.clientWidth || 800) : 1
      const rx = e.deltaX * mult
      const ry = e.deltaY * mult
      const rdx = Math.abs(rx) > Math.abs(ry) ? rx : ry // 横竖谁大听谁的

      /* ⚠️ 容差取 0.02 卡位（≈4.6px），不是 0.001：
         弹簧+吸附收敛后可能停在离整卡位一两个像素的地方，
         用 0.001 会判不出"已到头"，于是既不撞墙也不放行（P9 实测踩过）。 */
      const atHead = rdx < 0 && pos <= 0.02
      const atTail = rdx > 0 && pos >= MAXP - 0.02
      const atEnd = atHead || atTail
      if (atEnd) {
        const dir = rdx < 0 ? -1 : 1
        /* ⚠️ 到头的处理，最终定稿（2026-09-27，站长要"橡皮筋"）：
           站点**不再**做"撞一次就放行给页面"。理由：站长要的是
           「拉到头再拉，像橡皮筋被拽住、松手弹回去」—— 那就该**一直拽着**，
           中途放行给页面会把"拽"的感觉打断。

           于是这里只有一件事：给一个**被阻尼的**朝外速度。
              · 刚到头（over≈0）→ 给得足，能明显拉出去一段；
              · 已经拉出很远 → 越给越少（rubber），"越拉越拉不动"。
           松手后由 tick 里的 spring 欠阻尼弹回（有 overshoot）。

           ⚠️ 那"万一读者就是想把页面滚下去呢？"—— 给一条**逃逸**：
              同一方向连推到第 ESCAPE_N 次（还没离开过端点）就放行给页面。
              这样既不打断橡皮筋手感，又不会把人困住。
              （第 1/2 版栽在"判据用时间/手势"，这版用**纯计数**，不会误判。） */
        if (dir === wallDir) {
          wallPushes++
          if (wallPushes >= ESCAPE_N) {
            /* 逃逸：摘掉 Lenis 的"别管我"标记，交还页面顺滑滚动。
               ⚠️ 必须摘属性而不是只 return：带着它 Lenis 会无视这次 wheel。 */
            if (stage.hasAttribute('data-lenis-prevent-wheel')) {
              stage.removeAttribute('data-lenis-prevent-wheel')
            }
            return
          }
        } else {
          wallDir = dir
          wallPushes = 0
        }
        /* 消费 + 橡皮筋推进 */
        e.preventDefault()
        e.stopPropagation()
        stage.setAttribute('data-lenis-prevent-wheel', '')
        const out = rdx * STRIP.KICK * 2.2
        vel = clamp(vel + rubber(out, -dir), -STRIP.MAX_VEL, STRIP.MAX_VEL)
        kick(5)
        return
      }
      /* 离开端点（往界内方向滚）→ 清空"已撞过"的记账，
         这样下次再到边时会重新给一次完整的橡皮筋手感。 */
      wallDir = 0
      wallPushes = 0
      /* ⚠️ 消费掉：stopPropagation 是**必须**的 ——
         preventDefault 只挡浏览器的默认滚动，**挡不住 JS 监听器**。
         Lenis 在 window 上收 wheel，只 preventDefault 它照常把页面滑走。 */
      e.preventDefault()
      e.stopPropagation()
      stage.setAttribute('data-lenis-prevent-wheel', '') // 见上方：放行时摘过，这里挂回去

      residue += rdx
      /* 位移累积制：触控板那种 0.5px 的碎 delta 也**一律消费**（不漏给页面），
         但累够 1px 再折算成速度，避免碎 delta 触发无用帧。 */
      if (Math.abs(residue) < 1) return
      const px = residue
      residue = 0
      const add = px * STRIP.KICK
      vel = clamp(vel + add, -STRIP.MAX_VEL, STRIP.MAX_VEL)
      kick(4) // 保底 4 帧（见 tick 的坑注释）
    }, { passive: false })

    /* ── 程序化移动：点卡 / 键盘 / 聚焦 共用 ──────────────────
       v14：不能直接改 pos（那样没有惯性，是硬跳）。
       做法：**给一个速度**，让同一个摩擦循环把它带过去 ——
       于是"点击滑到居中"和"滚轮滑到居中"手感完全一致。
       速度按距离换算，并留出一点余量（0.06 卡）防浮点不收敛。 */
    const moveTo = (i) => {
      const to = clamp(i, 0, MAXP)
      const d = to - pos
      if (Math.abs(d) < 0.002) { pos = to; return }
      /* v = 距离 / 时间常数。
         位移 = v/(1−FRICTION) = v/0.10 = 10v 卡位，要走到距离 d → v = d/10。
         所以系数 = 1/10 × 一点余量。这样"点卡居中"与"滚轮滑过去"
         走的是同一套摩擦曲线，手感一致。
         ⚠️ 不能用大系数硬怼 MAX_VEL：那样会先顶到上限再匀速，
            加速段和匀速段手感割裂（旧版就是这么抖的）。 */
      vel = clamp(d * 0.1, -STRIP.MAX_VEL, STRIP.MAX_VEL)
      kick(6) // 保底 6 帧，确保位移真的起步（见 tick 的坑注释）
    }

    /* ── 点击卡片 → 滑到居中，**不跳转** ────────────────────
       v14：所有卡平等，不再有"中心卡"的特权，
       所以规则简化成：**点哪张哪张就居中**；已在居中的再点一次才真的进系列页。 */
    on(stage, 'click', (e) => {
      let card = e.target && e.target.closest ? e.target.closest('.fm-series-card') : null
      if (!card && typeof e.clientX === 'number') { // 兜底：按坐标反查实际渲染矩形
        for (const el of cards) {
          const r = el.getBoundingClientRect()
          if (r.width && e.clientX >= r.left && e.clientX <= r.right &&
              e.clientY >= r.top && e.clientY <= r.bottom) { card = el; break }
        }
      }
      if (!card) return
      const i = cards.indexOf(card)
      if (i < 0) return
      const d = i - clamp(pos, 0, MAXP)
      if (Math.abs(d) > 0.06) {
        e.preventDefault()
        e.stopPropagation()
        moveTo(i) // 滑过去；已在中间再点一次才真的进系列页
        return
      }
    }, { capture: true })

    /* ── 触屏：手指滑 + 甩出的惯性 ─────────────────────────
       v14：与滚轮共用同一个 vel 状态机 —— 手指拖动时**直接写 pos**（跟手），
       松手时把手指速度交给 vel，剩下的滑行/吸附/回弹全由 tick 接管。
       ⚠️ 注意这里是**拖动**，不是滚轮：拖动必须 1:1 跟手，不能走积分。 */
    let downX = 0, downPos = 0, lastX = 0, lastT = 0, touchVel = 0, armed = false, dragged = false
    on(stage, 'pointerdown', (e) => {
      if (e.pointerType !== 'touch') return // 桌面不做鼠标按住拖（站长否掉）
      armed = true; dragged = false
      downX = lastX = e.clientX; downPos = pos; lastT = e.timeStamp; touchVel = 0
      vel = 0
      dragging = true
      if (raf) { cancelAnimationFrame(raf); raf = 0 }
      if (stage.setPointerCapture) stage.setPointerCapture(e.pointerId)
    })
    on(stage, 'pointermove', (e) => {
      if (!armed) return
      const dx = e.clientX - downX
      if (!dragged && Math.abs(dx) < 4) return
      dragged = true
      const dt = Math.max(1, e.timeStamp - lastT)
      /* 手指速度（卡/帧），带一点平滑 —— 用**局部**变量，
         不要污染 vel（vel 是给 tick 用的，拖动期间 tick 不跑）。 */
      touchVel += (((e.clientX - lastX) / dt) * 16 / step - touchVel) * 0.4
      lastX = e.clientX; lastT = e.timeStamp
      pos = downPos - dx / step  // 1:1 跟手
      paint()
      if (e.cancelable) e.preventDefault()
    }, { passive: false })
    const release = () => {
      if (!armed) return
      armed = false
      dragging = false
      if (!dragged) return
      dragged = false
      /* 松手 → 把手指速度交给主循环（惯性甩出），方向和滚轮一致：
         手指左滑（ dx<0 ）应该让内容继续左移 = 位置增大 = 速度取正。 */
      vel = clamp(-touchVel, -STRIP.MAX_VEL, STRIP.MAX_VEL)
      /* 松手即交给摩擦循环：有速度就惯性甩出，没速度就原地停。
         不再吸附到整卡位（站长 2026-09-27：停到哪里就是哪里）。 */
      kick(8)
    }
    on(stage, 'pointerup', release)
    on(stage, 'pointercancel', release)
    on(stage, 'dragstart', (e) => e.preventDefault())

    /* ── 键盘 ───────────────────────────────────────────── */
    on(stage, 'keydown', (e) => {
      const t = Math.round(clamp(pos, 0, MAXP))
      if (e.key === 'ArrowRight') moveTo(t + 1)
      else if (e.key === 'ArrowLeft') moveTo(t - 1)
      else if (e.key === 'Home') moveTo(0)
      else if (e.key === 'End') moveTo(MAXP)
      else return
      e.preventDefault()
    })
    on(stage, 'focusin', (e) => { // Tab 聚焦也居中（读屏/键盘用户）
      const card = e.target && e.target.closest ? e.target.closest('.fm-series-card') : null
      if (!card) return
      const i = cards.indexOf(card)
      if (i >= 0 && Math.abs(i - pos) > 0.002) moveTo(i)
    })

    let ro = null
    if (typeof ResizeObserver !== 'undefined') {
      let lastW = 0
      ro = new ResizeObserver(() => {
        const W = stage.clientWidth || 1
        if (W === lastW) return
        lastW = W
        layout(); paint()
      })
      ro.observe(stage)
    }
    stage.__fmStrip = {
      layout,
      paint,
      /* 只读的物理状态快照 —— 排查"手感不对"时唯一的观察窗。
         没有它，所有状态都关在闭包里，只能靠截图猜（2026-09-27 踩过：
         一度以为撞墙没反弹，其实是读不到 pos，只能看到 tx 这个无关量）。 */
      debug: () => ({ pos, vel, squash, raf, needFrames, wallDir, wallPushes, dragging, step, cardW, N }),
      dispose() {
        try { ac.abort() } catch (_) {}
        if (ro) ro.disconnect()
        if (raf) cancelAnimationFrame(raf)
        raf = 0
      }
    }
    layout()
    paint()
    stage.classList.add('is-ready')
  }

  const arm = () => document.querySelectorAll('.fm-series-stage').forEach(bind)
  arm()
  window.addEventListener('resize', () => {
    document.querySelectorAll('.fm-series-stage').forEach((s) => {
      if (s.__fmStrip) { s.__fmStrip.layout(); s.__fmStrip.paint() }
    })
  }, { passive: true, signal: gac.signal })
  return arm
}

export default {
  extends: DefaultTheme,
  Layout: MyLayout,
  enhanceApp({ router }) {
    const rebindHero = setupHeroParallax()
    const resetHeroPointer = setupHeroPointer()
    const resetHeroFly = setupHeroFly()
    setupReveal()
    const playPoemRise = setupPoemRise()
    setupScrollProgress()
    setupNavState()
    setupBackToTop()
    setupViewTransitions(router)
    const resetSpotlight = setupSelectionSpotlight()
    // SSR（构建渲染页）时没有 window/document，直接返回
    if (typeof window === 'undefined') return
    // ⚠️ 必须在 window 守卫之后：它一上来就查 .fm-mq-row，
    // SSR 阶段没有 document，否则 build 报 "document is not defined"
    setupMarqueeTouch()
    const rebindSeriesStrip = setupSeriesStrip()
    // Lenis 顺滑滚动（站长 2026-09-19 点名要的效果；vendored 于 lenis@1.3.26，33KB ESM）。
    // - reduced-motion 不启用；触屏默认原生滚动（Lenis 的 syncTouch 默认 false）
    // - SPA 切页后 VitePress 会 native scrollTo(0)，Lenis 的内部状态必须 immediate 同步，
    //   否则下一次滚轮会从旧位置「飞」回顶部 —— 实测这种跳变比没有顺滑滚动更糟
    let lenis = null
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      lenis = new Lenis({ lerp: 0.1 })
      const raf = (t) => {
        lenis.raf(t)
        requestAnimationFrame(raf)
      }
      requestAnimationFrame(raf)
    }
    // 自愈轮询：window load 可能被慢速外链字体无限推迟，hydration 也可能
    // 把手动插入的节点摘掉——轮询到成功为止，最多 60s 后自行收手
    let timer = null
    const arm = () => {
      if (timer) clearInterval(timer)
      let n = 0
      /* 每一轮要把三件事都做一遍，所以**不能短路**：
         写 ensureA() || ensureB() 会在 A 成功时直接跳过 B（反之亦然）。
         用 map 而不是 some/every —— map 天生不短路；三个步骤各自幂等，
         已完成的会立刻返回 true，所以"全都 true"就是收工条件。 */
      const steps = [ensureHeroParticles, ensureHeroCover, ensureHeroWordmark, ensureHeroRibbon]
      timer = setInterval(() => {
        const done = steps.map((f) => f())
        if (done.every(Boolean) || ++n > 120) {
          clearInterval(timer)
          timer = null
        }
      }, 500)
    }

    // ⚠️ onAfterRouteChange 是**单值属性**，不是事件总线 —— 一个 router 只能有一个持有者。
    // 旧代码写的是
    //   if (typeof router.onAfterRouteChanged === 'function') router.onAfterRouteChanged(arm)
    // 而该属性初始就是 undefined，typeof 守卫恒为 false，于是回调**从未注册过**。
    // 实测后果（1440px，headless Edge）：首页硬加载时 --hero-y=240.0px、.hero-field 存在；
    // 「首页 → 归档 → 首页」SPA 往返后，--hero-y 变成未设置、.hero-field 消失。
    // 现在把所有「切页后必须重做」的工作集中在这一个回调里按序调用。
    if (router) {
      router.onAfterRouteChange = () => {
        arm()
        // Lenis 内部状态与原生滚动对齐（见上方注释，immediate 防回飞）
        if (lenis) lenis.scrollTo(0, { immediate: true, force: true })
        // 旧页留下的选区在新页上会变成一层没来由的遮罩，切页即清掉
        if (resetSpotlight) resetSpotlight()
        // 飞行的 inline 残留会把新页站名锁成隐形（SPA 切页不触发 scroll），必须清场
        if (resetHeroFly) resetHeroFly()
        // 指针变量归零：新页的 hero 从"字放平 + 门紧闭"起步，不继承上一页的倾角与开合度
        if (resetHeroPointer) resetHeroPointer()
        /* 诗句升起（2026-09-19）。
           ⚠️ 这里**故意让它有机会执行**，而不是"只在首屏调一次"：
           因为 SPA 从文章页切回首页时，首页 DOM 是**新建**的，诗句处于 CSS 初始态
           （translateY(110%)）——若不处理，就是一片空白。
           playPoemRise() 内部用**模块级 poemRisen** 判断是否已播过：
             · 首次加载 / 整页刷新 → 播升起
             · SPA 切回 → 直接落终态（不重复播，避免与 VT 横移打架）
           之所以要 requestAnimationFrame：钩子在路由变更**之后**触发，
           但新首页的 DOM 可能此刻尚未提交完，交给下一帧更稳。 */
        if (playPoemRise) requestAnimationFrame(() => playPoemRise())
        requestAnimationFrame(() => rebindHero && rebindHero())
        // SPA 切回首页时首页 DOM 重建，横滑带的 dataset.stripBound 随之消失，必须重绑
        requestAnimationFrame(() => rebindSeriesStrip && rebindSeriesStrip())
      }
    }
    arm()
    /* 首屏硬加载（刷新/直接进入首页）时 onAfterRouteChange 不触发，
       必须在 hydration 后自己跑一次。此时 [data-poem] 可能还没渲染完
       （首页是 Vue 组件挂载出来的）—— play() 内部用 rAF 轮询重试若干帧，
       找不到就重试，重试耗尽才判定为非首页并标 done 保持可见，
       所以不会把诗句锁死成隐形。 */
    if (playPoemRise) requestAnimationFrame(() => playPoemRise())
    /* 同理：首屏硬加载时横滑带的圆钮/居中放大也要绑一次。
       enhanceApp 早于首页组件挂载，此刻 .fm-series-stage 可能还不存在 ——
       所以这里做**多帧重试**（最多 12 帧 ≈ 200ms），一旦找到就绑上；
       bind 内部有 dataset.stripBound 守卫，重复调用无害。
       ⚠️ 2026-09-26：不加这段时，直接刷新首页进站（不经 SPA 切页）会
       出现"圆钮点了没反应"—— 只有从文章页切回首页才绑得上。 */
    if (rebindSeriesStrip) {
      let tries = 0
      const armStrip = () => {
        rebindSeriesStrip()
        const bound = document.querySelector('.fm-series-stage[data-strip-bound]')
        if (!bound && ++tries < 12) requestAnimationFrame(armStrip)
      }
      requestAnimationFrame(armStrip)
    }
  }
}
