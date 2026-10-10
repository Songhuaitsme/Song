import { contentPath, decodeContentSlug } from "@/lib/content-path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccessBadge } from "@/components/access-badge";
import { SiteHeader } from "@/components/site-header";
import { PhotoStory } from "@/components/photo-story";
import { getViewerContext } from "@/lib/admin-auth";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug:routeSlug}=await params;
  const slug=decodeContentSlug(routeSlug);
  const viewer=await getViewerContext();
  const item=(await getSiteContent(viewer.ownerMode)).series.find((series)=>series.slug===slug);
  if(!item)return {title:"未找到系列",robots:{index:false,follow:false}};
  return {title:item.title,description:item.description,robots:item.access === "public" ? undefined : {index:false,follow:false}};
}

export default async function SeriesDetail({params}:{params:Promise<{slug:string}>}){
  const {slug:routeSlug}=await params;
  const slug=decodeContentSlug(routeSlug);
  const viewer=await getViewerContext();
  const item=(await getSiteContent(viewer.ownerMode)).series.find((series)=>series.slug===slug);
  if(!item)notFound();
  const returnTo=contentPath("series", slug);
  const coverAlt=item.photos.find((photo)=>photo.imageUrl===item.coverUrl)?.alt||item.title;
  return <main><SiteHeader viewer={viewer} returnTo={returnTo}/><header className="story-hero">
    <img className="story-hero-image" src={item.coverUrl} alt={coverAlt} fetchPriority="high"/>
    <div className="story-hero-shade"/>
    <div className="story-hero-copy"><p className="eyebrow">SONFORU / PHOTOGRAPHIC SERIES</p>{viewer.ownerMode&&<AccessBadge access={item.access}/>}<h1>{item.title}</h1><p>{item.description}</p><div className="story-hero-meta"><span>{String(item.photos.length).padStart(2,"0")} PHOTOGRAPHS</span><span>SONG</span></div>{viewer.ownerMode&&<a className="story-hero-edit" href={`/studio?tab=series#${item.id}`}>编辑此系列</a>}</div>
  </header><div className="story-lede"><p>摄影系列</p><p>{item.description}</p></div><PhotoStory photos={item.photos}/><div className="story-end"><span>END / {item.title}</span><a href="/series">返回系列目录</a></div></main>;
}
