"use client";
import type { CSSProperties } from "react";
import type { Photo } from "@/shared/content-model";
import { isMosaic, type LayoutGroup, type LayoutImage } from "@/shared/series-layout";
import { EditableText } from "./editable-text";

type Item = { photo: Photo; index: number; aspectRatio: number; frame: LayoutImage };
type Editor = { enabled: boolean; csrf: string };
function Caption({ photo, index, editor }: { photo: Photo; index: number; editor?: Editor }) {
  return <>
    {(photo.caption.trim() || editor?.enabled) && <p className="story-photo-caption" data-text-page="story" data-text-role="caption"><EditableText textPage="story" textRole="caption" value={photo.caption || "添加照片说明"} editValue={photo.caption} field="caption" entity="photo" id={photo.id} enabled={editor?.enabled ?? false} csrf={editor?.csrf ?? ""}/></p>}
    <div className="story-photo-meta" data-text-page="story" data-text-role="label"><span className="story-photo-index" data-text-page="story" data-text-role="label">{String(index + 1).padStart(2, "0")}</span>{(photo.location || photo.takenAt) && <span data-text-page="story" data-text-role="label">{[photo.location, photo.takenAt].filter(Boolean).join(" · ")}</span>}</div>
  </>;
}
export function StoryLayoutGroup({ group, items, editor, onOpen }: { group: LayoutGroup; items: Item[]; editor?: Editor; onOpen(index: number): void }) {
  const mosaic = isMosaic(group.template), fixedPair = group.template === "left-wide" || group.template === "right-wide";
  const columns = group.template === "left-wide" || group.template === "large-left" ? "2fr 1fr" : group.template === "right-wide" || group.template === "large-right" ? "1fr 2fr" : group.template === "quad" ? "1fr 1fr" : items.map(item => `${item.aspectRatio}fr`).join(" ");
  return <div className={`story-layout-block layout-${group.template} layout-gap-${group.gap}${mosaic ? " layout-mosaic" : ""}${fixedPair ? " layout-fixed-pair" : ""}`} data-layout-group={group.id} style={{"--layout-columns": columns} as CSSProperties}>
    <div className="story-layout-visual">{items.map(({ photo, index, aspectRatio, frame }, slot) => <figure className="story-photo" key={photo.id} data-layout-slot={slot + 1}>
      <button className="story-image-button" type="button" onClick={() => onOpen(index)} aria-haspopup="dialog" aria-label={`全屏查看第 ${index + 1} 张照片：${photo.alt}`} style={{"--photo-ratio": aspectRatio, "--frame-fit": frame.fit, "--frame-position": `${frame.x}% ${frame.y}%`} as CSSProperties}>
        <img src={photo.imageUrl} width={photo.width > 0 ? photo.width : undefined} height={photo.height > 0 ? photo.height : undefined} alt={photo.alt} loading={index < 2 ? "eager" : "lazy"} decoding="async"/>
      </button>
      <figcaption><Caption photo={photo} index={index} editor={editor}/></figcaption>
    </figure>)}</div>
    {mosaic && <div className="story-layout-captions" aria-label="本组照片说明">{items.map(item => <div key={item.photo.id} className="story-layout-caption"><Caption photo={item.photo} index={item.index} editor={editor}/></div>)}</div>}
  </div>;
}
