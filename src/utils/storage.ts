import Taro from '@tarojs/taro';
import { LearningProgress, MyNote } from '@/types';
import { getUserInfo, uploadProgress } from '@/services/auth';
import { getSettings } from '@/utils/settings';

const STORAGE_KEY = 'lunyu_progress';

// 创建全新的默认进度（每次返回独立对象，避免数组引用共享被意外修改）
function createDefaultProgress(): LearningProgress {
  return {
    readVerseIds: [],
    myNotes: [],
    totalReadDays: 1,
    lastReadDate: undefined,
    deletedNoteIds: [],
    likedNoteIds: [],
    unlikedNoteIds: []
  };
}

// 获取当前用户的存储 key（用户隔离）
function getStorageKey(): string {
  const user = getUserInfo();
  if (user && user.openId) {
    return `${STORAGE_KEY}_${user.openId}`;
  }
  return STORAGE_KEY; // 未登录时使用默认 key
}

// 云端同步防抖定时器
let syncTimer: ReturnType<typeof setTimeout> | null = null;
const isWeapp = process.env.TARO_ENV === 'weapp';

// 触发云端同步（防抖 3 秒，仅微信小程序环境）
function triggerCloudSync(): void {
  if (!isWeapp) return; // 非小程序环境无云开发，跳过
  if (!getSettings().autoSync) return; // 用户在设置中关闭了自动同步
  const user = getUserInfo();
  if (!user) return; // 未登录不同步

  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      const progress = getProgress();
      await uploadProgress(progress);
    } catch (e) {
      console.warn('[Storage] 云端同步失败（静默）:', e);
    }
  }, 3000);
}

// 获取今天日期字符串 (YYYY-MM-DD，按本地时区，避免 toISOString 的 UTC 偏移导致凌晨跨日误判)
function getTodayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 检查是否是连续的一天（昨天或今天）
function isConsecutiveDay(lastDate: string | undefined, today: string): boolean {
  if (!lastDate) return false;

  // 解析 YYYY-MM-DD 时显式按本地时间构造，避免 new Date('YYYY-MM-DD') 被当作 UTC 导致偏移
  const [ly, lm, ld] = lastDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const last = new Date(ly, lm - 1, ld);
  const current = new Date(ty, tm - 1, td);

  // 计算天数差（基于本地午夜，不受时区影响）
  const diffTime = current.getTime() - last.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  // 如果是同一天或相差一天，则是连续的
  return diffDays === 0 || diffDays === 1;
}

// 合并两份进度数据（取并集，用于登录后合并本地匿名进度与云端进度）
export function mergeProgress(local: LearningProgress, cloud: LearningProgress): LearningProgress {
  const readVerseIds = [...new Set([
    ...(local.readVerseIds || []),
    ...(cloud.readVerseIds || [])
  ])];
  // 公开心得点赞：同样并集 + 取消标记剔除
  const unlikedNoteIds = [...new Set([
    ...(local.unlikedNoteIds || []),
    ...(cloud.unlikedNoteIds || [])
  ])];
  const likedNoteIds = [...new Set([
    ...(local.likedNoteIds || []),
    ...(cloud.likedNoteIds || [])
  ])].filter(id => !unlikedNoteIds.includes(id));
  // 删除标记取并集
  const deletedNoteIds = [...new Set([
    ...(local.deletedNoteIds || []),
    ...(cloud.deletedNoteIds || [])
  ])];
  // 笔记按 id 合并去重：本地后写覆盖云端（last-writer-wins）。
  // 实现里 cloud 先入 Map、local 后入覆盖，云端副本只是兜底，不会覆盖本机编辑。
  const noteMap = new Map<number, MyNote>();
  [...(cloud.myNotes || []), ...(local.myNotes || [])].forEach(note => {
    noteMap.set(note.id, note);
  });
  const myNotes = [...noteMap.values()]
    .sort((a, b) => b.id - a.id)
    .filter(note => !deletedNoteIds.includes(note.id));
  const totalReadDays = Math.max(local.totalReadDays || 1, cloud.totalReadDays || 1);
  // 最后学习日期：取存在且较新的（显式处理 undefined，避免字符串与 undefined 比较返回 NaN）
  const lastReadDate = (local.lastReadDate && cloud.lastReadDate)
    ? (local.lastReadDate > cloud.lastReadDate ? local.lastReadDate : cloud.lastReadDate)
    : (local.lastReadDate || cloud.lastReadDate);
  return { readVerseIds, myNotes, totalReadDays, lastReadDate, deletedNoteIds, likedNoteIds, unlikedNoteIds };
}

