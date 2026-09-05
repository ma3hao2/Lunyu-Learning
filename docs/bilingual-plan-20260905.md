# 三端中英双语改造计划（小程序 / Windows / APK）

> **状态：已执行完成（2026-09-05）。** 数据层/i18n/主包与分包页面/三端产物均已落地，256 项测试全绿，H5 端语言切换经浏览器实测通过；weapp 需人工经开发者工具上传提审。
> 提出：Zcode（2026-09-05）
> 背景：lunyu-web 已完成中英双语改造（2026-09 增量，见 lunyu-web/DESIGN.md 第〇节），界面语言与章句数据均可切换。本计划将同样的双语能力移植到 lunyu-miniapp 代码库，使其三端产物——微信小程序（weapp）、Windows 桌面版（Electron）、安卓 APK（Capacitor）——全部支持中英切换。
> 核心洞察：**三端共用同一套 lunyu-miniapp 源码**。Windows 版 = Electron 壳托管 `taro build --type h5` 产物；APK = Capacitor 壳托管同一 H5 产物；小程序 = weapp 构建。**代码改造只做一次，三端各自重建产物即可**。

---

## 一、现状盘点

### 1.1 三端产物链路

| 端 | 壳 | 托管产物 | 重建方式 |
|---|---|---|---|
| 微信小程序 | 微信运行时 | `npm run build:weapp` → dist | 开发者工具上传提审 |
| Windows | Electron（`desktop/`，electron-builder） | `taro build --type h5` → `../dist`（extraResources 注入） | `cd desktop && npm run dist`（nsis + portable） |
| 安卓 APK | Capacitor 7（`../lunyu-android/`，webDir www） | 同一 H5 产物拷入 www | `cap sync` + `gradlew assembleRelease`（keystore 在 lunyu-android 根目录） |

> 注：`../lunyu-android-build/`（appId com.lunyu.study）为旧构建工作区，未配签名。建议本次改造后**归档停维护**，统一以 `lunyu-android/`（com.lunyu.app）为准，避免双包漂移。

### 1.2 可移植的双语资产（lunyu-web，已验证）

| 资产 | 位置 | 说明 |
|---|---|---|
| 英文章句数据 | `lunyu-web/src/data/verses-en/`（20 篇，736KB 源码） | `VerseEn { id, translation, commentary, keyPoint }`，与中文 id 对齐；结构完整性由 `versesEn.test.ts` 验收 |
| 英文章节/主题 | `chaptersEn.ts` + `THEME_EN` 映射 | 篇名、简介、主题词英文 |
| i18n 基建 | `src/i18n/messages.ts`（zh/en 并排字典）+ `index.tsx`（Context Provider + 回退） | 纯 TS，几乎可直接移植 |
| 双语搜索 | `searchVerses(kw, lang)` | 英文模式搜英文字段，缺失回退中文，原文永远参与 |
| 语言设置 | `AppSettings.language`（默认 zh） | 存储字段规范可直接沿用 |

### 1.3 小程序侧的体积红线（方案设计的决定性约束）

- 中文数据为构建时 deflate 压缩 blob（`versesData.compressed.ts`，851KB 源码），**刻意只被分包页面/服务静态引用**——app.tsx 注释明确警告不得在主包静态引入（否则 common.js 174KB → 1MB，违背"完整数据进分包"设计）。
- 首页/论语页只用轻量索引 `versesIndex.ts`（92KB），只展示文言原文。
- **推论**：英文数据同样必须放分包；主包只新增 i18n 字典（~15KB）与 settings.language 字段，主包体积近似零增长。

---

## 二、总体策略

1. **单一英文数据源 = lunyu-web**。翻译产线与验收测试已在 web 侧建立，小程序新增反向同步脚本 `scripts/sync-en-data.mjs`（web → miniapp），与现有 `sync-data.mjs`（miniapp → web）方向相反、互不冲突：
   - 中文数据流：miniapp → web
   - 英文数据流：web → miniapp
2. **数据双 blob、按语言懒解压**。中文 blob 维持现状；英文数据构建为 `versesEnData.compressed.ts`（预估 deflate 后 250-350KB），新增 `versesEnLoader.ts` 仅在英文模式首次取值时解压一次。中文模式内存与启动开销零变化。
3. **i18n 移植 web 方案**：messages.ts 字典 + React Context（Taro 支持）+ settings.language 持久化；新增 Taro 特有处理——原生 tabBar / 导航栏标题 / 分享文案的动态更新。
4. **原文（文言）不翻译**，与 web 一致。主包页面（首页/论语页/笔记页）继续只展示文言原文，英文章句内容（译文/注释/要点）仅在分包页面呈现——主包零数据增长，无需打破现有体积设计。

