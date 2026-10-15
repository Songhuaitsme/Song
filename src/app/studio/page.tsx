import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StudioDashboard } from "@/frontend/components/studio-dashboard";
import { getAdminSession, safeReturnTo } from "@/backend/auth/admin-auth";
import { getSiteContent } from "@/backend/content/content-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "工作室", robots: { index: false, follow: false } };

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await getAdminSession();
  if (!session) redirect(`/login?returnTo=${encodeURIComponent(safeReturnTo("/studio"))}`);
  const query = await searchParams;
  const initialTab = query.tab === "essays" || query.tab === "favorites" || query.tab === "about" || query.tab === "copy" || query.tab === "media" || query.tab === "sync" || query.tab === "typography" ? query.tab : "series";
  const content = await getSiteContent(true);
  return <StudioDashboard initialContent={content} userName={session.username} csrfToken={session.csrfToken} initialTab={initialTab}/>;
}
