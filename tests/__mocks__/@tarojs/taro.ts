// Taro 测试 mock：使用内存对象模拟小程序本地存储
const _store: Record<string, any> = {};

const Taro = {
  // 同步本地存储
  getStorageSync(key: string) {
    return _store[key] ?? '';
  },
  setStorageSync(key: string, data: any) {
    _store[key] = data;
  },
  removeStorageSync(key: string) {
    delete _store[key];
  },
  clearStorageSync() {
    for (const k of Object.keys(_store)) delete _store[k];
  },
  // Toast / 导航
  showToast: jest.fn(),
  showLoading: jest.fn(),
  hideLoading: jest.fn(),
  showModal: jest.fn(),
  navigateTo: jest.fn(),
  navigateBack: jest.fn(),
  switchTab: jest.fn(),
  redirectTo: jest.fn(),
  // 原生界面文案（i18n：tabBar / 导航栏标题）
  setTabBarItem: jest.fn(),
  setNavigationBarTitle: jest.fn(),
  // 页面栈（i18n tabBar 守卫用；默认模拟当前在 tab 页）
  getCurrentPages: jest.fn(() => [{ route: 'pages/home/index' }]),
  // 登录
  login: jest.fn(),
  // 隐私授权（P1-5：微信隐私保护框架，基础库 2.32.3+）
  getPrivacySetting: jest.fn(),
  requirePrivacyAuthorize: jest.fn(),
  openPrivacyContract: jest.fn(),
  // 云开发
  cloud: {
    init: jest.fn(),
    callFunction: jest.fn(),
    database: jest.fn()
  },
  // 事件
  eventCenter: {
    on: jest.fn(),
    off: jest.fn(),
    trigger: jest.fn()
  },
  // 页面生命周期（useProgress 等在页面组件中使用）
  useDidShow: jest.fn(),
  useDidHide: jest.fn(),
  // 工具方法
  pxTransform: (n: number) => `${n}px`,
  getSystemInfoSync: () => ({
    windowWidth: 375,
    windowHeight: 667,
    platform: 'ios'
  })
};

// 暴露内部存储以便测试在用例间重置
;(Taro as any).__store__ = _store;

export default Taro;
export const getStorageSync = Taro.getStorageSync;
export const setStorageSync = Taro.setStorageSync;
export const removeStorageSync = Taro.removeStorageSync;
export const clearStorageSync = Taro.clearStorageSync;
export const showToast = Taro.showToast;
export const navigateTo = Taro.navigateTo;
export const navigateBack = Taro.navigateBack;
export const switchTab = Taro.switchTab;
export const redirectTo = Taro.redirectTo;
export const getPrivacySetting = Taro.getPrivacySetting;
export const requirePrivacyAuthorize = Taro.requirePrivacyAuthorize;
export const openPrivacyContract = Taro.openPrivacyContract;
export const setTabBarItem = Taro.setTabBarItem;
export const setNavigationBarTitle = Taro.setNavigationBarTitle;
export const getCurrentPages = Taro.getCurrentPages;
export const eventCenter = Taro.eventCenter;
export const useDidShow = Taro.useDidShow;
export const useDidHide = Taro.useDidHide;
export const pxTransform = Taro.pxTransform;
export const getSystemInfoSync = Taro.getSystemInfoSync;
