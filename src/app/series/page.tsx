import { PrivateArtwork } from "@/frontend/components/private-content-notice";
import { EditableText } from "@/frontend/components/editable-text";
import { getSiteCopy } from "@/backend/content/content-store";
import { ExtraPageCopy } from "@/frontend/components/extra-page-copy";
import { contentPath } from "@/shared/content-path";
import type { Metadata } from "next";
import { AccessBadge } from "@/frontend/components/access-badge";
import { SiteHeader } from "@/frontend/components/site-header";
import { SiteFooter } from "@/frontend/components/site-footer";
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
      <section className={`series-feature${featured.access === "private" && !viewer.ownerMode ? " series-feature-private" : ""}`} aria-labelledby="series-feature-title">
        <a data-text-page="series" data-text-role="overlayLabel" className="series-feature-image" href={contentPath("series", featured.slug)} aria-label={`查看摄影系列：${featured.title}`}>{featured.access === "private" && !viewer.ownerMode ? <PrivateArtwork/> : <img src={featured.coverUrl} alt={featured.photos.find((photo) => photo.imageUrl === featured.coverUrl)?.alt || featured.title} fetchPriority="high"/>}</a>
        <div className="series-feature-copy">
          {c.seriesLabel && <p data-text-page="series" data-text-role="overlayLabel" className="series-feature-label"><EditableText textPage="series" textRole="overlayLabel" value={c.seriesLabel} field="seriesLabel" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}
          {(viewer.ownerMode || featured.access === "private") && <AccessBadge access={featured.access}/>}
          <h2 data-text-page="series" data-text-role="overlayTitle" id="series-feature-title"><a data-text-page="series" data-text-role="overlayTitle" href={contentPath("series", featured.slug)}><EditableText textPage="series" textRole="overlayTitle" value={featured.title} field="title" entity="series" id={featured.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></a></h2>
          <p data-text-page="series" data-text-role="overlaySummary" className="series-feature-description"><EditableText textPage="series" textRole="overlaySummary" value={featured.description} field="description" entity="series" id={featured.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>
          {(featured.access !== "private" || viewer.ownerMode) && <span data-text-page="series" data-text-role="overlayLabel" className="series-feature-count">{String(featured.photos.length).padStart(2, "0")} <EditableText textPage="series" textRole="overlayLabel" value={c.photoUnit} field="photoUnit" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></span>}
          {c.readSeries && <a data-text-page="series" data-text-role="overlayLink" className="series-feature-link" href={contentPath("series", featured.slug)}><EditableText textPage="series" textRole="overlayLink" value={c.readSeries} field="readSeries" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></a>}
          {viewer.ownerMode && <a className="series-feature-edit" href={`/studio?tab=series#${featured.id}`}>编辑此系列</a>}
        </div>
      </section>
      {remaining.length > 0 && <section className="photography-collection" aria-labelledby="photography-collection-title">
        <div className="photography-collection-heading">{c.seriesListTitle && <h2 data-text-page="series" data-text-role="sectionTitle" id="photography-collection-title"><EditableText textPage="series" textRole="sectionTitle" value={c.seriesListTitle} field="seriesListTitle" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></h2>}{c.seriesListIntro && <p data-text-page="series" data-text-role="summary"><EditableText textPage="series" textRole="summary" value={c.seriesListIntro} field="seriesListIntro" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}</div>
        <div className="photography-cards">{remaining.map((item, index) => <article className="photography-card" key={item.id}>
          <a data-text-page="series" data-text-role="label" className="photography-card-image" href={contentPath("series", item.slug)} aria-label={`查看摄影系列：${item.title}`}>{item.access === "private" && !viewer.ownerMode ? <PrivateArtwork/> : <img src={item.coverUrl} alt={item.photos.find((photo) => photo.imageUrl === item.coverUrl)?.alt || item.title} loading="lazy"/>}</a>
          <div className="photography-card-copy"><p data-text-page="series" data-text-role="label" className="photography-card-meta">{c.seriesAuthor && <span data-text-page="series" data-text-role="label"><EditableText textPage="series" textRole="label" value={c.seriesAuthor} field="seriesAuthor" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></span>}<span data-text-page="series" data-text-role="label"><EditableText textPage="series" textRole="label" value={c.seriesNumberLabel} field="seriesNumberLabel" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/> {String(index + 2).padStart(2, "0")}{(item.access !== "private" || viewer.ownerMode) && <> · {String(item.photos.length).padStart(2, "0")} <EditableText textPage="series" textRole="label" value={c.photographs} field="photographs" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></>}</span></p>
            {(viewer.ownerMode || item.access === "private") && <AccessBadge access={item.access}/>}
            <h3 data-text-page="series" data-text-role="itemTitle"><a data-text-page="series" data-text-role="itemTitle" href={contentPath("series", item.slug)}><EditableText textPage="series" textRole="itemTitle" value={item.title} field="title" entity="series" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></a></h3><p data-text-page="series" data-text-role="summary" className="photography-card-description"><EditableText textPage="series" textRole="summary" value={item.description} field="description" entity="series" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>
            {c.readSeries && <a data-text-page="series" data-text-role="link" className="photography-card-link" href={contentPath("series", item.slug)}><EditableText textPage="series" textRole="link" value={c.readSeries} field="readSeries" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></a>}
            {viewer.ownerMode && <a className="owner-edit-link" href={`/studio?tab=series#${item.id}`}>编辑此系列</a>}
          </div>
        </article>)}</div>
      </section>}
    </> : <div className="list-empty"><EditableText textPage="series" textRole="label" value={c.seriesEmpty} field="seriesEmpty" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></div>}
    <ExtraPageCopy copy={copy} page="series"/><SiteFooter viewer={viewer}/>
  </main>;
}
