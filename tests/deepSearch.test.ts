/**
 * 深度搜索（译文/注释）双语测试：中文模式行为不变；英文模式搜英文字段、
 * 预览取英文文本；字段标签按语言返回。
 */
import { searchDeep, getFieldLabel } from '@/packageContent/services/deepSearch';
import { loadVerse } from '@/data/versesLoader';
import { loadVerseEn } from '@/data/versesEnLoader';

describe('deepSearch（深度搜索双语）', () => {
  test('中文模式：命中中文译文/注释，行为与历史一致', async () => {
    const zh = await loadVerse(101);
    expect(zh).not.toBeNull();
    // 取该句中文译文的实际片段做关键词，保证命中
    const kw = (zh!.translation.match(/[\u4e00-\u9fa5]{2,4}/g) || ['学习'])[0];
    const res = await searchDeep(kw, 'zh');
    expect(res.length).toBeGreaterThan(0);
    const hit = res.find(r => r.id === 101)!;
    expect(hit.matchFields.length).toBeGreaterThan(0);
    expect(hit.previewText).toContain(kw);
  });

  test('英文模式：命中英文字段，预览为英文文本', async () => {
    const en = await loadVerseEn(101);
    expect(en).not.toBeNull();
    // 英文数据保证非空（blob 完整性测试）；搜索范围是译文/注释，关键词从译文取（includes 区分大小写，保留原样）
    const kw = (en!.translation.match(/[A-Za-z]{5,}/g) || ['learn'])[0];
    expect(kw.length).toBeGreaterThan(0);
    const res = await searchDeep(kw, 'en');
    expect(res.length).toBeGreaterThan(0);
    const hit = res.find(r => r.id === 101)!;
    expect(hit).toBeDefined();
    expect(hit.matchFields.length).toBeGreaterThan(0);
    // 预览文本来自英文字段（含关键词且不含 CJK）
    expect(hit.previewText).toContain(kw);
    expect(hit.previewText).not.toMatch(/[\u4e00-\u9fa5]/);
  });

  test('空关键词返回空结果（双语一致）', async () => {
    expect(await searchDeep('  ', 'zh')).toEqual([]);
    expect(await searchDeep('  ', 'en')).toEqual([]);
  });

  test('getFieldLabel 按语言返回字段标签', () => {
    expect(getFieldLabel('original', 'zh')).toBe('原文');
    expect(getFieldLabel('original', 'en')).toBe('Original');
    expect(getFieldLabel('translation', 'en')).toBe('Translation');
    expect(getFieldLabel('commentary', 'en')).toBe('Commentary');
  });
});
