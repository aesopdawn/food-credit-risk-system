"use server";
// 登录 / 登出 Server Actions。
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSessionToken, COOKIE_NAME, SESSION_MAX_AGE, type Role } from "@/lib/auth";

type LoginResult = { ok: true } | { ok: false; error: string };

export async function login(input: { username: string; password: string }): Promise<LoginResult> {
  const username = input.username?.trim();
  const password = input.password ?? "";
  if (!username || !password) return { ok: false, error: "请输入用户名和密码" };

  const user = await prisma.user.findUnique({ where: { username } });
  // 演示用途：明文比对（生产应使用哈希）
  if (!user || user.password !== password) return { ok: false, error: "用户名或密码错误" };

  const token = await createSessionToken({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role as Role,
  });
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return { ok: true };
}

export async function logout(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
  redirect("/login");
}
