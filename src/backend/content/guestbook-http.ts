import { MessageError } from "@/shared/guestbook";

export async function messageRequestBody(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) throw new MessageError("请从本站页面提交留言", 403);
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new MessageError("请求格式无效", 415);
  if (Number(request.headers.get("content-length")) > 16384) throw new MessageError("提交内容过大", 413);
  const reader = request.body?.getReader(); if (!reader) throw new MessageError("提交内容为空");
  const chunks: Uint8Array[] = []; let length = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > 16384) { await reader.cancel(); throw new MessageError("提交内容过大", 413); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let data; try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new MessageError("请求格式无效"); }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new MessageError("请求格式无效");
  return data as Record<string, unknown>;
}
export function messageErrorResponse(error: unknown) {
  return Response.json({ error: error instanceof MessageError ? error.message : "留言服务暂时不可用，请稍后重试" }, { status: error instanceof MessageError ? error.status : 503, headers: { "cache-control": "no-store", ...(error instanceof MessageError && error.retryAfter ? { "retry-after": String(error.retryAfter) } : {}) } });
}
