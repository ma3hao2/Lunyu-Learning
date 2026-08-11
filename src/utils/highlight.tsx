import React from 'react';
import { Text } from '@tarojs/components';

// 高亮匹配文本：拆分为片段数组，每段都用 Text 包裹
// （避免数组混合字符串与元素导致 Taro 调和器报错）
// highlightClassName 由调用方传入各自 SCSS 模块的 .highlight 样式类
export function renderHighlighted(text: string, keyword: string, highlightClassName?: string): React.ReactNode {
  const kw = (keyword || '').trim();
  if (!kw || !text) return text;
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'g');
  const parts = text.split(regex);
  return parts.map((part, i) => {
    if (part === kw) {
      return <Text key={i} className={highlightClassName}>{part}</Text>;
    }
    return <Text key={i}>{part}</Text>;
  });
}
