import { EditableText } from "@/components/editable-text";
import { getSiteCopy } from "@/lib/content-store";
import { ExtraPageCopy } from "@/components/extra-page-copy";
import { contentPath } from "@/lib/content-path";
import { AccessBadge } from "@/components/access-badge";
import { SiteHeader } from "@/components/site-header";
import { getViewerContext } from "@/lib/admin-auth";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const copy=await getSiteCopy();
  const c=copy.values;
  const viewer = await getViewerContext();
  const content = await getSiteContent(viewer.ownerMode);
  const featured = content.series[0];
  const essay = content.essays[0];
  return <main data-copy-page="home">
    <SiteHeader viewer={viewer} returnTo="/" />
    {featured ? <section className="home-cover" aria-labelledby="featured-title">
      <a href={contentPath("series", featured.slug)} className="cover-image-wrap"><img src={featured.coverUrl} alt="" className="cover-image" />{c.homeImageLabel && <span className="cover-index"><EditableText value={c.homeImageLabel} field="homeImageLabel" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></span>}</a>
      <div className="cover-copy">{c.homeSeriesLabel && <p className="eyebrow"><EditableText value={c.homeSeriesLabel} field="homeSeriesLabel" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}{viewer.ownerMode && <AccessBadge access={featured.access}/>}<h1 id="featured-title"><EditableText value={featured.title} field="title" entity="series" id={featured.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></h1><p><EditableText value={featured.description} field="description" entity="series" id={featured.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>{c.enterSeries && <a href={contentPath("series", featured.slug)} className="text-link"><EditableText value={c.enterSeries} field="enterSeries" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></a>}{viewer.ownerMode && <a href={`/studio?tab=series#${featured.id}`} className="owner-edit-link">编辑此系列</a>}</div>
    </section> : <section className="public-empty">{c.homeEmptyLabel && <p className="eyebrow"><EditableText value={c.homeEmptyLabel} field="homeEmptyLabel" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}{c.homeEmptyTitle && <h1><EditableText value={c.homeEmptyTitle} field="homeEmptyTitle" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></h1>}{c.homeEmptyDescription && <p><EditableText value={c.homeEmptyDescription} field="homeEmptyDescription" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}</section>}
    {essay && <section className="editorial-section home-essay"><div>{c.homeEssayLabel && <p className="section-number"><EditableText value={c.homeEssayLabel} field="homeEssayLabel" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}{viewer.ownerMode && <AccessBadge access={essay.access}/>}<h2><EditableText value={essay.title} field="title" entity="essay" id={essay.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></h2></div><div><p><EditableText value={essay.excerpt} field="excerpt" entity="essay" id={essay.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>{c.readEssay && <a href={contentPath("essays", essay.slug)} className="text-link"><EditableText value={c.readEssay} field="readEssay" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></a>}{viewer.ownerMode && <a href={`/studio?tab=essays#${essay.id}`} className="owner-edit-link">编辑此随笔</a>}</div></section>}
    {content.favorites.length > 0 && <section className="editorial-section home-collection"><div>{c.homeCollectionLabel && <p className="section-number"><EditableText value={c.homeCollectionLabel} field="homeCollectionLabel" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}{c.homeCollectionTitle && <h2><EditableText value={c.homeCollectionTitle} field="homeCollectionTitle" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></h2>}</div><div className="collection-preview">{content.favorites.map((item) => <article key={item.id}>{viewer.ownerMode && <AccessBadge access={item.access}/>}<span><EditableText value={item.category} field="category" entity="favorite" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></span><h3><EditableText value={item.title} field="title" entity="favorite" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></h3><p><EditableText value={item.note} field="note" entity="favorite" id={item.id} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>{viewer.ownerMode && <a href={`/studio?tab=favorites#${item.id}`} className="owner-edit-link">编辑</a>}</article>)}</div></section>}
    <ExtraPageCopy copy={copy} page="home"/><footer className="site-footer">{c.copyright && <span><EditableText value={c.copyright} field="copyright" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></span>}{c.studio && <a href={viewer.isAdmin ? "/studio" : "/login?returnTo=%2Fstudio"} className="footer-studio"><EditableText value={c.studio} field="studio" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/><span aria-hidden="true">↗</span></a>}</footer>
  </main>;
}
