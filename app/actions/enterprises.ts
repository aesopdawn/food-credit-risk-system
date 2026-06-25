"use server";
// 企业档案增 / 删 / 改（查在 lib/data.ts）。Next 16 Server Actions。
// 建档后自动建立初始评级；改动经营状态会影响评分，故更新后自动重评级。
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { reRateEnterprise } from "@/lib/rating";
import { getSession } from "@/lib/session";
import { canWrite, isAdmin } from "@/lib/auth";

const EnterpriseInput = z.object({
  name: z.string().trim().min(1, "请填写企业名称").max(100),
  uscc: z.string().trim().min(1, "请填写统一社会信用代码").max(18),
  legalPerson: z.string().trim().min(1, "请填写法定代表人").max(50),
  registeredCapital: z.number().min(0, "注册资本不能为负"),
  establishedAt: z.string().min(1, "请选择成立日期"),
  industry: z.enum(["食品生产", "食品销售", "餐饮服务", "食品添加剂"]),
  region: z.string().trim().min(1, "请填写所在区县").max(50),
  businessScope: z.string().trim().min(1, "请填写经营范围").max(500),
  status: z.enum(["在营", "注销", "吊销"]),
});

export type EnterpriseInputType = z.input<typeof EnterpriseInput>;

type CreateResult = { ok: true; id: string } | { ok: false; error: string };
type MutateResult = { ok: true } | { ok: false; error: string };

function revalidate(id?: string) {
  revalidatePath("/enterprises");
  revalidatePath("/");
  revalidatePath("/alerts");
  if (id) revalidatePath(`/enterprises/${id}`);
}

/** 校验 USCC 唯一性（编辑时排除自身）。冲突返回错误信息，否则 null。 */
async function usccConflict(uscc: string, excludeId?: string): Promise<string | null> {
  const found = await prisma.enterprise.findUnique({ where: { uscc } });
  if (found && found.id !== excludeId) return "该统一社会信用代码已被其他企业使用";
  return null;
}

export async function createEnterprise(raw: EnterpriseInputType): Promise<CreateResult> {
  const user = await getSession();
  if (!canWrite(user?.role)) return { ok: false, error: "无操作权限（当前为只读账号）" };

  const parsed = EnterpriseInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "参数有误" };
  const d = parsed.data;

  const conflict = await usccConflict(d.uscc);
  if (conflict) return { ok: false, error: conflict };

  const created = await prisma.enterprise.create({
    data: { ...d, establishedAt: new Date(d.establishedAt) },
  });
  // 新企业暂无事件 → 初始评级（在营通常为 100 分 A 级）
  await reRateEnterprise(created.id);
  revalidate(created.id);
  return { ok: true, id: created.id };
}

export async function updateEnterprise(id: string, raw: EnterpriseInputType): Promise<MutateResult> {
  const user = await getSession();
  if (!canWrite(user?.role)) return { ok: false, error: "无操作权限（当前为只读账号）" };

  const parsed = EnterpriseInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "参数有误" };
  const d = parsed.data;

  const conflict = await usccConflict(d.uscc, id);
  if (conflict) return { ok: false, error: conflict };

  await prisma.enterprise.update({
    where: { id },
    data: { ...d, establishedAt: new Date(d.establishedAt) },
  });
  // 经营状态影响评分（吊销/注销会扣基础经营分），更新后重新评级
  await reRateEnterprise(id);
  revalidate(id);
  return { ok: true };
}

/** 删除企业（级联删除其事件/评级/预警）。高危操作，仅管理员可执行。 */
export async function deleteEnterprise(id: string): Promise<MutateResult> {
  const user = await getSession();
  if (!isAdmin(user?.role)) return { ok: false, error: "仅管理员可删除企业（如需停业请改为注销/吊销）" };

  await prisma.enterprise.delete({ where: { id } });
  revalidate();
  return { ok: true };
}
