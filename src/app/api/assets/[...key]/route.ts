import { getAdminSession } from "@/backend/auth/admin-auth";
import { getAssetAccess } from "@/backend/content/content-store";
import { getMediaObject, validObjectKey } from "@/storage/media-store";

export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const objectKey = key.join("/");
  if (!validObjectKey(objectKey)) return new Response("Not found", { status: 404 });
  const assetUrl = `/api/assets/${objectKey}`;
  const level = await getAssetAccess(assetUrl);
  const session = level === "public" ? null : await getAdminSession(request);
  if (level !== "public" && !session) return new Response("Not found", { status: 404 });
  const object = await getMediaObject(objectKey);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", level === "public" ? "public, max-age=86400" : "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}
