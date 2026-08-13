/**
 * 搜索高亮渲染测试（src/utils/highlight.tsx）
 *
 * renderHighlighted 返回字符串或 React 元素数组（Taro Text 组件），
 * 这里直接检查返回结构（元素 props），不依赖 DOM 渲染。
 */
import { renderHighlighted } from '@/utils/highlight';

type El = { props: { className?: string; children?: any } };

describe('搜索高亮渲染（renderHighlighted）', () => {
  test('命中关键词时拆分为片段，高亮段带 className', () => {
    const result = renderHighlighted('学而时习之，不亦说乎', '习之', 'hl') as El[];
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(3); // 前段 / 高亮 / 后段
    const hl = result.find(el => el.props.className === 'hl');
    expect(hl).toBeTruthy();
    expect(hl!.props.children).toBe('习之');
  });

  test('多个匹配各生成高亮段', () => {
    // split 含空串：'abab' 按 /(a)/g 拆为 ['', 'a', 'b', 'a', 'b'] → 5 段
    const result = renderHighlighted('abab', 'a', 'hl') as El[];
    expect(result).toHaveLength(5);
    expect(result.filter(el => el.props.className === 'hl')).toHaveLength(2);
  });

  test('关键词未命中时返回单片段元素（无高亮样式）', () => {
    // split 无匹配时也走 map 包裹：返回长度为 1 的元素数组，非原字符串
    const result = renderHighlighted('学而时习之', '不存在') as El[];
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].props.children).toBe('学而时习之');
    expect(result[0].props.className).toBeUndefined();
  });

  test('空关键词或空文本返回原值（字符串，不包裹）', () => {
    expect(renderHighlighted('学而时习之', '')).toBe('学而时习之');
    expect(renderHighlighted('学而时习之', '   ')).toBe('学而时习之');
    expect(renderHighlighted('', '学')).toBe('');
  });

  test('正则特殊字符被转义（. 不当通配符）', () => {
    // 'a.c' 若未转义会作为正则匹配 'abc'（. 为通配符），转义后按字面匹配 → 未命中单片段
    const miss = renderHighlighted('abc', 'a.c') as El[];
    expect(miss).toHaveLength(1);
    expect(miss[0].props.children).toBe('abc');
    const hit = renderHighlighted('a.c', 'a.c', 'hl') as El[];
    expect(hit.find(el => el.props.className === 'hl')).toBeTruthy();
  });

  test('高亮词在文本开头/结尾时片段数正确（split 含首尾空串）', () => {
    expect(renderHighlighted('学而时习之', '学而')).toHaveLength(3); // ['', 高亮, 后段]
    expect(renderHighlighted('学而时习之', '习之')).toHaveLength(3); // [前段, 高亮, '']
  });
});
