import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: '牧神的笔记',
  description: '投资估值复盘与工业自动化工程实践的个人博客',
  cleanUrls: true,
  lastUpdated: true,
  srcDir: '.',
  outDir: 'dist',
  ignoreDeadLinks: true,

  // 用 Obsidian 管理 posts/ 时，这些目录不能变成页面：
  // .obsidian(Obsidian配置) / .trash(Obsidian回收站) / _templates(模板) / drafts(草稿)
  srcExclude: [
    '.obsidian/**',
    '.trash/**',
    '_templates/**',
    'posts/.obsidian/**',
    'posts/.trash/**',
    'posts/_templates/**',
    'posts/drafts/**',
    'drafts/**',
    'README.md',
    // 部署脚本 / 内部说明不对外发布
    'tools/**',
    // 交接文档：给 AI 和未来的自己看，不对外发布
    'AGENTS.md',
    'CLAUDE.md',
    // 项目记忆目录：已在 .gitignore 里挡住提交，这里再挡一次构建。
    // 因为 srcDir 是 `.`，任何 .md 都会变成网页 —— 万一被人 force-add 进来，
    // 没有这条就会被构建成页面发到公网。点开头的目录不会被自动排除（`.obsidian/**` 同理）。
    '.workbuddy/**',

    // 2026-09-24：历史工作区 _ws/（探针脚本、截图、视频、抓取样本等，279MB）。
    // 它是**工具留档**，不是博客内容 —— 里面 206 个 .md（知乎抓取样本、GitHub 调试记录、
    // 上游 skill 副本）一条都不该发到公网。移进来之前就先把门关上。
    // 同理：这些大文件也不进 git（见 .gitignore 的 `_ws/`）。
    '_ws/**'
  ],

  themeConfig: {
    siteTitle: '牧神的笔记',
    logo: '/zhihu_avatar.jpg',

    nav: [
      { text: '首页', link: '/' },
      { text: '归档', link: '/posts/' },
      { text: '系列', link: '/series' },
      { text: '标签', link: '/tags' },
      { text: '关于', link: '/about' }
    ],

    // 侧边栏在「列表页/分类页」阶段再细化，这里先只给文章内 prev/next
    sidebar: {},

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文章', buttonAriaLabel: '搜索文章' },
          modal: {
            noResultsText: '没有找到相关结果',
            resetButtonTitle: '清除查询条件',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭'
            }
          }
        }
      }
    },

    outline: {
      label: '本文目录',
      level: [2, 3]
    },

    docFooter: {
      prev: '上一页',
      next: '下一页'
    },

    lastUpdatedText: '最后更新',
    returnToTopLabel: '回到顶部',
    darkModeSwitchLabel: '外观',
    sidebarMenuLabel: '目录',
    externalLinkIcon: true
    // 默认 footer 已移除：首页有 fm-colophon 封底（兰波签名 + 版权行），
    // 全局灰字 footer 是第三处「牧神的笔记」，纯重复。
  },

  head: [
    ['meta', { name: 'theme-color', content: '#f6f1e6' }],
    ['meta', { name: 'author', content: '牧神' }],
    ['link', { rel: 'icon', type: 'image/jpeg', href: '/zhihu_avatar.jpg' }],
    // 衬线字体（Google Fonts 国内镜像），Playfair 用于西文刊名、Noto Serif SC 用于中文标题
    ['link', { rel: 'preconnect', href: 'https://fonts.loli.net' }],
    ['link', { rel: 'preconnect', href: 'https://gstatic.loli.net', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.loli.net/css2?family=Playfair+Display:ital,wght@0,700;1,600&family=Noto+Serif+SC:wght@600;700;900&display=swap'
      }
    ]
  ],

  sitemap: {
    // GitHub Pages 默认域名；以后若买个人域名，改这里 + 在 public/ 放 CNAME 文件
    hostname: 'https://ausvaldoo.github.io'
  }
})
