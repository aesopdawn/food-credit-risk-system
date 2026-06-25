import { getDashboardStats } from "@/lib/data";
import DashboardView from "@/components/DashboardView";

export const dynamic = "force-dynamic";

export default async function Home() {
  const stats = await getDashboardStats();
  return <DashboardView stats={stats} />;
}
