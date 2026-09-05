# 项目规则（Trae / Zcode / Codex 通用）

## 公用技能库
- 技能库位置: D:\Software\AI-AGENT\skills\
- 技能清单: humanizer-zh（中文去AI味）、nuwa（思维蒸馏）、guizang-ppt（HTML网页PPT）、ppt-master（原生PPTX）、book-to-skill（书转技能）
- 需要上述能力时：先读取技能库中对应目录的 SKILL.md，按其中流程执行
- 禁止修改技能库文件

## 项目约定
- Taro 4 + React 18 + TypeScript；jest 测试
- 修改代码后必须跑 npm test（全量 227 用例）
- 提审前还原 appid；云环境用 cloud.local.ts
