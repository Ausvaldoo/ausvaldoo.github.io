import DefaultTheme from 'vitepress/theme'
import './custom.css'

/**
 * 首页 Hero 滚动叙事：
 * apply() 每帧写入两个变量（位移系数在 custom.css）：
 *   --hero-y 滚动像素（照片/粒子层视差）
 *   --hero-p 进度 0→1（文字左滑消隐、粒子放大渐隐）
 * - rAF 节流，passive 监听；prefers-reduced-motion 时不绑定
 * - 路由切换后重新查找 .VPHero（文章页无 hero，自动跳过）
 */
function setupHeroParallax(router) {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  let hero = null
  let raf = null

  const apply = () => {
    raf = null
    if (!hero) hero = document.querySelector('.VPHero')
    if (!hero) return
    const h = hero.offsetHeight || 1
    const y = Math.min(Math.max(window.scrollY || 0, 0), h)
    hero.style.setProperty('--hero-y', y.toFixed(1) + 'px')
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
  if (router && typeof router.onAfterRouteChanged === 'function') {
    router.onAfterRouteChanged(() => requestAnimationFrame(bind))
  }
  requestAnimationFrame(bind)
}

/* =========================================================
 * Hero 粒子场：加号 / 圆点交替，水波式起伏，鼠标处如水面涟漪
 * - 纯 Canvas 2D，单层绘制，~400 粒子，性能无压力
 * - 鼠标附近粒子被"推开 + 增亮 + 放大"，像手指点水面
 * - hero 滚出视口 / 标签页隐藏时自动暂停
 * - prefers-reduced-motion：只画一帧静态场
 * ========================================================= */
function startParticles(canvas) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let w = 0
  let h = 0
  let pts = []
  let raf = null
  let running = false
  let mx = -99999
  let my = -99999

  const build = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = canvas.clientWidth
    h = canvas.clientHeight
    canvas.width = Math.max(1, w * dpr)
    canvas.height = Math.max(1, h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    pts = []
    const gap = 30
    const cols = Math.ceil(w / gap) + 1
    const rows = Math.ceil(h / gap) + 1
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        pts.push({
          x: i * gap + (Math.random() - 0.5) * 12,
          y: j * gap + (Math.random() - 0.5) * 12,
          plus: (i + j) % 2 === 0, // 加号与圆点棋盘式交替
          s: 2.4 + Math.random() * 1.8,
          rot: (Math.random() - 0.5) * 0.5,
          ph: Math.random() * Math.PI * 2,
          rust: Math.random() < 0.07
        })
      }
    }
  }

  const draw = (t) => {
    ctx.clearRect(0, 0, w, h)
    const dark = document.documentElement.classList.contains('dark')
    const ink = dark ? '236,226,208' : '43,36,28'
    const rust = dark ? '207,107,74' : '168,68,42'

    for (const p of pts) {
      // 水波：相位随 (x+y) 推移，形成斜向荡开的波
      const wave = Math.sin(t * 0.0016 + (p.x + p.y) * 0.013 + p.ph)
      const sc = 0.62 + 0.46 * (wave * 0.5 + 0.5)
      // 缓慢漂移，避免阵列感
      const ox = Math.sin(t * 0.0006 + p.y * 0.02 + p.ph) * 3
      const oy = Math.cos(t * 0.0005 + p.x * 0.02 + p.ph) * 3

      // 鼠标涟漪：半径 130px 内，粒子被轻推 + 增亮 + 放大
      const dx = p.x + ox - mx
      const dy = p.y + oy - my
      const d2 = dx * dx + dy * dy
      const near = d2 < 16900 // 130^2
      const k = near ? 1 - Math.sqrt(d2) / 130 : 0
      const push = k * k * 10
      const ang = Math.atan2(dy, dx)

      const a = Math.min((0.15 + 0.32 * (wave * 0.5 + 0.5)) * (1 + k * 1.6), 0.9)
      const col = p.rust ? rust : ink
      const s = p.s * sc * (1 + k * 0.9)
      const px = p.x + ox + (near ? Math.cos(ang) * push : 0)
      const py = p.y + oy + (near ? Math.sin(ang) * push : 0)

      ctx.strokeStyle = ctx.fillStyle = `rgba(${col},${a.toFixed(3)})`
      ctx.lineWidth = 1.1
      if (p.plus) {
        const ax = Math.cos(p.rot) * s
        const ay = Math.sin(p.rot) * s
        ctx.beginPath()
        ctx.moveTo(px - ax, py - ay)
        ctx.lineTo(px + ax, py + ay)
        ctx.moveTo(px + ay, py - ax)
        ctx.lineTo(px - ay, py + ax)
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.arc(px, py, Math.max(s * 0.42, 0.6), 0, 6.2832)
        ctx.fill()
      }
    }
  }

  const loop = (t) => {
    draw(t)
    raf = requestAnimationFrame(loop)
  }
  const start = () => {
    if (running || reduced) return
    running = true
    raf = requestAnimationFrame(loop)
  }
  const stop = () => {
    running = false
    if (raf) cancelAnimationFrame(raf)
    raf = null
  }

  build()
  if (reduced) {
    draw(0) // 减弱动效：静态粒子场一帧
  } else {
    start()
    // 鼠标涟漪：监听 hero 区域（含其上方遮挡的容器冒泡）
    const zone = canvas.parentElement || canvas
    zone.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect()
      mx = e.clientX - r.left
      my = e.clientY - r.top
    })
    zone.addEventListener('pointerleave', () => {
      mx = -99999
      my = -99999
    })
  }

  window.addEventListener('resize', () => {
    build()
    if (reduced) draw(0)
  })
  document.addEventListener('visibilitychange', () =>
    document.hidden ? stop() : start()
  )
  // hero 滚出视口即暂停，回来再续
  const io = new IntersectionObserver(
    ([e]) => (e.isIntersecting ? start() : stop()),
    { threshold: 0.02 }
  )
  io.observe(canvas)
}

