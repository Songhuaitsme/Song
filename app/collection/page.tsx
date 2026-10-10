import { getSiteCopy } from "@/lib/content-store";
import { ExtraPageCopy } from "@/components/extra-page-copy";
import type { Metadata } from "next";
import { AccessBadge } from "@/components/access-badge";
import { SiteHeader } from "@/components/site-header";
import { getViewerContext } from "@/lib/admin-auth";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "收藏" };

export default async function CollectionPage(){
  const copy=await getSiteCopy();
  const c=copy.values;
  const viewer = await getViewerContext();
  const { favorites } = await getSiteContent(viewer.ownerMode);
  return <main className="collection-page"><SiteHeader viewer={viewer} returnTo="/collection"/><div className="notes-heading">{c.collectionLabel && <p className="eyebrow">{c.collectionLabel}</p>}{c.collectionTitle && <h1>{c.collectionTitle}</h1>}{c.collectionIntro && <p className="notes-intro">{c.collectionIntro}</p>}</div>
    {favorites.length ? <section className="favorites-grid">{favorites.map((item,index)=><article key={item.id}>{item.imageUrl&&<div className="favorite-image"><img src={item.imageUrl} alt={item.title} loading={index > 1 ? "lazy" : "eager"}/></div>}<div>{viewer.ownerMode && <AccessBadge access={item.access}/>}<span>{item.category} · {String(index+1).padStart(2,"0")}</span><h2>{item.title}</h2><p>{item.note}</p>{item.url&&c.collectionSource&&<a href={item.url} target="_blank" rel="noreferrer">{c.collectionSource}</a>}{viewer.ownerMode && <a className="owner-edit-link" href={`/studio?tab=favorites#${item.id}`}>编辑此收藏</a>}</div></article>)}</section> : <div className="list-empty">{c.collectionEmpty}</div>}
  <ExtraPageCopy copy={copy} page="collection"/></main>;
}
