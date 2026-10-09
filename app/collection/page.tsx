import type { Metadata } from "next";
import { AccessBadge } from "@/components/access-badge";
import { SiteHeader } from "@/components/site-header";
import { getViewerContext } from "@/lib/admin-auth";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "收藏" };

export default async function CollectionPage(){
  const viewer = await getViewerContext();
  const { favorites } = await getSiteContent(viewer.ownerMode);
  return <main><SiteHeader viewer={viewer} returnTo="/collection"/><div className="page-heading"><p className="eyebrow">CABINET / 收藏</p><h1>喜欢的东西</h1><p>书、影像、习惯，以及值得反复回看的细节。</p></div>
    {favorites.length ? <section className="favorites-grid">{favorites.map((item,index)=><article key={item.id}>{item.imageUrl&&<img src={item.imageUrl} alt=""/>}<div>{viewer.ownerMode && <AccessBadge access={item.access}/>}<span>{item.category} · {String(index+1).padStart(2,"0")}</span><h2>{item.title}</h2><p>{item.note}</p>{item.url&&<a href={item.url} target="_blank" rel="noreferrer">查看来源</a>}{viewer.ownerMode && <a className="owner-edit-link" href={`/studio?tab=favorites#${item.id}`}>编辑此收藏</a>}</div></article>)}</section> : <div className="list-empty">暂时没有公开的收藏。</div>}
  </main>;
}
