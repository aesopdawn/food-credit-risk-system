import { getEnterpriseDetail } from "@/lib/data";
import EnterpriseDetailView from "@/components/EnterpriseDetailView";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EnterpriseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = await getEnterpriseDetail(id);
  if (!d) notFound();

  // 构造可序列化的视图模型传给客户端组件
  const vm = {
    id: d.id,
    name: d.name,
    uscc: d.uscc,
    legalPerson: d.legalPerson,
    registeredCapital: d.registeredCapital,
    establishedAt: new Date(d.establishedAt).toISOString().slice(0, 10),
    industry: d.industry,
    region: d.region,
    businessScope: d.businessScope,
    status: d.status,
    level: d.latestRating?.level ?? "-",
    score: d.latestRating?.score ?? null,
    computedAt: d.latestRating ? new Date(d.latestRating.computedAt).toISOString().slice(0, 10) : null,
    breakdown: d.breakdown,
    events: d.events.map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title,
      severity: e.severity,
      isVeto: e.isVeto,
      source: e.source,
      occurredAt: new Date(e.occurredAt).toISOString().slice(0, 10),
    })),
    alerts: d.alerts.map((a) => ({ id: a.id, level: a.level, reason: a.reason, status: a.status })),
  };

  return <EnterpriseDetailView vm={vm} />;
}
