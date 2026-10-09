import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { isSiteOwner } from "@/lib/owner-auth";

export async function POST(request: Request) {
  if (!isSiteOwner(await getChatGPTUser())) return Response.json({ error: "无权访问" }, { status: 403 });
  if (!env.BUCKET) return Response.json({ error: "图片存储暂时不可用" }, { status: 503 });
  const form = await request.formData();
  const original = form.get("original"); const display = form.get("display");
  if (!(original instanceof File) || !(display instanceof File)) return Response.json({ error: "请选择有效图片" }, { status: 400 });
  if (original.size > 25 * 1024 * 1024) return Response.json({ error: "原图不能超过 25MB" }, { status: 413 });
  const id = crypto.randomUUID(); const ext = original.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const originalKey = `uploads/originals/${id}.${ext}`; const displayKey = `uploads/display/${id}.webp`;
  await env.BUCKET.put(originalKey, await original.arrayBuffer(), { httpMetadata: { contentType: original.type || "application/octet-stream" } });
  await env.BUCKET.put(displayKey, await display.arrayBuffer(), { httpMetadata: { contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable" } });
  return Response.json({ imageUrl: `/api/assets/${displayKey}`, originalUrl: `/api/assets/${originalKey}` });
}
