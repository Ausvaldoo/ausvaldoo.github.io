import DefaultTheme from 'vitepress/theme'
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
 * Hero 分层：往 .VPHero 追加墨彩层（照片之上、内容之下）。
 * 三层各自挂在不同元素上，才能既带 keyframe 动画又带不同速率的视差：
 *   ::before 照片(0.26x) → .hero-blobs 墨彩(0.15x，动画在其 ::before 上) → 内容(-0.06x)
 * 两个坑（都踩过）：
 *   1. 必须等 hydration 完成——提前注入会让 Vue 对不上子节点，
 *      把整个 .main 挪进墨彩层，文字直接消失；
 *   2. 必须追加为末尾节点——插在最前面同样破坏 Vue 的子节点对位。
 */
function ensureHeroBlobs() {
  if (document.readyState !== 'complete') return false
  const hero = document.querySelector('.VPHero')
  if (!hero || hero.querySelector('.hero-blobs')) return true
  const d = document.createElement('div')
  d.className = 'hero-blobs'
  d.setAttribute('aria-hidden', 'true')
  hero.appendChild(d)
  return true
}

export default {
  extends: DefaultTheme,
  enhanceApp({ router }) {
    setupHeroParallax(router)
    setupReveal()
    // SSR（构建渲染页）时没有 window/document，直接返回
    if (typeof window === 'undefined') return
    // 挂载后补注入（路由切换重建 DOM 时也要补）
    const inject = () => setTimeout(ensureHeroBlobs, 0)
    window.addEventListener('load', inject)
    if (router && typeof router.onAfterRouteChanged === 'function') {
      router.onAfterRouteChanged(inject)
    }
    inject()
  }
}
