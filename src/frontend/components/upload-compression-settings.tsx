"use client";

import type { CompressionMode } from "@/frontend/resize-image";
import { NativeSelect, NativeSelectOption } from "@/frontend/components/ui/native-select";

const hints: Record<CompressionMode, string> = {
  balanced: "最长边 2200 像素，目标 800 KB 以内，适合网页展示。",
  small: "最长边 1600 像素，目标 350 KB 以内，适合大量上传。",
  detail: "最长边 3000 像素，目标 2 MB 以内，保留更多细节。",
  original: "上传完整原图，并另外生成展示图；每张原图最多 25 MB，上传会更久。",
};

export function UploadCompressionSettings({ value, onChange, disabled }: {
  value: CompressionMode; onChange(value: CompressionMode): void; disabled: boolean;
}) {
  return <section className="upload-compression-settings" aria-label="图片上传设置">
    <label><span>图片上传方式</span><NativeSelect value={value} disabled={disabled} onChange={event => onChange(event.target.value as CompressionMode)} aria-label="图片上传方式">
      <NativeSelectOption value="balanced">均衡压缩（推荐）</NativeSelectOption>
      <NativeSelectOption value="small">更小体积 · 上传更快</NativeSelectOption>
      <NativeSelectOption value="detail">更多细节</NativeSelectOption>
      <NativeSelectOption value="original">保留原图</NativeSelectOption>
    </NativeSelect></label>
    <p>{hints[value]}{value !== "original" && "仅上传处理后的图片，电脑里的原文件会保留。"}适用于摄影、随笔和媒体库。</p>
  </section>;
}
