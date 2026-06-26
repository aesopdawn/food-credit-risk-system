"use server";
// 涉企事件的增删改 —— Next 16 Server Actions（前后端不分离，客户端直接调用）。
// 每次写库后都调用 reRateEnterprise 自动重评级，并 revalidate 受影响的页面，
// 让总览 / 名录 / 预警 / 详情自动刷新，无需手动 router.refresh()。
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { reRateEnterprise } from "@/lib/rating";
import { getSession } from "@/lib/session";
import { canWrite } from "@/lib/auth";

/** 写操作权限校验：viewer / 未登录返回拒绝结果，否则返回 null。 */
async function denyIfReadOnly(): Promise<{ ok: false; error: string } | null> {
  const user = await getSession();
  if (!canWrite(user?.role)) return { ok: false, error: "无操作权限（当前为只读账号）" };
  return null;
}

const NEGATIVE_TYPES = ["PENALTY", "INSPECTION", "COMPLAINT"] as const;

const EventInput = z
  .object({
    enterpriseId: z.string().min(1),
    type: z.enum(["PENALTY", "INSPECTION", "COMPLAINT", "REPAIR", "LICENSE"]),
    title: z.string().trim().min(1, "请填写事由").max(200),
    severity: z.number().int().min(1).max(5),
    isVeto: z.boolean().default(false),
    occurredAt: z.string().min(1, "请选择发生时间"),
    source: z.string().trim().min(1, "请填写数据来源").max(100),
    remark: z.string().trim().max(500).optional(),
    // 信用修复(REPAIR)的修复对象：回补哪个被扣分的维度
    repairTarget: z.enum(["PENALTY", "INSPECTION", "COMPLAINT"]).optional(),
  })
  .refine((d) => d.type !== "REPAIR" || !!d.repairTarget, {
    message: "信用修复请选择修复对象",
    path: ["repairTarget"],
  });

export type EventInputType = z.input<typeof EventInput>;
type ActionResult =
  | { ok: true; level?: string; score?: number }
  | { ok: false; error: string };

function revalidate(enterpriseId: string) {
  revalidatePath(`/enterprises/${enterpriseId}`);
  revalidatePath("/enterprises");
  revalidatePath("/alerts");
  revalidatePath("/");
}

/** 把表单输入归一化为可写库的数据（含一票否决仅对负面事件生效的约束）。 */
function toEventData(d: z.infer<typeof EventInput>) {
  const isVeto = (NEGATIVE_TYPES as readonly string[]).includes(d.type) ? d.isVeto : false;
  const payloadObj: Record<string, string> = {};
  if (d.remark) payloadObj.备注 = d.remark;
  if (d.type === "REPAIR" && d.repairTarget) payloadObj.修复对象 = d.repairTarget;
  return {
    type: d.type,
    title: d.title,
    severity: d.severity,
    isVeto,
    occurredAt: new Date(d.occurredAt),
    source: d.source,
    payload: Object.keys(payloadObj).length ? JSON.stringify(payloadObj) : null,
  };
}

export async function addRiskEvent(raw: EventInputType): Promise<ActionResult> {
  const denied = await denyIfReadOnly();
  if (denied) return denied;
  const parsed = EventInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "参数有误" };

  await prisma.riskEvent.create({
    data: { enterpriseId: parsed.data.enterpriseId, ...toEventData(parsed.data) },
  });
  const result = await reRateEnterprise(parsed.data.enterpriseId);
  revalidate(parsed.data.enterpriseId);
  return { ok: true, level: result?.level, score: result?.score };
}

export async function updateRiskEvent(eventId: string, raw: EventInputType): Promise<ActionResult> {
  const denied = await denyIfReadOnly();
  if (denied) return denied;
  const parsed = EventInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "参数有误" };

  await prisma.riskEvent.update({ where: { id: eventId }, data: toEventData(parsed.data) });
  const result = await reRateEnterprise(parsed.data.enterpriseId);
  revalidate(parsed.data.enterpriseId);
  return { ok: true, level: result?.level, score: result?.score };
}

export async function deleteRiskEvent(eventId: string, enterpriseId: string): Promise<ActionResult> {
  const denied = await denyIfReadOnly();
  if (denied) return denied;
  await prisma.riskEvent.delete({ where: { id: eventId } });
  const result = await reRateEnterprise(enterpriseId);
  revalidate(enterpriseId);
  return { ok: true, level: result?.level, score: result?.score };
}

/** 手动触发一次重新评级（不改事件），用于"重新评级"按钮。 */
export async function reRateAction(enterpriseId: string): Promise<ActionResult> {
  const denied = await denyIfReadOnly();
  if (denied) return denied;
  const result = await reRateEnterprise(enterpriseId);
  revalidate(enterpriseId);
  if (!result) return { ok: false, error: "企业不存在" };
  return { ok: true, level: result.level, score: result.score };
}
