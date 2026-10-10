import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/frontend/components/login-form";
import { getAdminSession, safeReturnTo } from "@/backend/auth/admin-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "管理员登录", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const query = await searchParams;
  const returnTo = safeReturnTo(query.returnTo);
  if (await getAdminSession()) redirect(returnTo);
  return <main className="login-page">
    <a href="/" className="login-wordmark">SONFORU</a>
    <section className="login-panel">
      <p className="eyebrow">OWNER / SONFORU</p>
      <p>登录查看私藏与草稿，并管理摄影、随笔和收藏</p>
      <LoginForm returnTo={returnTo}/>
    </section>
  </main>;
}
