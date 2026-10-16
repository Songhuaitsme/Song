import type { AccessLevel, Favorite, Series, SiteContent } from "./content-model";

export type StudioListItem = Series | Favorite;
export type StudioListView = { access: AccessLevel | "all"; query: string; category: string; sort: "display" | "recent"; page: number };
export type BulkAccessResult = {
  updated: { id: string; access: AccessLevel; version: number; updatedAt: number }[];
  skipped: { id: string; reason: "not_found" }[];
};
export const studioPageSize = 20;
export const defaultStudioView: StudioListView = { access: "all", query: "", category: "", sort: "display", page: 1 };
export const accessLabels: Record<AccessLevel, string> = { public: "公开", private: "私藏", draft: "草稿" };
export const accessDescriptions: Record<AccessLevel, string> = {
  public: "公开后，所有访客都可以完整浏览。",
  private: "私藏内容对访客保留标题与简介，详情仅主人可见。",
  draft: "草稿仅在工作室和主人视图中显示。",
};

function editable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(editable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => !["version", "updatedAt", "deletedAt"].includes(key)).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, editable(child)]));
  return value;
}
export function sameStudioValue(a: unknown, b: unknown) { return JSON.stringify(editable(a)) === JSON.stringify(editable(b)); }
export function studioItemDirty(item: StudioListItem, saved?: StudioListItem) { return !saved || !sameStudioValue(item, saved); }
export function displayOrder<T extends StudioListItem>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}
export function studioListPage<T extends StudioListItem>(items: T[], saved: T[], view: StudioListView) {
  const snapshots = new Map(saved.map(item => [item.id, item]));
  const counts = { all: saved.length, public: 0, private: 0, draft: 0 };
  for (const item of saved) counts[item.access]++;
  const query = view.query.trim().toLocaleLowerCase();
  const filtered = displayOrder(items).filter(item => {
    const access = snapshots.get(item.id)?.access ?? "draft";
    const category = "category" in item ? item.category.trim() || "其他" : "";
    const search = "photos" in item ? `${item.title}\n${item.description}` : `${item.title}\n${item.category}\n${item.note}`;
    return (view.access === "all" || access === view.access) && (!view.category || category === view.category) && (!query || search.toLocaleLowerCase().includes(query));
  });
  if (view.sort === "recent") filtered.sort((a, b) => (snapshots.get(b.id)?.updatedAt ?? 0) - (snapshots.get(a.id)?.updatedAt ?? 0));
  const pages = Math.max(1, Math.ceil(filtered.length / studioPageSize));
  const page = Math.min(pages, Math.max(1, Math.floor(view.page) || 1));
  return { counts, filtered, pages, page, items: filtered.slice((page - 1) * studioPageSize, page * studioPageSize) };
}

// Refresh committed records while keeping fields still being edited in the dashboard.
export function mergeStudioReload(current: SiteContent, saved: SiteContent, incoming: SiteContent): SiteContent {
  const merge = <T extends { id: string }>(drafts: T[], baseline: T[], remote: T[]) => {
    const known = new Map(baseline.map(item => [item.id, item]));
    const draftMap = new Map(drafts.map(item => [item.id, item]));
    const result = remote.map(item => { const draft = draftMap.get(item.id); return draft && !sameStudioValue(draft, known.get(item.id)) ? draft : item; });
    for (const draft of drafts) if (!known.has(draft.id) && !remote.some(item => item.id === draft.id)) result.push(draft);
    return result;
  };
  return { ...incoming, series: merge(current.series, saved.series, incoming.series), favorites: merge(current.favorites, saved.favorites, incoming.favorites), essays: merge(current.essays, saved.essays, incoming.essays), copy: sameStudioValue(current.copy, saved.copy) ? incoming.copy : current.copy, about: sameStudioValue(current.about, saved.about) ? incoming.about : current.about };
}
