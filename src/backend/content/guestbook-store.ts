import { env } from "cloudflare:workers";
import { getDatabase } from "./content-store";
import { MessageError, messageIdentifier, messageText, type GuestbookMessage, type ManagedMessage, type MessagePage } from "@/shared/guestbook";

type Row = { id: string; nickname: string; body: string; reply: string; visibility: "public" | "hidden"; created_at: number; replied_at: number | null; version: number; updated_at: number; deleted_at: number | null };
const minute = 60_000, day = 86_400_000;
function database() { const db = getDatabase(); if (!db) throw new MessageError("留言暂时无法使用，请稍后重试", 503); return db; }
export function publicMessage(row: Row): GuestbookMessage { return { id: row.id, nickname: row.nickname, body: row.body, reply: row.reply, createdAt: row.created_at, repliedAt: row.replied_at }; }
function managedMessage(row: Row): ManagedMessage { return { ...publicMessage(row), visibility: row.visibility, version: row.version, updatedAt: row.updated_at }; }
export async function listMessages(options: { admin?: boolean; page?: number; visibility?: string; query?: string } = {}): Promise<MessagePage<ManagedMessage> | MessagePage> {
  const db = database(), page = options.page ?? 1, query = (options.query ?? "").trim();
  if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000 || query.length > 200 || ![undefined, "all", "public", "hidden"].includes(options.visibility)) throw new MessageError("留言筛选参数无效");
  const visibility = options.admin ? options.visibility ?? "all" : "public";
  const where = "deleted_at IS NULL AND (?='all' OR visibility=?) AND (?='' OR instr(lower(nickname||char(10)||body),lower(?))>0)";
  const counts = options.admin ? await db.prepare("SELECT COUNT(*) AS all_count,COALESCE(SUM(visibility='public'),0) AS public_count,COALESCE(SUM(visibility='hidden'),0) AS hidden_count FROM guestbook_messages WHERE deleted_at IS NULL").first<{ all_count: number; public_count: number; hidden_count: number }>() : null;
  const total = Number((await db.prepare(`SELECT COUNT(*) AS n FROM guestbook_messages WHERE ${where}`).bind(visibility, visibility, query, query).first<{ n: number }>())?.n ?? 0);
  const pages = Math.max(1, Math.ceil(total / 20)), current = Math.min(page, pages);
  const rows = await db.prepare(`SELECT * FROM guestbook_messages WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET ?`).bind(visibility, visibility, query, query, (current - 1) * 20).all<Row>();
  return { items: rows.results.map(options.admin ? managedMessage : publicMessage), total, page: current, pages, counts: { all: counts?.all_count ?? total, public: counts?.public_count ?? total, hidden: counts?.hidden_count ?? 0 } };
}
async function digest(text: string) { const result = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)); return Array.from(new Uint8Array(result), n => n.toString(16).padStart(2, "0")).join(""); }
async function sourceHash(request: Request) {
  const secret = env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new MessageError("留言暂时无法使用，请稍后重试", 503);
  const ip = request.headers.get("cf-connecting-ip") ?? (env.LOCAL_DEV === "1" ? "local-development" : "unknown");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`guestbook:source:${ip}`));
  return Array.from(new Uint8Array(signature), n => n.toString(16).padStart(2, "0")).join("");
}
export async function submitMessage(request: Request, input: Record<string, unknown>) {
  const id = messageIdentifier(input.id), nickname = messageText(input.nickname, "昵称", 30), body = messageText(input.body, "留言", 1000);
  if (input.website !== undefined && input.website !== "") throw new MessageError("无法提交，请重新填写留言");
  const db = database(), timestamp = Date.now();
  const existing = await db.prepare("SELECT * FROM guestbook_messages WHERE id=?").bind(id).first<Row>();
  const acknowledged = (row: Row) => {
    if (row.nickname !== nickname || row.body !== body) throw new MessageError("这次提交的内容已变化，请重新提交", 409);
    return { ok: true, id, message: row.deleted_at == null && row.visibility === "public" ? publicMessage(row) : null };
  };
  if (existing) return acknowledged(existing);
  const source = await sourceHash(request), content = await digest(body.replace(/\s+/gu, " "));
  await db.batch([
    db.prepare("DELETE FROM guestbook_submissions WHERE created_at<=?").bind(timestamp - day),
    db.prepare(`INSERT INTO guestbook_submissions(id,source_hash,content_hash,created_at)
      SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM guestbook_submissions WHERE source_hash=? AND created_at>?)
      AND (SELECT COUNT(*) FROM guestbook_submissions WHERE source_hash=? AND created_at>?)<10
      AND NOT EXISTS(SELECT 1 FROM guestbook_submissions WHERE source_hash=? AND content_hash=? AND created_at>?) ON CONFLICT(id) DO NOTHING`)
      .bind(id, source, content, timestamp, source, timestamp - minute, source, timestamp - day, source, content, timestamp - day),
    db.prepare(`INSERT INTO guestbook_messages(id,nickname,body,reply,visibility,created_at,replied_at,version,updated_at,deleted_at)
      SELECT ?,?,?,'','public',?,NULL,1,?,NULL WHERE EXISTS(SELECT 1 FROM guestbook_submissions WHERE id=? AND source_hash=? AND content_hash=?) ON CONFLICT(id) DO NOTHING`)
      .bind(id, nickname, body, timestamp, timestamp, id, source, content),
  ]);
  const saved = await db.prepare("SELECT * FROM guestbook_messages WHERE id=?").bind(id).first<Row>();
  if (saved) return acknowledged(saved);
  const recent = await db.prepare("SELECT created_at,content_hash FROM guestbook_submissions WHERE source_hash=? AND created_at>? ORDER BY created_at DESC").bind(source, timestamp - day).all<{ created_at: number; content_hash: string }>();
  const duplicate = recent.results.find(row => row.content_hash === content);
  if (duplicate) throw new MessageError("这条内容已经提交过了，请不要重复留言", 429, Math.max(1, Math.ceil((duplicate.created_at + day - timestamp) / 1000)));
  if (recent.results.length >= 10) throw new MessageError("今天的留言次数已用完，请稍后再来", 429, Math.max(1, Math.ceil((recent.results.at(-1)!.created_at + day - timestamp) / 1000)));
  const wait = Math.max(1, Math.ceil(((recent.results[0]?.created_at ?? timestamp) + minute - timestamp) / 1000));
  throw new MessageError(`留言太快了，请 ${wait} 秒后重试`, 429, wait);
}
export async function manageMessage(input: Record<string, unknown>) {
  const id = messageIdentifier(input.id);
  if (!Number.isSafeInteger(input.version) || Number(input.version) < 1) throw new MessageError("留言版本无效");
  const db = database(), row = await db.prepare("SELECT * FROM guestbook_messages WHERE id=? AND deleted_at IS NULL").bind(id).first<Row>();
  if (!row) throw new MessageError("留言已删除或不存在", 404);
  if (row.version !== input.version) throw new MessageError("留言已有新修改，请刷新后核对，当前回复草稿已保留", 409);
  const timestamp = Date.now(); let statement: D1PreparedStatement;
  if (input.action === "reply") {
    const reply = messageText(input.reply, "回复", 2000, true);
    statement = db.prepare("UPDATE guestbook_messages SET reply=?,replied_at=?,version=version+1,updated_at=? WHERE id=? AND version=? AND deleted_at IS NULL").bind(reply, reply ? timestamp : null, timestamp, id, row.version);
  } else if (input.action === "set-visibility" && ["public", "hidden"].includes(String(input.visibility))) {
    statement = db.prepare("UPDATE guestbook_messages SET visibility=?,version=version+1,updated_at=? WHERE id=? AND version=? AND deleted_at IS NULL").bind(input.visibility, timestamp, id, row.version);
  } else if (input.action === "delete") {
    statement = db.prepare("UPDATE guestbook_messages SET deleted_at=?,version=version+1,updated_at=? WHERE id=? AND version=? AND deleted_at IS NULL").bind(timestamp, timestamp, id, row.version);
  } else throw new MessageError("留言操作无效");
  if (!Number((await statement.run()).meta.changes)) throw new MessageError("留言已有新修改，请刷新后核对，当前回复草稿已保留", 409);
  const saved = await db.prepare("SELECT * FROM guestbook_messages WHERE id=?").bind(id).first<Row>();
  return { ok: true, message: saved && saved.deleted_at == null ? managedMessage(saved) : null };
}
