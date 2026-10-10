import { EditableText } from "@/frontend/components/editable-text";
import { getSiteCopy } from "@/backend/content/content-store";
import { ExtraPageCopy } from "@/frontend/components/extra-page-copy";
import { contentPath } from "@/shared/content-path";
import type { Metadata } from "next";
import { AccessBadge } from "@/frontend/components/access-badge";
import { SiteHeader } from "@/frontend/components/site-header";
import { getViewerContext } from "@/backend/auth/admin-auth";
import { getSiteContent } from "@/backend/content/content-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "摄影" };

export default async function SeriesPage() {
  const copy=await getSiteCopy();
  const c=copy.values;
  const viewer = await getViewerContext();
  const { series } = await getSiteContent(viewer.ownerMode);
  const [featured, ...remaining] = series;
  return <main data-copy-page="series" className="photography-page">
    <SiteHeader viewer={viewer} returnTo="/series"/>
    <h1 className="sr-only">摄影系列</h1>
    {featured ? <>
      <section className="series-feature" aria-labelledby="series-feature-title">
        <a className="series-feature-image" href={contentPath("series", featured.slug)} aria-label={`查看摄影系列：${featured.title}`}><img src={featured.coverUrl} alt={featured.photos.find((photo) => photo.imageUrl === featured.coverUrl)?.alt || featured.title} fetchPriority="high"/></a>
        <div className="series-feature-copy">
          {c.seriesLabel && <p className="series-feature-label"><EditableText value={c.seriesLabel} field="seriesLabel" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}
          {viewer.ownerMode && <AccessBadge access={featured.access}/>}
          <h2 id="series-feature-title"><a href={contentPath("series", featured.slug)}><EditableText value={featured.title} field="title" entity="series" id={featured.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></a></h2>
          <p className="series-feature-description"><EditableText value={featured.description} field="description" entity="series" id={featured.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>
          {c.readSeries && <a className="series-feature-link" href={contentPath("series", featured.slug)}><EditableText value={c.readSeries} field="readSeries" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></a>}
          {viewer.ownerMode && <a className="series-feature-edit" href={`/studio?tab=series#${featured.id}`}>编辑此系列</a>}
        </div>
        <span className="series-feature-count">{String(featured.photos.length).padStart(2, "0")} <EditableText value={c.photoUnit} field="photoUnit" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></span>
      </section>
      {remaining.length > 0 && <section className="photography-collection" aria-labelledby="photography-collection-title">
        <div className="photography-collection-heading">{c.seriesListTitle && <h2 id="photography-collection-title"><EditableText value={c.seriesListTitle} field="seriesListTitle" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></h2>}{c.seriesListIntro && <p><EditableText value={c.seriesListIntro} field="seriesListIntro" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}</div>
        <div className="photography-cards">{remaining.map((item, index) => <article className="photography-card" key={item.id}>
          <a className="photography-card-image" href={contentPath("series", item.slug)} aria-label={`查看摄影系列：${item.title}`}><img src={item.coverUrl} alt={item.photos.find((photo) => photo.imageUrl === item.coverUrl)?.alt || item.title} loading="lazy"/></a>
          <div className="photography-card-copy"><p className="photography-card-meta">{c.seriesAuthor && <span><EditableText value={c.seriesAuthor} field="seriesAuthor" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></span>}<span><EditableText value={c.seriesNumberLabel} field="seriesNumberLabel" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/> {String(index + 2).padStart(2, "0")} · {String(item.photos.length).padStart(2, "0")} <EditableText value={c.photographs} field="photographs" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></span></p>
            {viewer.ownerMode && <AccessBadge access={item.access}/>}
            <h3><a href={contentPath("series", item.slug)}><EditableText value={item.title} field="title" entity="series" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></a></h3><p className="photography-card-description"><EditableText value={item.description} field="description" entity="series" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>
            {c.readSeries && <a className="photography-card-link" href={contentPath("series", item.slug)}><EditableText value={c.readSeries} field="readSeries" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></a>}
            {viewer.ownerMode && <a className="owner-edit-link" href={`/studio?tab=series#${item.id}`}>编辑此系列</a>}
          </div>
        </article>)}</div>
      </section>}
    </> : <div className="list-empty"><EditableText value={c.seriesEmpty} field="seriesEmpty" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></div>}
    <ExtraPageCopy copy={copy} page="series"/><footer className="site-footer">{c.copyright && <span><EditableText value={c.copyright} field="copyright" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></span>}{c.studio && <a href={viewer.isAdmin ? "/studio" : "/login?returnTo=%2Fstudio"} className="footer-studio"><EditableText value={c.studio} field="studio" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/><span aria-hidden="true">↗</span></a>}</footer>
  </main>;
}
