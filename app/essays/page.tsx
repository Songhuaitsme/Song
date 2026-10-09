import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { getSiteContent } from "@/lib/content-store";
export const metadata: Metadata = { title: "随笔" };
export default async function EssaysPage(){const {essays}=await getSiteContent();return <main><SiteHeader/><div className="page-heading"><p className="eyebrow">NOTES / 随笔</p><h1>写下来的事</h1><p>关于观看、行走与偶然留下的片段。</p></div><section className="essay-list">{essays.map((item,index)=><a href={`/essays/${item.slug}`} key={item.id}><span>{String(index+1).padStart(2,"0")}</span><div><small>{item.publishedAt}</small><h2>{item.title}</h2><p>{item.excerpt}</p></div></a>)}</section></main>}
