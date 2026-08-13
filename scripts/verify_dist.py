# dist 与源码一致性校验
# 还原 dist 中 \uXXXX 转义后，校验各页面功能字符串是否编译进产物
import re
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Windows 控制台默认 GBK，强制 stdout 为 UTF-8，避免打印 ✓/中文时 UnicodeEncodeError
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


def decode_unicode_escapes(text):
    # 匹配 \uXXXX（4 位 hex），还原为对应字符
    return re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), text)


def load(path):
    full = os.path.join(ROOT, path)
    if not os.path.exists(full):
        return None
    with open(full, 'r', encoding='utf-8') as f:
        return decode_unicode_escapes(f.read())


# 各 dist 文件路径
FILES = {
    'settings': 'dist/pages/settings/index.js',
    'mine': 'dist/pages/mine/index.js',
    'insights': 'dist/pages/insights/index.js',
    'verseDetail': 'dist/packageContent/pages/verseDetail/index.js',
    'writeNote': 'dist/packageContent/pages/writeNote/index.js',
    'privacy': 'dist/pages/privacy/index.js',
    'common': 'dist/common.js',
    'app.json': 'dist/app.json',
}

# 期望每个文件中存在的功能字符串（来自源码；去 UGC 改造后已更新为当前文案）
CHECKS = {
    'settings': [
        '同步中...', '同步失败', '数据已清空', '本地已清空，云端清理失败',
        '标准', '大', '特大',           # 字号选项
        '清空学习数据',                  # 数据管理
        '需同意隐私政策后才能复制',      # 隐私入口校验
        '论语学习者',                   # 默认昵称
    ],
    'mine': [
        '点击登录', '登录成功', '已退出登录',
        '继续阅读', '我的笔记', '设置',   # 功能菜单
        '论语二十篇', '学习总进度',       # 进度
        '编辑资料', '保存',
    ],
    'insights': [
        '我的笔记', '记录你的学习感悟',
        '编辑', '删除',                  # 笔记操作
        '还没有笔记，去学习后写第一条笔记吧',  # 空态
        '已删除', '删除失败',
    ],
    'verseDetail': [
        '标记已读', '已读过啦',
        '写笔记', '删除笔记',
        '还没有笔记，点击上方"写笔记"记录你的感悟',  # 空态
    ],
    'writeNote': [
        '引用原文', '请输入笔记内容',
        '标签最多8个字', '最多添加5个标签',
        '保存笔记', '更新笔记', '编辑笔记',
        '保存成功', '加载失败，请重试',
    ],
    'privacy': [
        '隐私政策', '更新日期', '我们收集的信息',
        '你的权利', '联系我们',
    ],
    'common': [
        'syncProgress',       # 进度同步云函数名（login/syncProgress 链路未 tree-shake）
        '论语学习者',         # 默认昵称兜底
    ],
}

# app.json 页面注册校验
APP_PAGES = [
    'pages/home/index', 'pages/classics/index', 'pages/insights/index',
    'pages/mine/index', 'pages/settings/index', 'pages/privacy/index',
]
APP_SUBPKG = {
    'packageContent': [
        'pages/chapterDetail/index', 'pages/verseDetail/index',
        'pages/writeNote/index', 'pages/search/index',
    ],
}


def main():
    all_ok = True
    print('=' * 60)
    print('dist 各页面功能字符串校验（Unicode 转义已还原）')
    print('=' * 60)

    # app.json 单独做页面注册校验，不参与上面的字符串检查
    for page in CHECKS:
        path = FILES[page]
        content = load(path)
        if content is None:
            print(f'  [{page}] ✗ 文件缺失: {path}')
            all_ok = False
            continue
        missing = [s for s in CHECKS[page] if s not in content]
        if missing:
            all_ok = False
            print(f'  [{page}] ✗ 缺失 {len(missing)} 项: {missing}')
        else:
            print(f'  [{page}] ✓ {len(CHECKS[page])} 项全中')

    # app.json 页面注册
    print()
    print('=' * 60)
    print('app.json 页面注册校验')
    print('=' * 60)
    app = load('dist/app.json')
    if app is None:
        print('  ✗ dist/app.json 缺失')
        all_ok = False
    else:
        import json
        cfg = json.loads(app)
        dist_pages = cfg.get('pages', [])
        for p in APP_PAGES:
            ok = p in dist_pages
            print(f'  主包 {p}: {"✓" if ok else "✗ 缺失"}')
            if not ok:
                all_ok = False
        for root, pages in APP_SUBPKG.items():
            dist_sub = [s.get('root') for s in cfg.get('subPackages', [])]
            if root not in dist_sub:
                print(f'  分包 {root}: ✗ 缺失')
                all_ok = False
                continue
            sub = next(s for s in cfg.get('subPackages', []) if s.get('root') == root)
            sub_pages = sub.get('pages', [])
            for p in pages:
                ok = p in sub_pages
                print(f'  分包 {root}/{p}: {"✓" if ok else "✗ 缺失"}')
                if not ok:
                    all_ok = False

    # 云函数文件
    print()
    print('=' * 60)
    print('云函数产物校验（cloudfunctions 不参与 build，应直接存在）')
    print('=' * 60)
    cf_files = [
        'cloudfunctions/publishNote/index.js',
        'cloudfunctions/publishNote/validate.js',
        'cloudfunctions/login/index.js',
        'cloudfunctions/syncProgress/index.js',
    ]
    for f in cf_files:
        full = os.path.join(ROOT, f)
        ok = os.path.exists(full)
        print(f'  {f}: {"✓" if ok else "✗ 缺失"}')
        if not ok:
            all_ok = False

    print()
    print('=' * 60)
    print('总体结论:', '✓ 全部一致' if all_ok else '✗ 存在不一致')
    print('=' * 60)
    return 0 if all_ok else 1


if __name__ == '__main__':
    sys.exit(main())
