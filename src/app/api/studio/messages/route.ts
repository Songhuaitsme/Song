import { getAdminSession, validateCsrf } from "@/backend/auth/admin-auth";
import { listMessages, manageMessage } from "@/backend/content/guestbook-store";
import { messageErrorResponse, messageRequestBody } from "@/backend/content/guestbook-http";

export async function GET(request: Request) {
  if (!(await getAdminSession(request))) return Response.json({ error: "无权访问" }, { status: 403, headers: { "cache-control": "no-store" } });
  try { const query = new URL(request.url).searchParams; return Response.json(await listMessages({ admin: true, page: Number(query.get("page") ?? 1), visibility: query.get("visibility") ?? "all", query: query.get("q") ?? "" }), { headers: { "cache-control": "no-store" } }); }
  catch (error) { return messageErrorResponse(error); }
}
export async function POST(request: Request) {
  const session = await getAdminSession(request);
  if (!session || !validateCsrf(request, session)) return Response.json({ error: "无权访问" }, { status: 403 });
  try { return Response.json(await manageMessage(await messageRequestBody(request)), { headers: { "cache-control": "no-store" } }); }
  catch (error) { return messageErrorResponse(error); }
}