/**
 * 往 .VPHero 追加粒子画布。
 * 坑（踩过）：插在最前面会破坏 Vue 子节点对位，内容层会消失——必须追加为末尾节点。
 * 门槛只要求 DOM ready（interactive 即可）：VitePress 的 hydration 在模块执行时同步完成，
 * 早于 DOMContentLoaded；而 window load 可能被慢速外链字体无限推迟，不能等它。
 */
function ensureHeroCanvas() {
  if (document.readyState === 'loading') return false
  const hero = document.querySelector('.VPHero')
  if (!hero) return false
  if (hero.querySelector('.hero-particles')) return true
  const c = document.createElement('canvas')
  c.className = 'hero-particles'
  c.setAttribute('aria-hidden', 'true')
  hero.appendChild(c)
  startParticles(c)
  return true
}

/**
 * 滚动渐显（MutationObserver 版）：
 * - 直接盯 body 的 DOM 变化，元素一出现就处理，不存在时序竞态
 * - 视口内立即显示；视口外交给 IntersectionObserver
 * - 先加 has-reveal 再藏内容：JS 挂了内容照常显示
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
        el.classList.add('revealed')
      } else {
        io.observe(el)
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

export default {
  extends: DefaultTheme,
  enhanceApp({ router }) {
    setupHeroParallax(router)
    setupReveal()
    // SSR（构建渲染页）时没有 window/document，直接返回
    if (typeof window === 'undefined') return
    // 自愈式注入：每 500ms 检查，hero 存在而 canvas 缺失就补插。
    // 不用「注入成功即停」的一次性逻辑——Vue hydration 可能在任意时刻
    // 清掉我们手工插入的节点，常驻轮询保证最终一定补回；
    // 稳态开销仅每秒两次 querySelector。
    const inject = () => {
      const hero = document.querySelector('.VPHero')
      if (hero && !hero.querySelector('.hero-particles')) ensureHeroCanvas()
    }
    setInterval(inject, 500)
    inject()
  }
}
