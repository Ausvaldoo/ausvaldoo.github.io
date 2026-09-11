# 牧神的笔记 · 项目交接与维护说明

> 这份文件是给「接手这个仓库的任何人或任何 AI」看的。
> 站长的**技术背景**：工业自动化工程师，**不写前端、不打算学**。请用自然语言解释，不要用「很简单/你只需要」这类假设读者懂代码的措辞。
> 站长的**核心诉求**：能独立发布文章；改动要能撤销；不被某一个 AI 绑定。

---

## 1. 这是什么

- **一个静态博客**，VitePress 1.6.4，纯 Markdown 写成，没有数据库、没有服务器、没有后端。
- **仓库**：`git@github.com:Ausvaldoo/ausvaldoo.github.io.git`（**公开仓库**）
- **线上地址**：https://ausvaldoo.github.io
- **本地路径**：`E:\Git_Repos\blog-vitepress`

---

## 2. 三层结构：什么能删，什么不能碰

| 层 | 位置 | 是什么 | 删了会怎样 |
|---|---|---|---|
| **内容层** | `posts/*.md`、`about.md`、`index.md` | 站长的文章与文案 | ❌ 不能删，这是全部资产。**是纯文本，脱离任何工具都能读** |
| **配置层** | `.vitepress/config.mts` | 导航、站名、搜索、排除目录、`<head>` | ⚠️ 改错最坏是导航乱掉，能改回来 |
| **装饰层** | `.vitepress/theme/` | 动效、阅读量、配色 | ✅ **整个删掉博客照常运行**，只少这些花样 |

装饰层当前实际生效的只有 4 个文件：`MyLayout.vue`（挂载点）、`ViewCount.vue`（阅读量）、`custom.css`（全部样式）、`index.mjs`。
`LikeButtons.vue` **处于停用状态**（原因见第 6 节），保留只是因为删掉没有额外收益。

**给 AI 的约束**：除非站长明确要求，不要为了"更好看"增加装饰层代码。装饰越多，维护成本越高，而这个站长看不懂前端。

---

## 3. 想改 X，改哪里（改动地图）

| 我想…… | 改这个文件 | 改完怎么验证 |
|---|---|---|
| 发一篇新文章 | 在 `posts/` 新建 `YYYY-MM-DD-英文短slug.md` | 首页条目 +1，归档页自动出现 |
| 改导航菜单 | `.vitepress/config.mts` → `themeConfig.nav` | 本地 `npm run docs:dev` 看顶部 |
| 改站名 / 副标题 | `.vitepress/config.mts` → `title` / `description` | 网页标签页标题 |
| 改关于页 | `about.md` | 打开 /about |
| 改首页排版 | `index.md` + `.vitepress/theme/custom.css` | 首页 |
| 改配色 / 字体 / 动效 | `.vitepress/theme/custom.css` | 全站 |
| **改文章分类 / 标签** | 每篇文章 frontmatter 的 `categories` / `tags` | 见下方「分类与标签」 |
| 去掉阅读量 | 删 `MyLayout.vue` 里的 `<ViewCount />` 那一行 | 文章页顶部那行消失 |
| 恢复成最朴素的博客 | 把 `Layout: MyLayout` 改回默认，删掉 `theme/` 下的 `.vue` | 只剩原生 VitePress |
| 让某个目录不被发布 | `.vitepress/config.mts` → `srcExclude` 数组 | `dist/` 里搜不到该目录 |

**重要**：`srcDir` 是 `.`，也就是**根目录下任何 `.md` 都会变成网页**。新增任何说明文档（如本文件）都必须同步加进 `srcExclude`，否则会被发到公网上。

### 文章命名约定（2026-09-10 起的硬性规则）

```
posts/YYYY-MM-DD-english-slug.md
```

