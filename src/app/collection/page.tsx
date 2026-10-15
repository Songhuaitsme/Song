import { PrivateContentTrigger } from "@/frontend/components/private-content-trigger";
import { EditableText } from "@/frontend/components/editable-text";
import { getSiteCopy } from "@/backend/content/content-store";
import { ExtraPageCopy } from "@/frontend/components/extra-page-copy";
import type { Metadata } from "next";
import { AccessBadge } from "@/frontend/components/access-badge";
import { SiteHeader } from "@/frontend/components/site-header";
import { SiteFooter } from "@/frontend/components/site-footer";
import { getViewerContext } from "@/backend/auth/admin-auth";
import { getSiteContent } from "@/backend/content/content-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "收藏" };

export default async function CollectionPage(){
  const copy=await getSiteCopy();
  const c=copy.values;
  const viewer = await getViewerContext();
  const { favorites } = await getSiteContent(viewer.ownerMode);
  return <main data-copy-page="collection" className="collection-page"><SiteHeader viewer={viewer} returnTo="/collection"/><div className="notes-heading">{c.collectionLabel && <p data-text-page="collection" data-text-role="label" className="eyebrow"><EditableText textPage="collection" textRole="label" value={c.collectionLabel} field="collectionLabel" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}{c.collectionTitle && <h1 data-text-page="collection" data-text-role="pageTitle"><EditableText textPage="collection" textRole="pageTitle" value={c.collectionTitle} field="collectionTitle" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></h1>}{c.collectionIntro && <p data-text-page="collection" data-text-role="summary" className="notes-intro"><EditableText textPage="collection" textRole="summary" value={c.collectionIntro} field="collectionIntro" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}</div>
    {favorites.length ? <section className="favorites-grid">{favorites.map((item,index)=><article key={item.id}>{item.imageUrl&&<div className="favorite-image"><img src={item.imageUrl} alt={item.title} loading={index > 1 ? "lazy" : "eager"}/></div>}<div>{(viewer.ownerMode || item.access === "private") && <AccessBadge access={item.access}/>}<span data-text-page="collection" data-text-role="category"><EditableText textPage="collection" textRole="category" value={item.category} field="category" entity="favorite" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/> · {String(index+1).padStart(2,"0")}</span><h2 data-text-page="collection" data-text-role="itemTitle">{item.access === "private" && !viewer.ownerMode ? <PrivateContentTrigger title={item.title}/> : <EditableText textPage="collection" textRole="itemTitle" value={item.title} field="title" entity="favorite" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/>}</h2>{(item.access !== "private" || viewer.ownerMode) && <p data-text-page="collection" data-text-role="summary"><EditableText textPage="collection" textRole="summary" value={item.note} field="note" entity="favorite" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}{item.url&&c.collectionSource&&<a data-text-page="collection" data-text-role="link" href={item.url} target="_blank" rel="noreferrer"><EditableText textPage="collection" textRole="summary" value={c.collectionSource} field="collectionSource" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></a>}{viewer.ownerMode && <a className="owner-edit-link" href={`/studio?tab=favorites#${item.id}`}>编辑此收藏</a>}</div></article>)}</section> : <div className="list-empty"><EditableText textPage="collection" textRole="summary" value={c.collectionEmpty} field="collectionEmpty" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></div>}
  <ExtraPageCopy copy={copy} page="collection"/><SiteFooter viewer={viewer}/></main>;
}
