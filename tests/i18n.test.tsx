/**
 * i18n 基建测试（node 环境，无 DOM）：
 * 字典 zh/en 对齐、translate/themeLabel 纯函数、makeI18nValue 取值回退、
 * Provider 渲染读设置、applyTabBarLang 联动、服务层 getLang/t。
 */
import React from 'react';
import { renderToString } from 'react-dom/server';
import Taro from '@tarojs/taro';
import { messages, translate, themeLabel, THEME_EN } from '@/i18n/messages';
import { I18nProvider, useI18n, getLang, t as tGlobal, applyTabBarLang, makeI18nValue } from '@/i18n';
import { saveLanguage } from '@/utils/settings';
import { chapters } from '@/data/chapters';
import type { Verse } from '@/types';

const getStore = () => (Taro as any).__store__ as Record<string, any>;
const SETTINGS_KEY = 'lunyu_settings';

// 渲染探针：输出 tabBar 首项文案，兼读 lang
let latestLang: string | null = null;
function Probe(): React.ReactElement {
  const i18n = useI18n();
  latestLang = i18n.lang;
  return <div>{i18n.t('tab.home')}</div>;
}

describe('字典完整性（zh / en 并排）', () => {
  test('每条文案 zh 与 en 均非空', () => {
    for (const entry of Object.values(messages)) {
      expect(entry.zh.trim()).not.toBe('');
      expect(entry.en.trim()).not.toBe('');
    }
  });

  test('THEME_EN 覆盖中文 chapters 的全部主题', () => {
    const themes = new Set(chapters.map(c => c.theme));
    for (const theme of themes) {
      expect(THEME_EN[theme]).toBeDefined();
    }
  });
});

describe('translate / themeLabel', () => {
  test('zh / en 取值正确', () => {
    expect(translate('zh', 'tab.home')).toBe('首页');
    expect(translate('en', 'tab.home')).toBe('Home');
  });

  test('占位符替换', () => {
    expect(translate('en', 'search.found', { n: 12 })).toBe('12 matches found');
    expect(translate('zh', 'classics.found', { verses: 3, chapters: 2 })).toBe('找到 3 条章句、2 篇篇章');
  });

  test('未知占位符保持原样', () => {
    expect(translate('en', 'search.found', { other: 1 })).toBe('{n} matches found');
  });

  test('themeLabel：en 查表、zh 原样、无对照回退原文', () => {
    expect(themeLabel('en', '学习修身')).toBe('Learning & Self-Cultivation');
    expect(themeLabel('zh', '学习修身')).toBe('学习修身');
    expect(themeLabel('en', '不存在的主题')).toBe('不存在的主题');
  });
});

describe('makeI18nValue（取值逻辑）', () => {
  const zhTitle = chapters[0].title;
  const zhDesc = chapters[0].description;
  const verse: Verse = {
    id: 101, chapterId: 1, order: 1,
    original: '子曰',
    translation: '中文译文',
    commentary: '中文注释',
    keyPoint: '学习'
  };
  const en = { id: 101, translation: 'EN translation', commentary: 'EN commentary', keyPoint: 'learning' };

  test('中文：t/theme/chapterTitle/verseText 均取中文', () => {
    const v = makeI18nValue('zh', () => {});
    expect(v.lang).toBe('zh');
    expect(v.t('verse.translation')).toBe('白话译文');
    expect(v.theme('学习修身')).toBe('学习修身');
    expect(v.chapterTitle(1, zhTitle)).toBe(zhTitle);
    expect(v.chapterDescription(1, zhDesc)).toBe(zhDesc);
    expect(v.verseText(verse)).toEqual({ translation: '中文译文', commentary: '中文注释', keyPoint: '学习' });
    expect(v.verseText(verse, en).translation).toBe('EN translation'); // 显式传入英文时也生效
  });

  test('英文：章节取 chaptersEn、主题查表、章句英文优先缺失回退', () => {
    const v = makeI18nValue('en', () => {});
    expect(v.t('verse.translation')).toBe('Translation');
    expect(v.theme('学习修身')).toBe('Learning & Self-Cultivation');
    expect(v.chapterTitle(1, zhTitle)).toBe('Xue Er · Learning');
    expect(v.chapterDescription(1, '中文简介')).toContain('learning');
    // 未收录 id 回退中文
    expect(v.chapterTitle(999, '回退标题')).toBe('回退标题');
    // 英文缺失逐字段回退中文
    expect(v.verseText(verse, null)).toEqual({ translation: '中文译文', commentary: '中文注释', keyPoint: '学习' });
    expect(v.verseText(verse, { id: 101, translation: 'EN', commentary: '', keyPoint: '' }).commentary).toBe('中文注释');
  });
});

describe('applyTabBarLang（tabBar 文案联动）', () => {
  beforeEach(() => {
    (Taro.setTabBarItem as jest.Mock).mockClear();
  });

  test('英文模式刷新 4 个 tab 为英文', () => {
    applyTabBarLang('en');
    expect(Taro.setTabBarItem).toHaveBeenCalledTimes(4);
    expect(Taro.setTabBarItem).toHaveBeenNthCalledWith(1, { index: 0, text: 'Home' });
    expect(Taro.setTabBarItem).toHaveBeenNthCalledWith(2, { index: 1, text: 'Analects' });
    expect(Taro.setTabBarItem).toHaveBeenNthCalledWith(3, { index: 2, text: 'Notes' });
    expect(Taro.setTabBarItem).toHaveBeenNthCalledWith(4, { index: 3, text: 'Me' });
  });

  test('中文模式刷新 4 个 tab 为中文', () => {
    applyTabBarLang('zh');
    expect(Taro.setTabBarItem).toHaveBeenNthCalledWith(1, { index: 0, text: '首页' });
    expect(Taro.setTabBarItem).toHaveBeenNthCalledWith(2, { index: 1, text: '论语' });
  });

  test('setTabBarItem 抛错时不影响后续 tab', () => {
    (Taro.setTabBarItem as jest.Mock).mockClear();
    (Taro.setTabBarItem as jest.Mock).mockImplementationOnce(() => { throw new Error('not ready'); });
    expect(() => applyTabBarLang('en')).not.toThrow();
    expect(Taro.setTabBarItem).toHaveBeenCalledTimes(4);
  });
});

describe('Provider 渲染 / 服务层取语言', () => {
  beforeEach(() => {
    Taro.clearStorageSync();
  });

  test('Provider 默认中文渲染', () => {
    const html = renderToString(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );
    expect(html).toContain('首页');
    expect(latestLang).toBe('zh');
  });

  test('Provider 读取存储中的英文设置（App 启动已保存语言的场景）', () => {
    Taro.setStorageSync(SETTINGS_KEY, { language: 'en' });
    const html = renderToString(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );
    expect(html).toContain('Home');
    expect(latestLang).toBe('en');
  });

  test('无 Provider 回退：直读设置存储', () => {
    Taro.setStorageSync(SETTINGS_KEY, { language: 'en' });
    const html = renderToString(<Probe />);
    expect(html).toContain('Home');
  });

  test('服务层 getLang / t 跟随存储语言', () => {
    Taro.clearStorageSync();
    expect(getLang()).toBe('zh');
    expect(tGlobal('tab.classics')).toBe('论语');
    saveLanguage('en');
    expect(getLang()).toBe('en');
    expect(tGlobal('tab.classics')).toBe('Analects');
  });
});
