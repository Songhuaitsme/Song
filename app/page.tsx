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
  return <main>
    <SiteHeader viewer={viewer} returnTo="/" />
    {featured ? <section className="home-cover" aria-labelledby="featured-title">
      <a href={contentPath("series", featured.slug)} className="cover-image-wrap"><img src={featured.coverUrl} alt="" className="cover-image" />{c.homeImageLabel && <span className="cover-index">{c.homeImageLabel}</span>}</a>
      <div className="cover-copy">{c.homeSeriesLabel && <p className="eyebrow">{c.homeSeriesLabel}</p>}{viewer.ownerMode && <AccessBadge access={featured.access}/>}<h1 id="featured-title">{featured.title}</h1><p>{featured.description}</p>{c.enterSeries && <a href={contentPath("series", featured.slug)} className="text-link">{c.enterSeries}</a>}{viewer.ownerMode && <a href={`/studio?tab=series#${featured.id}`} className="owner-edit-link">编辑此系列</a>}</div>
    </section> : <section className="public-empty">{c.homeEmptyLabel && <p className="eyebrow">{c.homeEmptyLabel}</p>}{c.homeEmptyTitle && <h1>{c.homeEmptyTitle}</h1>}{c.homeEmptyDescription && <p>{c.homeEmptyDescription}</p>}</section>}
    {essay && <section className="editorial-section home-essay"><div>{c.homeEssayLabel && <p className="section-number">{c.homeEssayLabel}</p>}{viewer.ownerMode && <AccessBadge access={essay.access}/>}<h2>{essay.title}</h2></div><div><p>{essay.excerpt}</p>{c.readEssay && <a href={contentPath("essays", essay.slug)} className="text-link">{c.readEssay}</a>}{viewer.ownerMode && <a href={`/studio?tab=essays#${essay.id}`} className="owner-edit-link">编辑此随笔</a>}</div></section>}
    {content.favorites.length > 0 && <section className="editorial-section home-collection"><div>{c.homeCollectionLabel && <p className="section-number">{c.homeCollectionLabel}</p>}{c.homeCollectionTitle && <h2>{c.homeCollectionTitle}</h2>}</div><div className="collection-preview">{content.favorites.map((item) => <article key={item.id}>{viewer.ownerMode && <AccessBadge access={item.access}/>}<span>{item.category}</span><h3>{item.title}</h3><p>{item.note}</p>{viewer.ownerMode && <a href={`/studio?tab=favorites#${item.id}`} className="owner-edit-link">编辑</a>}</article>)}</div></section>}
    <ExtraPageCopy copy={copy} page="home"/><footer className="site-footer">{c.copyright && <span>{c.copyright}</span>}{c.studio && <a href={viewer.isAdmin ? "/studio" : "/login?returnTo=%2Fstudio"} className="footer-studio">{c.studio}<span aria-hidden="true">↗</span></a>}</footer>
  </main>;
}
