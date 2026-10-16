export type MessageVisibility = "public" | "hidden";
export type GuestbookMessage = { id: string; nickname: string; body: string; reply: string; createdAt: number; repliedAt: number | null };
export type ManagedMessage = GuestbookMessage & { visibility: MessageVisibility; version: number; updatedAt: number };
export type MessagePage<T = GuestbookMessage> = { items: T[]; total: number; page: number; pages: number; counts: { all: number; public: number; hidden: number } };
export class MessageError extends Error {
  constructor(message: string, public status = 400, public retryAfter?: number) { super(message); }
}
export function messageText(value: unknown, label: string, max: number, optional = false): string {
  if (typeof value !== "string") throw new MessageError(`${label}格式无效`);
  const text = value.replace(/\r\n?/g, "\n").trim();
  if ((!optional && !text) || Array.from(text).length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new MessageError(`${label}${optional ? "最多" : `须为 1～`}${max} 字`);
  if (label === "昵称" && /[\n\t]/.test(text)) throw new MessageError("昵称不能换行");
  return text;
}
export function messageIdentifier(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new MessageError("留言标识无效，请刷新后重试");
  return value;
}
export function validateMessageRow(data: Record<string, unknown>) {
  messageIdentifier(data.id); messageText(data.nickname, "昵称", 30); messageText(data.body, "留言", 1000); messageText(data.reply, "回复", 2000, true);
  if (!["public", "hidden"].includes(String(data.visibility)) || !Number.isSafeInteger(data.version) || Number(data.version) < 1) throw new MessageError("留言状态或版本无效");
  const validDate = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 8_640_000_000_000_000;
  for (const field of ["created_at", "updated_at"]) if (!validDate(data[field])) throw new MessageError("留言时间无效");
  for (const field of ["replied_at", "deleted_at"]) if (data[field] != null && !validDate(data[field])) throw new MessageError("留言时间无效");
  if (Boolean(String(data.reply).trim()) !== (data.replied_at != null)) throw new MessageError("回复内容与时间不匹配");
}
