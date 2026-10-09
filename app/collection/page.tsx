import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { getSiteContent } from "@/lib/content-store";
export const metadata: Metadata = { title: "收藏" };
export default async function CollectionPage(){const {favorites}=await getSiteContent();return <main><SiteHeader/><div className="page-heading"><p className="eyebrow">CABINET / 收藏</p><h1>喜欢的东西</h1><p>书、影像、习惯，以及值得反复回看的细节。</p></div><section className="favorites-grid">{favorites.map((item,index)=><article key={item.id}>{item.imageUrl&&<img src={item.imageUrl} alt=""/>}<div><span>{item.category} · {String(index+1).padStart(2,"0")}</span><h2>{item.title}</h2><p>{item.note}</p>{item.url&&<a href={item.url} target="_blank" rel="noreferrer">查看来源</a>}</div></article>)}</section></main>}
