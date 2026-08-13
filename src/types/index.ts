// 篇章
export interface Chapter {
  id: number;
  title: string;       // 学而第一
  subTitle: string;    // 学而
  verseCount: number;  // 句子数量
  description: string; // 篇章简介
  theme: string;       // 主题关键词
}

// 句子（一章中的每一条）
export interface Verse {
  id: number;
  chapterId: number;
  order: number;       // 篇章内序号
  original: string;    // 原文
  translation: string; // 译文
  commentary: string;  // 注释解读
  keyPoint: string;    // 核心要点
}

// 每日推荐（方案 E：按主题轮换，theme 由篇章唯一映射）
export interface DailyRecommend {
  verseId: number;
  reason: string;        // 推荐理由（章句 keyPoint）
  theme: string;         // 今日主题（如「学习修身」）
  chapterTitle: string;  // 篇章标题（如「学而第一」）
  chapterId: number;     // 篇章 id（「换一批」按同篇换句需要）
}

// 学习进度
export interface LearningProgress {
  readVerseIds: number[];   // 已读句子 ID
  myNotes: MyNote[];        // 我的笔记
  totalReadDays: number;     // 连续学习天数
  lastReadDate?: string;     // 最后学习日期 (YYYY-MM-DD)
  lastReadVerseId?: number;  // 最后阅读的章句 ID（「接着读」续读入口用）
  deletedNoteIds?: number[];    // 已删除笔记 ID（删除标记，跨端同步时防止旧数据复活）
  likedNoteIds?: string[];      // 已点赞的公开心得 ID（云笔记，string）
  unlikedNoteIds?: string[];    // 已取消点赞的公开心得 ID（取消标记）
}

// 我的笔记
export interface MyNote {
  id: number;
  verseId: number;
  content: string;
  createTime: string;
  updateTime?: string;   // 最后修改时间 (YYYY-MM-DD)，跨设备合并时按此判断最新版本
  tags?: string[];  // 笔记标签
  isPublic?: boolean;    // 是否公开到社区
  cloudNoteId?: string;  // 云端文档 _id（发布成功后保存，用于编辑/取消发布联动）
}

// 公开心得（社区展示用，从云函数返回，不含 _openid）
export interface PublishedNote {
  id: string;              // 云端文档 _id
  verseId: number;
  verseOriginal: string;   // 关联章句原文（冗余，列表展示用）
  chapterTitle: string;    // 篇章标题（冗余）
  content: string;
  tags: string[];
  authorName: string;
  likeCount: number;
  createTime: string;
  likedByMe?: boolean;     // 当前用户是否已赞
}

// 用户信息
export interface UserInfo {
  openId: string;          // 微信 openId
  nickName: string;        // 昵称
  avatarUrl: string;       // 头像 URL
  gender?: number;         // 性别 0-未知 1-男 2-女
  loginTime: string;       // 最后登录时间
}

// 云端同步结果
export interface SyncResult {
  success: boolean;
  message: string;
  data?: LearningProgress;
}
