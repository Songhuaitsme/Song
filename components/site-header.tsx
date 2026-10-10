import { getSiteCopy } from "@/lib/content-store";
import type { ViewerContext } from "@/lib/admin-auth";

const links = [["/series", "navSeries"], ["/essays", "navEssays"], ["/collection", "navCollection"], ["/about", "navAbout"]] as const;
export async function SiteHeader({ viewer, returnTo = "/" }: { viewer: ViewerContext; returnTo?: string }) {
  const {values:c}=await getSiteCopy();
  const currentPath = returnTo.split(/[?#]/)[0];
  return <>
    {viewer.isAdmin && <aside className="owner-bar" aria-label="主人浏览模式">
      <div><strong>{viewer.ownerMode ? "主人视图" : "访客预览"}</strong><span>{viewer.ownerMode ? "正在显示全部内容" : "只显示访客可见内容"}</span></div>
      <div className="owner-actions">
        <form action="/api/auth/view-mode" method="post"><input type="hidden" name="csrf" value={viewer.csrfToken ?? ""}/><input type="hidden" name="returnTo" value={returnTo}/><input type="hidden" name="mode" value={viewer.ownerMode ? "visitor" : "owner"}/><button type="submit">{viewer.ownerMode ? "切换访客预览" : "返回主人视图"}</button></form>
        <a href="/studio">{c.studio || "工作室"}</a><a href="/studio?tab=copy">编辑页面文字</a>
        <form action="/api/auth/logout" method="post"><input type="hidden" name="csrf" value={viewer.csrfToken ?? ""}/><input type="hidden" name="returnTo" value="/"/><button type="submit">退出</button></form>
      </div>
    </aside>}
    <header className="site-header"><a href="/" className="wordmark" aria-label="首页">{c.brand}</a><nav aria-label="主要导航">{links.filter(([,key])=>c[key]).map(([href, key]) => { const active = currentPath === href || currentPath.startsWith(`${href}/`); return <a key={href} href={href} className="nav-link" aria-current={active ? "page" : undefined}>{c[key]}</a>; })}{!viewer.isAdmin && c.studio && <a className="nav-studio" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>{c.studio}<span aria-hidden="true">↗</span></a>}</nav></header>
  </>;
}
