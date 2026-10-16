"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Photo, Series, SiteContent } from "@/shared/content-model";
import { emptyNarrative, orderedChapters, type SeriesNarrative } from "@/shared/series-narrative";
import { layoutPhotos } from "@/shared/series-layout";
import type { ChapterResolution } from "@/backend/content/series-narrative-store";
import { SeriesStoryContent } from "./series-story-content";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";

const count = (text: string) => Array.from(text.trim()).length;

export function SeriesStoryPreview({ series, copy }: { series: Series; copy: SiteContent["copy"] }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [frameDocument, setFrameDocument] = useState<Document | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(1200);
  useEffect(() => {
    const element=viewport.current;if(!element)return;
    const observer=new ResizeObserver(entries=>setViewportWidth(entries[0].contentRect.width));observer.observe(element);return()=>observer.disconnect();
  }, []);
  const frameWidth=device==="mobile"?390:1200, scale=Math.min(1,Math.max(1,viewportWidth)/frameWidth);
  return <div className="series-story-preview">
    <div className="series-preview-tools" role="group" aria-label="预览设备">
      <Button size="sm" variant="outline" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>桌面</Button>
      <Button size="sm" variant="outline" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}>手机</Button>
      <span>预览包含未保存的输入，保存后才更新网站。</span>
    </div>
    <div ref={viewport} className="series-preview-viewport" style={{height:480,overflow:"hidden"}}>
      <iframe title="摄影系列图文预览" className="series-preview-frame" style={{ width: frameWidth, height:480/scale, transform:`scale(${scale})`,transformOrigin:"top left",margin:0 }} srcDoc={'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body></body></html>'} onLoad={event => {
        const frame = event.currentTarget.contentDocument;
        if (!frame) return;
        const base = frame.createElement("base"); base.href = document.baseURI; frame.head.appendChild(base);
        document.querySelectorAll('link[rel="stylesheet"],style').forEach(node => frame.head.appendChild(node.cloneNode(true)));
        const standards = document.documentElement.getAttribute("data-text-standards");
        if (standards) frame.documentElement.setAttribute("data-text-standards", standards);
        setFrameDocument(frame);
      }}/>
    </div>
    {frameDocument && createPortal(<main data-copy-page="story" className="story-editorial">
      <header className="story-hero">
        {series.coverUrl && <img className="story-hero-image" src={series.coverUrl} alt=""/>}<div className="story-hero-shade"/>
        <div className="story-hero-copy"><p className="eyebrow" data-text-page="story" data-text-role="overlayLabel">{copy.values.storyLabel}</p><h1 data-text-page="story" data-text-role="overlayTitle">{series.title}</h1><div className="story-hero-meta"><span data-text-page="story" data-text-role="overlayLabel">{String(series.photos.length).padStart(2, "0")} {copy.values.photographs}</span></div></div>
      </header>
      <SeriesStoryContent series={series} ledeLabel={copy.values.storyLede} labels={{ close: copy.values.photoClose, prev: copy.values.photoPrev, next: copy.values.photoNext }}/>
    </main>, frameDocument.body)}
  </div>;
}

