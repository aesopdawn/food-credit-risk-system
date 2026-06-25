import { listEnterprises } from "@/lib/data";
import EnterpriseTable from "@/components/EnterpriseTable";
import { getSession } from "@/lib/session";
import { canWrite } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EnterprisesPage() {
  const list = await listEnterprises();
  const user = await getSession();
  return <EnterpriseTable data={list} canWrite={canWrite(user?.role)} />;
}
