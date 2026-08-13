import Taro from '@tarojs/taro';

// 应用设置（设备维度，不随用户切换；与学习进度存储分离，清空学习数据时不受影响）
export type FontSize = 'normal' | 'large' | 'xl';

export interface AppSettings {
  fontSize: FontSize;          // 正文字号：标准 / 大 / 特大
  defaultPublic: boolean;      // 存量兼容：历史默认公开发布设置（去 UGC 后不再使用）
  anonymousNickname: boolean;  // 存量兼容：历史匿名昵称设置（去 UGC 后不再使用）
  autoSync: boolean;           // 自动同步（保存进度后防抖上传云端）
}

const SETTINGS_KEY = 'lunyu_settings';

const FONT_SIZES: FontSize[] = ['normal', 'large', 'xl'];

const DEFAULT_SETTINGS: AppSettings = {
  fontSize: 'normal',
  defaultPublic: false,
  anonymousNickname: false,
  autoSync: true
};

// 读取应用设置（损坏/缺省时回退默认值，逐字段规范化）
export function getSettings(): AppSettings {
  try {
    const data = Taro.getStorageSync(SETTINGS_KEY);
    if (data && typeof data === 'object') {
      return {
        fontSize: FONT_SIZES.includes(data.fontSize) ? data.fontSize : DEFAULT_SETTINGS.fontSize,
        defaultPublic: typeof data.defaultPublic === 'boolean' ? data.defaultPublic : DEFAULT_SETTINGS.defaultPublic,
        anonymousNickname: typeof data.anonymousNickname === 'boolean' ? data.anonymousNickname : DEFAULT_SETTINGS.anonymousNickname,
        autoSync: typeof data.autoSync === 'boolean' ? data.autoSync : DEFAULT_SETTINGS.autoSync
      };
    }
  } catch (e) {
    console.error('[Settings] getSettings failed:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

// 保存应用设置（整对象覆盖）
export function saveSettings(settings: AppSettings): boolean {
  try {
    Taro.setStorageSync(SETTINGS_KEY, settings);
    return true;
  } catch (e) {
    console.error('[Settings] saveSettings failed:', e);
    return false;
  }
}