// 判断进度是否有实质数据
export function hasProgressData(p: LearningProgress): boolean {
  return (p.readVerseIds && p.readVerseIds.length > 0)
    || (p.myNotes && p.myNotes.length > 0)
    // 笔记删除/点赞取消标记也视为有效数据，保证登录合并后能传播到云端
    || (!!p.deletedNoteIds && p.deletedNoteIds.length > 0)
    || (!!p.likedNoteIds && p.likedNoteIds.length > 0)
    || (!!p.unlikedNoteIds && p.unlikedNoteIds.length > 0);
}

// 清除未登录期间的匿名进度数据（登录合并成功后调用，避免登出后看到旧匿名数据）
export function clearAnonymousProgress(): void {
  try {
    Taro.removeStorageSync(STORAGE_KEY);
  } catch (e) {
    console.error('[Storage] clearAnonymousProgress failed:', e);
  }
}

// 获取学习进度（返回深拷贝，避免调用方意外修改存储中的原始数据）
export function getProgress(): LearningProgress {
  try {
    const data = Taro.getStorageSync(getStorageKey());
    if (data && typeof data === 'object') {
      // 深拷贝数组元素，防止返回的引用与存储中的对象共享（避免 unshift/filter 等操作污染存储）
      return {
        readVerseIds: Array.isArray(data.readVerseIds) ? [...data.readVerseIds] : [],
        myNotes: Array.isArray(data.myNotes) ? data.myNotes.map((n: MyNote) => ({ ...n })) : [],
        deletedNoteIds: Array.isArray(data.deletedNoteIds) ? [...data.deletedNoteIds] : [],
        likedNoteIds: Array.isArray(data.likedNoteIds) ? [...data.likedNoteIds] : [],
        unlikedNoteIds: Array.isArray(data.unlikedNoteIds) ? [...data.unlikedNoteIds] : [],
        totalReadDays: typeof data.totalReadDays === 'number' ? data.totalReadDays : 1,
        lastReadDate: data.lastReadDate
      };
    }
  } catch (e) {
    console.error('[Storage] getProgress failed:', e);
    // 数据损坏时返回默认值
  }
  return createDefaultProgress();
}

// 保存学习进度（返回是否成功，不弹 toast——由调用方决定 UI 反馈）
export function saveProgress(progress: LearningProgress): boolean {
  try {
    Taro.setStorageSync(getStorageKey(), progress);
    // 保存成功后触发云端同步（防抖）
    triggerCloudSync();
    return true;
  } catch (e) {
    console.error('[Storage] saveProgress failed:', e);
    return false;
  }
}

// 标记句子为已读
export function markVerseRead(verseId: number): LearningProgress {
  const progress = getProgress();
  // 防御性检查
  if (!Array.isArray(progress.readVerseIds)) {
    progress.readVerseIds = [];
  }
  const today = getTodayString();

  // 如果该章句未读过，则添加
  if (!progress.readVerseIds.includes(verseId)) {
    progress.readVerseIds.push(verseId);
    
    // 更新连续学习天数
    if (!progress.lastReadDate) {
      // 首次学习
      progress.totalReadDays = 1;
    } else if (progress.lastReadDate !== today) {
      // 不是同一天，检查是否连续
      if (isConsecutiveDay(progress.lastReadDate, today)) {
        // 连续学习，天数 +1
        progress.totalReadDays += 1;
      } else {
        // 中断了，重置为 1
        progress.totalReadDays = 1;
      }
    }
    // 如果是同一天，不改变 totalReadDays
    
    progress.lastReadDate = today;
    saveProgress(progress);
  }
  
  return progress;
}

