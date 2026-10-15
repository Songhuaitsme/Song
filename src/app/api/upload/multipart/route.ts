import { getAdminSession, validateCsrf } from "@/backend/auth/admin-auth";
import { beginMultipart, finishMultipart, uploadMultipartPart } from "@/storage/media-store";

const allowedMime = new Set(["image/jpeg", "image/png", "image/webp"]);

async function authorize(request: Request) {
  const session = await getAdminSession(request);
  return Boolean(session && validateCsrf(request, session));
}

export async function POST(request: Request) {
  if (!(await authorize(request))) return Response.json({ error: "无权访问" }, { status: 403 });
  try {
    const body = await request.json() as Record<string, any>;
    if (body.action === "init") {
      const fileName = String(body.fileName ?? "");
      const mimeType = String(body.mimeType ?? "");
      const size = Number(body.size);
      if (!fileName || !allowedMime.has(mimeType)) throw new Error("仅支持 JPEG、PNG 或 WebP 图片");
      if (!Number.isFinite(size) || size <= 0 || size > 25 * 1024 * 1024) throw new Error("原图不能超过 25MB");
      return Response.json(await beginMultipart(fileName, mimeType));
    }
    if (body.action === "complete") {
      return Response.json(await finishMultipart({
        ...body,
        access: "private",
        assignment: String(body.assignment ?? "unassigned"),
      } as Parameters<typeof finishMultipart>[0]));
    }
    throw new Error("操作无效");
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "上传失败" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  if (!(await authorize(request))) return Response.json({ error: "无权访问" }, { status: 403 });
  try {
    const query = new URL(request.url).searchParams;
    const key = query.get("key") ?? "";
    const uploadId = query.get("uploadId") ?? "";
    const partNumber = Number(query.get("partNumber"));
    if (!key || !uploadId || !Number.isInteger(partNumber) || partNumber < 1 || !request.body) throw new Error("分片参数无效");
    return Response.json(await uploadMultipartPart(key, uploadId, partNumber, request.body));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "分片上传失败" }, { status: 400 });
  }
}