- **文件名必须是纯 ASCII 小写英文短 slug**（2~5 个词，连字符分隔），**不要用中文**。
- **中文标题写在 frontmatter 的 `title` 里** —— 首页、归档页、浏览器标签显示的都是 `title`，跟文件名无关，所以换成英文 slug 对读者**完全无感**。
- 原因：中文文件名编码后长达 200+ 字符，复制到微信/知乎/邮件里容易被截断或转义，GitHub Pages 对非 ASCII 路径也更脆弱。
- 日期前缀保证唯一性，也方便按时间排序。
- ⚠️ **文件名一旦发布就不要改** —— 改了 URL 就变了，旧链接会 404。要改 slug 得同时考虑跳转。

### 分类与标签（2026-09-11 已重整完毕）

- **首页卡片上显示的那个词，是 `categories`，不是 `tags`** —— 见 `index.md` 里的 `{{ post.category }}`。
  ⚠️ 所以「改标签」不会改变首页观感，要改观感必须改 `categories`。
- 归档页（`/posts`）显示的是 `categories`，`posts.data.js` 负责汇总。
- `posts.data.js` 用 `posts/*.md` 通配，因此**必须排除 `posts/index.md` 自身**，否则归档页会把自己算成一篇、数量虚增 1。

**当前分类体系（7 类 / 35 篇）**，每篇 `categories` 只填**一个**：

| 分类 | 篇数 | 收什么 |
|---|---|---|
| 权力与制度 | 12 | 制度设计、权力运行、意识形态、沉默与表达空间 |
| 社会观察 | 7 | 具体社会现象与人群（身份、性别、婚恋、劳动、心理） |
| 历史与文化 | 6 | 历史事件/人物、语言文字、文艺变迁 |
| 信息与认知 | 5 | 信息管控、公共知识、叙事与修辞 |
| 宪法与法治 | 3 | 宪法文本、言论自由、法治结构 |
| 投资笔记 | 1 | 估值、资产配置 |
| 工业自动化 | 1 | PLC / ST / 工业控制 |

- `tags` 是**主题关键词**（每篇 2~5 个），**「知乎」这个来源标记一律保留**，出处不丢。
- 想给文章改分类：直接改那篇 frontmatter 的 `categories:` 一行即可，首页与归档页会自动重排。
- 改完务必 `npm run build`，然后确认 `dist/index.html` 里 `class="post-cat"` 的分布符合预期 ——
  **构建产物才是最终事实**，光看源文件不算验证通过。

---

## 4. 发布流程

**最简方式**：双击桌面 `PublishBlog.bat`，输入一句说明，回车。1~2 分钟后线上生效。

**等价命令**：

```bash
git add -A
git commit -m "说明"
git push origin main
```

- 推送走 **SSH over 443**：`~/.ssh/config` 里把 `github.com` 映射到了 `ssh.github.com:443`。
- ⚠️ **不要改成 HTTPS 远程地址** —— 这台机器上 `github.com:443` 不通，改了就推不上去。
- 推送后 GitHub Actions（`.github/workflows/deploy.yml`）自动 `npm ci && npm run build` 并发布。

---

## 5. 隐私与安全红线（不要违反）

站长建这个博客的原因之一，是他在知乎的文章被删除过。**因此：**

1. 这是**公开仓库**，写进去的一切都会公开。不要提交 API key、token、密码、真实身份信息。
2. **不引入任何需要实名的国内服务**（腾讯云、阿里云等）。阅读量目前用「不蒜子」，它只返回一个整数，不收 IP、不收身份。
3. 不上**评论功能** —— 访客产生的内容会带来不可控的责任。
4. `tools/` 已在 `srcExclude`，不会被发布。新增内部脚本/文档同样要加进去。
5. ⚠️ **`.gitignore` 里有 `/Pasted image *.png`** —— Obsidian 粘贴图片会落在仓库根目录且常无引用，不要顺手 `git add -A` 提交上去。

---

## 6. 已知行为：这些不是 bug，别"修"

