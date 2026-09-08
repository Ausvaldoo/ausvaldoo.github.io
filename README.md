# 牧神的笔记 · 写作与发布指南

博客本体在 `posts/`，全是 Markdown 文件。**用什么编辑器都行，推荐 Obsidian。**

## 一、首次设置 Obsidian（一次性）

1. 安装 Obsidian（官网 obsidian.md，或 `winget install Obsidian.Obsidian`）
2. 打开 Obsidian → 「打开本地文件夹作为仓库」→ 选择 `E:\Git_Repos\blog-vitepress`
3. 设置 → 核心插件 → 开启「模板」→ 模板文件夹位置填 `posts/_templates`
4. 设置 → 文件与链接 → 删除的文件 → 选「移到 `.trash/` 文件夹」（回收站文件不会被发布）

## 二、新增文章

1. 文件列表右键 `posts` → 新建笔记，命名 `YYYY-MM-DD-标题.md`（如 `2026-09-08-我的新文章.md`）
2. `Ctrl+P` → 输入「模板」→ 插入模板「文章模板」，补上 `title` 和 `date`
3. 正文随便写。写一半不想发？把文件挪进 `posts/drafts/`，那里**不会发布**

**front matter 至少要有 `title` 和 `date`**，可选 `categories`、`tags`、`description`。

## 三、编辑 / 删除

- **编辑**：文件列表里直接点开改，保存即可（Obsidian 自动保存）
- **删除**：右键文件 → 删除（进 `.trash/`，不会发布）
- **下架已发布的文章**：把 `posts/` 里的文件拖进 `posts/drafts/` 即可

## 四、发布（Obsidian 只管写，发布靠 git）

在 PowerShell 里（`E:\Git_Repos\blog-vitepress` 目录下）：

```powershell
git add -A
git commit -m "新文章：标题"
git push
```

推完约 1 分半自动上线 https://ausvaldoo.github.io 。本地想先看效果：`npm run build` 后重启 `npx vitepress preview`（preview 必须重启才会看到新构建）。

## 五、语法注意（Obsidian ≠ 网页）

| Obsidian 写法 | 网页上 | 改用 |
|---|---|---|
| `[[双链]]` `![[嵌入]]` | ❌ 不渲染 | 普通链接 `[文字](/posts/xxx)` |
| `%%注释%%` | ❌ 原样显示 | `<!-- 注释 -->` |
| `> [!note]` 标注块 | ❌ 不渲染 | `::: tip 标题 ... ::: ` |
| `==高亮==` | ❌ 原样显示 | `**加粗**` |

图片放 `public/img/`，正文用 `![](/img/文件名.png)` 引用。
