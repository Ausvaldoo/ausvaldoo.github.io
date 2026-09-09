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
    'tools/**'
  ],

  themeConfig: {
    siteTitle: '牧神的笔记',
    logo: '/zhihu_avatar.jpg',

    nav: [
      { text: '首页', link: '/' },
      { text: '归档', link: '/posts/' },
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
    externalLinkIcon: true,

    footer: {
      message: '牧神的笔记',
      copyright: 'Copyright © 2026 牧神'
    }
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
