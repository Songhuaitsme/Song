import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { getDatabase } from "@/lib/content-store";

const SESSION_COOKIE = "song_admin_session";
const VIEW_COOKIE = "song_view_mode";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_MS = 30 * 60 * 1000;
const MAX_FAILURES = 5;

export type AdminSession = {
  username: string;
  csrfToken: string;
  tokenHash: string;
  expiresAt: number;
};

export type ViewerContext = {
  isAdmin: boolean;
  ownerMode: boolean;
  csrfToken: string | null;
  username: string | null;
};

function adminConfig() {
  try {
    return {
      username: (env.ADMIN_USERNAME ?? "").trim().toLowerCase(),
      passwordHash: env.ADMIN_PASSWORD_HASH ?? "",
      sessionSecret: env.SESSION_SECRET ?? "",
    };
  } catch {
    return { username: "", passwordHash: "", sessionSecret: "" };
  }
}

export function isAdminConfigured() {
  const config = adminConfig();
  return Boolean(config.username && config.passwordHash && config.sessionSecret.length >= 32);
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomToken(bytes = 32): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return encodeBase64Url(value);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return encodeBase64Url(new Uint8Array(digest));
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return encodeBase64Url(new Uint8Array(digest));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return difference === 0;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [scheme, iterationsValue, saltValue, expectedValue] = encoded.split("$");
  const iterations = Number(iterationsValue);
  if (scheme !== "pbkdf2-sha256" || !Number.isInteger(iterations) || iterations < 100_000 || !saltValue || !expectedValue) return false;
  try {
    const salt = decodeBase64Url(saltValue);
    const expected = decodeBase64Url(expectedValue);
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const saltBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations }, key, expected.length * 8);
    return constantTimeEqual(new Uint8Array(bits), expected);
  } catch {
    return false;
  }
}

async function credentialFingerprint(): Promise<string> {
  const config = adminConfig();
  return sha256(`${config.username}\0${config.passwordHash}`);
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const item of header.split(";")) {
    const [key, ...rest] = item.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

async function readCookie(name: string, request?: Request): Promise<string | null> {
  if (request) return parseCookie(request.headers.get("cookie"), name);
  return (await cookies()).get(name)?.value ?? null;
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export function viewModeCookie(mode: "owner" | "visitor"): string {
  return `${VIEW_COOKIE}=${mode}; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; HttpOnly; Secure; SameSite=Lax`;
}

export async function getAdminSession(request?: Request): Promise<AdminSession | null> {
  if (!isAdminConfigured()) return null;
  const token = await readCookie(SESSION_COOKIE, request);
  const db = getDatabase();
  if (!token || !db) return null;
  const tokenHash = await sha256(token);
  const row = await db.prepare("SELECT token_hash, credential_fingerprint, csrf_token, expires_at FROM admin_sessions WHERE token_hash = ?").bind(tokenHash).first<Record<string, unknown>>();
  if (!row) return null;
  const now = Date.now();
  const fingerprint = await credentialFingerprint();
  if (Number(row.expires_at) <= now || String(row.credential_fingerprint) !== fingerprint) {
    await db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(tokenHash).run();
    return null;
  }
  return { username: adminConfig().username, csrfToken: String(row.csrf_token), tokenHash, expiresAt: Number(row.expires_at) };
}

export async function getViewerContext(request?: Request): Promise<ViewerContext> {
  const session = await getAdminSession(request);
  if (!session) return { isAdmin: false, ownerMode: false, csrfToken: null, username: null };
  const mode = await readCookie(VIEW_COOKIE, request);
  return { isAdmin: true, ownerMode: mode !== "visitor", csrfToken: session.csrfToken, username: session.username };
}

function clientAddress(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function attemptKey(request: Request, username: string): Promise<string> {
  return hmac(`${clientAddress(request)}\0${username.trim().toLowerCase()}`, adminConfig().sessionSecret);
}

async function isLocked(request: Request, username: string): Promise<boolean> {
  const db = getDatabase();
  if (!db) throw new Error("数据库暂时不可用");
  const key = await attemptKey(request, username);
  const row = await db.prepare("SELECT locked_until FROM login_attempts WHERE attempt_key = ?").bind(key).first<Record<string, unknown>>();
  return Boolean(row && Number(row.locked_until) > Date.now());
}

async function recordFailure(request: Request, username: string) {
  const db = getDatabase();
  if (!db) throw new Error("数据库暂时不可用");
  const key = await attemptKey(request, username);
  const now = Date.now();
  const row = await db.prepare("SELECT failures, window_started_at FROM login_attempts WHERE attempt_key = ?").bind(key).first<Record<string, unknown>>();
  const insideWindow = Boolean(row && now - Number(row.window_started_at) < LOGIN_WINDOW_MS);
  const failures = insideWindow ? Number(row?.failures ?? 0) + 1 : 1;
  const windowStartedAt = insideWindow ? Number(row?.window_started_at) : now;
  const lockedUntil = failures >= MAX_FAILURES ? now + LOGIN_LOCK_MS : 0;
  await db.prepare("INSERT INTO login_attempts (attempt_key, failures, window_started_at, locked_until) VALUES (?,?,?,?) ON CONFLICT(attempt_key) DO UPDATE SET failures=excluded.failures,window_started_at=excluded.window_started_at,locked_until=excluded.locked_until").bind(key, failures, windowStartedAt, lockedUntil).run();
}

async function clearFailures(request: Request, username: string) {
  const db = getDatabase();
  if (!db) return;
  await db.prepare("DELETE FROM login_attempts WHERE attempt_key = ?").bind(await attemptKey(request, username)).run();
}

export async function authenticateAdmin(request: Request, username: string, password: string) {
  if (!isAdminConfigured()) return { ok: false as const, unavailable: true as const };
  const normalizedUsername = username.trim().toLowerCase();
  if (await isLocked(request, normalizedUsername)) return { ok: false as const, locked: true as const };
  const config = adminConfig();
  const passwordMatches = await verifyPassword(password, config.passwordHash);
  const usernameMatches = normalizedUsername === config.username;
  if (!passwordMatches || !usernameMatches) {
    await recordFailure(request, normalizedUsername);
    return { ok: false as const };
  }
  await clearFailures(request, normalizedUsername);
  const db = getDatabase();
  if (!db) return { ok: false as const, unavailable: true as const };
  const token = randomToken();
  const csrfToken = randomToken(24);
  const tokenHash = await sha256(token);
  const now = Date.now();
  await db.batch([
    db.prepare("DELETE FROM admin_sessions WHERE expires_at <= ? OR credential_fingerprint != ?").bind(now, await credentialFingerprint()),
    db.prepare("INSERT INTO admin_sessions (token_hash, credential_fingerprint, csrf_token, created_at, last_seen_at, expires_at) VALUES (?,?,?,?,?,?)").bind(tokenHash, await credentialFingerprint(), csrfToken, now, now, now + SESSION_TTL_MS),
  ]);
  return { ok: true as const, token, csrfToken };
}

export async function destroyAdminSession(request: Request) {
  const token = await readCookie(SESSION_COOKIE, request);
  const db = getDatabase();
  if (token && db) await db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
}

export function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function validateCsrf(request: Request, session: AdminSession, supplied?: string | null): boolean {
  if (!hasSameOrigin(request)) return false;
  const value = supplied ?? request.headers.get("x-csrf-token");
  return Boolean(value && value === session.csrfToken);
}

export function safeReturnTo(value: unknown, fallback = "/studio"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, "https://song.local");
    return url.origin === "https://song.local" ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
