import { PrivateArtwork } from "@/frontend/components/private-content-notice";
import { PrivateContentTrigger } from "@/frontend/components/private-content-trigger";
import { ArrowRight } from "lucide-react";
import { EditableText } from "@/frontend/components/editable-text";
import { getSiteCopy } from "@/backend/content/content-store";
import { ExtraPageCopy } from "@/frontend/components/extra-page-copy";
import { contentPath } from "@/shared/content-path";
import { AccessBadge } from "@/frontend/components/access-badge";
import { SiteHeader } from "@/frontend/components/site-header";
import { SiteFooter } from "@/frontend/components/site-footer";
import { getViewerContext } from "@/backend/auth/admin-auth";
import { getSiteContent } from "@/backend/content/content-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const copy=await getSiteCopy();
  const c=copy.values;
  const viewer = await getViewerContext();
  const content = await getSiteContent(viewer.ownerMode);
  const featured = content.series[0];
  const essay = content.essays[0];
  return <main data-copy-page="home" className="home-page">
    <SiteHeader viewer={viewer} returnTo="/" />
    {featured ? <section className="home-cover" aria-labelledby="featured-title">
      <figure className="cover-artwork">
        <a data-text-page="home" data-text-role="summary" href={contentPath("series", featured.slug)} className="cover-image-wrap" aria-label={`查看摄影系列：${featured.title}`}>{featured.access === "private" && !viewer.ownerMode ? <PrivateArtwork/> : <img src={featured.coverUrl} alt={featured.photos.find(photo=>photo.imageUrl===featured.coverUrl)?.alt || featured.title} className="cover-image" fetchPriority="high" />}</a>
      </figure>
      <div className="cover-copy">
        {c.homeSeriesLabel && <p data-text-page="home" data-text-role="label" className="section-number"><EditableText textPage="home" textRole="label" value={c.homeSeriesLabel} field="homeSeriesLabel" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}
        {(viewer.ownerMode || featured.access === "private") && <AccessBadge access={featured.access}/>}
        <h1 data-text-page="home" data-text-role="hero" id="featured-title"><EditableText textPage="home" textRole="hero" value={featured.title} field="title" entity="series" id={featured.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></h1>
        {featured.description && <p data-text-page="home" data-text-role="summary" className="cover-description"><EditableText textPage="home" textRole="summary" value={featured.description} field="description" entity="series" id={featured.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}
        {c.enterSeries && <a data-text-page="home" data-text-role="link" href={contentPath("series", featured.slug)} className="text-link" aria-label={`${c.enterSeries} · ${featured.title}`}>
          <EditableText textPage="home" textRole="link" value={c.enterSeries} field="enterSeries" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/>
          <span className="text-link-icon" aria-hidden="true"><ArrowRight size={20} strokeWidth={1.4}/></span>
        </a>}
        {viewer.ownerMode && <a href={`/studio?tab=series#${featured.id}`} className="owner-edit-link">编辑此系列</a>}
      </div>
    </section> : <section className="public-empty">{c.homeEmptyLabel && <p data-text-page="home" data-text-role="summary" className="eyebrow"><EditableText textPage="home" textRole="label" value={c.homeEmptyLabel} field="homeEmptyLabel" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}{c.homeEmptyTitle && <h1 data-text-page="home" data-text-role="hero"><EditableText textPage="home" textRole="hero" value={c.homeEmptyTitle} field="homeEmptyTitle" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></h1>}{c.homeEmptyDescription && <p data-text-page="home" data-text-role="summary"><EditableText textPage="home" textRole="summary" value={c.homeEmptyDescription} field="homeEmptyDescription" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}</section>}
    {essay && <section className="editorial-section home-essay"><div>{c.homeEssayLabel && <p data-text-page="home" data-text-role="label" className="section-number"><EditableText textPage="home" textRole="label" value={c.homeEssayLabel} field="homeEssayLabel" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}{(viewer.ownerMode || essay.access === "private") && <AccessBadge access={essay.access}/>}<h2 data-text-page="home" data-text-role="sectionTitle"><EditableText textPage="home" textRole="sectionTitle" value={essay.title} field="title" entity="essay" id={essay.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></h2></div><div><p data-text-page="home" data-text-role="summary"><EditableText textPage="home" textRole="summary" value={essay.excerpt} field="excerpt" entity="essay" id={essay.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>{c.readEssay && <a data-text-page="home" data-text-role="link" href={contentPath("essays", essay.slug)} className="text-link">
      <EditableText textPage="home" textRole="link" value={c.readEssay} field="readEssay" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/>
      <span className="text-link-icon" aria-hidden="true"><ArrowRight size={20} strokeWidth={1.4}/></span>
    </a>}{viewer.ownerMode && <a href={`/studio?tab=essays#${essay.id}`} className="owner-edit-link">编辑此随笔</a>}</div></section>}
    {content.favorites.length > 0 && <section className="editorial-section home-collection"><div>{c.homeCollectionLabel && <p data-text-page="home" data-text-role="label" className="section-number"><EditableText textPage="home" textRole="label" value={c.homeCollectionLabel} field="homeCollectionLabel" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}{c.homeCollectionTitle && <h2 data-text-page="home" data-text-role="sectionTitle"><EditableText textPage="home" textRole="sectionTitle" value={c.homeCollectionTitle} field="homeCollectionTitle" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></h2>}</div><div className="collection-preview">{content.favorites.map((item) => <article key={item.id}>{(viewer.ownerMode || item.access === "private") && <AccessBadge access={item.access}/>}<span data-text-page="home" data-text-role="category"><EditableText textPage="home" textRole="category" value={item.category} field="category" entity="favorite" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></span><h3 data-text-page="home" data-text-role="itemTitle">{item.access === "private" && !viewer.ownerMode ? <PrivateContentTrigger title={item.title}/> : <EditableText textPage="home" textRole="itemTitle" value={item.title} field="title" entity="favorite" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/>}</h3>{(item.access !== "private" || viewer.ownerMode) && <p data-text-page="home" data-text-role="summary"><EditableText textPage="home" textRole="summary" value={item.note} field="note" entity="favorite" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}{viewer.ownerMode && <a href={`/studio?tab=favorites#${item.id}`} className="owner-edit-link">编辑</a>}</article>)}</div></section>}
    <ExtraPageCopy copy={copy} page="home"/><SiteFooter viewer={viewer}/>
  </main>;
}
