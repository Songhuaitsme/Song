import { EditableText } from "@/frontend/components/editable-text";
import { getSiteCopy } from "@/backend/content/content-store";
import type { ViewerContext } from "@/backend/auth/admin-auth";
import { SiteNavigation } from "@/frontend/components/site-navigation";

export async function SiteHeader({ viewer, returnTo = "/" }: { viewer: ViewerContext; returnTo?: string }) {
  const {values:c}=await getSiteCopy();
  return <>
    {viewer.isAdmin && <aside className="owner-bar" aria-label="主人浏览模式">
      <div><strong>{viewer.ownerMode ? "主人视图" : "访客预览"}</strong><span>{viewer.ownerMode ? "正在显示全部内容" : "只显示访客可见内容"}</span></div>
      <div className="owner-actions">
        <form action="/api/auth/view-mode" method="post"><input type="hidden" name="csrf" value={viewer.csrfToken ?? ""}/><input type="hidden" name="returnTo" value={returnTo}/><input type="hidden" name="mode" value={viewer.ownerMode ? "visitor" : "owner"}/><button type="submit">{viewer.ownerMode ? "切换访客预览" : "返回主人视图"}</button></form>
        <a href="/studio">{c.studio || "工作室"}</a><a href="/studio?tab=copy">编辑首页与导航</a>
        <form action="/api/auth/logout" method="post"><input type="hidden" name="csrf" value={viewer.csrfToken ?? ""}/><input type="hidden" name="returnTo" value="/"/><button type="submit">退出</button></form>
      </div>
    </aside>}
    <header className="site-header"><a data-text-page="global" data-text-role="brand" href="/" className="wordmark" aria-label="首页"><EditableText textPage="global" textRole="brand" value={c.brand} field="brand" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></a><SiteNavigation copy={c} viewer={viewer} returnTo={returnTo}/></header>
  </>;
}
