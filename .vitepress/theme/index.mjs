import DefaultTheme from 'vitepress/theme'
import MyLayout from './MyLayout.vue'
import './custom.css'

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

  const SEL = '.post-item:not(.revealed), .archive-group:not(.revealed)'
  let scheduled = false

  const handle = () => {
    scheduled = false
    document.documentElement.classList.add('has-reveal')
    document.querySelectorAll(SEL).forEach((el) => {
      const r = el.getBoundingClientRect()
      if (r.top < window.innerHeight && r.bottom > 0) {
        el.classList.add('revealed') // 已在视口：立即显示
      } else {
        io.observe(el) // 视口外：滚动到再显示
      }
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
 * Hero 粒子场 —— hakim 的「Particles」思路（2026-09-12 替换掉原来的「鼠标墨痕」）。
 *
 * 来源：hakim.se「Particles」，他第一个 canvas 作品（2011）。原始行为：
 * 粒子匀速漂移、撞边反弹，**离鼠标越近越大**（distanceFactor），
 * 点击可以把最近的一颗「钉住」。原版源码：assets/hakim/_lab/src/particles_01.html。
 *
 * 为什么换掉原来那层：原墨痕峰值 alpha 只有 0.10，是**设计上就看不见**的
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

  const SPEED = 14 // 漂移速度 px/s
  const GROW = 5 // 鼠标附近的放大上限（软边精灵比原版实心圆更"占面积"，所以上限比原版的 10 收得多）
  const DENSITY = 6200 // 每多少 px² 一颗（1440×480 的 hero ≈ 111 颗）

  let w = 0
  let h = 0
  let raf = null
  let last = 0
  let parts = []
  const mouse = { x: -9999, y: -9999, active: false }

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
    const n = Math.max(70, Math.min(260, Math.round((w * h) / DENSITY)))
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
        r: 1.5 + Math.random() * 1.9,
        // alpha 0.34~0.68：彩色点需要一点浓度才认得出是颜色（太淡会退回灰）。
        // 这里只是**浅色基准**，实际绘制时还会乘主题系数 alphaScale（暗色 0.78），
        // 见 draw()。两档合成后与正文 --ink 的对比度分别 ≥5.9:1 / ≥4.8:1，
        // 与纸底只有 1.8~3.0:1 —— 是底纹，不是第二层文字。
        a: 0.34 + Math.random() * 0.34,
        grow: 1,
        frozen: false,
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
    for (const p of parts) {
      if (!p.frozen) {
        p.x += p.vx * dt
        p.y += p.vy * dt
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
      // 距离因子沿用原式 max(min(15 - d/10, 上限), 1)，只是把上限从 10 收到 GROW
      let target = 1
      if (mouse.active) {
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        target = Math.max(Math.min(15 - Math.sqrt(dx * dx + dy * dy) / 10, GROW), 1)
      }
      p.grow += (target - p.grow) * Math.min(1, dt * 7)
      const r = p.r * p.grow
      // 放大的同时略微加深：软边精灵把「变大」的视觉冲击削掉了一截
      // （实测鼠标区 alpha 总量只涨到 6.9 倍，实心圆那版是 35 倍），
      // 靠这一项把对比补回来，又不至于把墨团糊成实心块。
      // alpha 0.34~0.68 是**浅色基准**，再乘主题系数 alphaScale（暗色 0.78）。
      // 彩色点需要一点浓度才认得出是颜色（太淡会退回灰），
      // 但合成后与正文 --ink 的对比度仍有 4.8:1 以上 —— 是底纹，不是第二层文字。
      ctx.globalAlpha = Math.min(1, p.a * alphaScale * (1 + (p.grow - 1) * 0.16))
      ctx.drawImage(sprites[p.ci] || sprites[0], p.x - r, p.y - r, r * 2, r * 2)
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

  // 事件挂在 hero 上而不是 canvas 上：canvas 是 pointer-events:none，
  // 自己收不到鼠标事件（这也正是文字/按钮还能正常点的原因）
  const zone = canvas.parentElement || canvas
  zone.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect()
    mouse.x = e.clientX - r.left
    mouse.y = e.clientY - r.top
    mouse.active = true
    start()
  })
  zone.addEventListener('pointerleave', () => {
    mouse.active = false
    mouse.x = -9999
    mouse.y = -9999
  })
  zone.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect()
    const mx = e.clientX - r.left
    const my = e.clientY - r.top
    let best = null
    let bestD = 400 // 只在 20px 内找，否则点空白处会钉住远处的粒子
    for (const p of parts) {
      const dx = p.x - mx
      const dy = p.y - my
      const d = dx * dx + dy * dy
      if (d < bestD) {
        bestD = d
        best = p
      }
    }
    if (best) best.frozen = !best.frozen
  })
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
    if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 8)
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

  router.onBeforeRouteChange = (to) => {
    if (pending !== null && path(pending) === path(to)) {
      pending = null
      return // 放行：这次才是真正执行的导航
    }
    // 同页（只变 hash / query）交给 VitePress 自己处理，不介入
    if (path(to) === window.location.pathname) return

    clearTitle()

    setDir(dirTo(window.location.pathname, path(to)))
    const src = Array.from(
      document.querySelectorAll('.post-title, .archive-title, .idx-list a, .idx-tagrow a')
    ).find((a) => a.href && path(a.href) === path(to))
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

export default {
  extends: DefaultTheme,
  Layout: MyLayout,
  enhanceApp({ router }) {
    const rebindHero = setupHeroParallax()
    setupReveal()
    setupScrollProgress()
    setupNavState()
    setupBackToTop()
    setupViewTransitions(router)
    const resetSpotlight = setupSelectionSpotlight()
    // SSR（构建渲染页）时没有 window/document，直接返回
    if (typeof window === 'undefined') return
    // 自愈轮询：window load 可能被慢速外链字体无限推迟，hydration 也可能
    // 把手动插入的节点摘掉——轮询到成功为止，最多 60s 后自行收手
    let timer = null
    const arm = () => {
      if (timer) clearInterval(timer)
      let n = 0
      timer = setInterval(() => {
        if (ensureHeroParticles() || ++n > 120) {
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
        // 旧页留下的选区在新页上会变成一层没来由的遮罩，切页即清掉
        if (resetSpotlight) resetSpotlight()
        requestAnimationFrame(() => rebindHero && rebindHero())
      }
    }
    arm()
  }
}
