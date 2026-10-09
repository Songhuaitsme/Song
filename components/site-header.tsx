const links = [["/series", "摄影"], ["/essays", "随笔"], ["/collection", "收藏"], ["/about", "关于"]];
export function SiteHeader() {
  return <header className="site-header"><a href="/" className="wordmark" aria-label="SONG 首页">SONG<span>／影像与文字</span></a><nav aria-label="主要导航">{links.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav></header>;
}
