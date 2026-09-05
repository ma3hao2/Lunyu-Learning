# 论语学习小程序（lunyu-miniapp）

一款基于 **Taro 4 + React + TypeScript + 微信云开发** 的《论语》学习小程序：二十篇原文/译文/注释精读、章句标记已读、学习进度多端云同步、本地学习笔记。

## 功能特性

- 📖 **二十篇全量精读**：509 条章句，含原文、白话译文、注释解读、核心要点（数据经 deflate 压缩后放入分包，主包保持轻量）
- 🌐 **中英双语切换**：设置页一键切换界面语言（中文 / English），章句译文、注释解读、核心要点与全部界面文案随语言切换（英文缺失逐字段回退中文，原文文言不翻译）；英文数据与 lunyu-web 共用同一翻译产线
- 🗓️ **每日推荐（主题轮换）**：按篇章主题 20 天一轮，同一天全用户看到同一句，跨年不重复
- ✅ **学习进度**：已读标记、连续学习天数、阅读进度条，登录后自动合并匿名期数据并云端同步
- ✍️ **本地笔记**：随手记录学习感悟，支持编辑/删除，随学习进度一起云端同步（个人主体合规，无公开社区）
- 🔒 **隐私合规**：微信隐私保护框架（授权前不上传、登录时弹官方授权框）
- 🧪 **测试完备**：256 项 Jest 单元测试全绿（存储合并、云函数、解压器、双语搜索、i18n、每日推荐等）

## 三端形态（一套代码）

| 端 | 壳 | 构建产物 |
|---|---|---|
| 微信小程序 | 微信运行时 | `npm run build:weapp` → `dist/` |
| Windows | Electron（`desktop/`，托管 H5 产物） | `npm run build:h5` → `dist-h5/` → `cd desktop && npm run dist` |
| 安卓 APK | Capacitor 7（`../lunyu-android/`，托管 H5 产物） | `npm run build:h5` → `dist-h5/` 拷入 www → `cap sync` → `gradlew assembleRelease` |

> 构建输出按端分离（weapp → `dist/`，h5 → `dist-h5/`），Taro 构建会清空输出目录，分离后两端互不覆盖；微信开发者工具预览小程序前只需保证跑过 `build:weapp`。

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Taro 4.1.x + React 18 + TypeScript |
| 平台 | 微信小程序（主）+ H5（Electron/Capacitor 套壳） |
| 后端 | 微信云开发（云函数 login / syncProgress；publishNote 已停用；云数据库、云存储） |
| 数据 | 章句数据构建时 deflate 压缩（`scripts/compress_verses.cjs` 中文 / `scripts/sync-en-data.mjs` 英文，反向同步自 lunyu-web），运行时纯 JS 解压（无 pako 依赖） |
| i18n | `src/i18n/`（zh/en 并排字典 + React Context Provider + tabBar/导航栏动态刷新） |
| 测试 | Jest + ts-jest（21 套件 / 256 用例） |

## 目录结构

```
├── src/
│   ├── app.tsx / app.config.ts      # 入口、I18nProvider、隐私门禁、分包/预下载配置
│   ├── i18n/                        # messages.ts（zh/en 字典 + THEME_EN）+ index.tsx（Provider/t()）
│   ├── pages/                       # 主包页面：首页/论语/笔记/我的/设置/隐私
│   ├── packageContent/              # 分包页面：篇章详情/章句详情/写笔记/译文搜索
│   ├── data/                        # 章节数据（中文压缩 blob + 英文压缩 blob + chaptersEn + loader）
│   ├── services/                    # auth（登录/云同步/隐私授权）、search、sync
│   ├── utils/                       # storage（进度/合并）、settings（含 language）、inflate（解压）
│   └── config/cloud.ts              # 云环境 ID（本地覆盖见「部署」）
├── cloudfunctions/                  # 云函数：login / syncProgress（publishNote 已停用保留）
├── scripts/                         # 数据生成与辅助脚本（含 sync-en-data.mjs 英文数据反向同步）
├── tests/                           # Jest 测试（21 套件 / 256 用例）
├── desktop/                         # Windows 桌面版（Electron 壳 + electron-builder 配置）
└── docs/                            # 计划与审查文档（双语改造、去 UGC、纯本地版、三交叉审查等）
```

## 本地开发

```bash
npm install
npm test                 # 256 项测试
npm run build:weapp      # 构建微信小程序（输出 dist/）
npm run dev:weapp        # 开发模式（watch）
npm run build:h5         # 构建 H5（Windows/APK 壳共用产物）
```

用微信开发者工具导入**项目根目录**（工具读取 `project.config.json` 定位 `dist/`）。

### 英文数据同步

英文章句/章节数据以 lunyu-web 为单一源（web 侧翻译产线产出），更新后反向同步并重新生成压缩 blob：

```bash
npm run data:sync-en     # lunyu-web/src/data/verses-en 更新后执行（生成 versesEnData.compressed.ts + chaptersEn.ts）
npm run data:compress    # 中文源数据变更后执行
```

## 部署

1. **AppID**：将 `project.config.json` 中的 `touristappid` 替换为你的小程序 AppID（或写入 `project.private.config.json` 的 `appid` 字段覆盖，该文件不入库）。
2. **云开发环境**：复制 `src/config/cloud.ts` 为 `src/config/cloud.local.ts`（已被 gitignore），填入你的环境 ID：
   ```ts
   export const CLOUD_ENV = '你的环境ID';
   ```
3. **创建集合**：云开发控制台手动创建 2 个集合，权限要求：
   - `progress`：仅创建者可读写（学习进度与本地笔记）
   - `users`：仅创建者可读写（登录用户资料，由 login 云函数写入）

   > 注：历史版本的 `notes` / `notes_likes`（公开心得/点赞）已随去 UGC 改造停用，无需创建。
4. **部署云函数**：开发者工具中右键 `cloudfunctions/` 下的 login、syncProgress 两个目录，「上传并部署：云端安装依赖」即可（publishNote 已停用，无需部署）。
5. **隐私保护指引**：小程序后台 → 设置 → 服务内容声明 → 用户隐私保护指引，声明收集「用户信息（头像、昵称）、学习进度（用于云端同步）、剪贴板（用于复制数据来源链接）」——不配置会导致头像选择、隐私授权弹窗异常，以及「设置 → 数据来源」复制链接报 errno 112。

## 数据版权

- 《论语》原文属公有领域。
- 译文、注释、核心要点**版权归本项目作者（和合文化屋公众号管理员）所有**，随项目以 MIT 协议开源，详见 [LICENSE](./LICENSE)。

## License

[MIT](./LICENSE)（含数据版权声明附加条款）。
