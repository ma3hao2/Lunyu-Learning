# 检查 mock 遗留字段是否编译进 dist 产物
import re
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def decode_unicode_escapes(text):
    return re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), text)


# mock 点赞遗留字段（应已清理，dist 中不应再出现）
MOCK_FIELDS = [
    'likedInsightIds',
    'unlikedInsightIds',
    'toggleInsightLike',
]


def main():
    print('=' * 60)
    print('mock 点赞遗留字段在 dist 中的残留检查')
    print('=' * 60)
    found_any = False
    for root, _, files in os.walk(os.path.join(ROOT, 'dist')):
        for fn in files:
            if not fn.endswith('.js'):
                continue
            p = os.path.join(root, fn)
            with open(p, 'r', encoding='utf-8') as f:
                content = decode_unicode_escapes(f.read())
            hits = [k for k in MOCK_FIELDS if k in content]
            if hits:
                rel = os.path.relpath(p, ROOT)
                print(f'  {rel}: {hits}')
                found_any = True
    if not found_any:
        print('  未发现 mock 遗留字段（likedInsightIds/unlikedInsightIds/toggleInsightLike）')
    print()
    print('=' * 60)
    print('结论:', '存在残留（需清理源码后重新构建）' if found_any else 'dist 无 mock 残留字段')
    print('=' * 60)
    return 0 if not found_any else 1


if __name__ == '__main__':
    sys.exit(main())
