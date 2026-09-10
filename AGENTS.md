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
| **装饰层** | `.vitepress/theme/`（5 个文件） | 动效、阅读量、点赞按钮 | ✅ **整个删掉博客照常运行**，只少这些花样 |

**给 AI 的约束**：除非站长明确要求，不要为了"更好看"增加装饰层代码。装饰越多，维护成本越高，而这个站长看不懂前端。

---

## 3. 想改 X，改哪里（改动地图）

| 我想…… | 改这个文件 | 改完怎么验证 |
|---|---|---|
| 发一篇新文章 | 在 `posts/` 新建 `YYYY-MM-DD-标题.md` | 首页条目 +1，归档页自动出现 |
| 改导航菜单 | `.vitepress/config.mts` → `themeConfig.nav` | 本地 `npm run docs:dev` 看顶部 |
| 改站名 / 副标题 | `.vitepress/config.mts` → `title` / `description` | 网页标签页标题 |
| 改关于页 | `about.md` | 打开 /about |
| 改首页排版 | `index.md` + `.vitepress/theme/custom.css` | 首页 |
| 改配色 / 字体 / 动效 | `.vitepress/theme/custom.css` | 全站 |
| 去掉阅读量 | 删 `MyLayout.vue` 里的 `<ViewCount />` 那一行 | 文章页顶部那行消失 |
| 去掉点赞按钮 | 删 `MyLayout.vue` 里的 `<LikeButtons />` 那一行 | 文章页底部那行消失 |
| 恢复成最朴素的博客 | 把 `Layout: MyLayout` 改回默认，删掉 `theme/` 下 3 个 `.vue` | 只剩原生 VitePress |
| 让某个目录不被发布 | `.vitepress/config.mts` → `srcExclude` 数组 | `dist/` 里搜不到该目录 |

**重要**：`srcDir` 是 `.`，也就是**根目录下任何 `.md` 都会变成网页**。新增任何说明文档（如本文件）都必须同步加进 `srcExclude`，否则会被发到公网上。

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
2. **不引入任何需要实名的国内服务**（腾讯云、阿里云等）。计数目前用 Cloudflare Worker，只存每页两个整数，不收 IP、不收身份。
3. 不上**评论功能** —— 访客产生的内容会带来不可控的责任。
4. `tools/` 已在 `srcExclude`，不会被发布。新增内部脚本/文档同样要加进去。

---

## 6. 已知行为：这些不是 bug，别"修"

| 现象 | 原因 |
|---|---|
| 首页卡片显示正文开头，不是 frontmatter 的 `description` | `posts.data.js` 是**正文优先**（正文比描述长就用正文）。这是当初为修「首页摘要空白」专门改的 |
| 文章底部点赞数字加载慢，或不显示 | 国内到 Cloudflare 的 TCP 链路丢包，**网络问题不是代码问题**。已做懒加载 + 15 秒超时，失败就静默隐藏，不影响页面 |
| `node_modules` 里 `.vitepress/config.mts.timestamp-*.mjs` 一堆 | Vite 的临时文件，已被 gitignore，不用管 |
| 阅读量需要点进文章才涨 | 不蒜子按 URL 统计，SPA 路由切换时脚本会重新注入 |

---

## 7. 这台机器的网络情况（影响你能做什么）

- **没有可用代理**。`ProxyEnable=0`，git 全局代理已于 2026-09-10 清除。
- `github.com:443` **不通**；`ssh.github.com:443` **通**。
- Cloudflare 及境外 HTTPS 经常被丢包（实测 curl 到 Worker：DNS 9ms 正常，TCP 21 秒黑洞）。
- **沙箱环境（如 WorkBuddy）通常也无法访问外网**，验证"某个外网地址通不通"要请站长在自己机器上跑。

---

## 8. 给接手者的行为准则

1. **先说改了哪一层**（内容 / 配置 / 装饰），以及**站长能不能自己删掉**。
2. **每次改动单独提交**，提交信息写清楚改了什么、为什么 —— `git log` 就是变更档案。
3. **不要只交付"做完了"**，要交付"你怎么验证它对、改坏了怎么回退"。
4. 遇到不确定，**问**，不要猜。站长明确说过：宁可被问，不要自作主张改设计。
