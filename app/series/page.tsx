import { contentPath } from "@/lib/content-path";
import type { Metadata } from "next";
import { AccessBadge } from "@/components/access-badge";
import { SiteHeader } from "@/components/site-header";
import { getViewerContext } from "@/lib/admin-auth";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "摄影" };

export default async function SeriesPage() {
  const viewer = await getViewerContext();
  const { series } = await getSiteContent(viewer.ownerMode);
  const [featured, ...remaining] = series;
  return <main className="photography-page">
    <SiteHeader viewer={viewer} returnTo="/series"/>
    <div className="photography-heading"><h1>摄影系列</h1><p>PHOTOGRAPHIC STORIES</p></div>
    {featured ? <>
      <section className="series-feature" aria-labelledby="series-feature-title">
        <a className="series-feature-image" href={contentPath("series", featured.slug)} aria-label={`查看摄影系列：${featured.title}`}><img src={featured.coverUrl} alt={featured.photos.find((photo) => photo.imageUrl === featured.coverUrl)?.alt || featured.title} fetchPriority="high"/></a>
        <div className="series-feature-copy">
          <p className="series-feature-label">SONFORU / SERIES 01</p>
          {viewer.ownerMode && <AccessBadge access={featured.access}/>}
          <h2 id="series-feature-title"><a href={contentPath("series", featured.slug)}>{featured.title}</a></h2>
          <p className="series-feature-description">{featured.description}</p>
          <a className="series-feature-link" href={contentPath("series", featured.slug)}>探索系列<span aria-hidden="true">↗</span></a>
          {viewer.ownerMode && <a className="series-feature-edit" href={`/studio?tab=series#${featured.id}`}>编辑此系列</a>}
        </div>
        <span className="series-feature-count">{String(featured.photos.length).padStart(2, "0")} 张照片</span>
      </section>
      {remaining.length > 0 && <section className="photography-collection" aria-labelledby="photography-collection-title">
        <div className="photography-collection-heading"><h2 id="photography-collection-title">更多系列</h2><p>不同的地方，同一种观看。</p></div>
        <div className="photography-cards">{remaining.map((item, index) => <article className="photography-card" key={item.id}>
          <a className="photography-card-image" href={contentPath("series", item.slug)}><img src={item.coverUrl} alt={item.photos.find((photo) => photo.imageUrl === item.coverUrl)?.alt || item.title} loading="lazy"/></a>
          <div className="photography-card-copy"><p className="photography-card-meta">SERIES {String(index + 2).padStart(2, "0")}<span>{item.photos.length} 张照片</span></p>
            {viewer.ownerMode && <AccessBadge access={item.access}/>}
            <h3><a href={contentPath("series", item.slug)}>{item.title}</a></h3><p className="photography-card-description">{item.description}</p>
            <a className="text-link" href={contentPath("series", item.slug)}>探索系列</a>
            {viewer.ownerMode && <a className="owner-edit-link" href={`/studio?tab=series#${item.id}`}>编辑此系列</a>}
          </div>
        </article>)}</div>
      </section>}
    </> : <div className="list-empty">暂时没有公开的摄影系列。</div>}
    <footer className="site-footer"><span>SONFORU © 2026</span><a href={viewer.isAdmin ? "/studio" : "/login?returnTo=%2Fstudio"}>工作室</a></footer>
  </main>;
}
