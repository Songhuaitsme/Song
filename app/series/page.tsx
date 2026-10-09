import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { getSiteContent } from "@/lib/content-store";
export const metadata: Metadata = { title: "摄影" };
export default async function SeriesPage() { const content = await getSiteContent(); return <main><SiteHeader/><div className="page-heading"><p className="eyebrow">PHOTOGRAPHY / 摄影</p><h1>系列</h1><p>一些依照时间、地点与感受编排的影像。</p></div><section className="series-grid">{content.series.map((item,index)=><a href={`/series/${item.slug}`} className="series-card" key={item.id}><img src={item.coverUrl} alt=""/><div><span>{String(index+1).padStart(2,"0")}</span><h2>{item.title}</h2><p>{item.description}</p><small>{item.photos.length} 张照片</small></div></a>)}</section></main>; }
