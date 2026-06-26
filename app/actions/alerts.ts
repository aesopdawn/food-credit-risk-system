"use server";
// 风险预警的「处置」—— 补全业务闭环的关键一环。
// 预警生成后不再是死数据：执法员可处置（销警 + 记录处置方式/措施/处置人/时间），
// 并可选「同步登记一条监管措施事件」（如现场核查、督促信用修复），该事件写回后
// 自动触发重新评级 —— 形成「评级→预警→处置→措施回写→再评级」的完整闭环。
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { reRateEnterprise } from "@/lib/rating";
import { getSession } from "@/lib/session";
import { canWrite } from "@/lib/auth";
import { DISPOSITION_TYPES } from "@/lib/alert-constants";

const DisposeInput = z.object({
  alertId: z.string().min(1),
  dispositionType: z.enum(DISPOSITION_TYPES),
  disposition: z.string().trim().min(1, "请填写处置说明").max(500),
  // 可选：同步登记一条监管措施事件，写回后自动重评级
  followUp: z
    .object({
      type: z.enum(["INSPECTION", "PENALTY", "COMPLAINT", "REPAIR", "LICENSE"]),
      title: z.string().trim().min(1, "请填写措施事由").max(200),
      severity: z.number().int().min(1).max(5),
    })
    .optional(),
});

export type DisposeInputType = z.input<typeof DisposeInput>;
type ActionResult =
  | { ok: true; level?: string; score?: number; reRated: boolean }
  | { ok: false; error: string };

function revalidate(enterpriseId: string) {
  revalidatePath("/alerts");
  revalidatePath("/");
  revalidatePath("/enterprises");
  revalidatePath(`/enterprises/${enterpriseId}`);
}

/** 处置一条预警：销警留痕 + 可选写回监管措施事件并重评级。 */
export async function disposeAlert(raw: DisposeInputType): Promise<ActionResult> {
  const user = await getSession();
  if (!canWrite(user?.role)) return { ok: false, error: "无操作权限（当前为只读账号）" };

  const parsed = DisposeInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "参数有误" };
  const d = parsed.data;

  const alert = await prisma.alert.findUnique({ where: { id: d.alertId } });
  if (!alert) return { ok: false, error: "预警不存在" };
  if (alert.status === "已处置") return { ok: false, error: "该预警已处置，请勿重复操作" };

  await prisma.alert.update({
    where: { id: d.alertId },
    data: {
      status: "已处置",
      dispositionType: d.dispositionType,
      disposition: d.disposition,
      handledBy: user!.name,
      handledAt: new Date(),
    },
  });

  // 可选：把本次监管措施登记为一条涉企事件，写回后重新评级（闭环回流）
  let level: string | undefined;
  let score: number | undefined;
  let reRated = false;
  if (d.followUp) {
    await prisma.riskEvent.create({
      data: {
        enterpriseId: alert.enterpriseId,
        type: d.followUp.type,
        title: d.followUp.title,
        severity: d.followUp.severity,
        isVeto: false,
        occurredAt: new Date(),
        source: `预警处置闭环 · ${d.dispositionType}`,
        payload: JSON.stringify({ 处置预警: d.alertId, 处置说明: d.disposition }),
      },
    });
    const result = await reRateEnterprise(alert.enterpriseId);
    level = result?.level;
    score = result?.score;
    reRated = true;
  }

  revalidate(alert.enterpriseId);
  return { ok: true, level, score, reRated };
}

/** 撤销处置：把已处置预警退回「待处置」（如误处置）。清空处置留痕。 */
export async function reopenAlert(alertId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getSession();
  if (!canWrite(user?.role)) return { ok: false, error: "无操作权限（当前为只读账号）" };

  const alert = await prisma.alert.findUnique({ where: { id: alertId } });
  if (!alert) return { ok: false, error: "预警不存在" };

  await prisma.alert.update({
    where: { id: alertId },
    data: { status: "待处置", dispositionType: null, disposition: null, handledBy: null, handledAt: null },
  });
  revalidate(alert.enterpriseId);
  return { ok: true };
}
