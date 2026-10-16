"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { EditableText } from "@/frontend/components/editable-text";
import type { Photo } from "@/shared/content-model";
import type { SeriesChapter } from "@/shared/series-narrative";
import { buildPhotoStorySections } from "@/shared/photo-story-layout";

type Props = {
  photos: Photo[];
  chapters?: SeriesChapter[];
  seriesId?: string;
  editor?: { enabled: boolean; csrf: string };
  labels?: { close: string; prev: string; next: string };
};

export function PhotoStory({ photos, chapters, seriesId, editor, labels = { close: "关闭", prev: "上一张", next: "下一张" } }: Props) {
  const sections = useMemo(() => buildPhotoStorySections(photos, chapters), [photos, chapters]);
  const [active, setActive] = useState<number | null>(null);
  const touchStart = useRef<number | null>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const activePhoto = active === null ? undefined : photos[active];
  const isOpen = !!activePhoto;

  useEffect(() => {
    if (!isOpen) return;
    const ownerDocument = lightboxRef.current?.ownerDocument ?? document;
    const ownerWindow = ownerDocument.defaultView ?? window;
    const trigger = ownerDocument.activeElement as HTMLElement | null;
    const previousOverflow = ownerDocument.body.style.overflow;
    const onKey = (event: KeyboardEvent) => {
      if (["Escape", "ArrowRight", "ArrowLeft"].includes(event.key)) event.preventDefault();
      if (event.key === "Escape") setActive(null);
      if (event.key === "ArrowRight") setActive(index => index === null ? null : (index + 1) % photos.length);
      if (event.key === "ArrowLeft") setActive(index => index === null ? null : (index - 1 + photos.length) % photos.length);
      if (event.key === "Tab") {
        const buttons = lightboxRef.current?.querySelectorAll<HTMLButtonElement>("button");
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && ownerDocument.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && ownerDocument.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    ownerWindow.addEventListener("keydown", onKey);
    ownerDocument.body.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      ownerWindow.removeEventListener("keydown", onKey);
      ownerDocument.body.style.overflow = previousOverflow;
      trigger?.focus({ preventScroll: true });
    };
  }, [isOpen, photos.length]);

  const finishSwipe = (x: number) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (active === null || start === null) return;
    const delta = x - start;
    if (Math.abs(delta) > 48) setActive(delta < 0 ? (active + 1) % photos.length : (active - 1 + photos.length) % photos.length);
  };

  return <>
    <div className="photo-story" data-series-id={seriesId}>
      {sections.map((section, sectionIndex) => <section className="story-photo-section" key={section.rows[0].items[0].photo.id}>
        {section.chapter && <header className="story-chapter" id={`chapter-${section.chapter.id}`}>
          <div className="story-chapter-heading">
            <p data-text-page="story" data-text-role="label">CHAPTER {String(sections.slice(0, sectionIndex + 1).filter(item => item.chapter).length).padStart(2, "0")}</p>
            {section.chapter.title.trim() && <h2 className="story-chapter-title" data-text-page="story" data-text-role="sectionTitle">{section.chapter.title}</h2>}
            {editor?.enabled && <a className="story-writing-link" data-text-page="story" data-text-role="link" href={`/studio?tab=series#chapter-${section.chapter.id}`}>编辑章节</a>}
          </div>
          {section.chapter.body.trim() && <div className="story-prose">{section.chapter.body.split(/\n\s*\n/).map((paragraph, index) => <p key={index} data-text-page="story" data-text-role="body">{paragraph}</p>)}</div>}
        </header>}
        <div className="story-section-rows">{section.rows.map(row => <div
        key={row.items[0].photo.id}
        className={`story-photo-row story-photo-row-${row.kind}`}
        style={{ "--story-columns": row.items.map(item => `minmax(0, ${item.aspectRatio}fr)`).join(" ") } as CSSProperties}
      >
        {row.items.map(({ photo, index, aspectRatio }) => <figure key={photo.id} className="story-photo">
          <button
            type="button"
            className="story-image-button"
            style={{ aspectRatio }}
            onClick={() => setActive(index)}
            aria-label={`全屏查看第 ${index + 1} 张照片：${photo.alt}`}
            aria-haspopup="dialog"
          >
            <img src={photo.imageUrl} width={photo.width > 0 ? photo.width : undefined} height={photo.height > 0 ? photo.height : undefined} alt={photo.alt} loading={index < 2 ? "eager" : "lazy"} decoding="async"/>
          </button>
          <figcaption>
            {(photo.caption.trim() || editor?.enabled) && <p className="story-photo-caption" data-text-page="story" data-text-role="caption">
              <EditableText textPage="story" textRole="caption" value={photo.caption || "添加照片说明"} editValue={photo.caption} field="caption" entity="photo" id={photo.id} enabled={editor?.enabled ?? false} csrf={editor?.csrf ?? ""}/>
            </p>}
            <div className="story-photo-meta" data-text-page="story" data-text-role="label">
              <span className="story-photo-index" data-text-page="story" data-text-role="label">{String(index + 1).padStart(2, "0")}</span>
              {(photo.location || photo.takenAt) && <span data-text-page="story" data-text-role="label">{[photo.location, photo.takenAt].filter(Boolean).join(" · ")}</span>}
            </div>
          </figcaption>
        </figure>)}
      </div>)}</div>
      </section>)}
    </div>
    {activePhoto && <div ref={lightboxRef} className="lightbox" role="dialog" aria-modal="true" aria-label="照片全屏查看" onPointerDown={event => { touchStart.current = event.clientX; }} onPointerUp={event => finishSwipe(event.clientX)} onPointerCancel={() => { touchStart.current = null; }}>
      <button ref={closeRef} type="button" data-text-page="story" data-text-role="overlayLink" className="lightbox-close" onClick={() => setActive(null)} aria-label="关闭全屏查看">{labels.close || "×"}</button>
      <button type="button" data-text-page="story" data-text-role="overlayLink" className="lightbox-prev" onClick={() => setActive(index => index === null ? null : (index - 1 + photos.length) % photos.length)} aria-label="上一张">{labels.prev || "‹"}</button>
      <img src={activePhoto.imageUrl} alt={activePhoto.alt} draggable={false}/>
      <button type="button" data-text-page="story" data-text-role="overlayLink" className="lightbox-next" onClick={() => setActive(index => index === null ? null : (index + 1) % photos.length)} aria-label="下一张">{labels.next || "›"}</button>
      <p data-text-page="story" data-text-role="overlaySummary">{String(active! + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}{activePhoto.caption ? ` · ${activePhoto.caption}` : ""}</p>
    </div>}
  </>;
}
