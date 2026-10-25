import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextRequest } from "next/server";

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = "scriptwriter_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionUser = { username: string; role: "admin" | "writer"; userId?: string; exp: number };

function secret() {
  return process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? "" : "local-development-only-change-this-secret");
}

function sign(value: string) {
  const key = secret();
  if (!key) throw new Error("SESSION_SECRET must be configured in production.");
  return createHmac("sha256", key).update(value).digest("base64url");
}

export function createSession(username: string, role: "admin" | "writer", userId?: string) {
  const payload: SessionUser = { username, role, ...(userId ? { userId } : {}), exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function readSessionFromRequest(request: NextRequest | Request): SessionUser | null {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const token = decodeURIComponent(match.slice(COOKIE_NAME.length + 1));
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  try {
    const expected = Buffer.from(sign(encoded));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionUser;
    if (!payload.username || !["admin", "writer"].includes(payload.role) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, hash] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function adminCredentialsMatch(username: string, password: string) {
  const expectedUsername = process.env.ADMIN_USERNAME || "zasha";
  const expectedPassword = process.env.ADMIN_PASSWORD || "zasha";
  const userBuffer = Buffer.from(username);
  const expectedUserBuffer = Buffer.from(expectedUsername);
  const passBuffer = Buffer.from(password);
  const expectedPassBuffer = Buffer.from(expectedPassword);
  const userMatches = userBuffer.length === expectedUserBuffer.length && timingSafeEqual(userBuffer, expectedUserBuffer);
  const passMatches = passBuffer.length === expectedPassBuffer.length && timingSafeEqual(passBuffer, expectedPassBuffer);
  return userMatches && passMatches;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
