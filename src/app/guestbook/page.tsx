import type { Metadata } from "next";
import { getSiteCopy } from "@/backend/content/content-store";
import { getViewerContext } from "@/backend/auth/admin-auth";
import { listMessages } from "@/backend/content/guestbook-store";
import { SiteHeader } from "@/frontend/components/site-header";
import { SiteFooter } from "@/frontend/components/site-footer";
import { EditableText } from "@/frontend/components/editable-text";
import { ExtraPageCopy } from "@/frontend/components/extra-page-copy";
import { Guestbook } from "@/frontend/components/guestbook";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "留言" };
export default async function GuestbookPage() {
  const copy = await getSiteCopy(), viewer = await getViewerContext(), c = copy.values;
  const initial = await listMessages().catch(() => null);
  return <main className="guestbook-page" data-copy-page="guestbook"><SiteHeader viewer={viewer} returnTo="/guestbook"/>
    <header className="guestbook-heading">{c.guestbookTitle && <h1 data-text-page="guestbook" data-text-role="pageTitle"><EditableText textPage="guestbook" textRole="pageTitle" value={c.guestbookTitle} field="guestbookTitle" enabled={viewer.ownerMode} csrf={viewer.csrfToken ?? ""}/></h1>}{c.guestbookIntro && <p data-text-page="guestbook" data-text-role="summary"><EditableText textPage="guestbook" textRole="summary" value={c.guestbookIntro} field="guestbookIntro" enabled={viewer.ownerMode} csrf={viewer.csrfToken ?? ""}/></p>}</header>
    <Guestbook initial={initial}/><ExtraPageCopy copy={copy} page="guestbook"/><SiteFooter viewer={viewer}/>
  </main>;
}
