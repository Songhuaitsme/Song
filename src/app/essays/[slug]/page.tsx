import { EditableText } from "@/frontend/components/editable-text";
import { getSiteCopy } from "@/backend/content/content-store";
import { ExtraPageCopy } from "@/frontend/components/extra-page-copy";
import { contentPath, decodeContentSlug } from "@/shared/content-path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccessBadge } from "@/frontend/components/access-badge";
import { SiteHeader } from "@/frontend/components/site-header";
import { SiteFooter } from "@/frontend/components/site-footer";
import { getViewerContext } from "@/backend/auth/admin-auth";
import { getSiteContent } from "@/backend/content/content-store";

import { PrivateContentNotice } from "@/frontend/components/private-content-notice";

import { EssayBody } from "@/frontend/components/essay-body";
import { scopedFormatKey } from "@/shared/text-standards";

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
  return <main data-copy-page="essay"><SiteHeader viewer={viewer} returnTo={returnTo}/><article className="essay-article"><header><p data-text-page="essay" data-text-role="label" className="eyebrow">{item.publishedAt}{c.essayDetailLabel && <> / <EditableText textPage="essay" textRole="label" value={c.essayDetailLabel} field="essayDetailLabel" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></>}</p>{(viewer.ownerMode || item.access === "private")&&<AccessBadge access={item.access}/>}<h1 data-text-page="essay" data-text-role="pageTitle"><EditableText textPage="essay" textRole="pageTitle" value={item.title} field="title" entity="essay" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></h1><p data-text-page="essay" data-text-role="summary"><EditableText textPage="essay" textRole="summary" value={item.excerpt} field="excerpt" entity="essay" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>{viewer.ownerMode&&<a className="owner-edit-link" href={`/studio?tab=essays#${item.id}`}>编辑此随笔</a>}</header>{item.access === "private" && !viewer.ownerMode ? <PrivateContentNotice/> : <><EditableText textPage="essay" textRole="body" value="" editValue={item.body} field="body" entity="essay" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/><div data-text-page="essay" data-text-role="body" data-scoped-format={encodeURIComponent(scopedFormatKey("essay","body",`essay:${item.id}:body`))} data-text-format={encodeURIComponent(`essay:${item.id}:body`)}><EssayBody body={item.body}/></div></>}</article><ExtraPageCopy copy={copy} page="essay"/><SiteFooter viewer={viewer}/></main>;
}
