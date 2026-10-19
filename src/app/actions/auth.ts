"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/crypto";
import { createSession, destroySession, getCurrentUser, SESSION_COOKIE } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { ensureDefaults } from "@/lib/seed";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function loginAction(prev: unknown, formData: FormData): Promise<ActionResult> {
  await ensureDefaults();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { ok: false, error: "Enter your username and password." };

  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const user = rows[0];
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    await audit(username || "unknown", "LOGIN_FAILED", "user", "", { username });
    return { ok: false, error: "Invalid credentials. Please try again." };
  }

  const token = await createSession(user.id);
  const store = await cookies();
  // SameSite=None + Secure + Partitioned so the session survives when the
  // console is embedded in a cross-site iframe (e.g. a preview panel).
store.set(SESSION_COOKIE, token, {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60,
  path: "/",
});
  await audit(user.username, "LOGIN", "user", user.id, {});
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const user = await getCurrentUser();
  if (token) await destroySession(token);
  if (user) await audit(user.username, "LOGOUT", "user", user.id, {});
store.set(SESSION_COOKIE, "", {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 0,
  path: "/",
});
  redirect("/login");
}
