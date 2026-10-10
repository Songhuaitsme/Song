import { clearSessionCookie, destroyAdminSession, getAdminSession, safeReturnTo, validateCsrf, viewModeCookie } from "@/backend/auth/admin-auth";

export async function POST(request: Request) {
  const form = await request.formData();
  const session = await getAdminSession(request);
  if (!session || !validateCsrf(request, session, String(form.get("csrf") ?? ""))) return new Response("Forbidden", { status: 403 });
  await destroyAdminSession(request);
  const headers = new Headers({ location: safeReturnTo(form.get("returnTo"), "/") });
  headers.append("set-cookie", clearSessionCookie(request));
  headers.append("set-cookie", viewModeCookie("visitor", request));
  return new Response(null, { status: 303, headers });
}
