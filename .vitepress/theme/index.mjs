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
 * 滚动渐显：列表项 / 归档分组进入视口时淡入上移。
 * - 先给 <html> 加 has-reveal 再藏内容：JS 挂了内容照常显示
 * - IntersectionObserver 触发后即 unobserve（只演一遍）
 * - prefers-reduced-motion 时不启用
 */
function setupReveal(router) {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (!('IntersectionObserver' in window)) return

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

  const scan = () => {
    document.documentElement.classList.add('has-reveal')
    document
      .querySelectorAll('.post-item:not(.revealed), .archive-group:not(.revealed)')
      .forEach((el) => io.observe(el))
  }

  const tryScan = (t) => setTimeout(scan, t)
  window.addEventListener('load', () => tryScan(0))
  if (router && typeof router.onAfterRouteChanged === 'function') {
    router.onAfterRouteChanged(() => tryScan(80))
  }
  tryScan(0)
  tryScan(300)
}

export default {
  extends: DefaultTheme,
  enhanceApp({ router }) {
    setupHeroParallax(router)
    setupReveal(router)
  }
}
