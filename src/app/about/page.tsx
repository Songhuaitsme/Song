import { EditableText } from "@/frontend/components/editable-text";
import { getSiteCopy } from "@/backend/content/content-store";
import { ExtraPageCopy } from "@/frontend/components/extra-page-copy";
import type { Metadata } from "next";
import { SiteHeader } from "@/frontend/components/site-header";
import { getViewerContext } from "@/backend/auth/admin-auth";

import { getAboutContent } from "@/backend/content/content-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "关于" };

export default async function AboutPage(){
  const copy=await getSiteCopy();
  const c=copy.values;
  const viewer=await getViewerContext();
  const about = await getAboutContent();
  return <main data-copy-page="about" className="about-index"><SiteHeader viewer={viewer} returnTo="/about"/><section className="about-page">{c.aboutLabel && <p className="eyebrow"><EditableText value={c.aboutLabel} field="aboutLabel" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}{about.title && <h1><EditableText value={about.title} field="title" entity="about" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></h1>}<div><p className="about-paragraph"><EditableText value={about.body} field="body" entity="about" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>{about.note && <p className="about-note"><EditableText value={about.note} field="note" entity="about" enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>}{viewer.ownerMode && <a className="owner-edit-link" href="/studio?tab=about">编辑关于页</a>}</div></section><ExtraPageCopy copy={copy} page="about"/></main>;
}
