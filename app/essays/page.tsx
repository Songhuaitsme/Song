import { contentPath } from "@/lib/content-path";
import type { Metadata } from "next";
import { AccessBadge } from "@/components/access-badge";
import { SiteHeader } from "@/components/site-header";
import { getViewerContext } from "@/lib/admin-auth";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "随笔" };

export default async function EssaysPage(){
  const viewer = await getViewerContext();
  const { essays } = await getSiteContent(viewer.ownerMode);
  return <main className="notes-page"><SiteHeader viewer={viewer} returnTo="/essays"/><div className="notes-heading"><p className="eyebrow">NOTES / 随笔</p><h1>写下来的事</h1><p className="notes-intro">关于观看、行走与偶然留下的片段。</p></div>
    {essays.length ? <section className="essay-list">{essays.map((item,index)=><article key={item.id}><span>{String(index+1).padStart(2,"0")}</span><div><small>{item.publishedAt}</small>{viewer.ownerMode && <AccessBadge access={item.access}/>}<h2><a href={contentPath("essays", item.slug)}>{item.title}</a></h2><p>{item.excerpt}</p>{viewer.ownerMode && <a className="owner-edit-link" href={`/studio?tab=essays#${item.id}`}>编辑此随笔</a>}</div></article>)}</section> : <div className="list-empty">暂时没有公开的随笔。</div>}
  </main>;
}
