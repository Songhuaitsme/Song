import { listMessages, submitMessage } from "@/backend/content/guestbook-store";
import { messageErrorResponse, messageRequestBody } from "@/backend/content/guestbook-http";

export async function GET(request: Request) {
  try { return Response.json(await listMessages({ page: Number(new URL(request.url).searchParams.get("page") ?? 1) }), { headers: { "cache-control": "no-store" } }); }
  catch (error) { return messageErrorResponse(error); }
}
export async function POST(request: Request) {
  try { return Response.json(await submitMessage(request, await messageRequestBody(request)), { headers: { "cache-control": "no-store" } }); }
  catch (error) { return messageErrorResponse(error); }
}
