import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getSiteContent } from "@/lib/content-store";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const item=(await getSiteContent()).essays.find(e=>e.slug===slug);return item?{title:item.title,description:item.excerpt}:{title:"未找到随笔"};}
export default async function EssayDetail({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const item=(await getSiteContent()).essays.find(e=>e.slug===slug);if(!item)notFound();return <main><SiteHeader/><article className="essay-article"><header><p className="eyebrow">{item.publishedAt} / NOTE</p><h1>{item.title}</h1><p>{item.excerpt}</p></header><div>{item.body.split(/\n\n+/).map((paragraph,index)=><p key={index}>{paragraph}</p>)}</div></article></main>}
