import { EditableText } from "@/frontend/components/editable-text";
import { getSiteCopy } from "@/backend/content/content-store";
import { ExtraPageCopy } from "@/frontend/components/extra-page-copy";
import { contentPath, decodeContentSlug } from "@/shared/content-path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccessBadge } from "@/frontend/components/access-badge";
import { SiteHeader } from "@/frontend/components/site-header";
import { SiteFooter } from "@/frontend/components/site-footer";
import { PrivateContentNotice } from "@/frontend/components/private-content-notice";
import { SeriesStoryContent } from "@/frontend/components/series-story-content";
import { getViewerContext } from "@/backend/auth/admin-auth";
import { getSiteContent } from "@/backend/content/content-store";

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
  if (item.access === "private" && !viewer.ownerMode) {
    return <main data-copy-page="story"><SiteHeader viewer={viewer} returnTo={returnTo}/><article className="private-content-page"><header><AccessBadge access={item.access}/><h1 data-text-page="story" data-text-role="pageTitle">{item.title}</h1><p data-text-page="story" data-text-role="summary">{item.description}</p></header><PrivateContentNotice/><a data-text-page="story" data-text-role="link" className="text-link" href="/series">{c.returnSeries || "返回摄影目录"}</a></article><SiteFooter viewer={viewer}/></main>;
  }
  const coverAlt=item.photos.find((photo)=>photo.imageUrl===item.coverUrl)?.alt||item.title;
  return <main data-copy-page="story" className="story-editorial"><SiteHeader viewer={viewer} returnTo={returnTo}/><header className="story-hero">
    <img className="story-hero-image" src={item.coverUrl} alt={coverAlt} fetchPriority="high"/>
    <div className="story-hero-shade"/>
    <div className="story-hero-copy">{c.storyLabel && <p data-text-page="story" data-text-role="overlayLabel" className="eyebrow"><EditableText textPage="story" textRole="overlayLabel" value={c.storyLabel} field="storyLabel" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}{viewer.ownerMode&&<AccessBadge access={item.access}/>}<h1 data-text-page="story" data-text-role="overlayTitle"><EditableText textPage="story" textRole="overlayTitle" value={item.title} field="title" entity="series" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></h1><div className="story-hero-meta"><span data-text-page="story" data-text-role="overlayLabel">{String(item.photos.length).padStart(2,"0")} <EditableText textPage="story" textRole="overlayLabel" value={c.photographs} field="photographs" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></span>{c.seriesAuthor && <span data-text-page="story" data-text-role="overlayLabel"><EditableText textPage="story" textRole="overlayLabel" value={c.seriesAuthor} field="seriesAuthor" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></span>}</div>{viewer.ownerMode&&<a className="story-hero-edit" href={`/studio?tab=series#${item.id}`}>编辑此系列</a>}</div>
  </header><SeriesStoryContent series={item} editor={{enabled:viewer.ownerMode,csrf:viewer.csrfToken??""}} labels={{close:c.photoClose,prev:c.photoPrev,next:c.photoNext}} ledeLabel={c.storyLede}/><div className="story-end"><span data-text-page="story" data-text-role="label"><EditableText textPage="story" textRole="label" value={c.storyEnd} field="storyEnd" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/>{c.storyEnd ? " / " : ""}<EditableText textPage="story" textRole="label" value={item.title} field="title" entity="series" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></span>{c.returnSeries && <a data-text-page="story" data-text-role="link" href="/series"><EditableText textPage="story" textRole="link" value={c.returnSeries} field="returnSeries" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></a>}</div><ExtraPageCopy copy={copy} page="story"/><SiteFooter viewer={viewer}/></main>;
}
