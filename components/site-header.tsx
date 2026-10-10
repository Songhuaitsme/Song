import type { ViewerContext } from "@/lib/admin-auth";

const links = [["/series", "摄影"], ["/essays", "随笔"], ["/collection", "收藏"], ["/about", "关于"]];
export function SiteHeader({ viewer, returnTo = "/" }: { viewer: ViewerContext; returnTo?: string }) {
  const currentPath = returnTo.split(/[?#]/)[0];
  return <>
    {viewer.isAdmin && <aside className="owner-bar" aria-label="主人浏览模式">
      <div><strong>{viewer.ownerMode ? "主人视图" : "访客预览"}</strong><span>{viewer.ownerMode ? "正在显示全部内容" : "只显示访客可见内容"}</span></div>
      <div className="owner-actions">
        <form action="/api/auth/view-mode" method="post"><input type="hidden" name="csrf" value={viewer.csrfToken ?? ""}/><input type="hidden" name="returnTo" value={returnTo}/><input type="hidden" name="mode" value={viewer.ownerMode ? "visitor" : "owner"}/><button type="submit">{viewer.ownerMode ? "切换访客预览" : "返回主人视图"}</button></form>
        <a href="/studio">工作室</a>
        <form action="/api/auth/logout" method="post"><input type="hidden" name="csrf" value={viewer.csrfToken ?? ""}/><input type="hidden" name="returnTo" value="/"/><button type="submit">退出</button></form>
      </div>
    </aside>}
    <header className="site-header"><a href="/" className="wordmark" aria-label="SONFORU 首页">SONFORU</a><nav aria-label="主要导航">{links.map(([href, label]) => { const active = currentPath === href || currentPath.startsWith(`${href}/`); return <a key={href} href={href} className="nav-link" aria-current={active ? "page" : undefined}>{label}</a>; })}{!viewer.isAdmin && <a className="nav-studio" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>工作室<span aria-hidden="true">↗</span></a>}</nav></header>
  </>;
}
