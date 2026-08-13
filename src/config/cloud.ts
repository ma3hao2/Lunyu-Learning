/**
 * 云开发环境配置
 *
 * 开源仓库默认使用占位符；本地/线上环境请通过「本地覆盖文件」注入真实环境 ID：
 *   1. 复制本文件为 src/config/cloud.local.ts（已被 .gitignore 忽略，不会提交）
 *   2. 在其中填写你的环境 ID：export const CLOUD_ENV = '你的环境ID';
 *
 * 获取方式：微信开发者工具 → 云开发 → 设置 → 环境ID
 * 留空时使用默认环境（仅适用于只有一个环境的开发期，生产环境强烈建议显式指定）
 */
let localEnv: string | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  localEnv = require('@/config/cloud.local').CLOUD_ENV;
} catch (e) {
  /* 无本地覆盖文件时使用占位符/默认环境 */
}

export const CLOUD_ENV = localEnv || '';
