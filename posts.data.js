import { createContentLoader } from 'vitepress'

// 把正文渲染后的 HTML 洗成干净的纯文本摘要：
// 去掉整块标题（避免节号"一、二、"混进摘要）、去掉其余标签、还原实体、压平空白。
function htmlToPlain(html) {
  return String(html || '')
    .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, ' ')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&ZeroWidthSpace;/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// description 是折叠标量的纯文本，只需压平空白 + 去掉开头章节标记
function descToPlain(s) {
  return String(s || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^[一二三四五六七八九十百]+[、.．]\s*/, '')
    .replace(/^(引言|引子|序|前言|结语|尾声|摘要)[：:]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// 统一日期为 YYYY-MM-DD（兼容 YAML 解析成 Date 或字符串）
function fmtDate(d) {
  if (!d) return ''
  if (d instanceof Date) return d.toISOString().slice(0, 10)
  return String(d).slice(0, 10)
}

// 把「分类 / 标签」统一成字符串数组。三处要兼容，因为历史上三种写法都用过：
//   categories: 权力与制度              （单值字符串）
//   categories: [宪法, 言论自由]         （内联数组）
//   categories:                          （多行列表）
//     - 宪法与法治
//     - 权力与制度
// 这样以后无论作者手写哪种写法都不会崩、也不会渲染出 "[宪法" 这种脏数据。
function toList(v) {
  if (v == null || v === '') return []
  const arr = Array.isArray(v) ? v : String(v).split(/[,，]/)
  return arr.map((s) => String(s).trim().replace(/^\[|\]$/g, '').trim()).filter(Boolean)
}

const MAX = 700 // 摘要上限：约 8~9 行，折叠 3 行时悬停有足够内容可展开

export default createContentLoader('posts/*.md', {
  render: true,
  transform(raw) {
    return raw
      // 归档页 posts/index.md 本身也会被 glob 命中，必须排除，
      // 否则它会把自己当成一篇文章列进列表，且「共 N 篇」多算一条
      .filter(({ url }) => !/^\/posts\/?$/.test(url))
      .map(({ url, frontmatter, html }) => {
        // 正文优先（长，能触发卡片折叠+悬停展开）；description 兜底
        // （作者手写摘要，同时仍被 VitePress 用于 <meta>/og 描述）。
        // 只有 description 基本为空才丢弃，其余让"更长者胜"自然决定。
        let text = descToPlain(frontmatter.description)
        if (text.length < 20) text = ''
        const body = htmlToPlain(html)
        if (body.length > text.length) text = body
        return {
          url,
          title: frontmatter.title || '',
          date: fmtDate(frontmatter.date),
          // category: 单值 —— 分类是一篇的归属，只能有一个。
          // tags:     多值 —— 提供多个浏览入口（标签页）。
          category: toList(frontmatter.categories)[0] || '',
          tags: toList(frontmatter.tags),
          excerpt: text.length > MAX ? text.slice(0, MAX) + '…' : text
        }
      })
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
  }
})
