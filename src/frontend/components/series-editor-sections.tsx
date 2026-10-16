"use client";

import { type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Series } from "@/shared/content-model";
import { emptyNarrative } from "@/shared/series-narrative";
import { sameStudioValue } from "@/shared/studio-list";
import type { SeriesEditorOpen, SeriesEditorSection } from "@/shared/studio-series-sections";
import { Button } from "./ui/button";

export function SeriesEditorSections({ series, saved, open, onChange, busy, text, layout, photos }: {
  series: Series; saved?: Series; open: SeriesEditorOpen; onChange(open: SeriesEditorOpen): void; busy: boolean;
  text(): ReactNode; layout(): ReactNode; photos(): ReactNode;
}) {
  const narrative = series.narrative ?? emptyNarrative();
  const photoFields = (item: Series | undefined) => item?.photos.map(photo => ({ id: photo.id, imageUrl: photo.imageUrl, alt: photo.alt, caption: photo.caption, location: photo.location, takenAt: photo.takenAt })).sort((a, b) => a.id.localeCompare(b.id)) ?? [];
  const sections: { key: SeriesEditorSection; title: string; summary: string; dirty: boolean; body(): ReactNode }[] = [
    { key: "text", title: "系列文字", summary: `${narrative.chapters.length} 个章节 · ${narrative.intro.trim() ? "已有导语" : "未写导语"}${narrative.closing.trim() ? " · 已有收尾" : ""}`, dirty: !sameStudioValue(narrative, saved?.narrative ?? emptyNarrative()), body: text },
    { key: "layout", title: "图片排版", summary: series.layout ? `自定义排版 · ${series.layout.groups.length} 组` : "自动画册排版", dirty: !sameStudioValue(series.layout ?? null, saved?.layout ?? null) || !!series.draftPhotoOrder, body: layout },
    { key: "photos", title: "图片与标注", summary: `${series.photos.length} 张照片 · ${series.photos.filter(photo => photo.caption.trim()).length} 张有注释`, dirty: !sameStudioValue(photoFields(series), photoFields(saved)), body: photos },
  ];
  return <div className="series-editor-sections">
    <div className="series-section-tools" role="group" aria-label="系列编辑区域展开状态">
      <Button size="sm" variant="ghost" disabled={busy || sections.every(section => open[section.key])} onClick={() => onChange({ text: true, layout: true, photos: true })}>展开全部</Button>
      <Button size="sm" variant="ghost" disabled={busy || !sections.some(section => open[section.key])} onClick={() => onChange({})}>折叠全部</Button>
    </div>
    {sections.map(section => <section key={section.key} className="series-editor-section" data-series-section={section.key}>
      <h3><button id={`section-toggle-${section.key}-${series.id}`} className="series-section-toggle" type="button" disabled={busy} aria-expanded={!!open[section.key]} aria-controls={`section-body-${section.key}-${series.id}`} onClick={() => onChange({ ...open, [section.key]: !open[section.key] })}>
        {open[section.key] ? <ChevronDown size={18} aria-hidden="true"/> : <ChevronRight size={18} aria-hidden="true"/>}
        <span className="series-section-title">{section.title}<span className="series-section-summary">{section.summary}</span></span>
        {section.dirty && <span className="studio-unsaved">未保存</span>}
      </button></h3>
      <div id={`section-body-${section.key}-${series.id}`} className="series-section-body" role="region" aria-labelledby={`section-toggle-${section.key}-${series.id}`} hidden={!open[section.key]}>{open[section.key] && section.body()}</div>
    </section>)}
  </div>;
}