| 现象 | 原因 |
|---|---|
| 首页卡片显示正文开头，不是 frontmatter 的 `description` | `posts.data.js` 是**正文优先**（正文比描述长就用正文）。这是当初为修「首页摘要空白」专门改的 |
| **点赞/点踩按钮已下线，文章底部没有它** | 见下方「点赞功能为什么下线」 |
| 首页卡片的分类词只有 7 个，不再有「知乎存档」 | 2026-09-11 已由「来源打标」改为「主题分类」，来源信息保留在 `tags` 里的「知乎」。见第 3 节「分类与标签」 |
| `node_modules` 里 `.vitepress/config.mts.timestamp-*.mjs` 一堆 | Vite 的临时文件，已被 gitignore，不用管 |
| 阅读量需要点进文章才涨 | 不蒜子按 URL 统计，SPA 路由切换时脚本会重新注入 |
| 刚部署完访问新文章 404，过几分钟又好了 | **404 响应被 GitHub Pages 的 CDN 和浏览器缓存了**。这是部署窗口期的正常现象，不是文章没发出去。临时绕过：URL 后面加 `?v=2` |

### 点赞功能为什么下线（2026-09-11）

**结论：废弃，不要试图重新挂载，除非后端换了地址。**

- 后端是 Cloudflare Worker，地址 `https://blog-likes.inkpaper8x2.workers.dev`，代码在 `tools/like-worker/`。
- 实测：在这台机器上 `nslookup blog-likes.inkpaper8x2.workers.dev` 直接 **"No response from server"**，
  同一时刻 `ausvaldoo.github.io` 正常返回 **HTTP 200**。
  → **`*.workers.dev` 域名在国内被 DNS 层拦截**，不是丢包、不是超时、不是代码问题，改超时时间没用。
- 表现：按钮能点，但数字永远拿不到，且组件是静默失败 —— 读者只看到一个坏掉的按钮。
  **静默失败比没有这个功能更糟**，所以整体摘掉（`MyLayout.vue` 不再挂载、`config.mts` 里的 `preconnect` 已删、`custom.css` 的样式已删）。
- 重启条件：后端必须换到**国内可达的地址**（自有域名 CNAME 到 Worker，或换国内可访问的服务），
  然后改 `LikeButtons.vue` 里的 `API` 常量并在 `MyLayout.vue` 重新挂载。

---

## 7. 这台机器的网络情况（影响你能做什么）

- **没有可用代理**。`ProxyEnable=0`，git 全局代理已于 2026-09-10 清除。
- `github.com:443` **不通**；`ssh.github.com:443` **通**。
- `*.workers.dev` **不通**（DNS 被拦）。普通境外 HTTPS 也经常被丢包。
- **沙箱环境（如 WorkBuddy）通常也无法访问外网**，验证"某个外网地址通不通"要请站长在自己机器上跑。
  可用的诊断命令（注意 PowerShell 里 `curl` 是 `Invoke-WebRequest` 的别名，**必须写 `curl.exe`**）：
  ```powershell
  nslookup <域名>
  curl.exe -s -o NUL -w "http=%{http_code} dns=%{time_namelookup}s conn=%{time_connect}s total=%{time_total}s`n" --max-time 10 "<url>"
  ```

---

## 8. 给接手者的行为准则

1. **先说改了哪一层**（内容 / 配置 / 装饰），以及**站长能不能自己删掉**。
2. **每次改动单独提交**，提交信息写清楚改了什么、为什么 —— `git log` 就是变更档案。
3. **不要只交付"做完了"**，要交付"你怎么验证它对、改坏了怎么回退"。
4. 遇到不确定，**问**，不要猜。站长明确说过：宁可被问，不要自作主张改设计。
5. ⚠️ **不要并行编辑同一个文件** —— 两个编辑同时读同一份内容再各自写回，后写的会覆盖先写的（本站 2026-09-11 实际踩到过）。
