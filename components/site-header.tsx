import Link from "next/link";
const links = [["/series", "摄影"], ["/essays", "随笔"], ["/collection", "收藏"], ["/about", "关于"]];
export function SiteHeader() {
  return <header className="site-header"><Link href="/" className="wordmark" aria-label="SONG 首页">SONG<span>／影像与文字</span></Link><nav aria-label="主要导航">{links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}</nav></header>;
}
