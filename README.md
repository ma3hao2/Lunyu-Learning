# 论语学习小程序（lunyu-miniapp）

一款基于 **Taro 4 + React + TypeScript + 微信云开发** 的《论语》学习小程序：二十篇原文/译文/注释精读、章句标记已读、学习进度多端云同步、学习心得社区（发布/点赞）。

## 功能特性

- 📖 **二十篇全量精读**：509 条章句，含原文、白话译文、注释解读、核心要点（数据经 deflate 压缩后放入分包，主包保持轻量）
- 🗓️ **每日推荐（主题轮换）**：按篇章主题 20 天一轮，同一天全用户看到同一句，跨年不重复
- ✅ **学习进度**：已读标记、连续学习天数、阅读进度条，登录后自动合并匿名期数据并云端同步
- 🏘️ **心得社区**：公开发布心得、标签筛选、点赞/取消点赞（接入微信内容安全检查 msgSecCheck）
- 🔒 **隐私合规**：微信隐私保护框架（授权前不上传、登录/发布弹官方授权框）
- 🧪 **测试完备**：220 项 Jest 单元测试全绿（存储合并、云函数、解压器、搜索、每日推荐等）

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Taro 4.1.x + React 18 + TypeScript |
| 平台 | 微信小程序（主）+ H5 预览 |
| 后端 | 微信云开发（云函数 login / syncProgress / publishNote，云数据库，云存储） |
| 数据 | 章节数据构建时 deflate 压缩（`scripts/compress_verses.cjs`），运行时纯 JS 解压（无 pako 依赖） |
| 测试 | Jest + ts-jest（14 套件 / 220 用例） |

## 目录结构

```
├── src/
│   ├── app.tsx / app.config.ts      # 入口、隐私门禁、分包/预下载配置
│   ├── pages/                       # 主包页面：首页/论语/心得/我的/设置/隐私
│   ├── packageContent/              # 分包页面：章句详情/写心得/译文搜索
│   ├── data/                        # 章节数据（verses/ 源数据 + 压缩产物 + 索引）
│   ├── services/                    # auth（登录/云同步/发布）、search、sync
│   ├── utils/                       # storage（进度/合并）、settings、inflate（解压）
│   └── config/cloud.ts              # 云环境 ID（本地覆盖见「部署」）
├── cloudfunctions/                  # 云函数：login / syncProgress / publishNote
├── scripts/                         # 数据生成与辅助脚本
├── tests/                           # Jest 测试（220 用例）
└── docs/                            # 项目文档、审查记录、上线清单
```

## 本地开发

```bash
npm install
npm test                 # 220 项测试
npm run build:weapp      # 构建微信小程序（输出 dist/）
npm run dev:weapp        # 开发模式（watch）
```

用微信开发者工具导入**项目根目录**（工具读取 `project.config.json` 定位 `dist/`）。

## 部署

1. **AppID**：将 `project.config.json` 中的 `touristappid` 替换为你的小程序 AppID（或写入 `project.private.config.json` 的 `appid` 字段覆盖，该文件不入库）。
2. **云开发环境**：复制 `src/config/cloud.ts` 为 `src/config/cloud.local.ts`（已被 gitignore），填入你的环境 ID：
   ```ts
   export const CLOUD_ENV = '你的环境ID';
   ```
3. **创建集合**：云开发控制台手动创建 3 个集合，权限要求：
   - `progress`：仅创建者可读写（学习进度）
   - `notes`：所有用户可读，仅创建者可写（公开心得）
   - `notes_likes`：所有用户可读，仅创建者可写（点赞记录）
4. **部署云函数**：开发者工具中右键 `cloudfunctions/` 下三个目录（login / syncProgress / publishNote），逐个「上传并部署：云端安装依赖」。
5. **内容安全**（可选但推荐）：云开发控制台开通「内容安全」能力，否则发布会保守放行不拦截。
6. **隐私保护指引**：小程序后台 → 设置 → 服务内容声明 → 用户隐私保护指引，声明收集「头像、昵称、用户主动发布的内容」——不配置会导致头像选择与隐私授权弹窗异常。

## 数据版权

- 《论语》原文属公有领域。
- 译文、注释、核心要点**版权归本项目作者（和合文化屋公众号管理员）所有**，随项目以 MIT 协议开源，详见 [LICENSE](./LICENSE)。

## License

[MIT](./LICENSE)（含数据版权声明附加条款）。
