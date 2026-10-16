import { readLayout, reconcileLayout, layoutIds, validateLayout, validateLayoutPhotos } from "@/shared/series-layout";
import { readNarrative, validateNarrative } from "@/shared/series-narrative";
import { syncVersionGuard } from "@/backend/sync/narrative-sync";
class NarrativeConflict extends Error { status = 409; }

export type StoredLayoutPhoto = { id: string; series_id: string; width: number; height: number; sort_order: number; version: number };
export async function layoutSnapshot(db: D1Database, id: string) {
  const series = await db.prepare("SELECT id,version,layout_json,narrative_json FROM series WHERE id=? AND deleted_at IS NULL").bind(id).first<{ id: string; version: number; layout_json: string | null; narrative_json: string }>();
  const photos = await db.prepare("SELECT id,series_id,width,height,sort_order,version FROM photos WHERE series_id=? AND deleted_at IS NULL ORDER BY sort_order,id").bind(id).all<StoredLayoutPhoto>();
  return { series, photos: photos.results };
}
export function layoutSnapshotGuards(db: D1Database, snapshots: Awaited<ReturnType<typeof layoutSnapshot>>[]) {
  const versions = snapshots.flatMap(snapshot => [
    ...(snapshot.series ? [{ entity: "series", data: { id: snapshot.series.id }, baseVersion: snapshot.series.version }] : []),
    ...snapshot.photos.map(photo => ({ entity: "photos", data: { id: photo.id }, baseVersion: photo.version })),
  ]);
  const counts = snapshots.filter(snapshot => snapshot.series).map(snapshot => ({ id: snapshot.series!.id, count: snapshot.photos.length }));
  return [syncVersionGuard(db, versions), db.prepare("SELECT CASE WHEN EXISTS(SELECT 1 FROM json_each(?) s WHERE (SELECT COUNT(*) FROM photos WHERE series_id=json_extract(s.value,'$.id') AND deleted_at IS NULL)!=json_extract(s.value,'$.count')) THEN json('layout-membership-conflict') ELSE 1 END AS valid").bind(JSON.stringify(counts))];
}
export async function layoutBatch(db: D1Database, statements: D1PreparedStatement[]) {
  try { return await db.batch(statements); }
  catch (error) {
    if (/malformed JSON|sync-version-conflict|layout-membership-conflict/i.test(String(error))) throw new NarrativeConflict("系列或照片已更新，未保存任何排版更改。请刷新后重新检查；当前输入会保留。");
    throw error;
  }
}
/** Layout and canonical photo order commit together; photo text/image columns are never rewritten. */
export async function saveSeriesLayout(db: D1Database, id: string, record: Record<string, unknown>, fields: unknown[]) {
  const snapshot = await layoutSnapshot(db, id), previous = snapshot.series;
  if (previous && record.version !== previous.version) throw new NarrativeConflict("系列已更新，请刷新后再保存排版");
  const layout = validateLayout(record.layout);
  const narrative = Object.hasOwn(record, "narrative") ? validateNarrative(record.narrative) : readNarrative(previous?.narrative_json);
  const order = record.photoOrder as { id: string; version: number }[] | undefined;
  if (!Array.isArray(order) || order.length !== snapshot.photos.length || new Set(order.map(item => item?.id)).size !== order.length) throw new NarrativeConflict("照片清单已改变，请刷新后检查排版");
  const known = new Map(snapshot.photos.map(photo => [photo.id, photo]));
  if (order.some(item => !item || known.get(item.id)?.version !== item.version)) throw new NarrativeConflict("照片版本已更新，请刷新后检查排版");
  const ordered = order.map(item => known.get(item.id)!);
  if (narrative.chapters.some(chapter => !known.has(chapter.beforePhotoId))) throw new Error("章节起始照片必须属于当前系列");
  validateLayoutPhotos(layout, ordered, narrative.chapters, true);
  const stamp = Date.now();
  const statements = layoutSnapshotGuards(db, [snapshot]);
  // Also guard a newly created series against an insertion after our initial read.
  if (!previous) statements.push(syncVersionGuard(db, [{ entity: "series", data: { id }, baseVersion: 0 }]));
  statements.push(db.prepare("INSERT INTO series(id,slug,title,description,cover_url,access,published,sort_order,narrative_json,layout_json,version,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?,1,?,NULL) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,description=excluded.description,cover_url=excluded.cover_url,access=excluded.access,published=excluded.published,sort_order=excluded.sort_order,narrative_json=excluded.narrative_json,layout_json=excluded.layout_json,version=series.version+1,updated_at=excluded.updated_at").bind(id, ...fields, JSON.stringify(narrative), layout ? JSON.stringify(layout) : null, stamp));
  const changed = ordered.flatMap((photo, index) => photo.sort_order === index + 1 ? [] : [{ id: photo.id, sortOrder: index + 1, version: photo.version + 1, updatedAt: stamp }]);
  // One JSON parameter keeps large series below D1's parameter limit.
  if (changed.length) statements.push(db.prepare("UPDATE photos SET sort_order=(SELECT json_extract(value,'$.sortOrder') FROM json_each(?) WHERE json_extract(value,'$.id')=photos.id),version=version+1,updated_at=? WHERE series_id=? AND id IN(SELECT json_extract(value,'$.id') FROM json_each(?))").bind(JSON.stringify(changed), stamp, id, JSON.stringify(changed)));
  await layoutBatch(db, statements);
  return { id, layout, narrative, version: (previous?.version ?? 0) + 1, updatedAt: stamp, photoOrder: ordered.map((photo, index) => ({ id: photo.id, sortOrder: index + 1, version: photo.version + (photo.sort_order !== index + 1 ? 1 : 0), updatedAt: photo.sort_order !== index + 1 ? stamp : undefined })) };
}

