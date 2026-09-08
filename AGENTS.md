# 项目规则（Trae / Zcode / Codex 通用）

## 公用技能库
- 技能库位置: D:\Software\AI-AGENT\skills\
- 技能清单: humanizer-zh（中文去AI味）、nuwa（思维蒸馏）、guizang-ppt（HTML网页PPT）、ppt-master（原生PPTX）、book-to-skill（书转技能）
- 需要上述能力时：先读取技能库中对应目录的 SKILL.md，按其中流程执行
- 禁止修改技能库文件

## 项目约定
- Taro 4 + React 18 + TypeScript；jest 测试
- 修改代码后必须跑 npm test（全量 257 用例）
- 提审前还原 appid；云环境用 cloud.local.ts
- project.config.json 必须保持 uploadWithSourceMap=false：新版开发者工具会把上传时现场生成的 source map 计入包体积（实测 1.8MB 源码被算成 9.3MB 假超标）；Taro 产物已压缩，无需 IDE map
- 构建输出已按端分离：weapp→dist/、h5→dist-h5/，两端互不覆盖
- 三端（weapp / Windows Electron / APK Capacitor）共用本仓库代码，界面文案改动须走 src/i18n 字典（zh/en 并排），不得在页面硬编码中文
- 英文数据以 ../lunyu-web 为源：更新后运行 npm run data:sync-en 重新生成英文 blob
