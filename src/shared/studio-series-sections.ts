import type { Series } from "./content-model";

export type SeriesEditorSection = "text" | "layout" | "photos";
export type SeriesEditorOpen = Partial<Record<SeriesEditorSection, boolean>>;

export function seriesEditorTarget(series: Series, target: string): SeriesEditorSection | null {
  if (target === `series-text-${series.id}` || series.narrative?.chapters.some(chapter => target === `chapter-${chapter.id}`)) return "text";
  if (target === `series-layout-${series.id}`) return "layout";
  if (target === `series-photos-${series.id}` || series.photos.some(photo => photo.id === target)) return "photos";
  return null;
}
