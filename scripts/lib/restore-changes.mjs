export function buildRestoreChanges(backup, current) {
  if (backup.schemaVersion !== current.schemaVersion && !([3,4,5].includes(backup.schemaVersion) && current.schemaVersion >= backup.schemaVersion && current.schemaVersion <= 6)) throw new Error("备份结构版本不兼容，请先升级或转换备份");
  const existing = new Map();
  for (const [entity, rows] of Object.entries(current.records)) for (const row of rows) existing.set(`${entity}:${row.id ?? row.key}`, row);
  const changes = [];
  for (const [entity, rows] of Object.entries(backup.records)) for (const row of rows) {
    const before = existing.get(`${entity}:${row.id ?? row.key}`), data = { ...row };
    // A pre-narrative backup cannot erase writing created after its snapshot.
    if (entity === "series" && data.narrative_json === undefined) data.narrative_json = before?.narrative_json ?? '{"intro":"","chapters":[],"closing":""}';
    if (entity === "series" && data.layout_json === undefined) data.layout_json = before?.layout_json ?? null;
    if (entity === "series" && backup.schemaVersion < 6 && current.schemaVersion >= 6 && before?.layout_json) {
      const previous = typeof before.layout_json === "string" ? JSON.parse(before.layout_json) : before.layout_json;
      const withWidths = previous?.groups?.filter(group => group.widthPercent !== undefined) ?? [];
      if (withWidths.length) {
        const restored = typeof data.layout_json === "string" ? JSON.parse(data.layout_json) : structuredClone(data.layout_json);
        const ids = layout => layout?.groups?.flatMap(group => group.items.map(item => item.photoId)).sort() ?? [];
        const incompatible = () => { throw new Error(`系列 ${data.id} 的旧备份布局无法匹配现有组图宽度，请先核对布局和照片集合`); };
        if (JSON.stringify(ids(previous)) !== JSON.stringify(ids(restored))) incompatible();
        for (const group of withWidths) {
          const target = restored?.groups?.find(item => item.id === group.id);
          if (!target || JSON.stringify(target.items.map(item => item.photoId).sort()) !== JSON.stringify(group.items.map(item => item.photoId).sort())) incompatible();
          target.widthPercent = group.widthPercent;
        }
        data.layout_json = JSON.stringify(restored);
      }
    }
    changes.push({ entity, data: { ...data, version: Number(before?.version ?? 0) + 1, updated_at: Date.now() }, baseVersion: Number(before?.version ?? 0) });
  }
  return { schemaVersion: current.schemaVersion, changes };
}
