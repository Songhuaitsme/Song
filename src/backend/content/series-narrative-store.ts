import { emptyNarrative, readNarrative, resolveChapterAnchor, validateNarrative } from "@/shared/series-narrative";

export type ChapterResolution = { beforePhotoId: string | null; version?: number };
export class NarrativeConflict extends Error { status = 409; }

export async function narrativeForSave(db: D1Database, seriesId: string, record: Record<string, unknown>) {
  if (!Object.hasOwn(record, "narrative")) return null;
  const narrative = validateNarrative(record.narrative);
  const rows = await db.prepare("SELECT id FROM photos WHERE series_id=? AND deleted_at IS NULL").bind(seriesId).all<{ id: string }>();
  const photos = new Set(rows.results.map(row => row.id));
  if (narrative.chapters.some(chapter => !photos.has(chapter.beforePhotoId))) throw new Error("章节起始照片必须属于当前系列，请重新选择");
  return narrative;
}

export async function deletePhotoWithNarrative(db: D1Database, id: string, resolution?: ChapterResolution) {
  const photo = await db.prepare("SELECT p.series_id,s.version,s.narrative_json FROM photos p JOIN series s ON s.id=p.series_id WHERE p.id=? AND p.deleted_at IS NULL AND s.deleted_at IS NULL").bind(id).first<{ series_id: string; version: number; narrative_json: string }>();
  if (!photo) return {};
  let narrative = readNarrative(photo.narrative_json);
  if (narrative.chapters.some(chapter => chapter.beforePhotoId === id)) {
    if (!resolution || !Object.hasOwn(resolution, "beforePhotoId")) throw new NarrativeConflict("这张照片是章节起点，请先选择新的起始照片或明确删除章节");
    if (resolution.version !== undefined && resolution.version !== photo.version) throw new NarrativeConflict("系列文字已更新，请刷新后重新确认删除");
    if (resolution.beforePhotoId !== null) {
      if (typeof resolution.beforePhotoId !== "string" || resolution.beforePhotoId === id) throw new Error("请选择另一张起始照片");
      const replacement = await db.prepare("SELECT id FROM photos WHERE id=? AND series_id=? AND deleted_at IS NULL").bind(resolution.beforePhotoId, photo.series_id).first();
      if (!replacement) throw new Error("新的起始照片必须属于当前系列");
    }
    narrative = validateNarrative(resolveChapterAnchor(narrative, id, resolution.beforePhotoId));
  }
  const stamp = Date.now();
  const result = await db.batch([
    db.prepare("UPDATE photos SET deleted_at=?,updated_at=?,version=version+1 WHERE id=? AND deleted_at IS NULL AND EXISTS(SELECT 1 FROM series WHERE id=? AND version=?)").bind(stamp, stamp, id, photo.series_id, photo.version),
    db.prepare("UPDATE series SET narrative_json=?,updated_at=?,version=version+1 WHERE id=? AND version=? AND EXISTS(SELECT 1 FROM photos WHERE id=? AND deleted_at=?)").bind(JSON.stringify(narrative), stamp, photo.series_id, photo.version, id, stamp),
  ]);
  if (!result[0].meta.changes || !result[1].meta.changes) throw new NarrativeConflict("系列已更新，照片未删除，请刷新后重试");
  return { series: { id: photo.series_id, narrative, version: photo.version + 1, updatedAt: stamp } };
}

export const emptyNarrativeJson = JSON.stringify(emptyNarrative());

export async function assertPhotoCanMove(db: D1Database, id: string, nextSeriesId: unknown) {
  const previous = await db.prepare("SELECT p.series_id,s.narrative_json FROM photos p JOIN series s ON s.id=p.series_id WHERE p.id=? AND p.deleted_at IS NULL").bind(id).first<{ series_id: string; narrative_json: string }>();
  if (previous && previous.series_id !== nextSeriesId && readNarrative(previous.narrative_json).chapters.some(chapter => chapter.beforePhotoId === id)) throw new NarrativeConflict("这张照片是章节起点，请先调整章节，再移到其他系列");
}
