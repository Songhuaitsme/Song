import { authenticateAdmin, hasSameOrigin, safeReturnTo, sessionCookie, viewModeCookie } from "@/lib/admin-auth";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return Response.json({ error: "请求来源无效" }, { status: 403 });
  try {
    const body = await request.json() as { username?: unknown; password?: unknown; returnTo?: unknown };
    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password || username.length > 160 || password.length > 1000) return Response.json({ error: "账号或密码不正确" }, { status: 401 });
    const result = await authenticateAdmin(request, username, password);
    if (!result.ok) {
      if ("unavailable" in result && result.unavailable) return Response.json({ error: "管理员登录尚未完成配置" }, { status: 503 });
      return Response.json({ error: "账号或密码不正确，请稍后再试" }, { status: 401 });
    }
    const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
    headers.append("set-cookie", sessionCookie(result.token));
    headers.append("set-cookie", viewModeCookie("owner"));
    return new Response(JSON.stringify({ ok: true, returnTo: safeReturnTo(body.returnTo) }), { status: 200, headers });
  } catch (error) {
    console.error("Admin login failed", error);
    return Response.json({ error: "登录暂时不可用，请稍后再试" }, { status: 503 });
  }
}
