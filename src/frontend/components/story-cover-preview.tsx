"use client";

import { useState } from "react";
import type { Series } from "@/shared/content-model";
import type { SiteCopy } from "@/shared/site-copy";
import { buildTypographyCss } from "@/shared/text-standard-css";
import { storyCoverCss } from "@/shared/story-cover-standard";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

export function StoryCoverPreview({ copy, series, device, page = "story" }: { copy: SiteCopy; series: Series[]; device: "desktop" | "mobile"; page?: "series" | "story" }) {
  const [selectedId, setSelectedId] = useState("");
  const sample = series.find(item => item.id === selectedId) ?? series.find(item => item.coverUrl) ?? series[0];
  const height = device === "desktop" ? 620 : 520;
  const c = copy.values;
  const directory = page === "series";
  const label = directory ? c.seriesLabel : c.storyLabel;
  const titleTag = directory ? "h2" : "h1";
  const content = `
    ${label ? `<p class="${directory ? "series-feature-label" : "eyebrow"}" data-text-page="${page}" data-text-role="overlayLabel">${escapeHtml(label)}</p>` : ""}
    <${titleTag} data-text-page="${page}" data-text-role="overlayTitle">${escapeHtml(sample?.title || "在雾与城之间")}</${titleTag}>
    ${directory ? `<p class="series-feature-description" data-text-page="series" data-text-role="overlaySummary">${escapeHtml(sample?.description ?? "")}</p>` : ""}
    <div class="${directory ? "series-feature-count" : "story-hero-meta"}"><span data-text-page="${page}" data-text-role="overlayLabel">${String(sample?.photos.length ?? 7).padStart(2, "0")} ${escapeHtml(directory ? c.photoUnit : c.photographs)}</span>
    ${!directory && c.seriesAuthor ? `<span data-text-page="story" data-text-role="overlayLabel">${escapeHtml(c.seriesAuthor)}</span>` : ""}</div>
    ${directory && c.readSeries ? `<span class="series-feature-link" data-text-page="series" data-text-role="overlayLink">${escapeHtml(c.readSeries)}</span>` : ""}`;
  const document = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;background:#242824;color:#fff}p{margin:0}
    .story-hero,.series-feature{position:relative;isolation:isolate;min-height:${height}px;display:flex;align-items:flex-end;overflow:hidden}
    .story-hero-image,.story-hero-shade{position:absolute;inset:0;width:100%;height:100%}
    .story-hero-image{z-index:-2;object-fit:cover}.story-hero-shade{z-index:-1}
    .story-hero-shade{background:linear-gradient(0deg,rgba(5,9,9,.76),rgba(5,9,9,.32) 38%,rgba(5,9,9,.06) 78%)}
    .story-hero-meta{display:flex}.series-feature-description{max-width:620px;line-height:1.9;white-space:pre-line}
    .series-feature-link{display:inline-flex;padding:10px 18px;border:1px solid currentColor;letter-spacing:.17em}
    ${storyCoverCss}${buildTypographyCss(copy)}
    </style><body><main data-copy-page="${page}" class="${directory ? "photography-page" : "story-editorial"}"><header class="${directory ? "series-feature" : "story-hero"}">
    ${sample?.coverUrl ? `<img class="story-hero-image" src="${escapeHtml(sample.coverUrl)}" alt="">` : ""}
    <div class="story-hero-shade"></div><div class="${directory ? "series-feature-copy" : "story-hero-copy"}">${content}
    </div></header></main></body></html>`;
  return <section className="standard-row standard-cover-example">
    <h3>{directory ? "摄影目录" : "摄影详情"}封面排版标准</h3>
    <p className="standard-size-note">摄影目录与摄影详情的封面文字均居中对齐，标题、标签、数量与署名共用字体、字号、颜色和字重。在任一页修改对应标准，两页会同步更新。桌面底部留白 56px，手机 36px。</p>
    {!!series.length && <label className="standard-cover-select">预览系列<select value={sample?.id ?? ""} onChange={event => setSelectedId(event.target.value)}>{series.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
    <div className={`standard-preview standard-preview-${device}`}><iframe title={`${directory ? "摄影目录" : "摄影详情"}封面整体预览`} sandbox="" srcDoc={document} style={{ width: device === "desktop" ? 1440 : 390, height }}/></div>
  </section>;
}
