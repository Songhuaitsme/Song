import { getChatGPTUser } from "@/app/chatgpt-auth";
import { deleteEntity, getSiteContent, upsertEntity } from "@/lib/content-store";
import { isSiteOwner } from "@/lib/owner-auth";

async function authorize() { const user = await getChatGPTUser(); return isSiteOwner(user); }
export async function GET() { if (!(await authorize())) return Response.json({ error: "无权访问" }, { status: 403 }); return Response.json(await getSiteContent(true)); }
export async function POST(request: Request) {
  if (!(await authorize())) return Response.json({ error: "无权访问" }, { status: 403 });
  try {
    const body = await request.json() as { action?: string; entity?: "series"|"photo"|"essay"|"favorite"; record?: Record<string,unknown>; id?: string };
    if (!body.entity || !["series","photo","essay","favorite"].includes(body.entity)) return Response.json({ error: "内容类型无效" }, { status: 400 });
    if (body.action === "delete" && body.id) { await deleteEntity(body.entity, body.id); return Response.json({ ok: true }); }
    if (body.action === "upsert" && body.record) { const result = await upsertEntity(body.entity, body.record); return Response.json({ ok: true, ...result }); }
    return Response.json({ error: "操作无效" }, { status: 400 });
  } catch (error) { console.error(error); return Response.json({ error: error instanceof Error ? error.message : "保存失败" }, { status: 500 }); }
}