---

## 三、文件级改动清单

### 3.1 数据层（分包）

| 文件 | 操作 | 内容 |
|---|---|---|
| `scripts/sync-en-data.mjs` | 新增 | 从 `../lunyu-web/src/data/verses-en/*.ts` + `chaptersEn.ts` 提取 JSON → deflate → base64 → 生成 `src/data/versesEnData.compressed.ts`；复用 `compress_verses.cjs` 的压缩函数；顺带解码 HTML 实体残留 |
| `src/data/versesEnData.compressed.ts` | 生成物 | 英文压缩 blob（勿手改） |
| `src/data/versesEnLoader.ts` | 新增 | `loadVerseEn(id)` / `loadChapterEn(chapterId)` / `loadAllVersesEn()`；懒解压 + 缓存，语义对齐 versesLoader |
| `src/types/index.ts` | 修改 | `type Language = 'zh' \| 'en'`；`interface VerseEn`；`AppSettings` 加 `language` |

### 3.2 i18n 基建

| 文件 | 操作 | 内容 |
|---|---|---|
| `src/i18n/messages.ts` | 新增 | 移植 web 版字典，补小程序特有 key：tabBar 四项、设置页各项、清空确认弹窗、剪贴板 toast、隐私页长文、分享标题 |
| `src/i18n/index.tsx` | 新增 | I18nProvider（Taro 版）：无 `document` 环境判断后仅 H5 同步 `<html lang>`；无 Provider 回退直读 settings；`setLang` 内联调用 `Taro.setTabBarItem` ×4 |
| `src/utils/settings.ts` | 修改 | `language` 字段默认 `'zh'`，getSettings 逐字段规范化；新增 `saveLanguage(lang)` |
| `src/pages/settings/index.tsx` | 修改 | 「界面语言 / Language」切换项（中文 / English 两档，样式复用字号三档的选择条），即时生效 |

### 3.3 页面接入（文案 t() 化 + 内容取值）

| 范围 | 文件 | 要点 |
|---|---|---|
| 主包 6 页 | `pages/home`、`classics`、`insights`、`mine`、`settings`、`privacy` | 硬编码中文 → `t()`；`useDidShow` 中 `Taro.setNavigationBarTitle` 动态设标题；主题词经 `theme()`；隐私页长文走字典 |
| 分包 4 页 | `packageContent/pages/chapterDetail`、`verseDetail`、`writeNote`、`search` | 章句译文/注释/要点经 `verseText(verse, en)` 取英文（`versesEnLoader` 供数，缺失回退中文）；篇名/按钮/空态文案 t() |
| 导航栏静态标题 | 各页 `index.config.ts` | 保留中文为默认；英文由运行时 `setNavigationBarTitle` 覆盖（weapp 与 H5 均支持） |
| 分享文案 | 各页 `useShareAppMessage` | 标题/路径文案 t() 化 |
| 搜索 | `services/searchCommon.ts`、`packageContent/services/deepSearch.ts` | `getFieldValue(v, field, lang)`；FIELD_LABELS 改为字典 key（原文/译文/注释 ↔ Original/Translation/Commentary）；英文模式搜英文字段、回退中文、原文恒参与 |
| 主包快捷搜索 | `services/search.ts` | **不改**——只搜 `versesIndex.original`（文言），与语言无关 |
| 入口 | `src/app.tsx` | 包裹 I18nProvider；确认不新增主包数据引用（维持体积红线） |

### 3.4 三端产物重建（代码完成后）

| 端 | 步骤 | 版本 |
|---|---|---|
| 小程序 | `npm test` 全绿 → `npm run build:weapp` → 开发者工具真机走查 → 上传提审（默认中文界面，提审材料不变；隐私指引无新增收集项，无需更新） | package.json → 1.1.0 |
| Windows | `npm run build:h5` → `cd desktop && npm run dist`（extraResources 自动打包新 dist）→ 产出 `release/LunYu-Setup-1.1.0-x64.exe` + Portable | desktop/package.json → 1.1.0 |
| APK | H5 产物拷入 `lunyu-android/www` → `npx cap sync android` → `gradlew assembleRelease`（核对 `android/app/build.gradle` 签名配置与 `lunyu-release.keystore` 对接）→ 真机安装走查 | versionName → 1.1.0 |

