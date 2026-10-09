import { env } from "cloudflare:workers";
import { getAdminSession } from "@/lib/admin-auth";
import { getAssetAccess } from "@/lib/content-store";

export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (!env.BUCKET) return new Response("Not found", { status: 404 });
  const { key } = await params;
  if (!key.length || key.some((part) => !part || part === "." || part === "..")) return new Response("Not found", { status: 404 });
  const objectKey = key.join("/");
  const assetUrl = `/api/assets/${objectKey}`;
  const level = await getAssetAccess(assetUrl);
  const session = level === "public" ? null : await getAdminSession(request);
  if (level !== "public" && !session) return new Response("Not found", { status: 404 });
  const object = await env.BUCKET.get(objectKey);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", level === "public" ? "public, max-age=86400" : "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}
