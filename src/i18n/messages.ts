// 界面文案字典（zh / en 并排维护；章句原文、译文、注释属内容数据，不在此翻译）
// 说明：页面中的单字图标（搜/书/记/人/设/日/续/同/自/字/隐/清/源/关等）为中式印章风格装饰元素，刻意不翻译。
import type { Language } from '@/types';

type Entry = { zh: string; en: string };

// 字典本体（导出仅供测试做 zh/en key 对齐校验）
export const messages = {
  // 全局
  'app.brand': { zh: '论语学习', en: 'The Analects' },
  'app.subtitle': { zh: '学而时习之，不亦说乎', en: '“Is it not a delight to learn and practice in due season?”' },
  'app.loading': { zh: '加载中…', en: 'Loading…' },
  'common.cancel': { zh: '取消', en: 'Cancel' },
  'common.confirm': { zh: '确认', en: 'Confirm' },
  'common.save': { zh: '保存', en: 'Save' },
  'common.saving': { zh: '保存中...', en: 'Saving...' },
  'common.edit': { zh: '编辑', en: 'Edit' },
  'common.delete': { zh: '删除', en: 'Delete' },
  'common.retry': { zh: '重试', en: 'Retry' },
  'common.clear': { zh: '清空', en: 'Clear' },
  'common.known': { zh: '知道了', en: 'Got it' },
  'common.deleted': { zh: '已删除', en: 'Deleted' },
  'common.deleteFailed': { zh: '删除失败', en: 'Delete failed' },
  'common.loadFailed': { zh: '加载失败，请重试', en: 'Load failed. Please retry.' },
  'common.loadFailedNetwork': { zh: '加载失败，请检查网络', en: 'Load failed. Please check your network.' },
  'common.viewAll': { zh: '查看全部 ›', en: 'View all ›' },
  'common.showAllMore': { zh: '点击显示全部（共 {total} 条，已显示 {shown} 条）', en: 'Tap to show all ({total} total, {shown} shown)' },
  'common.showAllDone': { zh: '已全部加载，共 {total} 条', en: 'All loaded — {total} results' },
  'common.searchIcon': { zh: '搜', en: '搜' },
  'common.fieldOriginal': { zh: '原文', en: 'Original' },
  'common.fieldTranslation': { zh: '译文', en: 'Translation' },
  'common.fieldCommentary': { zh: '注释', en: 'Commentary' },

  // 底部 tab（app.config.ts 默认中文，运行时经 Taro.setTabBarItem 更新）
  'tab.home': { zh: '首页', en: 'Home' },
  'tab.classics': { zh: '论语', en: 'Analects' },
  'tab.notes': { zh: '笔记', en: 'Notes' },
  'tab.mine': { zh: '我的', en: 'Me' },

  // 首页
  'home.searchPlaceholder': { zh: '搜索译文、注释...（支持全库搜索）', en: 'Search translation & commentary... (full-text)' },
  'home.daily': { zh: '今日推荐', en: 'Daily Verse' },
  'home.start': { zh: '开始学习 ›', en: 'Start Reading ›' },
  'home.continue': { zh: '继续学习', en: 'Continue Reading' },
  'home.progress': { zh: '学习进度', en: 'Learning Progress' },
  'home.statVerses': { zh: '已读章句', en: 'Verses Read' },
  'home.statChapters': { zh: '已读篇目', en: 'Books Opened' },
  'home.statStreak': { zh: '连续学习', en: 'Day Streak' },
  'home.statNotes': { zh: '我的笔记', en: 'My Notes' },
  'home.totalProgress': { zh: '总进度', en: 'Overall' },
  'home.quickLinks': { zh: '快捷入口', en: 'Quick Links' },
  'home.qReading': { zh: '篇章阅读', en: 'Browse Books' },
  'home.qReadingDesc': { zh: '二十篇全文', en: 'All twenty books' },
  'home.qNotes': { zh: '我的笔记', en: 'My Notes' },
  'home.qNotesDesc': { zh: '学习感悟记录', en: 'Record your reflections' },
  'home.qMine': { zh: '个人中心', en: 'Profile' },
  'home.qMineDesc': { zh: '学习数据', en: 'Learning data' },
  'home.qSettings': { zh: '设置', en: 'Settings' },
  'home.qSettingsDesc': { zh: '数据管理', en: 'Data & preferences' },
  'home.classics': { zh: '经典名句', en: 'Classic Quotes' },
  'home.langZh': { zh: '中文', en: '中文' },
  'home.langEn': { zh: 'EN', en: 'EN' },

  // 论语目录页
  'classics.title': { zh: '论语二十篇', en: 'The Twenty Books' },
  'classics.desc': {
    zh: '儒家经典，孔子弟子及再传弟子编纂，记录孔子及其弟子言行，共二十篇，蕴含修身齐家治国之大道。',
    en: 'A Confucian classic compiled by the disciples of Confucius, recording the words and deeds of the master. Twenty books on the way of self-cultivation, family, and governance.',
  },
  'classics.tabOriginal': { zh: '搜原文', en: 'Original' },
  'classics.tabDeep': { zh: '搜译文/注释 ›', en: 'Translation & Commentary ›' },
  'classics.searchPlaceholder': { zh: '搜索原文...', en: 'Search original text...' },
  'classics.found': { zh: '找到 {verses} 条章句、{chapters} 篇篇章', en: '{verses} matching verses, {chapters} matching books' },
  'classics.matchedVerses': { zh: '匹配章句', en: 'Matching Verses' },
  'classics.matchedChapters': { zh: '匹配篇章', en: 'Matching Books' },
  'classics.chapterList': { zh: '篇目列表', en: 'Books' },
  'classics.countVerses': { zh: '共{n}条', en: '{n} results' },
  'classics.countChapters': { zh: '共{n}篇', en: '{n} books' },
  'classics.all': { zh: '全部', en: 'All' },
  'classics.empty': { zh: '未找到匹配内容，试试其他关键词', en: 'No matches found. Try another keyword.' },

  // 篇章详情页
  'chapter.title': { zh: '篇章详情', en: 'Book Details' },
  'chapter.progress': { zh: '本篇进度', en: 'Book Progress' },
  'chapter.verseList': { zh: '章句列表', en: 'Verses' },
  'chapter.countVerses': { zh: '共{n}章', en: '{n} verses' },
  'chapter.verseCount': { zh: '{n}章', en: '{n} verses' },
  'chapter.readAll': { zh: '已读完', en: 'Completed' },
  'chapter.readProgress': { zh: '已读{n}/{m}', en: '{n}/{m} read' },
  'chapter.loadingList': { zh: '加载中...', en: 'Loading...' },
  'chapter.compiling': { zh: '本篇内容正在整理中...', en: 'Content for this book is being prepared...' },

  // 章句详情页
  'verse.title': { zh: '章句详情', en: 'Verse Details' },
  'verse.badgeNote': { zh: '笔记', en: 'Note' },
  'verse.badgeRead': { zh: '已读', en: 'Read' },
  'verse.viewDetail': { zh: '查看详情 ›', en: 'Details ›' },
  'verse.keyPoint': { zh: '核心要点：{text}', en: 'Key points: {text}' },
  'verse.translation': { zh: '白话译文', en: 'Translation' },
  'verse.commentary': { zh: '注释解读', en: 'Word Notes & Interpretation' },
  'verse.markRead': { zh: '标记已读', en: 'Mark as Read' },
  'verse.readDone': { zh: '已读 ✓', en: 'Read ✓' },
  'verse.writeNote': { zh: '写笔记', en: 'Write Note' },
  'verse.prev': { zh: '‹ 上一句', en: '‹ Previous' },
  'verse.next': { zh: '下一句 ›', en: 'Next ›' },
  'verse.markedRead': { zh: '已标记为已读', en: 'Marked as read' },
  'verse.markedReadStreak': { zh: '已标记为已读 · 连续{n}天', en: 'Marked as read · {n}-day streak' },
  'verse.alreadyRead': { zh: '已读过啦', en: 'Already marked as read' },
  'verse.source': { zh: '内容来源：和合文化屋公众号', en: 'Source: 和合文化屋 (Hehe Culture House) account' },
  'verse.notesTitle': { zh: '我的笔记', en: 'My Notes' },
  'verse.notesCount': { zh: '共{n}条', en: '{n} total' },
  'verse.noteEmpty': { zh: '还没有笔记，点击上方"写笔记"记录你的感悟', en: 'No notes yet — tap “Write Note” above to record your reflection' },
  'verse.noteFrom': { zh: '出自：{text}...', en: 'From: {text}...' },
  'verse.deleteNoteTitle': { zh: '删除笔记', en: 'Delete Note' },
  'verse.deleteNoteContent': { zh: '确定要删除这条笔记吗？删除后不可恢复。', en: 'Delete this note? This cannot be undone.' },

  // 写笔记页
  'note.title': { zh: '写笔记', en: 'Write Note' },
  'note.quoteLabel': { zh: '引用原文', en: 'Original Text' },
  'note.editTitle': { zh: '编辑笔记', en: 'Edit Note' },
  'note.editorTitle': { zh: '我的笔记', en: 'My Note' },
  'note.placeholder': { zh: '写下你对这段论语的学习感悟...', en: 'Write your reflection on this passage...' },
  'note.tagLabel': { zh: '添加标签（最多5个）', en: 'Tags (up to 5)' },
  'note.tagCustomPlaceholder': { zh: '自定义标签...', en: 'Custom tag...' },
  'note.tagAdd': { zh: '添加', en: 'Add' },
  'note.tagMaxLen': { zh: '标签最多8个字', en: 'Tags are limited to 8 characters' },
  'note.tagMaxCount': { zh: '最多添加5个标签', en: 'Up to 5 tags' },
  'note.emptyContent': { zh: '请输入笔记内容', en: 'Please write your note first' },
  'note.saveFailed': { zh: '保存失败，请重试', en: 'Save failed. Please retry.' },
  'note.saved': { zh: '保存成功', en: 'Saved' },
  'note.updated': { zh: '更新成功', en: 'Updated' },
  'note.saveBtn': { zh: '保存笔记', en: 'Save Note' },
  'note.updateBtn': { zh: '更新笔记', en: 'Update Note' },
  'note.tagSelfCultivation': { zh: '修身', en: 'Self-cultivation' },
  'note.tagLearning': { zh: '学习', en: 'Learning' },
  'note.tagConduct': { zh: '处世', en: 'Conduct' },
  'note.tagEducation': { zh: '教育', en: 'Education' },
  'note.tagManagement': { zh: '管理', en: 'Management' },

  // 译文/注释搜索页
  'search.title': { zh: '搜索译文/注释', en: 'Search Translation & Commentary' },
  'search.placeholder': { zh: '搜索译文、注释...', en: 'Search translation, commentary...' },
  'search.history': { zh: '搜索历史', en: 'Recent Searches' },
  'search.loadHint': { zh: '正在加载章节数据...', en: 'Loading verse data...' },
  'search.found': { zh: '找到 {n} 条匹配', en: '{n} matches found' },
  'search.hint': { zh: '输入关键词，搜索《论语》的译文与注释', en: 'Type a keyword to search translations and commentary of The Analects' },

  // 我的笔记 tab
  'notes.title': { zh: '我的笔记', en: 'My Notes' },
  'notes.subtitle': { zh: '记录你的学习感悟', en: 'Record your learning reflections' },
  'notes.empty': { zh: '还没有笔记，去学习后写第一条笔记吧', en: 'No notes yet — start reading and write your first note' },

  // 我的页
  'mine.loggingIn': { zh: '登录中...', en: 'Signing in...' },
  'mine.tapToLogin': { zh: '点击登录', en: 'Tap to Sign In' },
  'mine.loginDesc': { zh: '登录后同步学习进度到云端', en: 'Sign in to sync your progress to the cloud' },
  'mine.loginBtn': { zh: '登录 ›', en: 'Sign In ›' },
  'mine.logoutBtn': { zh: '退出', en: 'Exit' },
  'mine.editProfile': { zh: '学而时习之，不亦说乎 · 编辑资料 ›', en: '“Is it not a delight to learn?” · Edit profile ›' },
  'mine.progress': { zh: '学习总进度', en: 'Overall Progress' },
  'mine.progressLabel': { zh: '论语二十篇', en: 'The Twenty Books' },
  'mine.menuContinue': { zh: '继续阅读', en: 'Continue Reading' },
  'mine.defaultNick': { zh: '论语学习者', en: 'Analects Learner' },
  'mine.privacyNeededLogin': { zh: '需同意隐私政策后才能登录', en: 'Please accept the privacy policy before signing in' },
  'mine.loginSuccess': { zh: '登录成功', en: 'Signed in' },
  'mine.loginFailed': { zh: '登录失败，请重试', en: 'Sign-in failed. Please retry.' },
  'mine.logoutTitle': { zh: '退出登录', en: 'Sign Out' },
  'mine.logoutContent': { zh: '退出后本地数据仍会保留，确定退出吗？', en: 'Local data will remain on this device. Sign out?' },
  'mine.loggedOut': { zh: '已退出登录', en: 'Signed out' },
  'mine.profileTitle': { zh: '编辑资料', en: 'Edit Profile' },
  'mine.chooseAvatar': { zh: '选择头像', en: 'Choose Avatar' },
  'mine.nicknamePlaceholder': { zh: '输入昵称（可联想微信昵称）', en: 'Enter a nickname' },
  'mine.profileSaved': { zh: '资料已更新', en: 'Profile updated' },
  'mine.profileSaveFailed': { zh: '更新失败，请重试', en: 'Update failed. Please retry.' },
  'mine.avatarUploadFailed': { zh: '头像上传失败，请重试', en: 'Avatar upload failed. Please retry.' },

  // 设置页
  'settings.title': { zh: '设置', en: 'Settings' },
  'settings.sectionAccount': { zh: '账号与同步', en: 'Account & Sync' },
  'settings.notLoggedIn': { zh: '未登录', en: 'Not signed in' },
  'settings.cloudSyncOn': { zh: '已开启云端同步', en: 'Cloud sync enabled' },
  'settings.goLogin': { zh: '去登录', en: 'Sign In' },
  'settings.syncNow': { zh: '同步学习进度', en: 'Sync Progress' },
  'settings.syncNowDesc': { zh: '下载并上传合并云端数据', en: 'Download and merge cloud data' },
  'settings.autoSync': { zh: '自动同步', en: 'Auto Sync' },
  'settings.autoSyncDesc': { zh: '保存进度后自动上传云端', en: 'Upload to cloud after each save' },
  'settings.sectionReading': { zh: '阅读体验', en: 'Reading Experience' },
  'settings.fontSize': { zh: '正文字号', en: 'Font Size' },
  'settings.fontSizeDesc': { zh: '影响原文、译文与注释', en: 'Applies to text, translation and commentary' },
  'settings.fontNormal': { zh: '标准', en: 'Normal' },
  'settings.fontLarge': { zh: '大', en: 'Large' },
  'settings.fontXl': { zh: '特大', en: 'X-Large' },
  'settings.language': { zh: '界面语言', en: 'Language' },
  'settings.languageDesc': { zh: '切换界面与译文、注释语言', en: 'Interface, translation and commentary language' },
  'settings.langZh': { zh: '中文', en: '中文' },
  'settings.langEn': { zh: 'English', en: 'English' },
  'settings.sectionPrivacy': { zh: '隐私', en: 'Privacy' },
  'settings.privacyPolicy': { zh: '隐私政策', en: 'Privacy Policy' },
  'settings.privacyDesc': { zh: '了解我们如何收集和使用数据', en: 'How we collect and use data' },
  'settings.sectionData': { zh: '数据管理', en: 'Data' },
  'settings.clearData': { zh: '清空学习数据', en: 'Clear Learning Data' },
  'settings.clearDataDesc': { zh: '已读记录与本地笔记', en: 'Read history and local notes' },
  'settings.sectionAbout': { zh: '关于', en: 'About' },
  'settings.dataSource': { zh: '数据来源', en: 'Data Source' },
  'settings.dataSourceDesc': { zh: '和合文化屋公众号', en: '和合文化屋 (Hehe Culture House) account' },
  'settings.aboutApp': { zh: '关于论语学习', en: 'About The Analects' },
  'settings.aboutDesc': { zh: '版本与数据来源', en: 'Version & data source' },
  'settings.version': { zh: '论语学习 v1.1.0', en: 'The Analects v1.1.0' },
  'settings.copyright': { zh: '© 2026 论语学习团队', en: '© 2026 The Analects Team' },
  'settings.pleaseLogin': { zh: '请先登录', en: 'Please sign in first' },
  'settings.syncing': { zh: '同步中...', en: 'Syncing...' },
  'settings.syncFailed': { zh: '同步失败', en: 'Sync failed' },
  'settings.cleared': { zh: '数据已清空', en: 'Data cleared' },
  'settings.clearedCloudFailed': { zh: '本地已清空，云端清理失败', en: 'Local data cleared — cloud cleanup failed' },
  'settings.clearTitle': { zh: '确认清空', en: 'Confirm Clear' },
  'settings.clearContent': { zh: '将清空已读记录与本地笔记，且无法恢复。确定继续吗？', en: 'This clears your read history and local notes, and cannot be undone. Continue?' },
  'settings.clearConfirmBtn': { zh: '确认清空', en: 'Clear Data' },
  'settings.aboutTitle': { zh: '关于论语学习', en: 'About The Analects' },
  'settings.aboutContent': {
    zh: '版本：1.1.0\n\n一款专注于《论语》学习的微信小程序，提供原文、译文、注释解读及学习笔记功能。\n\n数据来源：和合文化屋公众号（见「数据来源」入口复制链接）',
    en: 'Version: 1.1.0\n\nA WeChat mini program dedicated to studying The Analects: original text, translation, commentary and learning notes.\n\nSource: 和合文化屋 (Hehe Culture House) account (copy the link via “Data Source”).',
  },
  'settings.privacyNeededCopy': { zh: '需同意隐私政策后才能复制', en: 'Please accept the privacy policy before copying' },
  'settings.linkCopied': { zh: '链接已复制', en: 'Link copied' },
  'settings.copyFailed': { zh: '复制失败，请稍后重试', en: 'Copy failed. Please try again later.' },

  // 服务层提示（sync.ts）
  'sync.success': { zh: '同步成功', en: 'Synced' },
  'sync.partial': { zh: '云端拉取失败，仅上传本地数据', en: 'Cloud download failed — uploaded local data only' },

  // 隐私政策页
  'privacy.title': { zh: '隐私政策', en: 'Privacy Policy' },
  'privacy.updatedAt': { zh: '更新日期：2026-08-14', en: 'Last updated: 2026-08-14' },
  'privacy.intro': {
    zh: '本小程序（「论语学习」）由论语学习团队提供。我们重视你的隐私，本政策说明我们收集和使用哪些信息。',
    en: 'This mini program (“The Analects”) is provided by The Analects Team. We respect your privacy. This policy explains what information we collect and how we use it.',
  },
  'privacy.s1': { zh: '1. 我们收集的信息', en: '1. Information We Collect' },
  'privacy.s1p1': { zh: '- 学习进度（已读章句、笔记），默认仅保存在你的设备本地；', en: '- Learning progress (read verses, notes), stored locally on your device by default;' },
  'privacy.s1p2': { zh: '- 微信登录信息（openId、昵称、头像），用于云端同步学习进度与笔记；', en: '- WeChat sign-in details (openId, nickname, avatar), used to sync learning progress and notes to the cloud;' },
  'privacy.s1p3': { zh: '- 剪贴板：在「设置 → 数据来源」复制链接时使用（仅在你点击复制时写入，本小程序不读取剪贴板内容）；', en: '- Clipboard: used when copying the link in “Settings → Data Source” (written only when you tap copy; this app never reads clipboard content);' },
  'privacy.s2': { zh: '2. 信息的使用', en: '2. How We Use Information' },
  'privacy.s2p1': { zh: '- 本地数据仅用于在你设备上展示学习进度与笔记；', en: '- Local data is used only to display your learning progress and notes on your device;' },
  'privacy.s2p2': { zh: '- 云端数据用于多设备同步；', en: '- Cloud data is used for syncing across your devices;' },
  'privacy.s2p3': { zh: '- 我们不会将你的个人信息出售给任何第三方。', en: '- We never sell your personal information to any third party.' },
  'privacy.s3': { zh: '3. 云同步与用户行为统计', en: '3. Cloud Sync & Analytics' },
  'privacy.s3p1': {
    zh: '- 云同步：登录后，你的学习进度与本地笔记会上传至云端，仅用于多设备同步。在你同意隐私授权之前，本小程序不会上传任何数据；',
    en: '- Cloud sync: after signing in, your learning progress and local notes are uploaded to the cloud, solely for syncing across devices. Before you accept the privacy authorization, nothing is uploaded;',
  },
  'privacy.s3p2': {
    zh: '- 用户行为统计：未征得你的同意前，我们不会开启行为数据统计。你首次登录时，系统会弹出微信官方隐私授权框，你可以在其中选择同意或拒绝。',
    en: '- Analytics: we do not enable usage analytics without your consent. On first sign-in, WeChat shows its official privacy dialog where you may agree or decline.',
  },
  'privacy.s4': { zh: '4. 你的权利', en: '4. Your Rights' },
  'privacy.s4p1': { zh: '你可以在「设置 → 清空学习数据」清除本地学习数据。', en: 'You can clear local learning data via “Settings → Clear Learning Data”.' },
  'privacy.s5': { zh: '5. 微信官方隐私保护指引', en: '5. WeChat Official Privacy Guidelines' },
  'privacy.s5p1': { zh: '除本政策外，微信平台对小程序还有统一的隐私保护要求，可点击下方按钮查看官方指引。', en: 'Beyond this policy, WeChat applies platform-wide privacy requirements to mini programs. Tap the button below to view the official guidelines.' },
  'privacy.s5btn': { zh: '查看《微信小程序隐私保护指引》', en: 'View WeChat Mini Program Privacy Guidelines' },
  'privacy.s6': { zh: '6. 联系我们', en: '6. Contact Us' },
  'privacy.s6p1': { zh: '如有隐私相关问题，可通过微信小程序客服或意见反馈渠道联系我们（联系方式将在上线前补充）。', en: 'For privacy questions, contact us via the mini program’s customer service or feedback channels.' },
  'privacy.contractUnavailable': { zh: '暂不可用，请稍后再试', en: 'Unavailable now. Please try again later.' },
} satisfies Record<string, Entry>;

