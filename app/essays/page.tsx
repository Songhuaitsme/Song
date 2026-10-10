import { EditableText } from "@/components/editable-text";
import { getSiteCopy } from "@/lib/content-store";
import { ExtraPageCopy } from "@/components/extra-page-copy";
import { contentPath } from "@/lib/content-path";
import type { Metadata } from "next";
import { AccessBadge } from "@/components/access-badge";
import { SiteHeader } from "@/components/site-header";
import { getViewerContext } from "@/lib/admin-auth";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "随笔" };

export default async function EssaysPage(){
  const copy=await getSiteCopy();
  const c=copy.values;
  const viewer = await getViewerContext();
  const { essays } = await getSiteContent(viewer.ownerMode);
  return <main data-copy-page="essays" className="notes-page"><SiteHeader viewer={viewer} returnTo="/essays"/><div className="notes-heading">{c.essayLabel && <p className="eyebrow"><EditableText value={c.essayLabel} field="essayLabel" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}{c.essayTitle && <h1><EditableText value={c.essayTitle} field="essayTitle" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></h1>}{c.essayIntro && <p className="notes-intro"><EditableText value={c.essayIntro} field="essayIntro" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}</div>
    {essays.length ? <section className="essay-list">{essays.map((item,index)=><article key={item.id}><span>{String(index+1).padStart(2,"0")}</span><div><small>{item.publishedAt}</small>{viewer.ownerMode && <AccessBadge access={item.access}/>}<h2><a href={contentPath("essays", item.slug)}><EditableText value={item.title} field="title" entity="essay" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></a></h2><p><EditableText value={item.excerpt} field="excerpt" entity="essay" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>{viewer.ownerMode && <a className="owner-edit-link" href={`/studio?tab=essays#${item.id}`}>编辑此随笔</a>}</div></article>)}</section> : <div className="list-empty"><EditableText value={c.essayEmpty} field="essayEmpty" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></div>}
  <ExtraPageCopy copy={copy} page="essays"/></main>;
}
