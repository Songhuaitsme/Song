import { readNarrative } from "@/shared/series-narrative";
import { readLayout, validateLayoutPhotos } from "@/shared/series-layout";

export type SyncChange = { entity: string; data: Record<string, unknown>; baseVersion: number };

/** Validate the final series/photo graph, not the transient order of imported rows. */
export async function validateNarrativeSync(db: D1Database, changes: SyncChange[]) {
  const seriesIds = new Set<string>();
  const changedPhotoIds = changes.filter(change => change.entity === "photos").map(change => change.data.id);
  if (changedPhotoIds.length) {
    const previous = await db.prepare("SELECT series_id FROM photos WHERE id IN (SELECT value FROM json_each(?))").bind(JSON.stringify(changedPhotoIds)).all<{ series_id: string }>();
    for (const photo of previous.results) seriesIds.add(photo.series_id);
  }
  for (const change of changes) {
    if (change.entity === "series") seriesIds.add(String(change.data.id));
    if (change.entity === "photos") {
      seriesIds.add(String(change.data.series_id));
    }
  }
  if (!seriesIds.size) return [];
  const ids = JSON.stringify([...seriesIds]);
  const [seriesRows, photoRows] = await db.batch<Record<string, unknown>>([
    db.prepare("SELECT id,narrative_json,layout_json,deleted_at,version FROM series WHERE id IN (SELECT value FROM json_each(?))").bind(ids),
    db.prepare("SELECT id,series_id,width,height,sort_order,version,deleted_at FROM photos WHERE series_id IN (SELECT value FROM json_each(?))").bind(ids),
  ]);
  const series = new Map(seriesRows.results.map(row => [String(row.id), row]));
  const photos = new Map(photoRows.results.map(row => [String(row.id), row]));
  for (const change of changes) {
    const id = String(change.data.id);
    if (change.entity === "series") series.set(id, { ...series.get(id), ...change.data });
    if (change.entity === "photos") photos.set(id, change.data);
  }
  for (const [id, row] of series) {
    if (row.deleted_at != null) continue;
    const members = [...photos.values()].filter(photo => photo.deleted_at == null && photo.series_id === id).sort((a,b) => Number(a.sort_order)-Number(b.sort_order) || String(a.id).localeCompare(String(b.id)));
    validateLayoutPhotos(readLayout(row.layout_json), members.map(photo => ({id:String(photo.id),width:Number(photo.width),height:Number(photo.height)})), readNarrative(row.narrative_json).chapters, true);
    for (const chapter of readNarrative(row.narrative_json).chapters) {
      const photo = photos.get(chapter.beforePhotoId);
      if (!photo || photo.deleted_at != null || photo.series_id !== id) throw new Error("同步包含失效的章节起始照片，请先处理系列文字或关联冲突");
    }
  }
  return [
    ...seriesRows.results.map(row => ({ entity: "series", data: { id: row.id, photoCount: photoRows.results.filter(photo=>photo.series_id===row.id && photo.deleted_at==null).length }, baseVersion: Number(row.version) })),
    ...photoRows.results.map(row => ({entity:"photos",data:{id:row.id},baseVersion:Number(row.version)})),
  ];
}

export function syncVersionGuard(db: D1Database, changes: SyncChange[]) {
  const cases = ["series", "photos", "essays", "favorites", "site_settings", "media_assets"].map(table => `WHEN '${table}' THEN COALESCE((SELECT version FROM ${table} WHERE ${table === "site_settings" ? "key" : "id"}=json_extract(c.value,'$.id')),0)`).join(" ");
  // A failed assertion aborts the entire D1 batch before it can write any rows.
  return db.prepare(`SELECT CASE WHEN EXISTS(SELECT 1 FROM json_each(?) c WHERE CASE json_extract(c.value,'$.entity') ${cases} END != json_extract(c.value,'$.version') OR (json_extract(c.value,'$.photoCount') IS NOT NULL AND (SELECT COUNT(*) FROM photos WHERE series_id=json_extract(c.value,'$.id') AND deleted_at IS NULL)!=json_extract(c.value,'$.photoCount'))) THEN json('sync-version-conflict') ELSE 1 END AS valid`).bind(JSON.stringify(changes.map(change => ({ entity: change.entity, id: change.data.id ?? change.data.key, version: change.baseVersion, photoCount: change.data.photoCount }))));
}
