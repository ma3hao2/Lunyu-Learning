# 去 UGC 改造计划：个人主体过审方案（方案 B）

> 提出：Hermes（2026-08-13）
> 背景：小程序提审被驳回——个人主体 + UGC（公开心得）触发「社交-笔记」类目（个人主体未开放）。用户决策：**移除全部 UGC 能力，改纯学习工具，个人主体过审**。
> 面向对象：Zcode
> 目标：**彻底移除"用户生成内容的记录/分享"，使功能与「工具-效率 / 教育-教育信息服务」类目匹配**。

---

## 一、改造原则

1. **彻底性**：任何"发布 / 公开 / 社区 / 其他用户可见"的入口、调用、文案全部清除——审核员会逐页走查，残留一个入口都可能再被拒
2. **学习功能 100% 保留**：阅读、标记已读、进度统计、本地笔记、云同步（登录后）、每日推荐、搜索——全部不动
3. **数据兼容**：已存在本地 storage 的 likedNoteIds/unlikedNoteIds 等字段保留（不主动清理，避免破坏存量用户数据），仅停止新增操作
4. **云函数**：login / syncProgress 保留（登录 + 进度同步非 UGC）；publishNote **代码不再调用**，目录保留标注 deprecated（未来企业主体恢复社区可复用）

---

## 二、改动清单（文件级）

### 1. 🗑️ 删除 insights 心得社区页
- **`src/pages/insights/index.tsx`**：整个文件删除
- **`src/assets/tabbar/insights.png / insights-selected.png / insights.svg / insights-selected.svg`**：删除
- **`src/app.config.ts`**：
  - `pages` 数组移除 `'pages/insights/index'`
  - `tabBar.list` 从 4 项减为 3 项（首页 / 论语 / 我的）

### 2. 🏠 首页快捷入口改造
- **`src/pages/home/index.tsx`**（约 206-211 行）：
  - "学习心得"快捷入口（`handleNavigate('/pages/insights/index')`）→ 改为「我的笔记」：`Taro.switchTab({ url: '/pages/mine/index' })`（我的页已有笔记列表），文案改「我的笔记」

### 3. 👤 我的页改造
- **`src/pages/mine/index.tsx`**：
  - `handleMenuClick('insights')`（约 201-202 行）+「浏览心得」菜单（约 351-355 行）→ 改为「我的笔记」入口（滚动到笔记列表或跳本地笔记查看），文案改「我的笔记」
  - 「点赞心得」统计（约 276 行）：移除（公开心得点赞不再存在；本地 likedNoteIds 保留但不再新增，统计无意义）
  - 删除心得弹窗（约 124 行）语义改为「删除这条笔记」（本地笔记）

### 4. ✍️ 写心得页改造（核心）
- **`src/packageContent/pages/writeNote/index.tsx`**：
  - 移除「公开发布」开关（`isPublic` state + UI）
  - 移除未登录公开发布拦截提示（约 127-131 行）
  - 移除云端联动（`publishNote` / `unpublishNote` 调用、cloudError 处理，约 154-156 行）
  - **只保留本地保存**：`addNote` / `updateNote`（登录与否均可写本地笔记）
  - 页面标题「写心得」→「写笔记」（导航栏 + 文案）

### 5. 📖 章句详情页改造
- **`src/packageContent/pages/verseDetail/index.tsx`**：
  - 移除「相关心得」区块：`relatedNotes / relatedLoading` state、云端拉取（约 96-105 行）、公开心得删除确认（约 184 行）、点赞逻辑（约 207 行）、列表渲染（含 NoteCard 引用）
  - 「写心得」按钮保留 → 跳 writeNote（本地笔记）
  - 空状态文案调整（无相关心得 → 无此区块）

### 6. 🧩 NoteCard 组件
- **`src/components/NoteCard/index.tsx`**：删 insights 与 verseDetail 相关心得后无引用 → **整个组件文件删除**（含样式）

### 7. 🔌 services 层
- **`src/services/auth.ts`**：删除 `publishNote` / `unpublishNote` / 相关云端心得封装（约 305-360 行）及类型（PublishedNote 等）；保留 login / syncProgress / 隐私授权相关

### 8. 📄 隐私政策更新
- **`src/pages/privacy/index.tsx`**：
  - 「1. 我们收集的信息」：删除"你主动选择『公开发布』的心得内容、标签与昵称，将展示给其他用户"
  - 「2. 信息的使用」：删除"云端数据用于……公开心得展示"
  - 「3. 云同步」：改为"登录后，你的学习进度与本地笔记上传至云端，仅用于多设备同步"
  - 其余（openId/昵称/头像/进度）保留

### 9. ⚙️ 设置页
- **`src/pages/settings/index.tsx`**：移除「默认公开发布」开关（`defaultPublic` 设置项）；`src/utils/settings.ts` / storage 中 defaultPublic 字段保留（兼容存量，不再展示入口）

### 10. ☁️ 云函数
- **`cloudfunctions/publishNote/`**：目录保留，文件头加 `// DEPRECATED: 个人主体版本停用（社交-笔记类目限制），保留待企业主体恢复社区时复用`；**不部署新版本即可**
- `cloudfunctions/login/`、`cloudfunctions/syncProgress/`：不动

### 11. 📝 类型清理
- **`src/types/index.ts`**：`PublishedNote` 等仅 UGC 使用的类型删除（若 auth.ts 删除后无引用）

### 12. 🧪 测试
- `tests/publishNote.test.ts`：**保留**（云函数纯逻辑测试，与页面无关，无害）
- 检查是否有引用 insights / NoteCard 的测试：如有同步删除/更新（预计无，页面层无单测）
- 新增（可选）：无（writeNote 页面层无单测习惯）

---

## 三、提审提交项（用户操作，非代码）

1. **类目改选**：微信后台 → 服务类目 → 改为「工具-效率」或「教育-教育信息服务」（个人主体可申请，无需资质）
2. **隐私保护指引更新**：小程序后台《用户隐私保护指引》删除"用户发布内容/社区展示"相关声明，保留：用户信息（昵称/头像）、openId、学习记录
3. 重新提交审核

---

## 四、验证清单（Zcode 完成改造后）

1. `npm test` 全量通过
2. `npm run build:weapp` 编译通过（3 tab 正常）
3. **UGC 残留扫描**（必须全为 0）：
   ```bash
   grep -rn "publishNote\|insights\|公开发布\|心得社区\|其他用户" src --include='*.ts' --include='*.tsx'
   ```
   - 允许残留：`docs/` 历史文档、`cloudfunctions/publishNote/`（deprecated 标注）、`tests/publishNote.test.ts`（纯逻辑测试）
   - 不允许：src 下任何 publishNote 调用 / insights 页面引用 / "公开发布"文案
4. 手动走查：底部 3 tab；写笔记 → 本地保存 → 我的页可见；章句详情无"相关心得"区块；全 app 无任何"发布到社区"入口
5. 数据完整性：已有用户升级后本地进度/笔记不丢（storage 结构未变）

---

## 五、备注

- **保留项**：微信登录、云进度同步、每日推荐（方案 E）、搜索、字体调节、清空数据——均非 UGC，全部保留
- **未来恢复社区**：企业主体申请成功后，git 历史中恢复 insights/writeNote 发布逻辑 + 部署 publishNote 云函数即可（本计划所有删除均为可逆操作，git 有完整历史）
- **审核风险兜底**：即使类目改选后，审核员仍可能人工点查——确保无任何"心得广场/公开/分享给他人"字样

—— 服务器 Hermes（2026-08-13）
