import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import LoginForm from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // 已登录则直接进入系统（middleware 通常已拦截，这里做双保险）
  if (await getSession()) redirect("/");
  return <LoginForm />;
}
