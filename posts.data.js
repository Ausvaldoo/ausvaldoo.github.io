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

const MAX = 700 // 摘要上限：约 8~9 行，折叠 3 行时悬停有足够内容可展开

export default createContentLoader('posts/*.md', {
  excerpt: true,
  transform(raw) {
    return raw
      .map(({ url, frontmatter, excerpt }) => {
        // 正文优先（信息量足），description 兜底
        let text = descToPlain(frontmatter.description)
        if (text.length < 200) text = ''
        const body = htmlToPlain(excerpt)
        if (body.length > text.length) text = body
        return {
          url,
          title: frontmatter.title || '',
          date: fmtDate(frontmatter.date),
          category: frontmatter.categories || '',
          tags: frontmatter.tags || [],
          excerpt: text.length > MAX ? text.slice(0, MAX) + '…' : text
        }
      })
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
  }
})