export function SeriesNarrativeEditor({ series: originalSeries, copy, busy, onChange, onSave }: {
  series: Series; copy: SiteContent["copy"]; busy: boolean;
  onChange(narrative: SeriesNarrative): void; onSave(): void;
}) {
  const series={...originalSeries,photos:layoutPhotos(originalSeries.photos,originalSeries.layout,originalSeries.draftPhotoOrder)};
  const narrative = series.narrative ?? emptyNarrative();
  const [previewOpen, setPreviewOpen] = useState(false);
  const chapters = orderedChapters(narrative, series.photos);
  const available = series.photos.filter(photo => !chapters.some(chapter => chapter.beforePhotoId === photo.id));
  const addChapter = () => {
    const lastStart = Math.max(-1, ...chapters.map(chapter => series.photos.findIndex(photo => photo.id === chapter.beforePhotoId)));
    const start = available.find(photo => series.photos.indexOf(photo) > lastStart) ?? available[0];
    if (!start) return;
    const id = crypto.randomUUID();
    onChange({ ...narrative, chapters: [...narrative.chapters, { id, beforePhotoId: start.id, title: "", body: "" }] });
    requestAnimationFrame(() => { const element = document.getElementById(`chapter-${id}`); element?.scrollIntoView({ block: "nearest" }); element?.querySelector("input")?.focus({ preventScroll: true }); });
  };
  const update = (id: string, patch: Partial<SeriesNarrative["chapters"][number]>) => onChange({ ...narrative, chapters: narrative.chapters.map(chapter => chapter.id === id ? { ...chapter, ...patch } : chapter) });
  return <section className="series-narrative-editor" id={`series-text-${series.id}`} aria-label="系列文字">
    <div className="series-writing-heading"><div><h3>系列文字</h3><p>用导语提出关注点，用章节串联照片，单张注释按需补充。</p></div><Button disabled={busy} onClick={onSave}>{busy ? "正在保存…" : "保存系列文字"}</Button></div>
    <details className="series-writing-guide"><summary>写作提示 · 纪实与思考</summary>
      <p>具体观察：哪个细节让你停下来？现场背景：画面之外发生了什么？拍摄选择：为什么站在这里、保留这个瞬间？个人理解：这些照片如何改变了你的看法？</p>
      <p>以真实记忆和观察为依据，可以留下不确定性。导语建议 100～250 字，章节每段 60～180 字，精选注释 20～80 字，收尾 50～150 字；这些是写作参考，可以留空。</p>
    </details>
    <fieldset disabled={busy} className="series-writing-fields">
      <label htmlFor={`intro-${series.id}`}>系列导语<span className="series-writing-hint">讲清这组照片的关注点与观看线索 · {count(narrative.intro)} 字</span></label>
      <Textarea id={`intro-${series.id}`} value={narrative.intro} maxLength={10000} onChange={event => onChange({ ...narrative, intro: event.target.value })} placeholder="可选。为空时，详情页继续使用系列短简介。"/>
      <div className="series-writing-heading"><h4>章节</h4><Button variant="outline" disabled={!available.length || chapters.length >= 100} onClick={addChapter}>添加章节</Button></div>
      {!series.photos.length && <p className="series-writing-hint">上传照片后，可以选择章节的起始位置。</p>}
      {!chapters.length && !!series.photos.length && <p className="series-writing-hint">可以让一段文字串联几张照片，无需逐张填写注释。</p>}
      <div className="series-chapter-editors">{chapters.map((chapter, index) => {
        const photo = series.photos.find(photo => photo.id === chapter.beforePhotoId);
        return <article className="series-chapter-editor" id={`chapter-${chapter.id}`} key={chapter.id}>
          <div className="series-writing-heading"><h4>章节 {String(index + 1).padStart(2, "0")}</h4><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="sm">删除章节</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除这个章节？</AlertDialogTitle><AlertDialogDescription>移除章节标题和正文，保留照片。点击保存系列文字后生效。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={() => onChange({ ...narrative, chapters: narrative.chapters.filter(item => item.id !== chapter.id) })}>删除章节</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
          <div className="series-chapter-anchor">{photo && <img src={photo.imageUrl} alt="选中的章节起始照片" loading="lazy"/>}<label>从哪张照片开始<NativeSelect aria-label={`章节${index + 1}起始照片`} value={chapter.beforePhotoId} onChange={event => update(chapter.id, { beforePhotoId: event.target.value })}><NativeSelectOption value="" disabled>选择起始照片</NativeSelectOption>{series.photos.map((photo, photoIndex) => <NativeSelectOption key={photo.id} value={photo.id} disabled={chapters.some(other => other.id !== chapter.id && other.beforePhotoId === photo.id)}>第 {String(photoIndex + 1).padStart(2, "0")} 张 · {photo.alt || "摄影作品"}</NativeSelectOption>)}</NativeSelect></label></div>
          <label>章节标题<Input aria-label={`章节${index + 1}标题`} value={chapter.title} maxLength={200} onChange={event => update(chapter.id, { title: event.target.value })} placeholder="可选，提炼这一组照片的关注点"/></label>
          <label>章节正文<span className="series-writing-hint">{count(chapter.body)} 字 · 使用空行分段</span><Textarea aria-label={`章节${index + 1}正文`} value={chapter.body} maxLength={10000} onChange={event => update(chapter.id, { body: event.target.value })} placeholder="从一个具体观察出发，连接现场背景、拍摄选择与个人思考。"/></label>
        </article>;
      })}</div>
      <label htmlFor={`closing-${series.id}`}>系列收尾<span className="series-writing-hint">回应开头，或留下仍在思考的事情 · {count(narrative.closing)} 字</span></label>
      <Textarea id={`closing-${series.id}`} value={narrative.closing} maxLength={10000} onChange={event => onChange({ ...narrative, closing: event.target.value })} placeholder="可选。没有填写时，不显示收尾区域。"/>
    </fieldset>
    <details className="series-writing-preview" onToggle={event => setPreviewOpen(event.currentTarget.open)}><summary>图文预览</summary>{previewOpen && <SeriesStoryPreview series={series} copy={copy}/>}</details>
  </section>;
}

