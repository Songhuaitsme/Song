import { validateSiteCopy, type TextFormat } from "@/shared/site-copy";
import { deleteEntity, getSiteContent, upsertEntity, saveAboutContent, saveSiteCopy, getSiteCopy } from "@/backend/content/content-store";
import { getAdminSession, validateCsrf } from "@/backend/auth/admin-auth";

export async function GET(request: Request) { if (!(await getAdminSession(request))) return Response.json({ error: "无权访问" }, { status: 403 }); return Response.json(await getSiteContent(true), { headers: { "cache-control": "no-store" } }); }
export async function POST(request: Request) {
  const session = await getAdminSession(request);
  if (!session || !validateCsrf(request, session)) return Response.json({ error: "无权访问" }, { status: 403 });
  try {
    const body = await request.json() as { action?: string; entity?: "series"|"photo"|"essay"|"favorite"|"about"|"copy"; record?: Record<string,unknown>; id?: string; textFormat?:{key:string;style:TextFormat} };
    let formattedCopy;
    if(body.textFormat){const expected=`${body.entity}:${body.entity==="about"?"":body.record?.id??""}:`;if(typeof body.textFormat.key!=="string"||!body.textFormat.key.startsWith(expected))throw new Error("文字格式目标无效");const copy=await getSiteCopy();formattedCopy=validateSiteCopy({...copy,textFormats:{...copy.textFormats,[body.textFormat.key]:body.textFormat.style}})}
    if (body.entity === "copy" && body.action === "upsert" && body.record) { const copy=await saveSiteCopy(body.record); return Response.json({ok:true,copy}); }
    if (body.entity === "copy") return Response.json({error:"操作无效"},{status:400});
    if (body.entity === "about" && body.action === "upsert" && body.record) { const about = await saveAboutContent(body.record); if(formattedCopy)await saveSiteCopy(formattedCopy as unknown as Record<string,unknown>); return Response.json({ ok: true, about }); }
    if (body.entity === "about") return Response.json({ error: "操作无效" }, { status: 400 });
    if (!body.entity || !["series","photo","essay","favorite"].includes(body.entity)) return Response.json({ error: "内容类型无效" }, { status: 400 });
    if (body.action === "delete" && body.id) { await deleteEntity(body.entity, body.id); return Response.json({ ok: true }); }
    if (body.action === "upsert" && body.record) { const result = await upsertEntity(body.entity, body.record); if(formattedCopy)await saveSiteCopy(formattedCopy as unknown as Record<string,unknown>); return Response.json({ ok: true, ...result }); }
    return Response.json({ error: "操作无效" }, { status: 400 });
  } catch (error) { console.error(error); return Response.json({ error: error instanceof Error ? error.message : "保存失败" }, { status: 500 }); }
}
