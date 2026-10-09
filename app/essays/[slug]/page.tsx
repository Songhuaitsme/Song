import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccessBadge } from "@/components/access-badge";
import { SiteHeader } from "@/components/site-header";
import { getViewerContext } from "@/lib/admin-auth";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params;
  const viewer=await getViewerContext();
  const item=(await getSiteContent(viewer.ownerMode)).essays.find((essay)=>essay.slug===slug);
  if(!item)return {title:"未找到随笔",robots:{index:false,follow:false}};
  return {title:item.title,description:item.excerpt,robots:item.access === "public" ? undefined : {index:false,follow:false}};
}

export default async function EssayDetail({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  const viewer=await getViewerContext();
  const item=(await getSiteContent(viewer.ownerMode)).essays.find((essay)=>essay.slug===slug);
  if(!item)notFound();
  const returnTo=`/essays/${slug}`;
  return <main><SiteHeader viewer={viewer} returnTo={returnTo}/><article className="essay-article"><header><p className="eyebrow">{item.publishedAt} / NOTE</p>{viewer.ownerMode&&<AccessBadge access={item.access}/>}<h1>{item.title}</h1><p>{item.excerpt}</p>{viewer.ownerMode&&<a className="owner-edit-link" href={`/studio?tab=essays#${item.id}`}>编辑此随笔</a>}</header><div>{item.body.split(/\n\n+/).map((paragraph,index)=><p key={index}>{paragraph}</p>)}</div></article></main>;
}
