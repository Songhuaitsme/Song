export type CompressionMode = "balanced" | "small" | "detail" | "original";
export type PreparedImage = { original: File; blob: Blob; width: number; height: number };

const profiles = {
  balanced: { edge: 2200, quality: .84, target: 800 * 1024 },
  small: { edge: 1600, quality: .78, target: 350 * 1024 },
  detail: { edge: 3000, quality: .90, target: 2 * 1024 * 1024 },
  original: { edge: 2200, quality: .86, target: 8 * 1024 * 1024 },
};

export function formatImageSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export async function prepareImageForUpload(file: File, mode: CompressionMode = "balanced"): Promise<PreparedImage> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("仅支持 JPEG、PNG 或 WebP 图片");
  if (!file.size) throw new Error("图片文件为空");
  if (file.size > 100 * 1024 * 1024) throw new Error("每张图片不能超过 100MB");
  if (mode === "original" && file.size > 25 * 1024 * 1024) throw new Error("保留原图时不能超过 25MB，请选择压缩上传");
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error("无法读取图片，请检查文件是否损坏"); }
  const canvas = document.createElement("canvas");
  try {
    const profile = profiles[mode];
    const scale = Math.min(1, profile.edge / Math.max(bitmap.width, bitmap.height));
    let width = Math.max(1, Math.round(bitmap.width * scale)), height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器无法处理图片");
    const encode = async (quality: number) => {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
        value => value ? resolve(value) : reject(new Error("图片处理失败")), "image/webp", quality,
      ));
      if (blob.type !== "image/webp") throw new Error("当前浏览器不支持 WebP 压缩，请更新浏览器后重试");
      return blob;
    };
    const draw = () => {
      canvas.width = width; canvas.height = height;
      context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, width, height);
    };
    draw();
    let blob = await encode(profile.quality);
    // Reduce quality modestly before reducing dimensions for unusually detailed images.
    if (mode !== "original" && blob.size > profile.target) blob = await encode(profile.quality - .08);
    for (let attempt = 0; blob.size > profile.target && attempt < 4; attempt++) {
      const ratio = Math.min(.85, Math.sqrt(profile.target / blob.size) * .95);
      width = Math.max(1, Math.round(width * ratio)); height = Math.max(1, Math.round(height * ratio));
      draw(); blob = await encode(mode === "original" ? profile.quality : profile.quality - .08);
    }
    if (!blob.size || blob.size > 8 * 1024 * 1024) throw new Error("图片压缩后仍然过大，请选择更小体积模式");
    // Avoid growing an already small source that fits the requested dimensions.
    if (mode === "original" || (file.size <= blob.size && bitmap.width === width && bitmap.height === height)) {
      return { original: file, blob, width, height };
    }
    const original = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp", lastModified: file.lastModified });
    return { original, blob: original, width, height };
  } finally {
    bitmap.close(); canvas.width = 0; canvas.height = 0;
  }
}

// Display-only callers explicitly retain the source file.
export async function resizeForWeb(file: File) {
  const { blob, width, height } = await prepareImageForUpload(file, "original");
  return { blob, width, height };
}
