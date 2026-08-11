export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/classics/index',
    'pages/insights/index',
    'pages/mine/index',
    'pages/settings/index',
    'pages/privacy/index'
  ],
  // 分包：章句详情、写心得、译文搜索等次级页面 + 完整章节数据（按需下载，减小主包体积）
  subPackages: [
    {
      root: 'packageContent',
      pages: [
        'pages/chapterDetail/index',
        'pages/verseDetail/index',
        'pages/writeNote/index',
        'pages/search/index'
      ]
    }
  ],
  // 组件按需注入：微信代码质量检查要求启用（微信开发者平台"代码质量"未通过项）
  // 已知坑：开发者工具内 Taro 分包页面经主包 base.wxml 引用主包 comp 组件时，
  // 某些工具/基础库版本会白屏或报 wx://not-found，真机正常（详见 docs/开发记录）。
  // 若在开发者工具复现，可切换调试基础库版本或升级开发者工具验证，真机发布不受影响。
  lazyCodeLoading: 'requiredComponents',
  window: {
    backgroundTextStyle: 'dark',
    navigationBarBackgroundColor: '#faf6f0',
    navigationBarTitleText: '论语学习',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#999999',
    selectedColor: '#b8612d',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页',
        iconPath: 'assets/tabbar/home.png',
        selectedIconPath: 'assets/tabbar/home-selected.png'
      },
      {
        pagePath: 'pages/classics/index',
        text: '论语',
        iconPath: 'assets/tabbar/classics.png',
        selectedIconPath: 'assets/tabbar/classics-selected.png'
      },
      {
        pagePath: 'pages/insights/index',
        text: '心得',
        iconPath: 'assets/tabbar/insights.png',
        selectedIconPath: 'assets/tabbar/insights-selected.png'
      },
      {
        pagePath: 'pages/mine/index',
        text: '我的',
        iconPath: 'assets/tabbar/mine.png',
        selectedIconPath: 'assets/tabbar/mine-selected.png'
      }
    ]
  }
})
