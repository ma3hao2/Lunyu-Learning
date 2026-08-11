# 统计提炼版各篇字词注释与解读评析的字数
import re
import os

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '论语学习心得提炼版')


def count_chars(text):
    """统计纯文字字数（去除 markdown 标记、空白、标点占位）"""
    # 去除 markdown 标记符号
    cleaned = re.sub(r'[#>*\-\[\]\(\)`\s]', '', text)
    return len(cleaned)


def main():
    files = sorted(f for f in os.listdir(ROOT) if f.endswith('.md'))
    print('=' * 56)
    print(f'提炼版字数统计（共 {len(files)} 篇）')
    print('=' * 56)
    print(f"{'文件':<48s} {'注释':>6s} {'解读':>6s} {'合计':>6s}")
    print('-' * 56)
    all_ok = True
    for fn in files:
        path = os.path.join(ROOT, fn)
        with open(path, encoding='utf-8') as f:
            content = f.read()
        m1 = re.search(r'## 字词注释(.*?)(?=## 解读评析)', content, re.DOTALL)
        m2 = re.search(r'## 解读评析(.*)', content, re.DOTALL)
        n1 = count_chars(m1.group(1)) if m1 else 0
        n2 = count_chars(m2.group(1)) if m2 else 0
        total = n1 + n2
        ok = '✓' if total >= 800 else '✗'
        if total < 800:
            all_ok = False
        print(f'{fn:<48s} {n1:6d} {n2:6d} {total:6d} {ok}')
    print('-' * 56)
    print('标准: 合计 >= 800 字')
    print('结论:', '全部达标' if all_ok else '存在未达标篇目')


if __name__ == '__main__':
    main()
