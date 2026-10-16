import { automaticLayout, defaultTemplate, layoutIds, reconcileLayout, type SeriesLayout } from "./series-layout";
import type { SeriesChapter } from "./series-narrative";
type Photo = { id: string; width: number; height: number };
export type LayoutCommand =
  | { type: "move-group"; id: string; before: number }
  | { type: "move-photo"; id: string; groupId?: string; before: number }
  | { type: "split"; id: string }
  | { type: "merge"; id: string };

export function editLayout(layout: SeriesLayout, command: LayoutCommand, photos: readonly Photo[], chapters: readonly SeriesChapter[] = []) {
  const next = structuredClone(layout), known = new Map(photos.map(photo => [photo.id, photo]));
  const defaults = () => next.groups.forEach(group => {
    const old = layout.groups.find(item => item.id === group.id);
    if (!old || old.items.length !== group.items.length) group.template = defaultTemplate(group.items.map(item => known.get(item.photoId)!));
  });
  if (command.type === "move-group") {
    const index = next.groups.findIndex(group => group.id === command.id);
    if (index < 0) throw new Error("图片组不存在");
    const [group] = next.groups.splice(index, 1);
    next.groups.splice(Math.max(0, command.before - (index < command.before ? 1 : 0)), 0, group);
  } else if (command.type === "move-photo") {
    const source = next.groups.find(group => group.items.some(item => item.photoId === command.id));
    if (!source) throw new Error("照片不存在");
    const index = source.items.findIndex(item => item.photoId === command.id), [item] = source.items.splice(index, 1);
    if (command.groupId) {
      const target = next.groups.find(group => group.id === command.groupId);
      if (!target) throw new Error("目标图片组不存在");
      if (target.items.length >= 4) throw new Error("每组最多四张照片，请先拆分组合");
      target.items.splice(Math.max(0, command.before - (source.id === target.id && index < command.before ? 1 : 0)), 0, item);
    } else {
      next.groups.splice(command.before, 0, { id: crypto.randomUUID(), template: defaultTemplate([known.get(item.photoId)!]), gap: source.gap, ...(source.widthPercent === undefined ? {} : { widthPercent: source.widthPercent }), items: [item] });
    }
    next.groups = next.groups.filter(group => group.items.length);
    defaults();
  } else {
    const index = next.groups.findIndex(group => group.id === command.id), group = next.groups[index];
    if (!group) throw new Error("图片组不存在");
    if (command.type === "split") next.groups.splice(index, 1, ...group.items.map((item, i) => ({ ...group, id: i ? crypto.randomUUID() : group.id, template: defaultTemplate([known.get(item.photoId)!]), items: [item] })));
    else {
      const following = next.groups[index + 1];
      if (!following || group.items.length + following.items.length > 4) throw new Error("只能合并总计不超过四张的相邻组");
      if (chapters.some(chapter => following.items.some(item => item.photoId === chapter.beforePhotoId))) throw new Error("章节边界不能合并，请先调整系列文字的起始照片");
      group.items.push(...following.items); next.groups.splice(index + 1, 1); defaults();
    }
  }
  return reconcileLayout(next, photos, chapters);
}
export function moveLayoutPhoto(layout: SeriesLayout | null | undefined, photos: readonly Photo[], chapters: readonly SeriesChapter[], id: string, direction: -1 | 1) {
  const next = structuredClone(layout ?? automaticLayout(photos, chapters));
  const frames = next.groups.flatMap(group => group.items), index = frames.findIndex(item => item.photoId === id), other = index + direction;
  if (other < 0 || other >= frames.length) return next;
  [frames[index], frames[other]] = [frames[other], frames[index]];
  let position = 0;
  for (const group of next.groups) group.items = group.items.map(() => frames[position++]);
  return reconcileLayout(next, photos, chapters);
}
export type LayoutDraft = { layout: SeriesLayout | null; order?: string[] };
export function seriesPhotoOrder(series: { photos: readonly (Photo & { version?: number })[]; layout?: SeriesLayout | null; draftPhotoOrder?: string[] }) {
  const ids = series.layout ? layoutIds(series.layout) : series.draftPhotoOrder ?? series.photos.map(photo => photo.id);
  const known = new Map(series.photos.map(photo => [photo.id, photo]));
  return ids.map(id => ({ id, version: known.get(id)?.version ?? 1 }));
}
