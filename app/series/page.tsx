import { contentPath } from "@/lib/content-path";
import type { Metadata } from "next";
import { AccessBadge } from "@/components/access-badge";
import { SiteHeader } from "@/components/site-header";
import { getViewerContext } from "@/lib/admin-auth";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "摄影" };

export default async function SeriesPage() {
  const viewer = await getViewerContext();
  const { series } = await getSiteContent(viewer.ownerMode);
  return <main><SiteHeader viewer={viewer} returnTo="/series"/><div className="page-heading"><p className="eyebrow">PHOTOGRAPHY / 摄影</p><h1>系列</h1><p>一些依照时间、地点与感受编排的影像。</p></div>
    {series.length ? <section className="series-grid">{series.map((item,index)=><article className="series-card" key={item.id}><a href={contentPath("series", item.slug)}><img src={item.coverUrl} alt=""/></a><div>{viewer.ownerMode && <AccessBadge access={item.access}/>}<span>{String(index+1).padStart(2,"0")}</span><h2><a href={contentPath("series", item.slug)}>{item.title}</a></h2><p>{item.description}</p><small>{item.photos.length} 张照片</small>{viewer.ownerMode && <a className="owner-edit-link" href={`/studio?tab=series#${item.id}`}>编辑此系列</a>}</div></article>)}</section> : <div className="list-empty">暂时没有公开的摄影系列。</div>}
  </main>;
}
