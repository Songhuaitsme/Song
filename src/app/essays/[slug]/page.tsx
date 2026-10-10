import { EditableText } from "@/frontend/components/editable-text";
import { getSiteCopy } from "@/backend/content/content-store";
import { ExtraPageCopy } from "@/frontend/components/extra-page-copy";
import { contentPath, decodeContentSlug } from "@/shared/content-path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccessBadge } from "@/frontend/components/access-badge";
import { SiteHeader } from "@/frontend/components/site-header";
import { getViewerContext } from "@/backend/auth/admin-auth";
import { getSiteContent } from "@/backend/content/content-store";

import { EssayBody } from "@/frontend/components/essay-body";

export const dynamic = "force-dynamic";

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug:routeSlug}=await params;
  const slug=decodeContentSlug(routeSlug);
  const viewer=await getViewerContext();
  const item=(await getSiteContent(viewer.ownerMode)).essays.find((essay)=>essay.slug===slug);
  if(!item)return {title:"未找到随笔",robots:{index:false,follow:false}};
  return {title:item.title,description:item.excerpt,robots:item.access === "public" ? undefined : {index:false,follow:false}};
}

export default async function EssayDetail({params}:{params:Promise<{slug:string}>}){
  const {slug:routeSlug}=await params;
  const slug=decodeContentSlug(routeSlug);
  const copy=await getSiteCopy();
  const c=copy.values;
  const viewer=await getViewerContext();
  const item=(await getSiteContent(viewer.ownerMode)).essays.find((essay)=>essay.slug===slug);
  if(!item)notFound();
  const returnTo=contentPath("essays", slug);
  return <main data-copy-page="essay"><SiteHeader viewer={viewer} returnTo={returnTo}/><article className="essay-article"><header><p className="eyebrow">{item.publishedAt}{c.essayDetailLabel && <> / <EditableText value={c.essayDetailLabel} field="essayDetailLabel" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></>}</p>{viewer.ownerMode&&<AccessBadge access={item.access}/>}<h1><EditableText value={item.title} field="title" entity="essay" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></h1><p><EditableText value={item.excerpt} field="excerpt" entity="essay" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>{viewer.ownerMode&&<a className="owner-edit-link" href={`/studio?tab=essays#${item.id}`}>编辑此随笔</a>}</header><EditableText value="" editValue={item.body} field="body" entity="essay" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/><div data-text-format={encodeURIComponent(`essay:${item.id}:body`)}><EssayBody body={item.body}/></div></article><ExtraPageCopy copy={copy} page="essay"/></main>;
}
