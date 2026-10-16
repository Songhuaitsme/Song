export type SeriesChapter = { id: string; beforePhotoId: string; title: string; body: string };
export type SeriesNarrative = { intro: string; chapters: SeriesChapter[]; closing: string };

export function emptyNarrative(): SeriesNarrative { return { intro: "", chapters: [], closing: "" }; }

export function validateNarrative(value: unknown): SeriesNarrative {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("系列文字格式无效");
  const input = value as Record<string, unknown>;
  const text = (v: unknown, label: string, max: number) => {
    if (v === undefined) return "";
    if (typeof v !== "string") throw new Error(`${label}必须是文字`);
    if (v.length > max) throw new Error(`${label}超过 ${max} 字的保存上限`);
    return v.trim();
  };
  const chapters = input.chapters ?? [];
  if (!Array.isArray(chapters) || chapters.length > 100) throw new Error("每个系列最多保存 100 个章节");
  const ids = new Set<string>(), anchors = new Set<string>();
  const result = {
    intro: text(input.intro, "系列导语", 10000),
    closing: text(input.closing, "系列收尾", 10000),
    chapters: chapters.map((item): SeriesChapter => {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("章节格式无效");
      const id = text(item.id, "章节标识", 160), beforePhotoId = text(item.beforePhotoId, "起始照片", 160);
      if (!id || !beforePhotoId) throw new Error("请为每个章节选择起始照片");
      if (ids.has(id) || anchors.has(beforePhotoId)) throw new Error("章节标识及起始照片不能重复");
      ids.add(id); anchors.add(beforePhotoId);
      return { id, beforePhotoId, title: text(item.title, "章节标题", 200), body: text(item.body, "章节正文", 10000) };
    }),
  };
  if (JSON.stringify(result).length > 250000) throw new Error("系列文字总量过大，请拆分系列");
  return result;
}

export function readNarrative(value: unknown): SeriesNarrative {
  if (value == null || value === "") return emptyNarrative();
  return validateNarrative(typeof value === "string" ? JSON.parse(value) : value);
}

export function orderedChapters(narrative: SeriesNarrative | undefined, photos: readonly { id: string }[]) {
  const order = new Map(photos.map((photo, index) => [photo.id, index]));
  return [...(narrative?.chapters ?? [])].sort((a, b) => (order.get(a.beforePhotoId) ?? Infinity) - (order.get(b.beforePhotoId) ?? Infinity));
}

export function resolveChapterAnchor(narrative: SeriesNarrative, photoId: string, replacementId: string | null): SeriesNarrative {
  return { ...narrative, chapters: narrative.chapters.flatMap(chapter => chapter.beforePhotoId !== photoId ? [chapter] : replacementId === null ? [] : [{ ...chapter, beforePhotoId: replacementId }]) };
}
