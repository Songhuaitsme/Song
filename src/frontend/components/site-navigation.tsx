"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { EditableText } from "@/frontend/components/editable-text";
import type { ViewerContext } from "@/backend/auth/admin-auth";
import type { SiteCopy } from "@/shared/site-copy";

const links = [["/", "navHome"], ["/series", "navSeries"], ["/essays", "navEssays"], ["/collection", "navCollection"], ["/about", "navAbout"]] as const;

export function SiteNavigation({ copy, viewer, returnTo }: { copy: SiteCopy["values"]; viewer: ViewerContext; returnTo: string }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const currentPath = returnTo.split(/[?#]/)[0];

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  return <div ref={menuRef} className="site-navigation-wrap" data-open={open} onKeyDown={event => {
    if (event.key === "Escape") {
      setOpen(false);
      document.getElementById(`${menuId}-toggle`)?.focus();
    }
  }}>
    <button data-text-page="global" data-text-role="navigation" id={`${menuId}-toggle`} className="navigation-toggle" type="button" aria-label={open ? "关闭导航菜单" : "打开导航菜单"} aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(!open)}>
      {open ? <X aria-hidden="true"/> : <Menu aria-hidden="true"/>}
    </button>
    <nav id={menuId} aria-label="主要导航" className="site-navigation">
      {links.filter(([, key]) => copy[key]).map(([href, key]) => {
        const active = currentPath === href || (href !== "/" && currentPath.startsWith(`${href}/`));
        return <a data-text-page="global" data-text-role="navigation" key={href} href={href} className="nav-link" aria-current={active ? "page" : undefined}>
          <EditableText textPage="global" textRole="navigation" value={copy[key]} field={key} enabled={viewer.ownerMode} csrf={viewer.csrfToken ?? ""}/>
        </a>;
      })}
      {!viewer.isAdmin && copy.studio && <a data-text-page="global" data-text-role="link" className="nav-studio" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>
        <EditableText textPage="global" textRole="link" value={copy.studio} field="studio" enabled={viewer.ownerMode} csrf={viewer.csrfToken ?? ""}/><ArrowUpRight className="navigation-arrow" size={16} strokeWidth={1.25} aria-hidden="true"/>
      </a>}
    </nav>
  </div>;
}