export type MessageKey = keyof typeof messages;

// 二十篇主题词的英文对照（按中文主题查表）
export const THEME_EN: Record<string, string> = {
  学习修身: 'Learning & Self-Cultivation',
  为政治国: 'Governance',
  礼乐制度: 'Rites & Music',
  仁德修养: 'Benevolence',
  品评人物: 'On People',
  仁德品行: 'Virtue & Conduct',
  教育理念: 'Education',
  至德精神: 'Supreme Virtue',
  进德修业: 'Advancing in Virtue',
  生活礼仪: 'Daily Etiquette',
  人才评价: 'On Talent',
  仁政克己: 'Self-Discipline & Rule',
  政事管理: 'Administration',
  修己安人: 'Cultivate Self, Care for Others',
  君子之道: 'The Gentleman’s Way',
  政治伦理: 'Political Ethics',
  性习相近: 'Human Nature',
  隐士处世: 'Hermits & the World',
  弟子言论: 'Disciples’ Words',
  尧舜之道: 'The Way of Yao & Shun',
};

// 取文案：按语言查字典，{name} 占位符用 vars 替换；缺 key 时回退中文
export function translate(lang: Language, key: MessageKey, vars?: Record<string, string | number>): string {
  const entry = messages[key];
  const text = (lang === 'en' ? entry.en : entry.zh) || entry.zh;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, name) =>
    name in vars ? String(vars[name]) : m
  );
}

// 主题标签：英文模式查表，无对照则显示原文
export function themeLabel(lang: Language, theme: string): string {
  if (lang === 'en' && THEME_EN[theme]) return THEME_EN[theme];
  return theme;
}
