import { createContentLoader } from 'vitepress'

// 系列专用的「瘦」数据管道。
//
// 为什么不复用 posts.data.js：那个管道开了 render:true，每篇带最多 700 字摘要，
// 它的产物体积是 86.3 KB —— 那个体量只该被归档页 /posts/ 和标签页 /tags 加载。
// 而本文件要被 MyLayout（全站布局）import，一旦复用，首页、关于页等每一个
// 页面都要额外下载 86 KB。这里只留「标题 + 链接 + 系列名 + 序号」，量级几 KB。
//
// 字段由文章 frontmatter 声明（两行，不写就完全不受影响）：
//   series: 从琴弓到电塔
//   seriesOrder: 2
//
// 注意：系列与标签的分工不同。标签是主题词、无顺序、纯浏览入口；
// 系列是有阅读顺序的连载，序号是它的核心信息 —— 所以顺序只认 seriesOrder，
// 绝不按日期猜（同一天发的多篇会分不出先后）。
export default createContentLoader('posts/*.md', {
  transform(raw) {
    // ⚠️ 序号解析必须区分「没写」和「写了 0」—— 这是 2026-09-19 修掉的真 bug。
    //
    // 原写法：`Number(frontmatter.seriesOrder) || 9999`
    // `Number(0)` 得 0，而 0 在 `||` 里是 **falsy** → 被兜底成 9999。
    // 于是《标签的背叛》00 那篇（seriesOrder: 0）被排到最后，
    // 系列页显示顺序成了 01 → 02 → 03 → 00，而正确顺序是 00 → 03。
    // （与同名旧产物的 timestamp-*.mjs 无关，那些是构建缓存，源只有这一处。）
    //
    // 教训：`|| 兜底` 用于「缺省值」时，只对 `undefined/null/''` 安全；
    // 一旦合法取值域包含 0（序号、金额、计数、左偏移…），必须改用显式判空。
    const parseOrder = (v) => {
      if (v === undefined || v === null) return 9999
      const s = String(v).trim()
      if (s === '') return 9999
      const n = Number(s)
      return Number.isFinite(n) ? n : 9999
    }

    return (
      raw
        // 归档页 posts/index.md 也会被 glob 命中，必须排除（同 posts.data.js 的处理）
        .filter(({ url, frontmatter }) => {
          if (/^\/posts\/?$/.test(url)) return false
          return String(frontmatter.series ?? '').trim() !== ''
        })
        .map(({ url, frontmatter }) => ({
          url,
          title: String(frontmatter.title || '').trim(),
          series: String(frontmatter.series).trim(),
          // 漏写 seriesOrder 的排到最后（9999），而不是落到第 0 位 ——
          // 少写一个序号不该让那篇篡位成「系列首篇」。写了 0 则是合法序号。
          order: parseOrder(frontmatter.seriesOrder)
        }))
        // 先按系列名归组，组内按序号；序号相同再按标题，
        // 保证每次构建顺序稳定（否则会产生无意义的 diff）
        .sort(
          (a, b) =>
            a.series.localeCompare(b.series, 'zh') ||
            a.order - b.order ||
            a.title.localeCompare(b.title, 'zh')
        )
    )
  }
})
