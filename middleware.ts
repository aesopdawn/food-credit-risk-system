// 路由保护中间件：未登录访问任意页面 → 跳转 /login；已登录访问 /login → 跳回首页。
// 使用 edge-safe 的 lib/auth 做完整签名校验（Web Crypto 可在 Edge 运行）。
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySessionToken(req.cookies.get(COOKIE_NAME)?.value);
  const isLogin = pathname === "/login";

  if (!session && !isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  if (session && isLogin) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// 排除 API、Next 静态资源、favicon 与 public 下的 svg
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
