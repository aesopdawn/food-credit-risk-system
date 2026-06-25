// 轻量自建会话鉴权（无外部依赖）：HMAC-SHA256 签名的 HttpOnly Cookie。
// 本文件保持「edge-safe」：纯 Web Crypto，不引入 next/headers / prisma，
// 因此可同时被 middleware(Edge) 与服务端组件 / Server Action(Node) 共用。
// 注意：演示用途，密码在 User 表明文存储；生产应改为哈希。

export const COOKIE_NAME = "fcr_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 天（秒）

export type Role = "admin" | "inspector" | "viewer";

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: Role;
}

/** 角色中文名（供界面展示） */
export const ROLE_LABELS: Record<Role, string> = {
  admin: "管理员",
  inspector: "监管执法员",
  viewer: "查询岗",
};

/** 是否拥有写权限：录入/编辑/删除事件、重新评级、处置预警。viewer 为只读。 */
export function canWrite(role: string | undefined | null): boolean {
  return role === "admin" || role === "inspector";
}

/** 是否管理员（用户管理等高权限操作）。 */
export function isAdmin(role: string | undefined | null): boolean {
  return role === "admin";
}

const SECRET = process.env.AUTH_SECRET ?? "fcr-dev-secret-change-me-in-production";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return b64urlEncode(new Uint8Array(sig));
}

interface TokenPayload extends SessionUser {
  exp: number; // 过期时间（秒级时间戳）
}

/** 生成签名会话令牌：`base64url(payload).base64url(hmac)`。 */
export async function createSessionToken(user: SessionUser): Promise<string> {
  const payload: TokenPayload = { ...user, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE };
  const body = b64urlEncode(encoder.encode(JSON.stringify(payload)));
  const sig = await hmac(body);
  return `${body}.${sig}`;
}

/** 校验令牌：签名不符或已过期返回 null。 */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (sig !== (await hmac(body))) return null;
  try {
    const payload = JSON.parse(decoder.decode(b64urlDecode(body))) as TokenPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { id: payload.id, username: payload.username, name: payload.name, role: payload.role };
  } catch {
    return null;
  }
}
