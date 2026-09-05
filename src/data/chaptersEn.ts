// 二十篇英文章节数据（与 chapters.ts 按 id 对齐；theme 保留中文作为筛选关联键，展示时经 THEME_EN 映射）
import type { ChapterEn } from '../types';

export const chaptersEn: ChapterEn[] = [
  { id: 1, title: 'Xue Er · Learning', subTitle: 'Xue Er', theme: '学习修身', description: 'On the attitude and method of learning and personal cultivation, opening with “to learn and to practice it in due season”.' },
  { id: 2, title: 'Wei Zheng · Governance', subTitle: 'Wei Zheng', theme: '为政治国', description: 'On governing by virtue: leading by moral example, rectifying names, and winning the people through trust.' },
  { id: 3, title: 'Ba Yi · Rites & Music', subTitle: 'Ba Yi', theme: '礼乐制度', description: 'On the norms of rites and music, censuring those who usurp the privileges of their station.' },
  { id: 4, title: 'Li Ren · Benevolence', subTitle: 'Li Ren', theme: '仁德修养', description: 'On the inner meaning of ren (benevolence) and the practice of dwelling among the virtuous.' },
  { id: 5, title: 'Gong Ye Chang · On People', subTitle: 'Gong Ye Chang', theme: '品评人物', description: 'Confucius’ appraisals of students and historical figures, revealing his standards for judging character.' },
  { id: 6, title: 'Yong Ye · Virtue & Conduct', subTitle: 'Yong Ye', theme: '仁德品行', description: 'Further appraisals of disciples; on the relation of ren, wisdom, and personal conduct.' },
  { id: 7, title: 'Shu Er · Education', subTitle: 'Shu Er', theme: '教育理念', description: 'The master’s teaching approach and scholarly attitude: transmitting, learning, and tireless effort.' },
  { id: 8, title: 'Tai Bo · Supreme Virtue', subTitle: 'Tai Bo', theme: '至德精神', description: 'On the supreme virtue of Tai Bo and the spirit of yielding and deference in moral character.' },
  { id: 9, title: 'Zi Han · Advancing in Virtue', subTitle: 'Zi Han', theme: '进德修业', description: 'The master’s sayings on perseverance, humility, and unceasing self-improvement.' },
  { id: 10, title: 'Xiang Dang · Daily Etiquette', subTitle: 'Xiang Dang', theme: '生活礼仪', description: 'The master’s bearing in daily life — the rites lived out in food, dress, and demeanor.' },
  { id: 11, title: 'Xian Jin · On Talent', subTitle: 'Xian Jin', theme: '人才评价', description: 'Evaluating the abilities and virtue of disciples; on recognizing and employing people.' },
  { id: 12, title: 'Yan Yuan · Self-Discipline & Rule', subTitle: 'Yan Yuan', theme: '仁政克己', description: '“Restrain yourself and return to the rites”: personal cultivation joined with benevolent governance.' },
  { id: 13, title: 'Zi Lu · Administration', subTitle: 'Zi Lu', theme: '政事管理', description: 'On the conduct of government: rectification of names, keeping one’s word, and leading from the front.' },
  { id: 14, title: 'Xian Wen · Cultivate Self, Care for Others', subTitle: 'Xian Wen', theme: '修己安人', description: 'On cultivating oneself so as to give ease to others; appraisals of statesmen and disciples.' },
  { id: 15, title: 'Wei Ling Gong · The Gentleman’s Way', subTitle: 'Wei Ling Gong', theme: '君子之道', description: 'The way of the junzi: self-respect, faithfulness, and handling affairs without seeking favor.' },
  { id: 16, title: 'Ji Shi · Political Ethics', subTitle: 'Ji Shi', theme: '政治伦理', description: 'On political ethics — censure of overreaching ministers and the roots of order in the family and state.' },
  { id: 17, title: 'Yang Huo · Human Nature', subTitle: 'Yang Huo', theme: '性习相近', description: '“By nature men are much alike; by practice they grow far apart” — on nature, teaching, and ritual.' },
  { id: 18, title: 'Wei Zi · Hermits & the World', subTitle: 'Wei Zi', theme: '隐士处世', description: 'Recluses who withdrew from the world, set against the master’s unwavering sense of mission.' },
  { id: 19, title: 'Zi Zhang · Disciples’ Words', subTitle: 'Zi Zhang', theme: '弟子言论', description: 'Sayings of Zizhang, Zixia, Zengzi and other disciples on learning, friendship, and the scholar’s way.' },
  { id: 20, title: 'Yao Yue · The Way of Yao & Shun', subTitle: 'Yao Yue', theme: '尧舜之道', description: 'The way of Yao, Shun, and Yu in governing; the master’s political ideal in three verses.' },
];
