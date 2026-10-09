import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getAdminSession, safeReturnTo } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "管理员登录", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const query = await searchParams;
  const returnTo = safeReturnTo(query.returnTo);
  if (await getAdminSession()) redirect(returnTo);
  return <main className="login-page">
    <a href="/" className="login-wordmark">SONG</a>
    <section className="login-panel">
      <p className="eyebrow">OWNER / 管理员</p>
      <h1>回到工作室</h1>
      <p>登录后可以查看私藏与草稿，并管理摄影、随笔和收藏。</p>
      <LoginForm returnTo={returnTo}/>
    </section>
  </main>;
}
