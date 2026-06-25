// 服务端会话读取（用于服务端组件 / Server Action）。
// 依赖 next/headers，故与 edge-safe 的 lib/auth 分开，避免被 middleware 误引入。
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, verifySessionToken, type SessionUser } from "./auth";

/** 读取当前登录用户；未登录返回 null。 */
export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

/** 要求已登录，否则跳转登录页。 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}
