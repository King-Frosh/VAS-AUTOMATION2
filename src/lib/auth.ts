import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { randomToken } from "@/lib/crypto";

export const SESSION_COOKIE = "briccs_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type Role = "ADMIN" | "OPS" | "VIEWER";

export async function createSession(userId: string): Promise<string> {
  const token = randomToken();
  await db.insert(sessions).values({
    token,
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return token;
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const user = rows[0]?.user;
  if (!user || !user.active) return null;
  return user;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function requireRole(user: User, roles: Role[]): void {
  if (!roles.includes(user.role as Role)) {
    throw new Error("You do not have permission to perform this action.");
  }
}

export function canManage(role: string): boolean {
  return role === "ADMIN";
}

export function canOperate(role: string): boolean {
  return role === "ADMIN" || role === "OPS";
}
