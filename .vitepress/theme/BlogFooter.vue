<template>
  <!-- 页脚（colophon 落款式）：结构 = 上行「刊名 + 三主题词（左）/ 四链接（右）」，
       下行「© 与域名」两端对齐。无多列链接墙、无社交图标行。
       样式在 custom.css ㊵ 段；由 MyLayout.vue 渲染在 </Layout> 之后。 -->
  <div class="mf-footer">
    <div class="mf-inner">
      <div class="mf-top">
        <div class="mf-brand">
          <p class="mf-name">牧神的笔记</p>
          <span class="mf-rule" aria-hidden="true"></span>
          <p class="mf-words">投资 · 工业自动化 · 工程实践</p>
        </div>
        <nav class="mf-nav" aria-label="页脚导航">
          <a href="/posts/">全部文章</a>
          <a href="/tags">分类与标签</a>
          <a href="/about">关于</a>
          <a href="https://github.com/Ausvaldoo" target="_blank" rel="noopener">GitHub</a>
        </nav>
      </div>
      <div class="mf-bottom">
        <span>© 2026 牧神</span>
        <span class="mf-site">ausvaldoo.github.io</span>
      </div>
    </div>
  </div>
</template>
