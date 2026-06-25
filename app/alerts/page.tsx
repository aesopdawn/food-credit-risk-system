import { prisma } from "@/lib/db";
import AlertsView from "@/components/AlertsView";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const rows = await prisma.alert.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { enterprise: { select: { id: true, name: true, industry: true, region: true } } },
  });
  const data = rows.map((a) => ({
    id: a.id,
    level: a.level,
    reason: a.reason,
    status: a.status,
    createdAt: new Date(a.createdAt).toISOString().slice(0, 10),
    enterprise: a.enterprise,
  }));
  return <AlertsView data={data} />;
}
