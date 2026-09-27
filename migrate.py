# -*- coding: utf-8 -*-
"""Hexo _posts -> VitePress posts/ 迁移脚本（一次性，已完成使命）

- front matter: 删除 abbrlink 行，其余（title/tags/categories/description/date）原样保留
- 文件名 slug: 去掉全角标点（：""？等），保留「日期-标题」语义化结构

⚠️ 2026-09-25：Hexo 旧站 `E:\\Git_Repos\\blog\\` 已按站长要求整体删除。
   SRC 现指向归档副本（32 篇源文件完整，字节数与原件一致）：
   `E:\\Git_Repos\\blog-vitepress\\_ws\\_archive-hexo-blog-20260925\\source\\_posts`
   重新跑这个脚本会**覆盖** DST 下的同名文件，正常情况下不需要再跑。
   ⚠️ 注意：归档里含《2021-12-05 毛主席谈他为什么要接见红卫兵》——
   这篇是站长**故意删除**的（见 AGENTS.md「回填日期」一条），跑脚本会把它带回来。
"""
import os
import re

SRC = r'E:\Git_Repos\blog-vitepress\_ws\_archive-hexo-blog-20260925\source\_posts'
DST = r'E:\Git_Repos\blog-vitepress\posts'


def slugify(name):
    name = name[:-3] if name.endswith('.md') else name
    # 全角标点 / 空格 / 中文标点范围
    name = re.sub(r'[\u3000-\u303F\uFF00-\uFFEF\u2014\u2018\u2019\u201C\u201D\u2026\u00B7\s]', '', name)
    # 半角 URL 特殊字符
    name = re.sub(r'[:\'"?!()<>\*\|\\/#%&]', '', name)
    name = re.sub(r'-+', '-', name)
    return name.strip('-')


def clean_frontmatter(text):
    # 删除 abbrlink 行（整行）
    return re.sub(r'(?m)^abbrlink:.*\r?\n', '', text)


def main():
    os.makedirs(DST, exist_ok=True)
    files = sorted(f for f in os.listdir(SRC) if f.endswith('.md'))
    count = 0
    for fn in files:
        with open(os.path.join(SRC, fn), encoding='utf-8') as f:
            content = f.read()
        content = clean_frontmatter(content)
        slug = slugify(fn)
        with open(os.path.join(DST, slug + '.md'), 'w', encoding='utf-8') as f:
            f.write(content)
        count += 1
        print(f'  {fn}  ->  {slug}.md')
    print(f'\n迁移完成：{count} 篇')


if __name__ == '__main__':
    main()
