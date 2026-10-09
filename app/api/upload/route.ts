import { env } from "cloudflare:workers";
import { getAdminSession, validateCsrf } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const session = await getAdminSession(request);
  if (!session || !validateCsrf(request, session)) return Response.json({ error: "无权访问" }, { status: 403 });
  if (!env.BUCKET) return Response.json({ error: "图片存储暂时不可用" }, { status: 503 });
  const form = await request.formData();
  const original = form.get("original"); const display = form.get("display");
  if (!(original instanceof File) || !(display instanceof File)) return Response.json({ error: "请选择有效图片" }, { status: 400 });
  if (original.size > 25 * 1024 * 1024) return Response.json({ error: "原图不能超过 25MB" }, { status: 413 });
  if (display.size > 8 * 1024 * 1024 || display.type !== "image/webp") return Response.json({ error: "展示图片格式无效" }, { status: 400 });
  if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(original.type)) return Response.json({ error: "仅支持 JPEG、PNG 或 WebP 图片" }, { status: 400 });
  const id = crypto.randomUUID(); const ext = original.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const originalKey = `uploads/originals/${id}.${ext}`; const displayKey = `uploads/display/${id}.webp`;
  await env.BUCKET.put(originalKey, await original.arrayBuffer(), { httpMetadata: { contentType: original.type, cacheControl: "private, no-store" } });
  await env.BUCKET.put(displayKey, await display.arrayBuffer(), { httpMetadata: { contentType: "image/webp", cacheControl: "private, no-store" } });
  return Response.json({ imageUrl: `/api/assets/${displayKey}`, originalUrl: `/api/assets/${originalKey}` });
}
