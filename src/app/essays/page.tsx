import { EditableText } from "@/frontend/components/editable-text";
import { getSiteCopy } from "@/backend/content/content-store";
import { ExtraPageCopy } from "@/frontend/components/extra-page-copy";
import { contentPath } from "@/shared/content-path";
import type { Metadata } from "next";
import { AccessBadge } from "@/frontend/components/access-badge";
import { SiteHeader } from "@/frontend/components/site-header";
import { SiteFooter } from "@/frontend/components/site-footer";
import { getViewerContext } from "@/backend/auth/admin-auth";
import { getSiteContent } from "@/backend/content/content-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "随笔" };

export default async function EssaysPage(){
  const copy=await getSiteCopy();
  const c=copy.values;
  const viewer = await getViewerContext();
  const { essays } = await getSiteContent(viewer.ownerMode);
  return <main data-copy-page="essays" className="notes-page"><SiteHeader viewer={viewer} returnTo="/essays"/><div className="notes-heading">{c.essayLabel && <p data-text-page="essays" data-text-role="label" className="eyebrow"><EditableText textPage="essays" textRole="label" value={c.essayLabel} field="essayLabel" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}{c.essayTitle && <h1 data-text-page="essays" data-text-role="pageTitle"><EditableText textPage="essays" textRole="pageTitle" value={c.essayTitle} field="essayTitle" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></h1>}{c.essayIntro && <p data-text-page="essays" data-text-role="summary" className="notes-intro"><EditableText textPage="essays" textRole="summary" value={c.essayIntro} field="essayIntro" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}</div>
    {essays.length ? <section className="essay-list">{essays.map((item,index)=><article key={item.id}><span data-text-page="essays" data-text-role="label">{String(index+1).padStart(2,"0")}</span><div><small data-text-page="essays" data-text-role="label">{item.publishedAt}</small>{(viewer.ownerMode || item.access === "private") && <AccessBadge access={item.access}/>}<h2 data-text-page="essays" data-text-role="itemTitle"><a data-text-page="essays" data-text-role="itemTitle" href={contentPath("essays", item.slug)}><EditableText textPage="essays" textRole="itemTitle" value={item.title} field="title" entity="essay" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></a></h2><p data-text-page="essays" data-text-role="caption"><EditableText textPage="essays" textRole="caption" value={item.excerpt} field="excerpt" entity="essay" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>{viewer.ownerMode && <a className="owner-edit-link" href={`/studio?tab=essays#${item.id}`}>编辑此随笔</a>}</div></article>)}</section> : <div className="list-empty"><EditableText textPage="essays" textRole="summary" value={c.essayEmpty} field="essayEmpty" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></div>}
  <ExtraPageCopy copy={copy} page="essays"/><SiteFooter viewer={viewer}/></main>;
}
