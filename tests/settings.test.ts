/**
 * 应用设置（字号/界面语言/默认公开/匿名昵称/自动同步）测试
 */
import Taro from '@tarojs/taro';
import { getSettings, saveSettings, saveLanguage, type AppSettings } from '@/utils/settings';

const getStore = () => (Taro as any).__store__ as Record<string, any>;
const SETTINGS_KEY = 'lunyu_settings';

describe('应用设置（settings）', () => {
  test('默认设置：标准字号、中文界面、默认不公开、非匿名、自动同步开启', () => {
    const s = getSettings();
    expect(s.fontSize).toBe('normal');
    expect(s.language).toBe('zh');
    expect(s.defaultPublic).toBe(false);
    expect(s.anonymousNickname).toBe(false);
    expect(s.autoSync).toBe(true);
  });

  test('saveSettings → getSettings 往返一致', () => {
    const settings: AppSettings = {
      fontSize: 'xl',
      language: 'en',
      defaultPublic: true,
      anonymousNickname: true,
      autoSync: false
    };
    expect(saveSettings(settings)).toBe(true);
    expect(getStore()[SETTINGS_KEY]).toEqual(settings);
    expect(getSettings()).toEqual(settings);
  });

  test('存储损坏（非对象）时回退默认值', () => {
    getStore()[SETTINGS_KEY] = 'broken';
    expect(getSettings()).toEqual({
      fontSize: 'normal',
      language: 'zh',
      defaultPublic: false,
      anonymousNickname: false,
      autoSync: true
    });
  });

  test('部分字段缺失/非法时逐字段规范化', () => {
    getStore()[SETTINGS_KEY] = { fontSize: 'huge', autoSync: false, language: 'ja' };
    const s = getSettings();
    expect(s.fontSize).toBe('normal'); // 非法字号回退默认
    expect(s.language).toBe('zh');     // 非法语言回退默认
    expect(s.autoSync).toBe(false);    // 合法值保留
    expect(s.defaultPublic).toBe(false);
    expect(s.anonymousNickname).toBe(false);
  });

  test('saveLanguage 仅切换语言，其余设置保留', () => {
    getStore()[SETTINGS_KEY] = { fontSize: 'large', language: 'zh', autoSync: false };
    expect(saveLanguage('en')).toBe(true);
    const s = getSettings();
    expect(s.language).toBe('en');
    expect(s.fontSize).toBe('large');
    expect(s.autoSync).toBe(false);
  });
});
