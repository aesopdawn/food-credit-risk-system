// 信用风险评分引擎（纯函数、确定性、可解释）
// 设计原则：评级由确定性的指标加权计算得出，而非交给大模型——监管场景要求可解释、可复现。
// 大模型只负责"智能研判文字"和"对话查询"，不负责定级。

export type RiskLevel = "A" | "B" | "C" | "D";

/** 事件类型 */
export const EVENT_TYPES = {
  PENALTY: "行政处罚",
  INSPECTION: "抽查检查",
  COMPLAINT: "投诉举报",
  REPAIR: "信用修复",
  LICENSE: "许可资质",
} as const;
export type EventType = keyof typeof EVENT_TYPES;

/** 评分用的最小事件结构（与数据库 RiskEvent 兼容） */
export interface ScoringEvent {
  type: string; // EventType
  title: string;
  severity: number; // 1-5
  isVeto: boolean;
  occurredAt: Date | string;
}

/** 维度定义：满分相加 = 100 */
const DIMENSIONS = [
  { key: "BASE", name: "基础经营", full: 10 },
  { key: "PENALTY", name: "行政处罚", full: 35 },
  { key: "INSPECTION", name: "抽查检查", full: 25 },
  { key: "COMPLAINT", name: "投诉举报", full: 20 },
  { key: "CREDIT", name: "信用记录", full: 10 },
] as const;

/** 等级阈值 */
export const LEVEL_THRESHOLDS = { A: 85, B: 70, C: 60 } as const;

/** 等级含义（供前端展示与 AI 引用） */
export const LEVEL_META: Record<RiskLevel, { label: string; color: string; desc: string; supervision: string }> = {
  A: { label: "A 级 · 低风险", color: "#52c41a", desc: "信用状况良好，风险低", supervision: "常规监管，合理降低抽查比例（无事不扰）" },
  B: { label: "B 级 · 一般风险", color: "#1677ff", desc: "信用状况一般，存在轻微风险", supervision: "按常规比例和频次抽查" },
  C: { label: "C 级 · 较高风险", color: "#faad14", desc: "信用状况较差，风险较高", supervision: "提高抽查比例和频次，重点关注" },
  D: { label: "D 级 · 高风险", color: "#f5222d", desc: "信用状况差，风险高", supervision: "列为重点监管对象，加大检查力度，从严管理" },
};

export interface DeductionItem {
  title: string;
  points: number; // 扣分(正数表示扣了多少)
  occurredAt: string;
}

export interface DimensionScore {
  key: string;
  name: string;
  full: number;
  score: number; // 该维度实际得分
  deductions: DeductionItem[];
}

export interface ScoreResult {
  score: number; // 0-100
  level: RiskLevel;
  veto: boolean; // 是否触发一票否决
  breakdown: DimensionScore[];
  topRisks: string[]; // 主要风险因素（文字，供研判/解释）
}

/** 时间衰减：越久远的事件影响越小 */
function decayFactor(occurredAt: Date | string, now = new Date()): number {
  const years = (now.getTime() - new Date(occurredAt).getTime()) / (365 * 24 * 3600 * 1000);
  if (years <= 1) return 1;
  if (years <= 2) return 0.6;
  if (years <= 3) return 0.3;
  return 0.15;
}

function levelOf(score: number): RiskLevel {
  if (score >= LEVEL_THRESHOLDS.A) return "A";
  if (score >= LEVEL_THRESHOLDS.B) return "B";
  if (score >= LEVEL_THRESHOLDS.C) return "C";
  return "D";
}

/**
 * 核心评分函数。
 * @param events 该企业的全部涉企事件
 * @param status 企业经营状态（在营/注销/吊销）
 */
export function computeScore(events: ScoringEvent[], status = "在营"): ScoreResult {
  const dims: Record<string, DimensionScore> = {};
  for (const d of DIMENSIONS) {
    dims[d.key] = { key: d.key, name: d.name, full: d.full, score: d.full, deductions: [] };
  }

  // 基础经营维度：根据经营状态扣分
  if (status === "吊销") {
    dims.BASE.score = 0;
    dims.BASE.deductions.push({ title: "营业执照被吊销", points: 10, occurredAt: "" });
  } else if (status === "注销") {
    dims.BASE.score = 5;
    dims.BASE.deductions.push({ title: "企业已注销", points: 5, occurredAt: "" });
  }

  let veto = false;

  // 各类事件加减分
  const apply = (dimKey: string, points: number, e: ScoringEvent) => {
    const dim = dims[dimKey];
    const before = dim.score;
    dim.score = Math.max(0, dim.score - points);
    const actual = before - dim.score;
    if (actual > 0) {
      dim.deductions.push({
        title: e.title,
        points: Math.round(actual * 10) / 10,
        occurredAt: new Date(e.occurredAt).toISOString().slice(0, 10),
      });
    }
  };

  for (const e of events) {
    if (e.isVeto) veto = true;
    const decay = decayFactor(e.occurredAt);
    switch (e.type) {
      case "PENALTY":
        apply("PENALTY", e.severity * 3 * decay, e);
        break;
      case "INSPECTION": // 抽查发现的问题，severity 越高问题越严重
        apply("INSPECTION", e.severity * 2.5 * decay, e);
        break;
      case "COMPLAINT":
        apply("COMPLAINT", e.severity * 2 * decay, e);
        break;
      case "REPAIR": {
        // 信用修复：在信用记录维度恢复分数（不超过满分）
        const dim = dims.CREDIT;
        dim.score = Math.min(dim.full, dim.score + e.severity * 2);
        break;
      }
      default:
        break; // LICENSE 等：信息性，不影响评分
    }
  }

  let score = Object.values(dims).reduce((s, d) => s + d.score, 0);
  score = Math.round(score * 10) / 10;

  let level = levelOf(score);
  if (veto) {
    level = "D";
    score = Math.min(score, 40);
  }

  // 主要风险因素：取扣分最多的若干项
  const allDeductions = Object.values(dims)
    .flatMap((d) => d.deductions.map((x) => ({ ...x, dim: d.name })))
    .sort((a, b) => b.points - a.points)
    .slice(0, 4);
  const topRisks = allDeductions.map((d) => `【${d.dim}】${d.title}（扣${d.points}分${d.occurredAt ? "，" + d.occurredAt : ""}）`);
  if (veto) topRisks.unshift("⚠️ 触发一票否决（发生严重食品安全事故），直接定为 D 级");

  return { score, level, veto, breakdown: Object.values(dims), topRisks };
}
