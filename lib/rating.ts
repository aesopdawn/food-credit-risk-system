// 重新评级 —— 让评级"活"起来的核心。
// 任何对涉企事件的增 / 删 / 改之后都应调用 reRateEnterprise：
//   1) 基于企业当前【全部】事件重新跑确定性评分引擎；
//   2) 追加一条 RatingRecord（保留历史 → 支撑评级趋势图与台账）；
//   3) 联动刷新风险预警（早提醒）。
// 评分本身仍由 lib/scoring.ts 的纯函数完成，本文件只负责"落库 + 联动"。
import { prisma } from "./db";
import { computeScore, type ScoringEvent, type ScoreResult } from "./scoring";

export async function reRateEnterprise(enterpriseId: string): Promise<ScoreResult | null> {
  const e = await prisma.enterprise.findUnique({
    where: { id: enterpriseId },
    include: { events: true },
  });
  if (!e) return null;

  const result = computeScore(
    e.events.map(
      (ev): ScoringEvent => ({
        type: ev.type,
        title: ev.title,
        severity: ev.severity,
        isVeto: ev.isVeto,
        occurredAt: ev.occurredAt,
      }),
    ),
    e.status,
  );

  await prisma.ratingRecord.create({
    data: {
      enterpriseId,
      score: result.score,
      level: result.level,
      breakdown: JSON.stringify(result),
    },
  });

  await syncAlert(enterpriseId, result);
  return result;
}

/**
 * 预警联动：评级落到 C / D（或一票否决）时，若当前没有对应级别的"待处置"预警，
 * 则自动生成一条，做到"早提醒"。等级回升不在此自动销警（销警属人工"处置"动作，
 * 见预警处置闭环），避免误销与重复建警。
 */
async function syncAlert(enterpriseId: string, result: ScoreResult) {
  const open = await prisma.alert.findMany({ where: { enterpriseId, status: "待处置" } });
  const hasOpen = (lv: string) => open.some((a) => a.level === lv);

  if (result.veto || result.level === "D") {
    if (!hasOpen("高")) {
      await prisma.alert.create({
        data: {
          enterpriseId,
          level: "高",
          reason: result.veto
            ? "触发一票否决，存在严重食品安全风险"
            : `信用评级为 D 级（${result.score}分），属高风险企业`,
          status: "待处置",
        },
      });
    }
  } else if (result.level === "C") {
    if (!hasOpen("高") && !hasOpen("中")) {
      await prisma.alert.create({
        data: {
          enterpriseId,
          level: "中",
          reason: `信用评级为 C 级（${result.score}分），风险较高需重点关注`,
          status: "待处置",
        },
      });
    }
  }
}
