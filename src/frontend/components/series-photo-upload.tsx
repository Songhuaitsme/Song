"use client";

import { useRef, useState } from "react";
import { Check, ImagePlus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { Photo, Series, SiteContent } from "@/shared/content-model";
import { uploadMediaMultipart } from "@/frontend/upload-media";
import { prepareImageForUpload, formatImageSize, type CompressionMode } from "@/frontend/resize-image";
import { uploadPhotoBatch, type PhotoUploadItem } from "@/frontend/photo-upload-batch";
import { Button } from "@/frontend/components/ui/button";

const labels: Record<PhotoUploadItem["state"], string> = {
  waiting: "等待上传", processing: "正在处理", uploading: "正在上传", saving: "正在保存", done: "已加入系列", error: "未完成",
};

export function SeriesPhotoUpload({ series, csrfToken, busy, compressionMode, onBusyChange, onPhotoAdded, onCoverChange, onSeriesSaved }: {
  series: Series;
  csrfToken: string;
  busy: boolean;
  compressionMode: CompressionMode;
  onBusyChange(value: boolean): void;
  onPhotoAdded(photo: Photo): void;
  onCoverChange(url: string): void;
  onSeriesSaved?(series: Series): void;
}) {
  const [items, setItems] = useState<PhotoUploadItem[]>([]);
  const [running, setRunning] = useState(false);
  const [batchError, setBatchError] = useState("");
  const lock = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const done = items.filter(item => item.state === "done").length;
  const failed = items.filter(item => item.state === "error").length;

  async function save(entity: "series" | "photo", record: Series | Photo) {
    const response = await fetch("/api/studio", {
      method: "POST", headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify({ action: "upsert", entity, record }),
    });
    const body = await response.json() as { error?: string };
    if (!response.ok) throw new Error(body.error || "保存失败，请重试");
  }

  async function run(queue: PhotoUploadItem[]) {
    if (lock.current || busy) return;
    lock.current = true; setRunning(true); onBusyChange(true); setBatchError("");
    try {
      const response = await fetch("/api/studio", { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 403 ? "登录已过期，请重新登录工作室" : "无法读取系列，请重试");
      const latest = await response.json() as SiteContent;
      let savedSeries = latest.series.find(item => item.id === series.id);
      if (!savedSeries) {
        // New series must exist before its photos are inserted.
        await save("series", series);
        savedSeries = series;
        onSeriesSaved?.(series);
      }
      const startOrder = Math.max(0, ...savedSeries.photos.map(photo => photo.sortOrder), ...series.photos.map(photo => photo.sortOrder));
      const results = await uploadPhotoBatch(queue, {
        seriesId: series.id, startOrder, prepare: file => prepareImageForUpload(file, compressionMode),
        upload: (file, display, onProgress) => uploadMediaMultipart({
          original: file, display: display.blob, width: display.width, height: display.height,
          csrfToken, assignment: `series:${series.id}`, onProgress,
        }),
        save: photo => save("photo", photo),
        onChange: changed => setItems(current => current.map(item => item.id === changed.id ? changed : item)),
        onSaved: onPhotoAdded,
      });
      const added = results.filter(item => item.state === "done");
      const firstPhoto = added[0]?.photo;
      if (!savedSeries.coverUrl && firstPhoto) {
        try { await save("series", { ...savedSeries, coverUrl: firstPhoto.imageUrl }); onCoverChange(firstPhoto.imageUrl); }
        catch { setBatchError("照片已保存，但封面未能更新；可以在照片旁点击“设为封面”。"); }
      }
      const errors = results.filter(item => item.state === "error").length;
      if (errors) toast.error(`已加入 ${added.length} 张，${errors} 张未完成，可重试失败项`);
      else toast.success(`已加入 ${added.length} 张照片`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "上传失败，请重试";
      setItems(current => current.map(item => queue.some(queued => queued.id === item.id) && item.state !== "done" ? { ...item, state: "error", error: message } : item));
      setBatchError(message); toast.error(message);
    } finally { lock.current = false; setRunning(false); onBusyChange(false); }
  }

  function chooseFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length || lock.current || busy) return;
    const queue = files.map(file => ({ id: crypto.randomUUID(), file, state: "waiting" as const, progress: 0 }));
    setItems(queue); void run(queue);
  }

  return <section className="series-photo-upload" aria-label={`${series.title}的批量上传`} aria-busy={running}>
    <div className="batch-upload-heading">
      <div><h3>添加摄影作品</h3><p>一次选择多张，按选择顺序追加。支持 JPEG、PNG、WebP，每张最多 {compressionMode === "original" ? "25" : "100"}MB；使用上方选择的图片上传方式。</p></div>
      <Button variant="outline" disabled={busy || running} onClick={() => input.current?.click()}><ImagePlus/>{running ? "正在上传…" : "批量上传照片"}</Button>
      <input ref={input} className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy || running} onChange={chooseFiles} aria-label="选择系列照片（可多选）"/>
    </div>
    {items.length > 0 && <>
      <div className="batch-upload-summary">
        <p role="status" aria-live="polite">{running ? `正在处理 · 已加入 ${done} / ${items.length} 张` : `已加入 ${done} 张${failed ? ` · ${failed} 张未完成` : " · 上传完成"}`}</p>
        {failed > 0 && !running && <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(items.filter(item => item.state === "error"))}><RotateCcw/>重试失败项</Button>}
      </div>
      <ol className="batch-upload-list">
        {items.map(item => <li key={item.id} data-state={item.state}>
          <div className="batch-file-info"><span className="batch-file-name" title={item.file.name}>{item.file.name}</span><span className="batch-file-status">{item.state === "done" && <Check size={14} aria-hidden="true"/>}{labels[item.state]}</span></div>
          {item.preparedSize !== undefined && <p className="batch-file-size">图片体积：{formatImageSize(item.file.size)} → {formatImageSize(item.preparedSize)}{item.preparedSize < item.file.size && ` · 减少 ${Math.round((1 - item.preparedSize / item.file.size) * 100)}%`}</p>}
          <progress value={item.progress} max={100} aria-label={`${item.file.name}上传进度`}/>
          {item.error && <p className="batch-file-error">{item.error}</p>}
        </li>)}
      </ol>
    </>}
    {batchError && <p className="batch-file-error" role="alert">{batchError}</p>}
  </section>;
}
