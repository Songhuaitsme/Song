import { clearSessionCookie, destroyAdminSession, getAdminSession, safeReturnTo, validateCsrf, viewModeCookie } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const form = await request.formData();
  const session = await getAdminSession(request);
  if (!session || !validateCsrf(request, session, String(form.get("csrf") ?? ""))) return new Response("Forbidden", { status: 403 });
  await destroyAdminSession(request);
  const headers = new Headers({ location: safeReturnTo(form.get("returnTo"), "/") });
  headers.append("set-cookie", clearSessionCookie());
  headers.append("set-cookie", viewModeCookie("visitor"));
  return new Response(null, { status: 303, headers });
}
