# -*- coding: utf-8 -*-
"""一次性全站校验（替代此前丢失的 _verify_blog.py 的对应检查项）。

检查：文章数 / 分类唯一性 / 标签受控表 / 知乎残留标签 / 各系列分类一致性。
用法：C:/Users/Ausva/.workbuddy/binaries/python/envs/default/Scripts/python.exe verify_series.py
"""
import glob
import io
import os
import re
import sys
from collections import Counter, defaultdict

ROOT = r'E:\Git_Repos\blog-vitepress'
POSTS = os.path.join(ROOT, 'posts')

# 受控标签表（AGENTS.md 记录，23 词）。故意不收录已废弃的「知乎」。
VOCAB = set('''权力 制度 意识形态 历史 社会心理 方法论 劳动与经济 政治思想史 信息管控
法治与宪法 言论空间 阶层与身份 伦理 历史记忆 文艺 性别 人工智能 婚姻 投资
语言与文字 福利与养老 工业自动化 PLC'''.split())

fails = []


def fail(msg):
    fails.append(msg)
    print('  ❌ ' + msg)


print('=== 1. 文章数与分类 ===')
files = [f for f in glob.glob(os.path.join(POSTS, '*.md')) if os.path.basename(f) != 'index.md']
print('  posts/*.md 共 %d 个（其中 index.md 是归档页，不算文章）' % len(glob.glob(os.path.join(POSTS, '*.md'))))
print('  文章数 = %d' % len(files))
CATEGORIES = Counter()
multi = 0
for f in files:
    txt = io.open(f, encoding='utf-8').read()
    m = re.search(r'^categories:\s*(.+?)\s*$', txt, re.M)
    if not m:
        fail('%s 缺 categories' % os.path.basename(f))
        continue
    val = m.group(1).strip()
    if val.startswith('['):
        fail('%s categories 写成了数组：%s' % (os.path.basename(f), val))
        continue
    CATEGORIES[val] += 1
print('  分类分布（%d 类）:' % len(CATEGORIES))
for k, v in CATEGORIES.most_common():
    print('    %-8s %d' % (k, v))

print('\n=== 2. 标签受控表 ===')
tag_counter = Counter()
for f in files:
    txt = io.open(f, encoding='utf-8').read()
    m = re.search(r'^tags:\n((?:  -.+\n)+)', txt, re.M)
    if not m:
        continue
    for t in re.findall(r'^  - (.+)$', m.group(1), re.M):
        t = t.strip()
        tag_counter[t] += 1
        if t == '知乎':
            fail('%s 仍有已废弃的「知乎」标签' % os.path.basename(f))
        elif t not in VOCAB:
            fail('%s 的标签「%s」不在受控表内' % (os.path.basename(f), t))
print('  标签词数 = %d，总出现 %d 次' % (len(tag_counter), sum(tag_counter.values())))
for k, v in tag_counter.most_common():
    print('    %-10s %d%s' % (k, v, '   ← 非受控表' if k not in VOCAB and k != '知乎' else ''))

print('\n=== 3. 各系列分类一致性（每个系列应只有 1 个分类）===')


def parse_fm_list(fm, key):
    """从 frontmatter 文本里读一个「可能是标量、也可能是列表」的键，返回字符串列表。

    三种写法都要吃得下：
        series: 单向生效                       （标量，存量 70 篇）
        series: [单向生效, 最后的审判]          （行内列表）
        series:                                （块列表）
          - 单向生效
          - 最后的审判
    2026-09-26 起支持一篇同属多个系列，所以这里不能再假设「只有一个值」。
    """
    m = re.search(r'^%s:[ \t]*(.*?)[ \t]*$' % key, fm, re.M)
    if not m:
        return []
    inline = m.group(1).strip()
    if inline.startswith('[') and ']' in inline:
        body = inline[1:inline.rfind(']')]
        vals = [p for p in (x.strip().strip('"\'') for x in body.split(',')) if p]
    elif inline:
        vals = [inline.strip('"\'')]
    else:
        # 块形式：紧随其后的缩进 `- xxx` 行；遇到第一个非列表行立刻停
        vals = []
        for ln in fm[m.end():].split('\n')[1:]:
            lm = re.match(r'^[ \t]+-[ \t]*(.+?)[ \t]*$', ln)
            if not lm:
                break
            v = lm.group(1).strip().strip('"\'')
            if v:
                vals.append(v)
    return vals


