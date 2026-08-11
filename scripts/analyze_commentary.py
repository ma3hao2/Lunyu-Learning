# 分析现有论语解读的质量分布：按 commentary / translation / keyPoint 长度
# 找出解读偏短的章节，作为内容补充的优先目标
import os
import re
import json
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 字段正则：匹配 verse 对象里的各字段（字段顺序固定：id, chapterId, order, original, translation, commentary, keyPoint）
VERSE_RE = re.compile(
    r'\{\s*id:\s*(\d+)\s*,\s*chapterId:\s*(\d+)\s*,\s*order:\s*(\d+)\s*,\s*'
    r'original:\s*"((?:[^"\\]|\\.)*)"\s*,\s*'
    r'translation:\s*"((?:[^"\\]|\\.)*)"\s*,\s*'
    r'commentary:\s*"((?:[^"\\]|\\.)*)"\s*,\s*'
    r'keyPoint:\s*"((?:[^"\\]|\\.)*)"\s*\}'
)


def unescape(s):
    """还原 TS 字符串里的转义"""
    return s.replace('\\n', '\n').replace('\\"', '"').replace('\\\\', '\\')


def load_all_verses():
    verses = []
    for cid in range(1, 21):
        path = os.path.join(ROOT, 'src/data/verses', f'chapter{cid}.ts')
        with open(path, encoding='utf-8') as f:
            content = f.read()
        for m in VERSE_RE.finditer(content):
            verses.append({
                'id': int(m.group(1)),
                'chapterId': int(m.group(2)),
                'order': int(m.group(3)),
                'original': unescape(m.group(4)),
                'translation': unescape(m.group(5)),
                'commentary': unescape(m.group(6)),
                'keyPoint': unescape(m.group(7)),
            })
    return verses


def main():
    verses = load_all_verses()
    print(f'共解析 {len(verses)} 条章句\n')

    # 总体长度分布
    com_lens = sorted([len(v['commentary']) for v in verses])
    tra_lens = sorted([len(v['translation']) for v in verses])
    print('=' * 64)
    print('总体长度分布')
    print('=' * 64)
    print(f"  commentary  最短{com_lens[0]:4d}  中位{com_lens[len(com_lens)//2]:4d}  平均{sum(com_lens)//len(com_lens):4d}  最长{com_lens[-1]:4d}")
    print(f"  translation 最短{tra_lens[0]:4d}  中位{tra_lens[len(tra_lens)//2]:4d}  平均{sum(tra_lens)//len(tra_lens):4d}  最长{tra_lens[-1]:4d}")
    print()

    # 按篇章统计 commentary 平均长度
    chap = defaultdict(list)
    for v in verses:
        chap[v['chapterId']].append(len(v['commentary']))
    print('=' * 64)
    print('各篇 commentary 平均长度（升序，定位薄弱篇章）')
    print('=' * 64)
    print(f"  {'篇':>4s}  {'平均':>6s}  {'最短':>6s}  {'最长':>6s}  {'条数':>4s}")
    for cid in sorted(chap, key=lambda c: sum(chap[c]) / len(chap[c])):
        vals = chap[cid]
        print(f"  第{cid:2d}篇  {sum(vals)//len(vals):6d}  {min(vals):6d}  {max(vals):6d}  {len(vals):4d}")
    print()

    # commentary 分档统计
    print('=' * 64)
    print('commentary 长度分档统计')
    print('=' * 64)
    bins = [(0, 100), (100, 200), (200, 400), (400, 800), (800, 1500), (1500, 99999)]
    labels = ['<100(极短)', '100-200(短)', '200-400(偏短)', '400-800(适中)', '800-1500(充实)', '>1500(详尽)']
    for (lo, hi), label in zip(bins, labels):
        cnt = sum(1 for v in verses if lo <= len(v['commentary']) < hi)
        print(f"  {label:16s}: {cnt:4d} 条 ({cnt*100//len(verses)}%)")
    print()

    # 最短的 30 条（优先补充目标）
    print('=' * 64)
    print('commentary 最短的 30 条（优先补充目标）')
    print('=' * 64)
    print(f"  {'id':>5s}  {'篇':>3s}  {'序':>3s}  {'com':>5s}  {'原文':<30s}")
    short = sorted(verses, key=lambda v: len(v['commentary']))[:30]
    for v in short:
        orig = v['original'][:28].replace('\n', ' ')
        print(f"  {v['id']:5d}  第{v['chapterId']:2d}篇  {v['order']:3d}  {len(v['commentary']):5d}  {orig}")
    print()

    # 输出 JSON 供后续使用
    out = {
        'total': len(verses),
        'short_verses': [
            {
                'id': v['id'],
                'chapterId': v['chapterId'],
                'order': v['order'],
                'original': v['original'],
                'commentary_len': len(v['commentary']),
                'commentary_preview': v['commentary'][:80],
            }
            for v in sorted(verses, key=lambda x: len(x['commentary']))[:60]
        ],
    }
    out_path = os.path.join(ROOT, 'scripts', 'commentary_analysis.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f'已输出前60短明细到 {out_path}')


if __name__ == '__main__':
    main()
