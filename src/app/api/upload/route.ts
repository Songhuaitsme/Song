import { getAdminSession, validateCsrf } from "@/backend/auth/admin-auth";
import { storeMedia } from "@/storage/media-store";

export async function POST(request: Request) {
  const session = await getAdminSession(request);
  if (!session || !validateCsrf(request, session)) return Response.json({ error: "无权访问" }, { status: 403 });
  try {
  const form = await request.formData(); const original = form.get("original"); const display = form.get("display");
  if (!(original instanceof File) || !(display instanceof File)) return Response.json({ error: "请选择有效图片" }, { status: 400 });
  return Response.json(await storeMedia({original,display,width:Number(form.get("width")||0),height:Number(form.get("height")||0),assignment:String(form.get("assignment")||"unassigned")}));
  } catch(error) { return Response.json({error:error instanceof Error?error.message:"上传失败"},{status:500}); }
}
