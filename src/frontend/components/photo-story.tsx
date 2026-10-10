"use client";
import { EditableText } from "@/frontend/components/editable-text";
import { useEffect, useRef, useState } from "react";
import type { Photo } from "@/shared/content-model";

export function PhotoStory({ photos, editor, labels = {close:"关闭",prev:"上一张",next:"下一张"} }: { photos: Photo[]; editor?:{enabled:boolean;csrf:string}; labels?: {close:string;prev:string;next:string} }) {
  const [active, setActive] = useState<number | null>(null);
  const touchStart = useRef<number | null>(null);
  useEffect(() => {
    if (active === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(null);
      if (event.key === "ArrowRight") setActive((active + 1) % photos.length);
      if (event.key === "ArrowLeft") setActive((active - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [active, photos.length]);
  const finishSwipe = (x: number) => {
    if (active === null || touchStart.current === null) return;
    const delta = x - touchStart.current;
    if (Math.abs(delta) > 48) setActive(delta < 0 ? (active + 1) % photos.length : (active - 1 + photos.length) % photos.length);
    touchStart.current = null;
  };
  return <>
    <div className="photo-story">{photos.map((photo, index) => <figure key={photo.id} className={`story-photo ${photo.height > photo.width ? "story-photo-portrait" : "story-photo-wide"}`}>
      <button className="story-image-button" onClick={() => setActive(index)} aria-label={`全屏查看第 ${index + 1} 张照片：${photo.alt}`}><img src={photo.imageUrl} width={photo.width} height={photo.height} alt={photo.alt} loading={index < 2 ? "eager" : "lazy"} /></button>
      <figcaption><span>{String(index + 1).padStart(2,"0")}</span><p><EditableText value={photo.caption} field="caption" entity="photo" id={photo.id} enabled={editor?.enabled??false} csrf={editor?.csrf??""}/></p><small>{photo.location}{photo.takenAt ? ` · ${photo.takenAt}` : ""}</small></figcaption>
    </figure>)}</div>
    {active !== null && <div className="lightbox" role="dialog" aria-modal="true" aria-label="照片全屏查看" onPointerDown={(e)=>touchStart.current=e.clientX} onPointerUp={(e)=>finishSwipe(e.clientX)}>
      <button className="lightbox-close" onClick={()=>setActive(null)} aria-label="关闭全屏查看">{labels.close || "×"}</button>
      <button className="lightbox-prev" onClick={()=>setActive((active-1+photos.length)%photos.length)} aria-label="上一张">{labels.prev || "‹"}</button>
      <img src={photos[active].imageUrl} alt={photos[active].alt} />
      <button className="lightbox-next" onClick={()=>setActive((active+1)%photos.length)} aria-label="下一张">{labels.next || "›"}</button>
      <p>{String(active+1).padStart(2,"0")} / {String(photos.length).padStart(2,"0")} · {photos[active].caption}</p>
    </div>}
  </>;
}
