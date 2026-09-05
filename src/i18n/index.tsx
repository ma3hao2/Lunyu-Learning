// 语言上下文：全局由 App 内 Provider 注入；无 Provider 时（测试/服务层直调）回退直读设置存储
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Taro from '@tarojs/taro';
import type { ReactNode } from 'react';
import type { Language, Verse, VerseEn } from '@/types';
import { getSettings, saveLanguage } from '@/utils/settings';
import { chaptersEn } from '@/data/chaptersEn';
import { translate, themeLabel } from './messages';
import type { MessageKey } from './messages';

// 底部 tab 与 app.config.ts tabBar.list 的顺序一致
const TAB_KEYS: MessageKey[] = ['tab.home', 'tab.classics', 'tab.notes', 'tab.mine'];

interface I18nValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  theme: (theme: string) => string;
  // 章节标题/简介按语言取（英文缺失回退中文）
  chapterTitle: (chapterId: number, zhTitle: string) => string;
  chapterDescription: (chapterId: number, zhDescription: string) => string;
  // 章句译文/注释/要点按语言取：英文模式由调用方传入该句英文（en），缺失回退中文
  verseText: (verse: Verse, en?: VerseEn | null) => { translation: string; commentary: string; keyPoint: string };
}

export const I18nContext = createContext<I18nValue | null>(null);

const chaptersEnMap = new Map(chaptersEn.map(c => [c.id, c]));

// 组装当前语言的取值函数（Provider 与回退分支共用；导出供测试直测取值逻辑）
export function makeI18nValue(lang: Language, setLang: (lang: Language) => void): I18nValue {
  return {
    lang,
    setLang,
    t: (key, vars) => translate(lang, key, vars),
    theme: (theme) => themeLabel(lang, theme),
    chapterTitle: (chapterId, zhTitle) => {
      if (lang !== 'en') return zhTitle;
      return chaptersEnMap.get(chapterId)?.title ?? zhTitle;
    },
    chapterDescription: (chapterId, zhDescription) => {
      if (lang !== 'en') return zhDescription;
      return chaptersEnMap.get(chapterId)?.description ?? zhDescription;
    },
    verseText: (verse, en) => ({
      // 空字符串视同缺失：英文数据个别字段为空时逐字段回退中文
      translation: en?.translation || verse.translation,
      commentary: en?.commentary || verse.commentary,
      keyPoint: en?.keyPoint || verse.keyPoint,
    }),
  };
}

// 原生 tabBar 文案按语言更新（weapp 原生 tab / H5 Taro 自绘 tab 均支持 setTabBarItem）
// 失败静默（个别端不支持时不影响功能），页面内导航栏标题由各页 useDidShow 自行刷新
export function applyTabBarLang(lang: Language): void {
  TAB_KEYS.forEach((key, index) => {
    try {
      Taro.setTabBarItem({ index, text: translate(lang, key) });
    } catch (e) {
      // 某些端/时机（如页面栈未就绪）可能失败，忽略即可
    }
  });
}

// 服务层（无 React 上下文）读取当前语言
export function getLang(): Language {
  return getSettings().language;
}

// 服务层（无 React 上下文）直接取文案
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  return translate(getLang(), key, vars);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => getSettings().language);

  const setLang = useCallback((next: Language) => {
    saveLanguage(next);
    setLangState(next);
    applyTabBarLang(next);
    // 仅 H5 有 document：同步 <html lang>（无障碍/SEO 生效）
    if (process.env.TARO_ENV === 'h5' && typeof document !== 'undefined') {
      document.documentElement.lang = next === 'en' ? 'en' : 'zh-CN';
    }
  }, []);

  // 启动时按已存语言刷新 tabBar（覆盖 app.config.ts 的中文默认）
  useEffect(() => {
    if (lang === 'en') {
      applyTabBarLang(lang);
    }
    if (process.env.TARO_ENV === 'h5' && typeof document !== 'undefined') {
      document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    }
  }, []);

  const value = useMemo(() => makeI18nValue(lang, setLang), [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// 页面/组件取语言的唯一入口
export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // 无 Provider 时（测试直渲染页面）回退直读设置存储
  return makeI18nValue(getSettings().language, (next) => {
    saveLanguage(next);
    applyTabBarLang(next);
  });
}
