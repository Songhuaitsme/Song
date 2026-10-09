import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { PhotoStory } from "@/components/photo-story";
import { getSiteContent } from "@/lib/content-store";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const item=(await getSiteContent()).series.find(s=>s.slug===slug);return item?{title:item.title,description:item.description}:{title:"未找到系列"};}
export default async function SeriesDetail({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const item=(await getSiteContent()).series.find(s=>s.slug===slug);if(!item)notFound();return <main><SiteHeader/><header className="story-header"><p className="eyebrow">PHOTOGRAPHIC SERIES</p><h1>{item.title}</h1><p>{item.description}</p><span>{item.photos.length} PHOTOGRAPHS</span></header><PhotoStory photos={item.photos}/><div className="story-end"><span>END / {item.title}</span><Link href="/series">返回系列目录</Link></div></main>}
