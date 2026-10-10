import { EditableText } from "@/frontend/components/editable-text";
import { getSiteCopy } from "@/backend/content/content-store";
import { ExtraPageCopy } from "@/frontend/components/extra-page-copy";
import type { Metadata } from "next";
import { AccessBadge } from "@/frontend/components/access-badge";
import { SiteHeader } from "@/frontend/components/site-header";
import { getViewerContext } from "@/backend/auth/admin-auth";
import { getSiteContent } from "@/backend/content/content-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "收藏" };

export default async function CollectionPage(){
  const copy=await getSiteCopy();
  const c=copy.values;
  const viewer = await getViewerContext();
  const { favorites } = await getSiteContent(viewer.ownerMode);
  return <main data-copy-page="collection" className="collection-page"><SiteHeader viewer={viewer} returnTo="/collection"/><div className="notes-heading">{c.collectionLabel && <p className="eyebrow"><EditableText value={c.collectionLabel} field="collectionLabel" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}{c.collectionTitle && <h1><EditableText value={c.collectionTitle} field="collectionTitle" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></h1>}{c.collectionIntro && <p className="notes-intro"><EditableText value={c.collectionIntro} field="collectionIntro" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}</div>
    {favorites.length ? <section className="favorites-grid">{favorites.map((item,index)=><article key={item.id}>{item.imageUrl&&<div className="favorite-image"><img src={item.imageUrl} alt={item.title} loading={index > 1 ? "lazy" : "eager"}/></div>}<div>{viewer.ownerMode && <AccessBadge access={item.access}/>}<span><EditableText value={item.category} field="category" entity="favorite" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/> · {String(index+1).padStart(2,"0")}</span><h2><EditableText value={item.title} field="title" entity="favorite" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></h2><p><EditableText value={item.note} field="note" entity="favorite" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>{item.url&&c.collectionSource&&<a href={item.url} target="_blank" rel="noreferrer"><EditableText value={c.collectionSource} field="collectionSource" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></a>}{viewer.ownerMode && <a className="owner-edit-link" href={`/studio?tab=favorites#${item.id}`}>编辑此收藏</a>}</div></article>)}</section> : <div className="list-empty"><EditableText value={c.collectionEmpty} field="collectionEmpty" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></div>}
  <ExtraPageCopy copy={copy} page="collection"/></main>;
}
