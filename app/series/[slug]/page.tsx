import { EditableText } from "@/components/editable-text";
import { getSiteCopy } from "@/lib/content-store";
import { ExtraPageCopy } from "@/components/extra-page-copy";
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
  const copy=await getSiteCopy();
  const c=copy.values;
  const viewer=await getViewerContext();
  const item=(await getSiteContent(viewer.ownerMode)).series.find((series)=>series.slug===slug);
  if(!item)notFound();
  const returnTo=contentPath("series", slug);
  const coverAlt=item.photos.find((photo)=>photo.imageUrl===item.coverUrl)?.alt||item.title;
  return <main data-copy-page="story" className="story-editorial"><SiteHeader viewer={viewer} returnTo={returnTo}/><header className="story-hero">
    <img className="story-hero-image" src={item.coverUrl} alt={coverAlt} fetchPriority="high"/>
    <div className="story-hero-shade"/>
    <div className="story-hero-copy">{c.storyLabel && <p className="eyebrow"><EditableText value={c.storyLabel} field="storyLabel" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}{viewer.ownerMode&&<AccessBadge access={item.access}/>}<h1><EditableText value={item.title} field="title" entity="series" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></h1><div className="story-hero-meta"><span>{String(item.photos.length).padStart(2,"0")} <EditableText value={c.photographs} field="photographs" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></span>{c.seriesAuthor && <span><EditableText value={c.seriesAuthor} field="seriesAuthor" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></span>}</div>{viewer.ownerMode&&<a className="story-hero-edit" href={`/studio?tab=series#${item.id}`}>编辑此系列</a>}</div>
  </header><div className="story-lede">{c.storyLede && <p><EditableText value={c.storyLede} field="storyLede" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}<p><EditableText value={item.description} field="description" entity="series" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p></div><PhotoStory photos={item.photos} editor={{enabled:viewer.ownerMode,csrf:viewer.csrfToken??""}} labels={{close:c.photoClose,prev:c.photoPrev,next:c.photoNext}}/><div className="story-end"><span><EditableText value={c.storyEnd} field="storyEnd" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/>{c.storyEnd ? " / " : ""}<EditableText value={item.title} field="title" entity="series" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></span>{c.returnSeries && <a href="/series"><EditableText value={c.returnSeries} field="returnSeries" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></a>}</div><ExtraPageCopy copy={copy} page="story"/></main>;
}
