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
 */
function setupHeroParallax(router) {
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
  if (router && typeof router.onAfterRouteChanged === 'function') {
    router.onAfterRouteChanged(() => requestAnimationFrame(bind))
  }
  requestAnimationFrame(bind)
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
 * Hero 鼠标墨痕：米白纸上的「手指划过湿墨」。
 * 沿用点阵版那套轨迹波源（18 个、时间衰减、角向摆动破坏正圆），
 * 但渲染成柔和墨团而不是字符——纸面上墨只压暗、不发光，
 * 峰值 alpha 刻意压到 0.10，属于触感层，绝不与刊名争夺注意力。
 * 无鼠标时不画：此时由 CSS 的墨彩 keyframe 缓慢漂移（自动模式）。
 */
function startInkWake(canvas) {
  const ctx = canvas.getContext('2d')
  if (!ctx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }
  const RENDER = 0.5 // 半分辨率渲染再拉伸：墨团自带柔化，且省 3/4 填充量
  const trail = []
  let w = 0
  let h = 0
  let raf = null
  let running = false
  let lastMove = 0
  let t0 = 0

  const setup = () => {
    w = canvas.clientWidth
    h = canvas.clientHeight
    canvas.width = Math.max(1, Math.round(w * RENDER))
    canvas.height = Math.max(1, Math.round(h * RENDER))
    ctx.setTransform(RENDER, 0, 0, RENDER, 0, 0)
  }

  const draw = (tSec) => {
    ctx.clearRect(0, 0, w, h)
    const now = performance.now()
    while (trail.length && now - trail[0].t > 900) trail.shift()
    if (now - lastMove > 2500) trail.length = 0 // 停手 2.5s 交还给 CSS 墨彩
    for (const p of trail) {
      const age = (now - p.t) / 1000
      const fade = Math.exp(-age * 2.6)
      if (fade < 0.03) continue
      const R = 120 + age * 90
      const a = 0.1 * fade
      // 角向摆动：墨痕边缘不成正圆，像手指带起的湿墨
      const wob = 1 + 0.18 * Math.sin(tSec * 1.6 + p.t * 0.01)
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate((p.t % 6280) / 1000)
      ctx.scale(wob, 1 / wob)
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R)
      g.addColorStop(0, `rgba(120, 58, 34, ${a.toFixed(4)})`)
      g.addColorStop(0.55, `rgba(150, 92, 48, ${(a * 0.45).toFixed(4)})`)
      g.addColorStop(1, 'rgba(150, 92, 48, 0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(0, 0, R, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }

  const loop = (tMs) => {
    draw((tMs - t0) / 1000)
    raf = requestAnimationFrame(loop)
  }
  const start = () => {
    if (running) return
    running = true
    t0 = performance.now()
    raf = requestAnimationFrame(loop)
  }
  const stop = () => {
    running = false
    if (raf) cancelAnimationFrame(raf)
    raf = null
  }

  setup()
  const zone = canvas.parentElement || canvas
  zone.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    const now = performance.now()
    const last = trail[trail.length - 1]
    if (
      !last ||
      now - last.t > 24 ||
      (x - last.x) * (x - last.x) + (y - last.y) * (y - last.y) > 64
    ) {
      trail.push({ x, y, t: now })
      if (trail.length > 18) trail.shift()
    }
    lastMove = now
    start()
  })
  zone.addEventListener('pointerleave', () => {
    trail.length = 0
  })
  window.addEventListener('resize', setup)
  document.addEventListener('visibilitychange', () =>
    document.hidden ? stop() : start()
  )
  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), {
    threshold: 0.02,
  }).observe(canvas)
}

/**
 * 往 .VPHero 追加墨痕画布。
 * 坑（踩过）：必须追加为末尾节点——插在最前面会破坏 Vue 子节点对位，内容层会消失。
 */
function ensureHeroWake() {
  if (document.readyState === 'loading') return false
  const hero = document.querySelector('.VPHero')
  if (!hero) return false // 不在首页：返回 false，让轮询继续等着
  if (hero.querySelector('.hero-wake')) return true
  const c = document.createElement('canvas')
  c.className = 'hero-wake'
  c.setAttribute('aria-hidden', 'true')
  hero.appendChild(c)
  startInkWake(c)
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

export default {
  extends: DefaultTheme,
  Layout: MyLayout,
  enhanceApp({ router }) {
    setupHeroParallax(router)
    setupReveal()
    setupScrollProgress()
    setupNavState()
    setupBackToTop()
    // SSR（构建渲染页）时没有 window/document，直接返回
    if (typeof window === 'undefined') return
    // 自愈轮询：window load 可能被慢速外链字体无限推迟，hydration 也可能
    // 把手动插入的节点摘掉——轮询到成功为止，最多 60s 后自行收手
    let timer = null
    const arm = () => {
      if (timer) clearInterval(timer)
      let n = 0
      timer = setInterval(() => {
        if (ensureHeroWake() || ++n > 120) {
          clearInterval(timer)
          timer = null
        }
      }, 500)
    }
    if (router && typeof router.onAfterRouteChanged === 'function') {
      router.onAfterRouteChanged(arm)
    }
    arm()
  }
}
