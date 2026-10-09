import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { getViewerContext } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "关于" };

export default async function AboutPage(){
  const viewer=await getViewerContext();
  return <main><SiteHeader viewer={viewer} returnTo="/about"/><section className="about-page"><p className="eyebrow">ABOUT / 关于</p><h1>把路过的光，<br/>慢慢收进来。</h1><div><p>SONG 是一个关于摄影、随笔与个人收藏的空间。</p><p>这里的照片不是按地点罗列，而是被重新编排成可以阅读的系列。文字也保留公开与私藏之间的界线：有些适合分享，有些只留给自己。</p><p className="about-note">个人介绍与联系方式可在工作室中继续完善。</p></div></section></main>;
}
