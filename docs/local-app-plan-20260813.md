# 纯本地版 App 改造计划（安卓 / 鸿蒙 / iOS）

> 提出：Hermes（2026-08-13）
> 背景：基于 lunyu-miniapp（Taro 4.1.9 + React 18 + TS），在「去 UGC 改造」完成后，进一步扩展为**纯本地多端 App**——无登录、无服务器、数据全内置。
> 目标形态：打开即用；阅读/进度/笔记/每日推荐/搜索全部离线可用；三端（安卓、鸿蒙、iOS）覆盖。

---

## 一、形态定义（先对齐边界）

| 能力 | 纯本地版 | 说明 |
|---|---|---|
| 登录/账号 | ❌ 无 | 打开即用，无注册 |
| 云端同步 | ❌ 无 | 进度/笔记仅存设备本地 |
| 服务器 | ❌ 无需 | 数据全内置（509 条压缩 blob + 纯 JS 解压器） |
| 云函数/数据库 | ❌ 全部移除 | login / syncProgress / publishNote 均不打包 |
| 换设备数据 | ⚠️ 不跟随 | 本地存储特性，未来可渐进加云同步 |
| UGC/社区 | ❌ 无 | 与去 UGC 改造（方案 B）一致 |

**核心价值**：零服务器成本、零账号门槛、隐私极简（本地版几乎不收集数据，商店隐私政策好写）、离线可用。

---

## 二、技术路线选择（三端）

### 总策略：**Taro H5 为统一中间产物 + 各端套壳**

原因：
- Taro 的 H5 编译是**一等公民**（RN 端虽支持但坑多、鸿蒙不支持 RN）
- 套壳（WebView）路线在个人项目规模下性价比最高：一套 H5 代码，三端壳各自打包
- 现有代码（去 UGC 后）几乎零 UI 改动即可编译 H5

| 目标端 | 方案 | 构建环境 | 成本 |
|---|---|---|---|
| **安卓** | Taro H5 + **Capacitor** 套壳 | Windows（Android Studio） | 免费 |
| **鸿蒙** | Taro H5 + **ArkWeb** WebView 壳（华为工程模板） | Windows（DevEco Studio） | 免费 |
| **iOS** | Taro H5 + Capacitor + **云构建**（GitHub Actions macos runner） | 云端（无 Mac 方案） | $99/年开发者账号 |

> 备选进阶：若追求原生体验，可后续评估 Taro → React Native（仅安卓+iOS，鸿蒙仍走套壳）。**阶段一统一套壳，验证市场后再升级。**

### 存储适配（H5 版关键）

- Taro `setStorageSync / getStorageSync` 在 H5 端自动落到 **localStorage**（容量 ~5MB，509 条进度 + 笔记完全够）
- 注意：**H5 的 localStorage 与微信小程序 storage 不互通**——多端数据天然隔离，符合"本地版"定位
- 超限兜底：storage.ts 现有 try/catch 保留（localStorage 满时 setStorageSync 抛异常已有降级）

---

## 三、代码改造清单（在「去 UGC 改造」完成后的代码基础上）

### 3.1 删除（云端/微信依赖）

| 文件 | 删除内容 |
|---|---|
| `src/services/auth.ts` | 整个文件（login/syncProgress/publishNote 封装、ensurePrivacyAuthorized） |
| `src/services/cloud.ts` | 整个文件（Taro.cloud 初始化、云环境配置） |
| `src/config/cloud.ts` | 整个文件（CLOUD_ENV） |
| `src/app.tsx` | `Taro.cloud.init`、`privacyGateLogin`、`silentLoginAndMerge` 调用；保留主题/全局样式 |
| `src/app.config.ts` | `__usePrivacyCheck__`（微信专属）；pages 保持（去 UGC 后 5 页 + 分包 4 页） |
| `src/pages/mine/index.tsx` | 头像昵称编辑弹层、登录/退出、云端统计；保留：本地统计（已读/天数/笔记数）、笔记列表、设置入口 |
| `src/pages/settings/index.tsx` | 登录相关项、云同步开关（autoSync）、清空数据保留（本地） |
| `src/utils/storage.ts` | `clearAnonymousProgress` 相关、`mergeProgress` 云端分支可保留为纯本地工具（无云端调用则不影响）；`scheduleAutoSync` 防抖上传逻辑删除 |
| `cloudfunctions/` 目录 | 全部不再打包进 App（本来就不在客户端包内）；仓库保留归档 |

### 3.2 保留（核心资产，零改动）

- `src/data/versesLoader.ts` + `versesData.compressed.ts` + `inflate.ts`（509 条数据 + 解压）
- `src/data/chapters.ts`、`versesIndex.ts`、`dailyRecommend.ts`（方案 E）
- `src/utils/storage.ts` 的本地部分（进度/笔记/已读/连续天数）
- `src/utils/settings.ts`、`searchCommon.ts`、`useDebounce.ts`、`highlight.tsx`
- `src/pages/` 阅读链路：home / classics / chapterDetail / verseDetail / writeNote（本地笔记）/ search / settings / privacy
- `src/hooks/useProgress.ts`

