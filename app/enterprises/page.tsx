import { listEnterprises } from "@/lib/data";
import EnterpriseTable from "@/components/EnterpriseTable";

export const dynamic = "force-dynamic";

export default async function EnterprisesPage() {
  const list = await listEnterprises();
  return <EnterpriseTable data={list} />;
}
