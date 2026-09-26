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
//
// ⚠️ 一篇可以同时属于**多个**系列（2026-09-26 加）。写法是两行都改成列表，
//    **按位置一一对应**（series 第 i 项配 seriesOrder 第 i 项）：
//      series:
//        - 单向生效
//        - 最后的审判
//      seriesOrder:
//        - 1
//        - 1
//    标量写法仍然照旧（70 篇存量文章用的都是标量），两种写法在下面统一成
//    「系列名 → 序号」的列表再展开。**本文件是「一篇 = 一行」的旧假设的唯一
//    破除点**：现在改成「一篇 × 系列 = 一行」，下面所有按 series 过滤的消费者
//    （SeriesNav / SeriesPager / series.md）拿到的仍然是「同一系列的行」，
//    它们的过滤逻辑不用改。
//    ⚠️ 两个列表长度不一致时，多出来的系列序号按「没写」处理（9999，排最后）
//    ——这是兜底，不是正确状态；tools/verify_series.py 会把它判为失败。
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

    // 「标量或列表」统一成数组。
    // 空字符串 / null / undefined 一律得空数组（= 这篇没有声明系列）。
    // ⚠️ 不用 `||` 兜底：本函数的取值域里 0 是合法序号，`||` 会把它吞掉
    //    （2026-09-19 已有一次同类事故，见上一段的注释）。
    const asList = (v) => {
      const one = (x) => String(x ?? '').trim()
      return (Array.isArray(v) ? v : [v]).map(one).filter((s) => s !== '')
    }

    return (
      raw
        // 归档页 posts/index.md 也会被 glob 命中，必须排除（同 posts.data.js 的处理）
        .filter(({ url }) => !/^\/posts\/?$/.test(url))
        // 一篇 × 一个系列 = 一行。同一篇文章属于两个系列就产出两行，
        // 于是它在 /series 页会出现在两个分组里（这是设计，不是重复渲染）。
        .flatMap(({ url, frontmatter }) => {
          const names = asList(frontmatter.series)
          // seriesOrder 允许写成列表（与 names 按位置对应），也允许写标量
          // （只作用于第一个系列）。两者都不写时全是 9999。
          const orders = Array.isArray(frontmatter.seriesOrder)
            ? frontmatter.seriesOrder
            : [frontmatter.seriesOrder]
          return names.map((series, i) => ({
            url,
            title: String(frontmatter.title || '').trim(),
            series,
            // 漏写 seriesOrder 的排到最后（9999），而不是落到第 0 位 ——
            // 少写一个序号不该让那篇篡位成「系列首篇」。写了 0 则是合法序号。
            order: parseOrder(orders[i])
          }))
        })
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