pairs = []  # (系列名, 序号, 分类, 文件名) —— 「一篇 × 一个系列」一行
for f in files:
    base = os.path.basename(f)
    txt = io.open(f, encoding='utf-8').read()
    fmm = re.match(r'^---\r?\n(.*?)\r?\n---', txt, re.S)
    fm = fmm.group(1) if fmm else ''
    names = parse_fm_list(fm, 'series')
    orders = parse_fm_list(fm, 'seriesOrder')
    cm = re.search(r'^categories:\s*(.+?)\s*$', fm, re.M)
    cat = cm.group(1).strip() if cm else ''
    if not names:
        continue
    if len(set(names)) != len(names):
        fail('%s 的 series 有重复项：%s' % (base, names))
    # 两个列表按位置一一对应；数量不等一定是写漏了（多出来的序号按「没写」兜底）
    if len(names) != len(orders):
        fail('%s 声明了 %d 个系列，但 seriesOrder 有 %d 个（必须按位置一一对应）'
             % (base, len(names), len(orders)))
    for i, n in enumerate(names):
        o = orders[i] if i < len(orders) else ''
        pairs.append((n, int(o) if o.isdigit() else -1, cat, base))

by_series = defaultdict(set)
for n, _o, cat, _f in pairs:
    by_series[n].add(cat)
for s in sorted(by_series):
    mine = [p for p in pairs if p[0] == s]
    cats = by_series[s]
    orders = sorted(p[1] for p in mine)
    cont = '  ✅' if len(cats) == 1 else '  ❌'
    print('%s 系列「%s」 %d 篇 分类数=%d %s 序号 %s'
          % (cont, s, len(mine), len(cats), sorted(cats), orders))
    if len(cats) != 1:
        fail('系列「%s」被拆散：%s' % (s, sorted(cats)))

# 同一系列内序号重复 = 两篇都自称「第 N 篇」，系列页的顺序就成了抛硬币
for s in sorted(by_series):
    seen_o = {}
    for _n, o, _c, base in [p for p in pairs if p[0] == s]:
        seen_o.setdefault(o, []).append(base)
    for o, who in sorted(seen_o.items()):
        if o != -1 and len(who) > 1:
            fail('系列「%s」的序号 %d 被 %d 篇占用：%s' % (s, o, len(who), who))

multi = [p for p in pairs if len(set(n for n, _o, _c, f2 in pairs if f2 == p[3])) > 1]
if multi:
    print('\n  一篇同属多个系列（%d 篇）：' % len(set(p[3] for p in multi)))
    for base in sorted(set(p[3] for p in multi)):
        ns = [n for n, _o, _c, f2 in pairs if f2 == base]
        print('    %-52s %s' % (base, ' + '.join(ns)))

print('\n=== 4. 《名与数》卷次自洽性 ===')
nm = [f for f in files if 'naming' in os.path.basename(f)]
for f in nm:
    txt = io.open(f, encoding='utf-8').read()
    print('  %s' % os.path.basename(f))
for f in sorted(files):
    if '名与数' in io.open(f, encoding='utf-8').read()[:400]:
        pass
vol = defaultdict(list)
for f in files:
    txt = io.open(f, encoding='utf-8').read()
    head = txt[:600]
    m = re.search(r'《名与数》系列·(卷[一二三四]|别卷)', head)
    if m:
        vol[os.path.basename(f)] = m.group(1)
for k, v in sorted(vol.items()):
    print('    %-52s %s' % (k, v))

print('\n=== 结果 ===')
if fails:
    print('失败 %d 项：' % len(fails))
    for x in fails:
        print('  - ' + x)
    sys.exit(1)
print('全部通过')
