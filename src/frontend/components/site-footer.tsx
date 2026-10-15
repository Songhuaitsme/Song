import { EditableText } from "@/frontend/components/editable-text";
import { getSiteCopy } from "@/backend/content/content-store";
import type { ViewerContext } from "@/backend/auth/admin-auth";
import { ArrowUpRight } from "lucide-react";

export async function SiteFooter({ viewer }: { viewer: ViewerContext }) {
  const { values: copy } = await getSiteCopy();
  return <footer className="site-footer">
    {copy.copyright && <span data-text-page="global" data-text-role="footer"><EditableText textPage="global" textRole="footer" value={copy.copyright} field="copyright" enabled={viewer.ownerMode} csrf={viewer.csrfToken ?? ""}/></span>}
    {copy.studio && <a data-text-page="global" data-text-role="footerLink" href={viewer.isAdmin ? "/studio" : "/login?returnTo=%2Fstudio"} className="footer-studio">
      <EditableText textPage="global" textRole="footerLink" value={copy.studio} field="studio" enabled={viewer.ownerMode} csrf={viewer.csrfToken ?? ""}/><ArrowUpRight size={16} strokeWidth={1.25} aria-hidden="true"/>
    </a>}
  </footer>;
}
