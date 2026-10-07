import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "resetwatch_admin";

function secret() {
  return process.env.ADMIN_SESSION_SECRET || "";
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

export function createAdminSession() {
  if (!secret()) throw new Error("ADMIN_SESSION_SECRET is not configured");
  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = String(expires);
  return payload + "." + sign(payload);
}

export function verifyAdminSession(value?: string | null) {
  if (!value || !secret()) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;

  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return false;

  const expires = Number(payload);
  return Number.isFinite(expires) && expires > Date.now();
}

export async function isAdmin() {
  const store = await cookies();
  return verifyAdminSession(store.get(COOKIE_NAME)?.value);
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

export const adminCookieName = COOKIE_NAME;
