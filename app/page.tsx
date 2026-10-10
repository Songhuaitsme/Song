import { contentPath } from "@/lib/content-path";
import { AccessBadge } from "@/components/access-badge";
import { SiteHeader } from "@/components/site-header";
import { getViewerContext } from "@/lib/admin-auth";
import { getSiteContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const viewer = await getViewerContext();
  const content = await getSiteContent(viewer.ownerMode);
  const featured = content.series[0];
  const essay = content.essays[0];
  return <main>
    <SiteHeader viewer={viewer} returnTo="/" />
    {featured ? <section className="home-cover" aria-labelledby="featured-title">
      <a href={contentPath("series", featured.slug)} className="cover-image-wrap"><img src={featured.coverUrl} alt="" className="cover-image" /><span className="cover-index">SERIES 01</span></a>
      <div className="cover-copy"><p className="eyebrow">01 / 摄影系列</p>{viewer.ownerMode && <AccessBadge access={featured.access}/>}<h1 id="featured-title">{featured.title}</h1><p>{featured.description}</p><a href={contentPath("series", featured.slug)} className="text-link">进入系列</a>{viewer.ownerMode && <a href={`/studio?tab=series#${featured.id}`} className="owner-edit-link">编辑此系列</a>}</div>
    </section> : <section className="public-empty"><p className="eyebrow">SONG / 影像与文字</p><h1>内容正在整理中</h1><p>公开内容会在这里出现。</p></section>}
    {essay && <section className="editorial-section home-essay"><div><p className="section-number">02 / 随笔</p>{viewer.ownerMode && <AccessBadge access={essay.access}/>}<h2>{essay.title}</h2></div><div><p>{essay.excerpt}</p><a href={contentPath("essays", essay.slug)} className="text-link">阅读全文</a>{viewer.ownerMode && <a href={`/studio?tab=essays#${essay.id}`} className="owner-edit-link">编辑此随笔</a>}</div></section>}
    {content.favorites.length > 0 && <section className="editorial-section home-collection"><div><p className="section-number">03 / 收藏</p><h2>最近留下的东西</h2></div><div className="collection-preview">{content.favorites.map((item) => <article key={item.id}>{viewer.ownerMode && <AccessBadge access={item.access}/>}<span>{item.category}</span><h3>{item.title}</h3><p>{item.note}</p>{viewer.ownerMode && <a href={`/studio?tab=favorites#${item.id}`} className="owner-edit-link">编辑</a>}</article>)}</div></section>}
    <footer className="site-footer"><span>SONG © 2026</span><a href={viewer.isAdmin ? "/studio" : "/login?returnTo=%2Fstudio"}>工作室</a></footer>
  </main>;
}
