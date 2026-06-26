// 预警处置方式常量（前后端共用）。
// 单独成文件：'use server' 的 app/actions/alerts.ts 只能导出 async 函数，不能导出常量，
// 因此把该常量放在普通模块，供 Server Action 与客户端组件共同 import。
export const DISPOSITION_TYPES = [
  "现场核查",
  "责令整改",
  "约谈告诫",
  "督促信用修复",
  "记录归档",
] as const;

export type DispositionType = (typeof DISPOSITION_TYPES)[number];
