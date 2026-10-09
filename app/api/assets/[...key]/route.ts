import { env } from "cloudflare:workers";
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  if (!env.BUCKET) return new Response("Not found", { status: 404 });
  const { key } = await params; const object = await env.BUCKET.get(key.join("/"));
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers(); object.writeHttpMetadata(headers); headers.set("etag", object.httpEtag); headers.set("cache-control", headers.get("cache-control") || "public, max-age=86400");
  return new Response(object.body, { headers });
}
