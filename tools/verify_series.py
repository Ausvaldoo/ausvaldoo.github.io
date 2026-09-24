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
by_series = defaultdict(set)
info = {}
for f in files:
    txt = io.open(f, encoding='utf-8').read()
    s = re.search(r'^series:\s*(.+?)\s*$', txt, re.M)
    c = re.search(r'^categories:\s*(.+?)\s*$', txt, re.M)
    o = re.search(r'^seriesOrder:\s*(\d+)\s*$', txt, re.M)
    if s and c:
        by_series[s.group(1)].add(c.group(1).strip())
    info[os.path.basename(f)] = (s.group(1) if s else '', int(o.group(1)) if o else -1)
for s, cats in sorted(by_series.items()):
    n = sum(1 for f, (ss, _) in info.items() if ss == s)
    orders = sorted(o for f, (ss, o) in info.items() if ss == s)
    cont = '  ✅' if len(cats) == 1 else '  ❌'
    print('%s 系列「%s」 %d 篇 分类数=%d %s 序号 %s'
          % (cont, s, n, len(cats), sorted(cats), orders))
    if len(cats) != 1:
        fail('系列「%s」被拆散：%s' % (s, sorted(cats)))

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
