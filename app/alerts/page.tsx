import { prisma } from "@/lib/db";
import AlertsView from "@/components/AlertsView";
import { getSession } from "@/lib/session";
import { canWrite } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const user = await getSession();
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
    dispositionType: a.dispositionType,
    disposition: a.disposition,
    handledBy: a.handledBy,
    handledAt: a.handledAt ? new Date(a.handledAt).toISOString().slice(0, 16).replace("T", " ") : null,
    enterprise: a.enterprise,
  }));
  return <AlertsView data={data} canWrite={canWrite(user?.role)} />;
}
