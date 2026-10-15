import { EditableText } from "@/frontend/components/editable-text";
import { getSiteCopy } from "@/backend/content/content-store";
import { ExtraPageCopy } from "@/frontend/components/extra-page-copy";
import type { Metadata } from "next";
import { SiteHeader } from "@/frontend/components/site-header";
import { SiteFooter } from "@/frontend/components/site-footer";
import { getViewerContext } from "@/backend/auth/admin-auth";

import { getAboutContent } from "@/backend/content/content-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "关于" };

export default async function AboutPage(){
  const copy=await getSiteCopy();
  const c=copy.values;
  const viewer=await getViewerContext();
  const about = await getAboutContent();
  return <main data-copy-page="about" className="about-index"><SiteHeader viewer={viewer} returnTo="/about"/><section className="about-page">{c.aboutLabel && <p data-text-page="about" data-text-role="label" className="eyebrow"><EditableText textPage="about" textRole="label" value={c.aboutLabel} field="aboutLabel" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}{about.title && <h1 data-text-page="about" data-text-role="pageTitle"><EditableText textPage="about" textRole="pageTitle" value={about.title} field="title" entity="about" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></h1>}<div><p data-text-page="about" data-text-role="body" className="about-paragraph"><EditableText textPage="about" textRole="body" value={about.body} field="body" entity="about" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>{about.note && <p data-text-page="about" data-text-role="caption" className="about-note"><EditableText textPage="about" textRole="caption" value={about.note} field="note" entity="about" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}{viewer.ownerMode && <a className="owner-edit-link" href="/studio?tab=about">编辑关于页</a>}</div></section><ExtraPageCopy copy={copy} page="about"/><SiteFooter viewer={viewer}/></main>;
}
