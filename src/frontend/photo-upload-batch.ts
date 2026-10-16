import type { Photo } from "@/shared/content-model";
import type { UploadedMedia } from "@/frontend/upload-media";

export type PhotoUploadItem = {
  id: string;
  file: File;
  state: "waiting" | "processing" | "uploading" | "saving" | "done" | "error";
  progress: number;
  error?: string;
  order?: number;
  photo?: Photo;
  preparedSize?: number;
};
type DisplayImage = { blob: Blob; width: number; height: number; original?: File };

export async function uploadPhotoBatch(items: PhotoUploadItem[], options: {
  seriesId: string;
  startOrder: number;
  prepare(file: File): Promise<DisplayImage>;
  upload(file: File, display: DisplayImage, onProgress: (progress: number) => void): Promise<UploadedMedia>;
  save(photo: Photo): Promise<unknown>;
  onChange(item: PhotoUploadItem): void;
  onSaved(photo: Photo): void;
}): Promise<PhotoUploadItem[]> {
  const results: PhotoUploadItem[] = [];
  // Process one image at a time to bound decoding memory and preserve selection order.
  for (const [index, source] of items.entries()) {
    if (source.state === "done") { results.push(source); continue; }
    const item: PhotoUploadItem = { ...source, order: source.order ?? options.startOrder + index + 1, error: undefined };
    const update = (state: PhotoUploadItem["state"], progress: number) => {
      item.state = state; item.progress = progress; options.onChange({ ...item });
    };
    try {
      if (!item.photo) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(item.file.type)) throw new Error("仅支持 JPEG、PNG 或 WebP 图片");
        if (!item.file.size) throw new Error("图片文件为空");
        if (item.file.size > 100 * 1024 * 1024) throw new Error("每张图片不能超过 100MB");
        update("processing", 5);
        const display = await options.prepare(item.file);
        item.preparedSize = (display.original ?? item.file).size;
        update("uploading", 10);
        const media = await options.upload(display.original ?? item.file, display, progress => update("uploading", 10 + Math.round(progress * 80)));
        item.photo = {
          id: item.id, seriesId: options.seriesId, imageUrl: media.imageUrl, originalUrl: media.originalUrl,
          width: display.width, height: display.height, alt: item.file.name.replace(/\.[^.]+$/, "").slice(0, 500) || "摄影作品",
          caption: "", location: "", takenAt: "", sortOrder: item.order!,
        };
      }
      // Keep the uploaded URLs and stable photo ID if saving fails: retry does not upload again.
      update("saving", 95);
      await options.save(item.photo);
      options.onSaved(item.photo);
      update("done", 100);
    } catch (error) {
      item.error = error instanceof Error ? error.message : "上传失败，请重试";
      update("error", item.progress);
    }
    results.push({ ...item });
  }
  return results;
}
