import { buildPhotoStorySections, photoAspectRatio } from "@/shared/photo-story-layout";
import type { SeriesChapter } from "./series-narrative";

export const layoutTemplates = [
  { id: "wide", label: "通栏大图", count: 1 },
  { id: "narrow", label: "居中窄幅", count: 1 },
  { id: "pair", label: "双图等高", count: 2 },
  { id: "left-wide", label: "左宽右窄", count: 2 },
  { id: "right-wide", label: "左窄右宽", count: 2 },
  { id: "triple", label: "三图等高", count: 3 },
  { id: "large-left", label: "左大右两小", count: 3 },
  { id: "large-right", label: "左两小右大", count: 3 },
  { id: "quad", label: "两行两列", count: 4 },
] as const;
export type LayoutTemplate = typeof layoutTemplates[number]["id"];
export type LayoutImage = { photoId: string; fit: "contain" | "cover"; x: number; y: number };
export type LayoutGroup = { id: string; template: LayoutTemplate; gap: "space" | "seamless"; widthPercent?: number; items: LayoutImage[] };
export type SeriesLayout = { version: 1; groups: LayoutGroup[] };
export class LayoutInputError extends Error { status = 400; }
type LayoutPhoto = { id: string; width: number; height: number };
export const layoutImage = (photoId: string): LayoutImage => ({ photoId, fit: "contain", x: 50, y: 50 });
export const layoutIds = (layout: SeriesLayout) => layout.groups.flatMap(group => group.items.map(item => item.photoId));
export const isMosaic = (template: LayoutTemplate) => ["large-left", "large-right", "quad"].includes(template);
export function defaultTemplate(photos: readonly LayoutPhoto[]): LayoutTemplate {
  return photos.length === 1 ? photoAspectRatio(photos[0]) < 1 ? "narrow" : "wide" : photos.length === 2 ? "pair" : photos.length === 3 ? "triple" : "quad";
}
export function readLayout(value: unknown): SeriesLayout | null {
  if (value == null || value === "" || value === "null") return null;
  return validateLayout(typeof value === "string" ? JSON.parse(value) : value);
}
export function validateLayout(value: unknown): SeriesLayout | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new LayoutInputError("图片排版格式无效");
  const input = value as SeriesLayout;
  if (input.version !== 1 || !Array.isArray(input.groups) || input.groups.length > 5000) throw new LayoutInputError("图片排版版本或分组数量无效");
  const groupIds = new Set<string>(), photoIds = new Set<string>();
  const identifier = (id: unknown) => typeof id === "string" && id.length > 0 && id.length <= 160;
  const groups = input.groups.map((group): LayoutGroup => {
    if (!group || !identifier(group.id) || groupIds.has(group.id)) throw new LayoutInputError("图片组标识无效或重复");
    groupIds.add(group.id);
    const template = layoutTemplates.find(item => item.id === group.template);
    if (!template || !Array.isArray(group.items) || group.items.length !== template.count || !["space", "seamless"].includes(group.gap)) throw new LayoutInputError("模板、照片数量或间距不匹配");
    if (group.widthPercent !== undefined && (!Number.isInteger(group.widthPercent) || group.widthPercent < 25 || group.widthPercent > 100)) throw new LayoutInputError("组图展示宽度必须是 25～100 的整数百分比");
    const items = group.items.map((item): LayoutImage => {
      if (!item || !identifier(item.photoId) || photoIds.has(item.photoId)) throw new LayoutInputError("排版包含重复或无效的照片");
      photoIds.add(item.photoId);
      if (!["contain", "cover"].includes(item.fit) || !Number.isFinite(item.x) || !Number.isFinite(item.y) || item.x < 0 || item.x > 100 || item.y < 0 || item.y > 100) throw new LayoutInputError("照片显示方式或取景位置无效");
      return { photoId: item.photoId, fit: item.fit, x: item.x, y: item.y };
    });
    return { id: group.id, template: group.template, gap: group.gap, ...(group.widthPercent === undefined ? {} : { widthPercent: group.widthPercent }), items };
  });
  return { version: 1, groups };
}
/** Strict save/sync invariant: every live photo exactly once, and no chapter crosses a group. */
export function validateLayoutPhotos(layout: SeriesLayout | null, photos: readonly LayoutPhoto[], chapters: readonly SeriesChapter[] = [], checkOrder = false) {
  if (!layout) return;
  const ids = layoutIds(layout), known = new Set(photos.map(photo => photo.id));
  if (ids.length !== known.size || ids.some(id => !known.has(id))) throw new LayoutInputError("排版照片与系列不一致，请刷新后处理新增或删除的照片");
  if (checkOrder && ids.some((id, index) => id !== photos[index].id)) throw new LayoutInputError("排版与照片顺序不一致，请同时保存布局和顺序");
  const anchors = new Set(chapters.map(chapter => chapter.beforePhotoId));
  if (layout.groups.some(group => group.items.slice(1).some(item => anchors.has(item.photoId)))) throw new LayoutInputError("图片组不能跨越章节，请先拆分组合");
}
export function automaticLayout(photos: readonly LayoutPhoto[], chapters: readonly SeriesChapter[] = []): SeriesLayout {
  return { version: 1, groups: buildPhotoStorySections(photos, chapters).flatMap(section => section.rows.map(row => ({
    id: crypto.randomUUID(), template: row.kind === "portrait" ? "narrow" : row.kind === "pair" ? "pair" : "wide", gap: "space", items: row.items.map(item => layoutImage(item.photo.id)),
  }))) };
}
/** Editor/delete/upload reconciliation; never used to silently repair a submitted save or sync. */
export function reconcileLayout(layout: SeriesLayout, photos: readonly LayoutPhoto[], chapters: readonly SeriesChapter[] = []): SeriesLayout {
  const known = new Map(photos.map(photo => [photo.id, photo])), seen = new Set<string>(), anchors = new Set(chapters.map(chapter => chapter.beforePhotoId));
  const groups: LayoutGroup[] = [];
  for (const group of layout.groups) {
    const chunks: LayoutImage[][] = [];
    for (const item of group.items) {
      if (!known.has(item.photoId) || seen.has(item.photoId)) continue;
      seen.add(item.photoId);
      if (!chunks.length || anchors.has(item.photoId)) chunks.push([]);
      chunks[chunks.length - 1].push(item);
    }
    chunks.forEach((items, index) => groups.push({ ...group, id: index ? `${group.id.slice(0, 100)}-${items[0].photoId.slice(0, 50)}` : group.id, items,
      template: items.length === group.items.length ? group.template : defaultTemplate(items.map(item => known.get(item.photoId)!)),
    }));
  }
  for (const photo of photos) if (!seen.has(photo.id)) groups.push({ id: `photo-${photo.id}`, template: defaultTemplate([photo]), gap: "space", items: [layoutImage(photo.id)] });
  return { version: 1, groups };
}
export function layoutPhotos<T extends LayoutPhoto>(photos: readonly T[], layout?: SeriesLayout | null, draftOrder?: readonly string[]): T[] {
  if (!layout && !draftOrder) return [...photos];
  const known = new Map(photos.map(photo => [photo.id, photo]));
  return (layout ? layoutIds(layout) : draftOrder!).flatMap(id => known.has(id) ? [known.get(id)!] : []);
}
export function layoutSections<T extends LayoutPhoto>(photos: readonly T[], layout: SeriesLayout, chapters: readonly SeriesChapter[] = []) {
  const ordered = layoutPhotos(photos, layout), indices = new Map(ordered.map((photo, index) => [photo.id, index]));
  const known = new Map(ordered.map(photo => [photo.id, photo]));
  const anchors = new Map(chapters.filter(chapter => chapter.title.trim() || chapter.body.trim()).map(chapter => [chapter.beforePhotoId, chapter]));
  const sections: { chapter?: SeriesChapter; groups: { group: LayoutGroup; items: { photo: T; index: number; aspectRatio: number; frame: LayoutImage }[] }[] }[] = [];
  for (const group of layout.groups) {
    const chapter = anchors.get(group.items[0]?.photoId);
    if (!sections.length || chapter) sections.push({ chapter, groups: [] });
    sections[sections.length - 1].groups.push({ group, items: group.items.flatMap(frame => {
      const photo = known.get(frame.photoId);
      return photo ? [{ photo, index: indices.get(photo.id)!, aspectRatio: photoAspectRatio(photo), frame }] : [];
    }) });
  }
  return { photos: ordered, sections };
}
