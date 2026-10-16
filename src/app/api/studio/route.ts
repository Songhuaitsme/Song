import { validateSiteCopy, type TextFormat } from "@/shared/site-copy";
import { deleteEntity, getSiteContent, upsertEntity, saveAboutContent, saveSiteCopy, saveTextStandards, getSiteCopy } from "@/backend/content/content-store";
import { getAdminSession, validateCsrf } from "@/backend/auth/admin-auth";
import { applyTextFormat, type TextRole } from "@/shared/text-standards";
import type { CopyPage } from "@/shared/site-copy";
import { setStudioAccess, validateBulkAccess } from "@/backend/content/studio-access";

export async function GET(request: Request) { if (!(await getAdminSession(request))) return Response.json({ error: "无权访问" }, { status: 403 }); return Response.json(await getSiteContent(true), { headers: { "cache-control": "no-store" } }); }
export async function POST(request: Request) {
  const session = await getAdminSession(request);
  if (!session || !validateCsrf(request, session)) return Response.json({ error: "无权访问" }, { status: 403 });
  try {
    const body = await request.json() as { action?: string; entity?: "series"|"photo"|"essay"|"favorite"|"about"|"copy"; record?: Record<string,unknown>; id?: string; chapterResolution?: { beforePhotoId: string | null; version?: number }; ids?: unknown; access?: unknown; textFormat?:{key:string;style:TextFormat;page?:CopyPage;role?:TextRole} };
    if (body.action === "set-access") {
      let input;
      try { input = validateBulkAccess(body); }
      catch (error) { return Response.json({ error: error instanceof Error ? error.message : "批量操作参数无效" }, { status: 400 }); }
      return Response.json(await setStudioAccess(input), { headers: { "cache-control": "no-store" } });
    }
    let formattedCopy;
    if (body.entity === "copy" && body.action === "typography" && body.record) { const copy=await saveTextStandards(body.record.textStandards); return Response.json({ok:true,copy}); }
    if(body.textFormat){const expected=`${body.entity}:${body.entity==="about"?"":body.record?.id??""}:`;if(typeof body.textFormat.key!=="string"||!body.textFormat.key.startsWith(expected))throw new Error("文字格式目标无效");const copy=await getSiteCopy();formattedCopy=validateSiteCopy(applyTextFormat(copy,body.textFormat.key,body.textFormat.style,body.textFormat.page,body.textFormat.role) as unknown as Record<string,unknown>)}
    if (body.entity === "copy" && body.action === "upsert" && body.record) { const copy=await saveSiteCopy(body.record); return Response.json({ok:true,copy}); }
    if (body.entity === "copy") return Response.json({error:"操作无效"},{status:400});
    if (body.entity === "about" && body.action === "upsert" && body.record) { const about = await saveAboutContent(body.record); if(formattedCopy)await saveSiteCopy(formattedCopy as unknown as Record<string,unknown>); return Response.json({ ok: true, about }); }
    if (body.entity === "about") return Response.json({ error: "操作无效" }, { status: 400 });
    if (!body.entity || !["series","photo","essay","favorite"].includes(body.entity)) return Response.json({ error: "内容类型无效" }, { status: 400 });
    if (body.action === "delete" && body.id) { const result = await deleteEntity(body.entity, body.id, body.chapterResolution); return Response.json({ ok: true, ...result }); }
    if (body.action === "upsert" && body.record) { const result = await upsertEntity(body.entity, body.record); if(formattedCopy)await saveSiteCopy(formattedCopy as unknown as Record<string,unknown>); return Response.json({ ok: true, ...result }); }
    return Response.json({ error: "操作无效" }, { status: 400 });
  } catch (error) { console.error(error); return Response.json({ error: error instanceof Error ? error.message : "保存失败" }, { status: error instanceof Error && "status" in error && error.status === 409 ? 409 : 500 }); }
}
