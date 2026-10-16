export function normalizeSyncRow(row) {
  const copy = { ...row };
  delete copy.version; delete copy.updated_at;
  if (copy.layout_json == null || copy.layout_json === 'null') delete copy.layout_json;
  else copy.layout_json = JSON.stringify(typeof copy.layout_json === 'string' ? JSON.parse(copy.layout_json) : copy.layout_json);
  if (copy.narrative_json !== undefined) {
    const writing = typeof copy.narrative_json === 'string' ? JSON.parse(copy.narrative_json) : copy.narrative_json;
    const normalized = { intro: writing?.intro ?? '', chapters: writing?.chapters ?? [], closing: writing?.closing ?? '' };
    // Empty migration defaults must still match pre-upgrade sync baselines.
    if (!normalized.intro && !normalized.closing && !normalized.chapters.length) delete copy.narrative_json;
    else copy.narrative_json = JSON.stringify(normalized);
  }
  return copy;
}
