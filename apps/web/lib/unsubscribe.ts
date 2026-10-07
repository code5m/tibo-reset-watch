import "server-only";
import crypto from "node:crypto";

function secret() {
  return process.env.UNSUBSCRIBE_SECRET || process.env.ADMIN_SESSION_SECRET || "";
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}

export function createUnsubscribeToken(subscriberId: string) {
  if (!secret()) return null;
  const expires = Date.now() + 365 * 24 * 60 * 60 * 1000;
  const payload = subscriberId + "." + expires;
  return payload + "." + sign(payload);
}

export function verifyUnsubscribeToken(token: string) {
  if (!secret()) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [subscriberId, expiresRaw, signature] = parts;
  const payload = subscriberId + "." + expiresRaw;
  const expected = sign(payload);

  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;

  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Date.now()) return null;
  return subscriberId;
}
