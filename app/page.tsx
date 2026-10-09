import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getSiteContent } from "@/lib/content-store";

export default async function Home() {
  const content = await getSiteContent();
  const featured = content.series[0];
  const essay = content.essays[0];
  return <main>
    <SiteHeader />
    <section className="home-cover" aria-labelledby="featured-title">
      <Link href={`/series/${featured.slug}`} className="cover-image-wrap"><img src={featured.coverUrl} alt="" className="cover-image" /><span className="cover-index">SERIES 01</span></Link>
      <div className="cover-copy"><p className="eyebrow">摄影系列 · 2026</p><h1 id="featured-title">{featured.title}</h1><p>{featured.description}</p><Link href={`/series/${featured.slug}`} className="text-link">进入系列</Link></div>
    </section>
    {essay && <section className="editorial-section home-essay"><div><p className="section-number">02 / 随笔</p><h2>{essay.title}</h2></div><div><p>{essay.excerpt}</p><Link href={`/essays/${essay.slug}`} className="text-link">阅读全文</Link></div></section>}
    <section className="editorial-section home-collection"><div><p className="section-number">03 / 收藏</p><h2>最近留下的东西</h2></div><div className="collection-preview">{content.favorites.map((item) => <article key={item.id}><span>{item.category}</span><h3>{item.title}</h3><p>{item.note}</p></article>)}</div></section>
    <footer className="site-footer"><span>SONG © 2026</span><Link href="/studio">工作室</Link></footer>
  </main>;
}
