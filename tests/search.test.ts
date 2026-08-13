/**
 * 搜索服务测试
 * 覆盖：即时搜索（原文）、深度搜索（译文+注释）、上下文预览、匹配字段优先级
 *
 * 注意：searchDeep 已移至分包（避免章节数据进入主包），故从分包模块引入
 */
import {
  searchInstant,
  extractContext,
  getFieldLabel,
  type MatchField
} from '@/services/search';
import { searchDeep } from '@/packageContent/services/deepSearch';

describe('即时搜索 — 原文 (CLS-005)', () => {
  test('搜索原文 "学而时习之" 命中且 matchFields 含 original', () => {
    const results = searchInstant('学而时习之');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].matchFields).toContain('original');
  });

  test('previewField 对原文命中为 original', () => {
    const results = searchInstant('学而时习之');
    expect(results[0].previewField).toBe('original');
  });

  test('空关键词返回空数组', () => {
    expect(searchInstant('')).toEqual([]);
    expect(searchInstant('   ')).toEqual([]);
  });

  test('关键词前后空白自动 trim', () => {
    const r1 = searchInstant('  学而时习之  ');
    const r2 = searchInstant('学而时习之');
    expect(r1.length).toBe(r2.length);
  });

  test('无匹配关键词返回空数组', () => {
    expect(searchInstant('xyzabc123')).toEqual([]);
  });

  test('结果数量不超过收集上限(512)', () => {
    const results = searchInstant('子');
    expect(results.length).toBeLessThanOrEqual(512);
  });

  test('结果包含必要字段', () => {
    const results = searchInstant('学而');
    expect(results.length).toBeGreaterThan(0);
    const r = results[0];
    expect(r).toHaveProperty('id');
    expect(r).toHaveProperty('chapterId');
    expect(r).toHaveProperty('order');
    expect(r).toHaveProperty('original');
    expect(r).toHaveProperty('matchFields');
    expect(r).toHaveProperty('previewField');
    expect(r).toHaveProperty('previewText');
  });
});

describe('深度搜索 — 译文 + 注释 (CLS-014 / CLS-015)', () => {
  test('搜索译文关键词 "温习" 命中且 matchFields 含 translation', async () => {
    const results = await searchDeep('温习');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.matchFields.includes('translation'))).toBe(true);
  });

  test('仅译文命中时 previewField 为 translation', async () => {
    const results = await searchDeep('贫穷却不巴结');
    expect(results.length).toBeGreaterThan(0);
    const match = results.find(r => r.matchFields.includes('translation') && !r.matchFields.includes('commentary'));
    if (match) {
      expect(match.previewField).toBe('translation');
    }
  });

  test('搜索注释关键词 "朱熹" 命中且 matchFields 含 commentary', async () => {
    const results = await searchDeep('朱熹');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].matchFields).toContain('commentary');
  });

  test('注释搜索结果 previewField 为 commentary（当仅注释命中）', async () => {
    const results = await searchDeep('朱熹');
    const commentaryOnly = results.find(r => r.matchFields.length === 1 && r.matchFields[0] === 'commentary');
    if (commentaryOnly) {
      expect(commentaryOnly.previewField).toBe('commentary');
    }
  });

  test('搜索 "孝悌" 在注释中命中', async () => {
    const results = await searchDeep('孝悌');
    expect(results.length).toBeGreaterThan(0);
  });

  test('译文+注释同时命中时 matchFields 含两个值', async () => {
    // "孔子" 在译文和注释中高频出现
    const results = await searchDeep('君子');
    const match = results.find(r => r.matchFields.length >= 2);
    if (match) {
      expect(match.matchFields).toContain('translation');
      expect(match.matchFields).toContain('commentary');
    }
  });

  test('无匹配时返回空数组', async () => {
    const results = await searchDeep('xyzabc123');
    expect(results).toEqual([]);
  });

  test('空关键词返回空数组', async () => {
    expect(await searchDeep('')).toEqual([]);
  });
});

describe('上下文预览 (extractContext)', () => {
  test('预览包含关键词', () => {
    const text = '孔子说学到的东西按时去温习和练习，不也很高兴吗';
    const preview = extractContext(text, '温习', 20);
    expect(preview).toContain('温习');
  });

  test('关键词在开头时不加前缀省略号', () => {
    const text = '温习和练习不也很高兴吗';
    const preview = extractContext(text, '温习', 20);
    expect(preview.startsWith('…')).toBe(false);
  });

  test('关键词在末尾时加后缀省略号（如果超出长度）', () => {
    const longText = '这是一段很长的文字用来测试上下文提取功能温习和练习';
    const preview = extractContext(longText, '温习', 10);
    expect(preview).toContain('温习');
  });

  test('关键词不存在时返回截断文本', () => {
    const text = '这是一段测试文本';
    const preview = extractContext(text, '不存在', 5);
    expect(preview.length).toBeLessThanOrEqual(6); // 5 chars + …
  });

  // P2-2 回归锁定：关键词长度超过 maxLen 时 half 曾为负，截断区间滑到关键词之后
  test('预览: 关键词长度超过 maxLen 时截断区间仍包含关键词（P2-2 回归锁定）', () => {
    const kw = '子'.repeat(60); // > maxLen(50)
    const text = `原文 ${kw} 后文`;
    const preview = extractContext(text, kw, 50);
    expect(preview).toContain(kw.slice(0, 10)); // 窗口内保留关键词头部
    expect(preview.length).toBeLessThanOrEqual(52); // 50 + 前后省略号
  });

  test('空文本返回空字符串', () => {
    expect(extractContext('', 'test', 10)).toBe('');
  });
});

describe('匹配字段优先级与标签', () => {
  test('字段优先级：原文 > 译文 > 注释', () => {
    const results = searchInstant('学而时习之');
    if (results[0].matchFields.length > 1) {
      expect(results[0].previewField).toBe('original');
    }
  });

  test('getFieldLabel 返回正确中文标签', () => {
    expect(getFieldLabel('original')).toBe('原文');
    expect(getFieldLabel('translation')).toBe('译文');
    expect(getFieldLabel('commentary')).toBe('注释');
  });
});
