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
 * Hero 粒子场 v4：「ASCII 点阵呼吸场」+ 手绘式水面尾流
 * - 字符点阵 . : - + * ◦ • ▢ 由四组 sin/cos 噪声场驱动显隐，
 *   默认即"涌动呼吸"；密度 CELL=16px
 * - 鼠标模式 = 轨迹尾流：移动时沿路径撒下一串波源（错峰 + 时间衰减），
 *   叠瓦出弯曲水痕；每处波再带角向摆动，杜绝正圆的机械感
 *   —— 快划是长尾浪，慢移是浅涟漪，停住 2.5s 回到自动呼吸
 * - hero 滚出视口 / 标签页隐藏自动暂停；reduced-motion 只画一帧
 * ========================================================= */
function startParticles(canvas) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const PALETTE = '   ...:::---+++***◦◦••▢▣' // 与 PPT 同款字符梯度
  const CELL = 16
  const FONT_SIZE = 13

  let w = 0
  let h = 0
  let raf = null
  let running = false
  const trail = [] // 鼠标轨迹波源 {x, y, t}
  let lastMove = 0
  let lightCv = null // 低分辨率光罩图：呼吸场亮度 → 遮罩擦除强度
  let lightCtx = null
  let lightImg = null
  let scrim = null // 暗幕渐变缓存

  const setup = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = canvas.clientWidth
    h = canvas.clientHeight
    canvas.width = Math.max(1, Math.round(w * dpr))
    canvas.height = Math.max(1, Math.round(h * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const mono =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--font-mono')
        .trim() || 'JetBrains Mono, Consolas, monospace'
    ctx.font = `500 ${FONT_SIZE}px ${mono}`
    ctx.textBaseline = 'top'
    // 暗幕：近乎全黑（96%~98%），照片平时完全看不见；
    // 只有光点波动幅度大的波峰顶点才被"擦亮"，透过一小块看到照片
    scrim = ctx.createLinearGradient(0, 0, 0, h)
    scrim.addColorStop(0, 'rgba(0, 0, 0, 0.97)')
    scrim.addColorStop(0.45, 'rgba(0, 0, 0, 0.96)')
    scrim.addColorStop(1, 'rgba(0, 0, 0, 0.98)')
    // 光罩图：每格 1 像素，放大绘制时 bilinear 平滑成柔光斑
    const cols = Math.ceil(w / CELL) + 1
    const rows = Math.ceil(h / CELL) + 1
    lightCv = document.createElement('canvas')
    lightCv.width = cols
    lightCv.height = rows
    lightCtx = lightCv.getContext('2d')
    lightImg = lightCtx.createImageData(cols, rows)
  }

  const draw = (tSec) => {
    // ① 暗幕打底：照片默认被压暗，文字清晰
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = scrim
    ctx.fillRect(0, 0, w, h)
    const cols = Math.ceil(w / CELL)
    const rows = Math.ceil(h / CELL)
    const cx = cols * 0.5
    const cy = rows * 0.5
    const now = performance.now()

    // 清理 700ms 前的旧波源；轨迹空 = 自动呼吸模式
    while (trail.length && now - trail[0].t > 700) trail.shift()
    const hasMouse = trail.length > 0
    const light = lightImg.data

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // PPT 同款四重噪声场：横向波 + 纵向波 + 对角波 + 中心径向波
        const n = (
          Math.sin(c * 0.18 + tSec) +
          Math.sin(r * 0.24 - tSec * 0.7) +
          Math.sin((c + r) * 0.12 + tSec * 0.45) +
          Math.sin(Math.hypot(c - cx, r - cy) * 0.16 - tSec * 0.55)
        ) / 4
        let v = (n + 1) / 2 // [0,1]
        // 亮底上淡点不可见：拉大波动幅度，让字符沿梯度充分形变（呼吸感的关键）
        v = Math.min(1, Math.max(0, 0.5 + (v - 0.5) * 1.45))

        // 鼠标尾流：对轨迹上每个波源求空间×时间衰减，角向摆动破坏正圆
        let mFall = 0
        let mWave = 0
        if (hasMouse) {
          const px = c * CELL
          const py = r * CELL
          for (let i = 0; i < trail.length; i++) {
            const p = trail[i]
            const dx = px - p.x
            const dy = py - p.y
            const d2 = dx * dx + dy * dy
            if (d2 > 32400) continue // 180px 外不参与
            const age = (now - p.t) / 1000
            const fall =
              Math.exp(-d2 / 4200) * Math.exp(-age * 3.2)
            if (fall < 0.02) continue
            const ang = Math.atan2(dy, dx)
            // 角向摆动：同一半径上强弱不均，水痕呈有机曲线
            const wob = 1 + 0.38 * Math.sin(ang * 3 + tSec * 1.8 + p.t * 0.013)
            mFall += fall * wob
            mWave += Math.sqrt(d2) > 1
              ? Math.sin(Math.sqrt(d2) * 0.085 - tSec * 2.6 + p.t * 0.01) *
                fall * wob
              : 0
          }
          if (mFall > 0.02) {
            v = Math.min(1, v + mFall * 0.5 + mWave * 0.4)
          } else {
            mFall = 0
          }
        }

        // 光罩强度：只有波动幅度大的波峰顶点才够格擦开遮罩
        // 阈值 0.74 → 平时一片黑，仅峰值处透出小块照片
        const li = (r * (cols + 1) + c) * 4
        const lum = Math.min(1, v + mFall * 0.55 + Math.max(0, mWave) * 0.25)
        const erase = Math.min(0.92, Math.max(0, lum - 0.74) * 3.4)
        light[li] = 0
        light[li + 1] = 0
        light[li + 2] = 0
        light[li + 3] = Math.min(255, Math.round(erase * 255))

        if (v < 0.22) continue
        const ch = PALETTE[Math.min(PALETTE.length - 1, Math.floor(v * PALETTE.length))]
        if (ch === ' ') continue
        // 点阵全程暖白：呼吸与尾流同色，尾流只增亮不换色
        const alpha = Math.min((0.22 + (v - 0.22) * 0.72) * (1 + mFall * 0.8), 1)
        ctx.fillStyle = `rgba(255,248,238,${alpha.toFixed(3)})`
        ctx.fillText(ch, c * CELL, r * CELL)
      }
    }

    // ② 光罩擦除：destination-out 把暗幕在"光点亮"的地方擦薄，
    //    低分辨率图放大绘制，柔化成有机光斑，随水波游走
    lightCtx.putImageData(lightImg, 0, 0)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(lightCv, 0, 0, w, h)
    ctx.globalCompositeOperation = 'source-over'

    // 鼠标静止 2.5s 后清空轨迹，回到自动呼吸
    if (hasMouse && now - lastMove > 2500) trail.length = 0
  }

  let t0 = 0
  const loop = (tMs) => {
    // PPT 同速：t*0.55 秒级时钟
    draw(((tMs - t0) / 1000) * 0.55)
    raf = requestAnimationFrame(loop)
  }
  const start = () => {
    if (running || reduced) return
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
  if (reduced) {
    draw(0) // 减弱动效：静态点阵一帧
  } else {
    start()
    // 鼠标轨迹采样：距离/时间双阈值去密，最多保留 18 个波源
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
    })
    zone.addEventListener('pointerleave', () => {
      trail.length = 0
    })
  }

  window.addEventListener('resize', () => {
    setup()
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
  hero.classList.add('has-mask') // 暗幕已入画布，隐藏 CSS 兜底遮罩
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
