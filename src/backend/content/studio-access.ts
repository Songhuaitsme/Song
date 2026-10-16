import { getDatabase } from "./content-store";
import type { AccessLevel } from "@/shared/content-model";
import type { BulkAccessResult } from "@/shared/studio-list";

export function validateBulkAccess(body: { entity?: unknown; ids?: unknown; access?: unknown }) {
  if (body.entity !== "series" && body.entity !== "favorite") throw new Error("仅支持摄影系列和收藏的批量权限操作");
  if (typeof body.access !== "string" || !["public", "private", "draft"].includes(body.access)) throw new Error("权限值无效");
  if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > 100 || body.ids.some(id => typeof id !== "string" || !id.trim() || id.length > 100)) throw new Error("请选择 1 至 100 条有效条目");
  return { entity: body.entity, ids: [...new Set(body.ids as string[])], access: body.access as AccessLevel };
}

export async function setStudioAccess(input: ReturnType<typeof validateBulkAccess>): Promise<BulkAccessResult> {
  const db = getDatabase();
  if (!db) throw new Error("数据库暂时不可用");
  const table = input.entity === "series" ? "series" : "favorites";
  const result = await db.prepare(`UPDATE ${table} SET access=?,published=?,version=version+1,updated_at=? WHERE deleted_at IS NULL AND id IN (SELECT value FROM json_each(?)) RETURNING id,access,version,updated_at`)
    .bind(input.access, input.access === "public" ? 1 : 0, Date.now(), JSON.stringify(input.ids))
    .all<{ id: string; access: AccessLevel; version: number; updated_at: number }>();
  const updated = result.results.map(item => ({ id: item.id, access: item.access, version: item.version, updatedAt: item.updated_at }));
  const changed = new Set(updated.map(item => item.id));
  return { updated, skipped: input.ids.filter(id => !changed.has(id)).map(id => ({ id, reason: "not_found" })) };
}
