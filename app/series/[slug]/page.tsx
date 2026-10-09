import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccessBadge } from "@/components/access-badge";
import { SiteHeader } from "@/components/site-header";
import { PhotoStory } from "@/components/photo-story";
import { getViewerContext } from "@/lib/admin-auth";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params;
  const viewer=await getViewerContext();
  const item=(await getSiteContent(viewer.ownerMode)).series.find((series)=>series.slug===slug);
  if(!item)return {title:"未找到系列",robots:{index:false,follow:false}};
  return {title:item.title,description:item.description,robots:item.access === "public" ? undefined : {index:false,follow:false}};
}

export default async function SeriesDetail({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const viewer=await getViewerContext();
  const item=(await getSiteContent(viewer.ownerMode)).series.find((series)=>series.slug===slug);
  if(!item)notFound();
  const returnTo=`/series/${slug}`;
  return <main><SiteHeader viewer={viewer} returnTo={returnTo}/><header className="story-header"><p className="eyebrow">PHOTOGRAPHIC SERIES</p>{viewer.ownerMode&&<AccessBadge access={item.access}/>}<h1>{item.title}</h1><p>{item.description}</p><span>{item.photos.length} PHOTOGRAPHS</span>{viewer.ownerMode&&<a className="owner-edit-link" href={`/studio?tab=series#${item.id}`}>编辑此系列</a>}</header><PhotoStory photos={item.photos}/><div className="story-end"><span>END / {item.title}</span><a href="/series">返回系列目录</a></div></main>;
}
