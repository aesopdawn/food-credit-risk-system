// 服务端数据访问层 —— 页面与 AI 工具共用，避免重复查询逻辑
import { prisma } from "./db";
import type { ScoreResult } from "./scoring";

export type EnterpriseFilter = {
  level?: string;
  industry?: string;
  region?: string;
  keyword?: string;
};

/** 总览统计 */
export async function getDashboardStats() {
  const enterprises = await prisma.enterprise.findMany({
    include: { ratings: { orderBy: { computedAt: "desc" }, take: 1 } },
  });
  const levelCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  const industryLevel: Record<string, Record<string, number>> = {};
  for (const e of enterprises) {
    const lvl = e.ratings[0]?.level ?? "B";
    levelCounts[lvl] = (levelCounts[lvl] ?? 0) + 1;
    industryLevel[e.industry] ??= { A: 0, B: 0, C: 0, D: 0 };
    industryLevel[e.industry][lvl]++;
  }
  const pendingAlerts = await prisma.alert.count({ where: { status: "待处置" } });
  const totalEvents = await prisma.riskEvent.count();
  const recentAlerts = await prisma.alert.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { enterprise: { select: { id: true, name: true } } },
  });
  return {
    total: enterprises.length,
    levelCounts,
    industryLevel,
    pendingAlerts,
    totalEvents,
    recentAlerts,
  };
}

export type EnterpriseListItem = {
  id: string;
  name: string;
  uscc: string;
  industry: string;
  region: string;
  status: string;
  legalPerson: string;
  level: string;
  score: number | null;
  events: number;
  alerts: number;
};

/** 企业列表（含最新评级） */
export async function listEnterprises(filter: EnterpriseFilter = {}): Promise<EnterpriseListItem[]> {
  const where: Record<string, unknown> = {};
  if (filter.industry) where.industry = filter.industry;
  if (filter.region) where.region = filter.region;
  if (filter.keyword)
    where.OR = [{ name: { contains: filter.keyword } }, { uscc: { contains: filter.keyword } }];

  const list = await prisma.enterprise.findMany({
    where,
    include: {
      ratings: { orderBy: { computedAt: "desc" }, take: 1 },
      _count: { select: { events: true, alerts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  let mapped: EnterpriseListItem[] = list.map((e) => ({
    id: e.id,
    name: e.name,
    uscc: e.uscc,
    industry: e.industry,
    region: e.region,
    status: e.status,
    legalPerson: e.legalPerson,
    level: e.ratings[0]?.level ?? "-",
    score: e.ratings[0]?.score ?? null,
    events: e._count.events,
    alerts: e._count.alerts,
  }));
  if (filter.level) mapped = mapped.filter((m) => m.level === filter.level);
  return mapped;
}

/** 企业详情（档案 + 事件 + 评级历史 + 评分明细） */
export async function getEnterpriseDetail(id: string) {
  const e = await prisma.enterprise.findUnique({
    where: { id },
    include: {
      events: { orderBy: { occurredAt: "desc" } },
      ratings: { orderBy: { computedAt: "desc" } },
      alerts: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!e) return null;
  const latestRating = e.ratings[0] ?? null;
  let breakdown: ScoreResult | null = null;
  try {
    breakdown = latestRating ? (JSON.parse(latestRating.breakdown) as ScoreResult) : null;
  } catch {
    breakdown = null;
  }
  return { ...e, latestRating, breakdown };
}

/** 模糊查找单个企业（供 AI 工具使用：支持 ID / 名称 / 统一社会信用代码） */
export async function findEnterprise(query: string) {
  return prisma.enterprise.findFirst({
    where: {
      OR: [{ id: query }, { name: { contains: query } }, { uscc: { contains: query } }],
    },
  });
}
