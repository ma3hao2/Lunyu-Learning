// publishNote 云函数纯逻辑（可单测）
// 校验：content 非空且 <=500 字，tags <=5 个且每个 <=8 字，verseId 为合法正整数

function validateNote(content, tags, verseId) {
  if (!content || !content.trim()) return '心得内容不能为空';
  if (content.length > 500) return '心得内容不能超过500字';
  if (tags && tags.length > 5) return '标签最多5个';
  if (tags && tags.some(t => t.length > 8)) return '每个标签最多8个字';
  if (verseId !== undefined && (!Number.isInteger(verseId) || verseId <= 0)) return '章句ID无效';
  return null;
}

module.exports = { validateNote };
