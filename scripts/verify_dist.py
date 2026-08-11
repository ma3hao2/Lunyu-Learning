# dist 与源码一致性校验
# 还原 dist 中 \uXXXX 转义后，校验各页面功能字符串是否编译进产物
import re
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


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

# 期望每个文件中存在的功能字符串（来自源码）
CHECKS = {
    'settings': [
        '同步成功', '云端拉取失败，仅上传本地数据', '同步中...',
        '标准', '大', '特大',           # 字号选项
        '清空学习数据', '字号', '自动同步',  # 设置项
        '默认公开', '匿名昵称',           # 真社区设置项
        '隐私政策',                       # 隐私入口
    ],
    'mine': [
        '点赞心得', '取消公开', '公开', '删除',
        '同步学习进度', '已读章句', '连续学习', '已读篇目',
        '退出', '点击登录',
    ],
    'insights': [
        '还没有公开心得，去写第一条吧',  # 空态引导（COM-013）
        '未找到匹配心得',                # 搜索无结果
        '搜索心得内容',                  # 搜索框
        '下滑加载更多', '已全部加载',     # 分页（COM-012）
        '请先登录',                      # 未登录点赞拦截（COM-010）
    ],
    'verseDetail': [
        '学习心得', '标记为已读', '已读过啦',
        '上一句', '下一句', '写心得',
    ],
    'writeNote': [
        '公开发布', '请输入心得内容',
        '标签最多8个字', '最多添加5个标签',
        '公开发布需先登录',   # COM-010
        '已保存到本地', '发布失败',  # COM-009 降级
        '引用原文',
    ],
    'privacy': [
        '隐私政策', '更新日期', '我们收集的信息',
        '你的权利', '联系我们', '公开发布',
    ],
    'common': [
        'publishNote',        # 云函数名
        'unpublish', 'edit', 'list', 'like', 'unlike',  # 云函数 action
        'likeCount', 'likedByMe', 'authorName',
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