export function SeriesPhotoDelete({ series, photo, busy, narrativeDirty, onConfirm }: {
  series: Series; photo: Photo; busy: boolean; narrativeDirty: boolean;
  onConfirm(resolution?: ChapterResolution): Promise<boolean>;
}) {
  const [open, setOpen] = useState(false), [mode, setMode] = useState("move"), [replacement, setReplacement] = useState("");
  const chapters = series.narrative?.chapters ?? [], anchored = chapters.find(chapter => chapter.beforePhotoId === photo.id);
  const candidates = series.photos.filter(item => item.id !== photo.id && !chapters.some(chapter => chapter.beforePhotoId === item.id));
  return <AlertDialog open={open} onOpenChange={value => { if (busy) return; if (value) { setMode(candidates.length ? "move" : "delete"); setReplacement(candidates[0]?.id ?? ""); } setOpen(value); }}>
    <AlertDialogTrigger asChild><Button variant="ghost" size="sm" disabled={busy || narrativeDirty} title={narrativeDirty ? "请先保存系列文字和排版，再删除照片" : undefined} aria-label="删除照片">删除照片</Button></AlertDialogTrigger>
    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{anchored ? "这张照片是章节起点" : "确认删除照片？"}</AlertDialogTitle><AlertDialogDescription>{anchored ? `章节“${anchored.title || "未命名章节"}”从这张照片开始。请选择新的起始照片，或明确删除该章节。` : "删除照片后无法从网站后台恢复。"}</AlertDialogDescription></AlertDialogHeader>
      {anchored && <div className="series-photo-delete-resolution"><label>章节处理方式<NativeSelect aria-label="章节处理方式" value={mode} onChange={event => setMode(event.target.value)}>{!!candidates.length && <NativeSelectOption value="move">保留章节，选择新的起始照片</NativeSelectOption>}<NativeSelectOption value="delete">同时删除这个章节的标题与正文</NativeSelectOption></NativeSelect></label>{mode === "move" && <label>新的起始照片<NativeSelect aria-label="新的章节起始照片" value={replacement} onChange={event => setReplacement(event.target.value)}>{candidates.map(item => <NativeSelectOption value={item.id} key={item.id}>第 {series.photos.findIndex(photo => photo.id === item.id) + 1} 张 · {item.alt || "摄影作品"}</NativeSelectOption>)}</NativeSelect></label>}</div>}
      <AlertDialogFooter><AlertDialogCancel disabled={busy}>取消</AlertDialogCancel><AlertDialogAction disabled={busy || (!!anchored && mode === "move" && !replacement)} onClick={async event => { event.preventDefault(); const ok = await onConfirm(anchored ? { beforePhotoId: mode === "delete" ? null : replacement, version: series.version } : undefined); if (ok) setOpen(false); }}>{busy ? "正在删除…" : anchored && mode === "delete" ? "删除照片及章节" : "删除照片"}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