/** New photos append to manual layouts; editing a caption cannot reorder a saved layout. */
export async function writePhotoWithLayout(db: D1Database, statement: D1PreparedStatement, record: Record<string, unknown>) {
  const id = String(record.id), target = String(record.seriesId);
  const old = await db.prepare("SELECT series_id,sort_order,version FROM photos WHERE id=? AND deleted_at IS NULL").bind(id).first<{ series_id: string; sort_order: number; version: number }>();
  if(old&&typeof record.version==="number"&&record.version!==old.version)throw new NarrativeConflict("照片已更新，请刷新后检查注释和排版，当前输入会保留");
  const ids = [...new Set([target, ...(old ? [old.series_id] : [])])];
  const snapshots = await Promise.all(ids.map(seriesId => layoutSnapshot(db, seriesId)));
  if (!snapshots.find(item => item.series?.id === target)) throw new Error("所属系列不存在或已删除");
  const manual = snapshots.filter(item => readLayout(item.series?.layout_json));
  if (!manual.length) {
    const results=await layoutBatch(db,[...layoutSnapshotGuards(db,snapshots),statement]);
    return results[2];
  }
  if (old && manual.some(item => item.series?.id === old.series_id) && (old.series_id !== target || old.sort_order !== Number(record.sortOrder))) throw new NarrativeConflict("请在图片排版中调整顺序；跨系列移动前先恢复自动排版");
  const statements = layoutSnapshotGuards(db, snapshots);
  statements.push(statement);
  for (const snapshot of manual) {
    const series = snapshot.series!, layout = readLayout(series.layout_json)!;
    const photos = [...snapshot.photos];
    if ((!old || old.series_id !== target) && series.id === target) photos.push({ id, series_id: target, width: Number(record.width), height: Number(record.height), sort_order: Number(record.sortOrder), version: 1 });
    const next = reconcileLayout(layout, photos, readNarrative(series.narrative_json).chapters);
    if (layoutIds(next).some((photoId, index) => photoId !== [...photos].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))[index]?.id)) throw new NarrativeConflict("新增照片需要追加在系列末尾，请刷新后重试");
    if (JSON.stringify(next) !== JSON.stringify(layout)) statements.push(db.prepare("UPDATE series SET layout_json=?,version=version+1,updated_at=? WHERE id=?").bind(JSON.stringify(next), Date.now(), series.id));
  }
  const results = await layoutBatch(db, statements);
  return results[2];
}