---

## 四、测试策略（沿用「先写测试，全绿才 commit」纪律）

| 套件 | 覆盖 |
|---|---|
| `versesEnLoader.test.ts` | EN blob 解压后 20 篇齐全；id 与中文 versesIndex 全量对齐（无缺漏）；`translation/commentary/keyPoint` 非空；commentary `---` 分节结构合法（移植 web versesEn.test.ts 方法学） |
| `i18n.test.tsx` | zh/en 字典 key 完全对齐；`t()` 占位符替换；无 Provider 回退取值；theme/chapterTitle 回退中文 |
| `settings` 增补 | language 字段默认 zh、非法值规范化、saveLanguage 持久化往返、清空学习数据不影响 language |
| `searchCommon` 增补 | 英文关键词命中英文译文/注释；英文缺失回退中文；原文恒参与；字段标签按语言返回 |
| 回归 | 现有 18 套件 / 227 用例全绿（AGENTS.md 纪律） |

---

## 五、里程碑（小步快走，每步一次 commit）

| # | 步骤 | 产出 | 工作量 |
|---|---|---|---|
| M0 | 基线测量 | weapp 主包/分包体积基线；EN 数据试压缩体积（验证 <400KB 预估）；H5 dist 基线 | 0.5 天 |
| M1 | 数据层 | sync-en-data.mjs + versesEnData blob + versesEnLoader + 数据完整性测试全绿 | 0.5-1 天 |
| M2 | i18n 基建 | messages.ts + I18nProvider + settings.language + 设置页切换项 | 0.5 天 |
| M3 | 主包页面 | 6 页文案 t() 化 + tabBar/导航栏动态化 + 测试 | 1 天 |
| M4 | 分包页面 | 4 页内容/文案双语 + 双语搜索 + deepSearch + 测试 | 1 天 |
| M5 | 回归与 H5 验证 | 227+ 新增用例全绿；dev:h5 走查切换即时生效、blob 懒解压无卡顿 | 0.5 天 |
| M6 | 三端产物重建 | weapp 上传提审；exe（Setup + Portable）；release APK 真机走查 | 0.5-1 天 |
| M7 | 收尾 | README / DESIGN / AGENTS（用例数）更新；lunyu-android-build 归档；发布记录 | 0.5 天 |

**合计约 5-5.5 天**（不含微信审核等待）。

---

## 六、风险与对策

| 风险 | 对策 |
|---|---|
| 分包超 2MB 上限 | 中文 blob 851KB + 英文 ~350KB + 分包代码，预估 ~1.4MB 有余量；M0 实测，超限时按章拆分 EN blob 按需解压 |
| Taro H5 端 `setTabBarItem` / `setNavigationBarTitle` 兼容性 | Taro 自绘 tabBar/navigator 已封装这两个 API；M3 在 dev:h5 验证，异常则 H5 端降级为「切换语言后下次进入页面生效」并在文档标注 |
| 英文模式内存（双 blob 解压） | EN blob 仅在英文模式首次取值时解压；JSON 双份 ~5MB 内存量级，学习类页面可承受；低端机如遇卡顿改为按章惰性解压 |
| 英文数据缺句回退体验 | 沿用 web 策略：缺失字段逐项回退中文，不整页降级；数据完整性测试保证零缺失 |
| 翻译长文工作量（隐私页、弹窗、提示语） | 界面文案从 web messages.ts 移植为主，小程序特有 key 约数十条，一次性补齐；隐私页长文可子代理翻译 + 人工复核 |
| 微信审核风险 | 界面语言切换不改变功能类目与隐私声明（无新增收集项、无 UGC 回归）；提审默认中文，提交材料与历史版本一致 |
| 云同步兼容 | language 为设备维度设置，不进 syncProgress 载荷，与 web（localStorage）行为一致，云端契约零变更 |

---

## 七、明确不做

- **《论语学习心得提炼版》不入 App**：仍是独立内容资产，双语改造不涉及。
- **原文（文言）不翻译**：与 web 版口径一致，文言本身即跨语言学习对象。
- **lunyu-web 不改动**：已是双语基准；反向同步脚本只读取其数据，不产生回写。
- **不做跟随系统语言自动切换**：首版仅手动切换（与 web 一致，避免设置项语义复杂化）；后续可作为增量。

—— Zcode（2026-09-05）
