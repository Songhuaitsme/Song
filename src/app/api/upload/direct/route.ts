import { env } from "cloudflare:workers";
import { getAdminSession, validateCsrf } from "@/backend/auth/admin-auth";
import { createDirectUpload, directUploadConfigured, readDirectUploadTicket, type DirectUploadMetadata } from "@/storage/direct-upload";
import { finishDirectUpload } from "@/storage/media-store";

export async function POST(request: Request) {
  const session = await getAdminSession(request);
  if (!session || !validateCsrf(request, session)) return Response.json({ error: "无权访问" }, { status: 403 });
  const headers = { "cache-control": "no-store" };
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "init") {
      if (!directUploadConfigured(env)) return Response.json({ enabled: false }, { headers });
      const input: DirectUploadMetadata = {
        fileName: String(body.fileName ?? ""), mimeType: String(body.mimeType ?? ""), size: Number(body.size), displaySize: Number(body.displaySize),
        checksum: String(body.checksum ?? ""), displayChecksum: String(body.displayChecksum ?? ""),
        width: Number(body.width), height: Number(body.height), assignment: String(body.assignment ?? "unassigned"),
      };
      return Response.json(await createDirectUpload(env, input, env.SESSION_SECRET ?? ""), { headers });
    }
    if (body.action === "complete") {
      const ticket = await readDirectUploadTicket(String(body.ticket ?? ""), env.SESSION_SECRET ?? "");
      return Response.json(await finishDirectUpload(ticket), { headers });
    }
    throw new Error("操作无效");
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "上传失败" }, { status: 400, headers });
  }
}