// 添加笔记（保存失败时抛出异常，由调用方捕获并提示用户）
export function addNote(verseId: number, content: string, tags?: string[]): LearningProgress {
  const progress = getProgress();
  // 防御性检查：确保 myNotes 是数组（避免存储损坏导致 unshift 崩溃）
  if (!Array.isArray(progress.myNotes)) {
    progress.myNotes = [];
  }
  const note: MyNote = {
    // 时间戳 + 随机后缀：避免同一毫秒内创建多条笔记、以及跨设备同毫秒生成时 id 撞车（合并按 id 去重会丢笔记）
    id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
    verseId,
    content,
    createTime: getTodayString(),
    tags: tags && tags.length > 0 ? tags : undefined
  };
  progress.myNotes.unshift(note);
  if (!saveProgress(progress)) {
    throw new Error('保存失败，请重试');
  }
  return progress;
}

// 更新笔记（编辑内容/标签）
export function updateNote(noteId: number, content: string, tags?: string[]): LearningProgress {
  const progress = getProgress();
  if (!Array.isArray(progress.myNotes)) {
    progress.myNotes = [];
  }
  const note = progress.myNotes.find(n => n.id === noteId);
  if (!note) {
    throw new Error('笔记不存在');
  }
  note.content = content;
  note.tags = tags && tags.length > 0 ? tags : undefined;
  if (!saveProgress(progress)) {
    throw new Error('保存失败，请重试');
  }
  return progress;
}

// 删除笔记
export function deleteNote(noteId: number): LearningProgress {
  const progress = getProgress();
  if (!Array.isArray(progress.myNotes)) {
    progress.myNotes = [];
  }
  progress.myNotes = progress.myNotes.filter(n => n.id !== noteId);
  // 记录删除标记，避免云端并集合并时笔记“复活”
  if (!Array.isArray(progress.deletedNoteIds)) {
    progress.deletedNoteIds = [];
  }
  if (!progress.deletedNoteIds.includes(noteId)) {
    progress.deletedNoteIds.push(noteId);
  }
  if (!saveProgress(progress)) {
    throw new Error('删除失败，请重试');
  }
  return progress;
}

// 根据 ID 获取单条笔记
export function getNoteById(noteId: number): MyNote | null {
  const progress = getProgress();
  if (!Array.isArray(progress.myNotes)) return null;
  return progress.myNotes.find(n => n.id === noteId) || null;
}

// 检查句子是否已读
export function isVerseRead(verseId: number): boolean {
  return getProgress().readVerseIds.includes(verseId);
}

// ============================================
// 公开心得点赞（本地状态管理，云端操作由 auth.ts 调用）
// ============================================

// 切换公开心得的本地点赞状态
export function togglePublishedNoteLike(noteId: string): { liked: boolean } {
  const progress = getProgress();
  if (!Array.isArray(progress.likedNoteIds)) progress.likedNoteIds = [];
  if (!Array.isArray(progress.unlikedNoteIds)) progress.unlikedNoteIds = [];

  const liked = progress.likedNoteIds.includes(noteId);
  if (liked) {
    // 取消点赞
    progress.likedNoteIds = progress.likedNoteIds.filter(id => id !== noteId);
    if (!progress.unlikedNoteIds.includes(noteId)) {
      progress.unlikedNoteIds.push(noteId);
    }
  } else {
    // 点赞
    progress.likedNoteIds.push(noteId);
    progress.unlikedNoteIds = progress.unlikedNoteIds.filter(id => id !== noteId);
  }
  saveProgress(progress);
  return { liked: !liked };
}

// 检查公开心得是否已赞
export function isPublishedNoteLiked(noteId: string): boolean {
  return getProgress().likedNoteIds?.includes(noteId) || false;
}

// ============================================
// 笔记公开状态（更新本地 MyNote 的 isPublic/cloudNoteId）
// ============================================

// 标记笔记为已公开，记录云端文档 id
export function setNotePublic(noteId: number, cloudNoteId: string): void {
  const progress = getProgress();
  const note = progress.myNotes.find(n => n.id === noteId);
  if (note) {
    note.isPublic = true;
    note.cloudNoteId = cloudNoteId;
    saveProgress(progress);
  }
}

// 标记笔记为已取消公开
export function setNotePrivate(noteId: number): void {
  const progress = getProgress();
  const note = progress.myNotes.find(n => n.id === noteId);
  if (note) {
    note.isPublic = false;
    note.cloudNoteId = undefined;
    saveProgress(progress);
  }
}
