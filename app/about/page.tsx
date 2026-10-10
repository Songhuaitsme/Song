import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { getViewerContext } from "@/lib/admin-auth";

import { getAboutContent } from "@/lib/content-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "关于" };

export default async function AboutPage(){
  const viewer=await getViewerContext();
  const about = await getAboutContent();
  return <main className="about-index"><SiteHeader viewer={viewer} returnTo="/about"/><section className="about-page"><p className="eyebrow">ABOUT / 关于</p><h1>{about.title.split(/\r?\n/).map((line,index)=><span key={index}>{line || "\u00a0"}</span>)}</h1><div>{about.body.split(/\n\s*\n/).filter((paragraph)=>paragraph.trim()).map((paragraph,index)=><p className="about-paragraph" key={index}>{paragraph}</p>)}{about.note && <p className="about-note">{about.note}</p>}{viewer.ownerMode && <a className="owner-edit-link" href="/studio?tab=about">编辑关于页</a>}</div></section></main>;
}
