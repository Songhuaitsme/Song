export function buildRestoreChanges(backup, current) {
  if (backup.schemaVersion !== current.schemaVersion && !(backup.schemaVersion === 3 && current.schemaVersion === 4)) throw new Error("备份结构版本不兼容，请先升级或转换备份");
  const existing = new Map();
  for (const [entity, rows] of Object.entries(current.records)) for (const row of rows) existing.set(`${entity}:${row.id ?? row.key}`, row);
  const changes = [];
  for (const [entity, rows] of Object.entries(backup.records)) for (const row of rows) {
    const before = existing.get(`${entity}:${row.id ?? row.key}`), data = { ...row };
    // A pre-narrative backup cannot erase writing created after its snapshot.
    if (entity === "series" && data.narrative_json === undefined) data.narrative_json = before?.narrative_json ?? '{"intro":"","chapters":[],"closing":""}';
    changes.push({ entity, data: { ...data, version: Number(before?.version ?? 0) + 1, updated_at: Date.now() }, baseVersion: Number(before?.version ?? 0) });
  }
  return { schemaVersion: current.schemaVersion, changes };
}