### 3.3 调整（H5 兼容性小改）

| 项 | 改动 |
|---|---|
| 隐私政策页 | 文案改为本地版（"数据仅存于你的设备，本应用不收集个人信息"）；H5 页面照常可用 |
| 分享/复制 | 原微信 `onShareAppMessage` 若有，H5 端改为系统 Web 分享或移除 |
| 路由 | Taro 路由三端通用，无需改 |
| 字体/主题 | 现有 Sass 样式 H5 端可用；Capacitor 壳内需处理安全区（`env(safe-area-inset)`） |
| 性能 | H5 首次解压 851KB blob 在主线程，桌面/现代手机无感；移动端弱机可接受（一次解压有缓存） |

### 3.4 测试

- `npm test` 全量通过（storage/dailyRecommend/search/inflate 等纯逻辑测试与端无关，**全部保留**）
- `auth.test.ts` / `storage.cloudSync.test.ts`：删除或标记 deprecated（云端逻辑已移除）——**建议删除**，避免死代码
- 新增（可选）：无

---

## 四、构建与发布流程

### 4.1 安卓（Windows 本机可完成）

1. `npm run build:h5` → 产出 `dist/h5`
2. Capacitor 初始化：`npx cap add android`，`npx cap sync`，dist 指向 h5 产物
3. Android Studio 打开 `android/` → 签名（自签名 keystore）→ 构建 APK/AAB
4. 上架：华为/小米/OPPO/vivo/应用宝等——个人开发者需：**软件著作权证书**（可自助申请，免费约 1-2 个月下证，或代办 300-500 元）+ 隐私政策链接（可托管在阿里云服务器）

### 4.2 鸿蒙（Windows 可完成）

1. H5 产物同上
2. DevEco Studio 新建 HarmonyOS 工程，ArkWeb 组件加载本地 H5 资源（`web.loadUrl($rawfile/index.html)` 或内置 server）
3. 打包 HAP → 上架华为 AppGallery（个人开发者账号 + 软著 + 签名证书）

### 4.3 iOS（无 Mac 方案）

1. Apple Developer 账号（$99/年）
2. **云构建**：GitHub Actions 的 `macos-latest` runner（免费额度）跑 `npx cap add ios && xcodebuild` 出 IPA
3. 或用 MacinCloud（按小时租）
4. 上架 App Store：隐私政策链接 + 审核（本地版无权限申请，审核极简）

### 4.4 附加收益：H5 网页版

- `dist/h5` 可直接部署到**现有阿里云服务器**（nginx 托管）→ 得到一个网页版学习工具，手机浏览器访问即用（微信内也能打开）
- 服务器不算"为 App 准备"，而是网页版顺带收益，不增加成本

---

## 五、分阶段实施计划

| 阶段 | 内容 | 工作量 | 交付物 |
|---|---|---|---|
| **M0** | 去 UGC 改造（已在进行） | 1 天 | 个人主体过审版小程序 |
| **M1** | 纯本地化改造（删云端依赖） | 1-2 天 | `npm run build:h5` 可跑的 H5 版 |
| **M2** | 安卓套壳 + 签名 | 1 天 | 安卓 APK（可安装） |
| **M3** | 鸿蒙套壳 | 1-2 天 | HAP（可安装） |
| **M4** | iOS 云构建（可选） | 1-2 天 | IPA |
| **M5** | 上架材料（软著/隐私页部署） | 并行 | 商店在审 |

> 总计约 **1 周内**可完成 M1-M3（不含商店审核等待）。

---

## 六、风险与注意

1. **H5 体验上限**：WebView 壳启动略慢于原生（首屏 1-2s），弱机动画流畅度略逊——学习阅读类 App 影响小；若后续需要原生体验，再评估 RN 路线
2. **localStorage 容量**：5MB 足够（进度+笔记为 KB 级），但极端大量笔记需留意；未来可换 IndexedDB（Taro 封装）
3. **商店合规**：国内安卓商店对"工具-教育"类目个人开发者友好，但需软著；华为/小米政策随时变，上架前查最新要求
4. **版本同步**：H5 壳版本升级需重新打包各端——发布节奏统一走 H5 产物，一次改版三端同步
5. **数据孤岛**：多设备不互通是设计取舍；未来加云同步时（账号 + 服务器），仅需恢复 auth/cloud 逻辑 + storage 合并（代码架构已预留，git 历史完整）

---

## 七、结论

纯本地版是**投入产出比最高**的 App 化路径：
- 零服务器/零登录/零账号成本
- 现有代码 90% 直接复用（删云端 ≈ 1-2 天）
- 三端覆盖（安卓免费本地构建、鸿蒙免费、iOS 云构建可选）
- 额外白得一个网页版

**下一步**：等去 UGC 改造（M0）合入后，直接进入 M1 纯本地化改造。需要我出 M1 的具体代码删改 diff 清单时随时说。

—— 服务器 Hermes（2026-08-13）
