"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Globe, ImageIcon, LockKeyhole, PencilLine, Plus } from "lucide-react";
import { toast } from "sonner";
import type { AccessLevel } from "@/shared/content-model";
import { accessDescriptions, accessLabels, defaultStudioView, displayOrder, studioItemDirty, studioListPage, studioPageSize, type BulkAccessResult, type StudioListItem, type StudioListView } from "@/shared/studio-list";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";

export function StudioStatusBadge({ access }: { access: AccessLevel }) {
  const Icon = access === "public" ? Globe : access === "private" ? LockKeyhole : PencilLine;
  return <span className={`studio-status studio-status-${access}`}><Icon size={14} aria-hidden="true"/>{accessLabels[access]}</span>;
}

export function StudioContentList<T extends StudioListItem>({ items, savedItems, entity, busy, reveal, onCreate, onSetAccess, renderEditor }: {
  items: T[]; savedItems: T[]; entity: "series" | "favorite" | "essay"; busy: boolean;
  reveal?: { id: string; token: number };
  onCreate(): void;
  onSetAccess(ids: string[], access: AccessLevel): Promise<BulkAccessResult>;
  renderEditor(item: T, originalIndex: number, canReorder: boolean): ReactNode;
}) {
  const [view, setView] = useState<StudioListView>(defaultStudioView);
  const [selected, setSelected] = useState(new Set<string>());
  const [expanded, setExpanded] = useState(new Set<string>());
  const [pending, setPending] = useState<AccessLevel | null>(null);
  const [scrollTarget, setScrollTarget] = useState("");
  const handledReveal = useRef<number | undefined>(undefined);
  const snapshots = useMemo(() => new Map(savedItems.map(item => [item.id, item])), [savedItems]);
  const page = studioListPage(items, savedItems, view);
  const dirty = (item: T) => studioItemDirty(item, snapshots.get(item.id));
  const anyDirty = items.some(dirty);
  const eligible = page.items.filter(item => !dirty(item));
  const selection = eligible.filter(item => selected.has(item.id));
  const categories = [...new Set(items.flatMap(item => "category" in item ? [item.category.trim() || "其他"] : []))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  const canReorder = view.access === "all" && !view.query.trim() && !view.category && view.sort === "display" && !anyDirty;
  const title = entity === "series" ? "摄影系列" : entity === "essay" ? "随笔" : "收藏";
  const changeView = (patch: Partial<StudioListView>) => { setView(current => ({ ...current, ...patch, page: patch.page ?? 1 })); setSelected(new Set()); };
  const showItem = (id: string) => {
    const ordered = displayOrder(items);
    const index = ordered.findIndex(item => item.id === id || ("photos" in item && (item.photos.some(photo => photo.id === id) || id === `series-text-${item.id}` || id === `series-layout-${item.id}` || id === `series-photos-${item.id}` || item.narrative?.chapters.some(chapter => id === `chapter-${chapter.id}`))));
    if (index < 0) return;
    setView({ ...defaultStudioView, access: snapshots.has(ordered[index].id) ? "all" : "draft", page: 1 });
    // New drafts have their own filtered position; existing deep links use the complete order.
    const targetPage = snapshots.has(ordered[index].id) ? Math.floor(index / studioPageSize) + 1 : Math.floor(ordered.filter(item => (snapshots.get(item.id)?.access ?? "draft") === "draft").findIndex(item => item.id === ordered[index].id) / studioPageSize) + 1;
    setView(current => ({ ...current, page: targetPage }));
    setExpanded(current => new Set(current).add(ordered[index].id)); setSelected(new Set()); setScrollTarget(id);
  };
  const showItemRef = useRef(showItem);
  useEffect(() => { showItemRef.current = showItem; });
  useEffect(() => {
    if (!reveal || handledReveal.current === reveal.token) return;
    handledReveal.current = reveal.token; showItemRef.current(reveal.id);
  }, [reveal, items]);
  useEffect(() => {
    const locate = () => { try { const id = decodeURIComponent(window.location.hash.slice(1)); if (id) showItemRef.current(id); } catch {} };
    locate(); window.addEventListener("hashchange", locate);
    return () => window.removeEventListener("hashchange", locate);
  }, []);
  useEffect(() => {
    if (!scrollTarget) return;
    const frame = requestAnimationFrame(() => { const target = document.getElementById(scrollTarget); if (target) { target.scrollIntoView({ block: "center" }); setScrollTarget(""); } });
    return () => cancelAnimationFrame(frame);
  }, [scrollTarget, page.page, expanded]);
  const toggleSelected = (id: string, checked: boolean) => setSelected(current => { const next = new Set(current); if (checked) next.add(id); else next.delete(id); return next; });
  const toggleExpanded = (id: string) => setExpanded(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  async function confirmBulk() {
    if (!pending || !selection.length || busy) return;
    try {
      const result = await onSetAccess(selection.map(item => item.id), pending);
      setSelected(new Set(result.skipped.map(item => item.id))); setPending(null);
      if (result.updated.length) toast.success(`已将 ${result.updated.length} 条设为${accessLabels[pending]}`);
      if (result.skipped.length) toast.error(`${result.skipped.length} 条已删除或不存在，未修改；请刷新列表核对。`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "批量修改失败，请重试"); }
  }

  return <section className="studio-content-list" data-entity={entity} aria-label={`${title}管理`}>
    <div className="studio-actions"><div><h2>{title}</h2><p>共 {items.length} 条 · 按状态查找，点击条目展开编辑</p></div><Button disabled={busy} onClick={onCreate}><Plus/>{entity === "series" ? "新建系列" : entity === "essay" ? "新建随笔" : "新增收藏"}</Button></div>
    <div className="studio-status-filters" role="group" aria-label="按权限筛选">
      {(["all", "public", "private", "draft"] as const).map(access => <button key={access} type="button" aria-pressed={view.access === access} disabled={busy} data-access={access} onClick={() => changeView({ access })}>{access === "all" ? "全部" : accessLabels[access]}<span>{page.counts[access]}</span></button>)}
    </div>
    <div className="studio-list-search">
      <Input value={view.query} disabled={busy} onChange={event => changeView({ query: event.target.value })} placeholder={entity === "series" ? "搜索系列标题或简介" : entity === "essay" ? "搜索随笔标题、摘要或正文" : "搜索收藏标题、分类或短评"} aria-label="搜索条目"/>
      {entity === "favorite" && <NativeSelect value={view.category} disabled={busy} onChange={event => changeView({ category: event.target.value })} aria-label="收藏分类"><NativeSelectOption value="">全部分类</NativeSelectOption>{categories.map(category => <NativeSelectOption key={category} value={category}>{category}</NativeSelectOption>)}</NativeSelect>}
      <NativeSelect value={view.sort} disabled={busy} onChange={event => changeView({ sort: event.target.value as StudioListView["sort"] })} aria-label="列表排序"><NativeSelectOption value="display">展示顺序</NativeSelectOption><NativeSelectOption value="recent">最近修改</NativeSelectOption></NativeSelect>
    </div>
    <div className="studio-list-tools">
      <label><input type="checkbox" checked={!!eligible.length && selection.length === eligible.length} disabled={busy || !eligible.length} onChange={event => setSelected(event.target.checked ? new Set(eligible.map(item => item.id)) : new Set())}/>全选本页</label>
      <span role="status">找到 {page.filtered.length} 条</span>
      <Button size="sm" variant="ghost" disabled={busy || !page.items.length} onClick={() => setExpanded(current => new Set([...current, ...page.items.map(item => item.id)]))}>展开本页</Button>
      <Button size="sm" variant="ghost" disabled={busy || !page.items.length} onClick={() => setExpanded(current => new Set([...current].filter(id => !page.items.some(item => item.id === id))))}>折叠本页</Button>
    </div>
    {anyDirty && <p className="studio-list-notice">带“未保存”标记的条目请先保存，再参与批量修改或调整展示顺序。</p>}
    {!canReorder && !anyDirty && <p className="studio-list-notice">调整展示顺序请切回全部条目、清除筛选，并选择“展示顺序”。<button type="button" disabled={busy} onClick={() => changeView(defaultStudioView)}>切回排序视图</button></p>}
    {selection.length > 0 && <div className="studio-bulk-actions" aria-label="批量权限操作"><strong>已选 {selection.length} 条</strong>{(["public", "private", "draft"] as const).map(access => <Button key={access} size="sm" variant="outline" disabled={busy} onClick={() => setPending(access)}>设为{accessLabels[access]}</Button>)}<Button size="sm" variant="ghost" disabled={busy} onClick={() => setSelected(new Set())}>取消选择</Button></div>}
    <div className="studio-entry-list">
      {page.items.map(item => {
        const snapshot = snapshots.get(item.id), savedAccess = snapshot?.access ?? "draft", isDirty = dirty(item), open = expanded.has(item.id);
        const image = "photos" in item ? item.coverUrl : "imageUrl" in item ? item.imageUrl : "";
        const summary = "photos" in item ? `${item.photos.length} 张照片` : "publishedAt" in item ? (item.publishedAt ? `发表于 ${item.publishedAt}` : "未设置发布日期") : item.category || "其他";
        const date = snapshot?.updatedAt ? new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Taipei" }).format(snapshot.updatedAt) : "";
        return <article className="studio-entry" id={item.id} key={item.id} data-access={savedAccess} data-dirty={isDirty}>
          <div className="studio-entry-heading">
            <input type="checkbox" aria-label={`选择${item.title || "未命名条目"}`} checked={!isDirty && selected.has(item.id)} disabled={busy || isDirty} onChange={event => toggleSelected(item.id, event.target.checked)}/>
            <button type="button" className="studio-entry-toggle" disabled={busy} aria-expanded={open} aria-controls={`editor-${item.id}`} onClick={() => toggleExpanded(item.id)}>
              <span className="studio-entry-image">{image ? <img src={image} alt="" loading="lazy"/> : entity === "essay" ? <PencilLine aria-hidden="true"/> : <ImageIcon aria-hidden="true"/>}</span>
              <span className="studio-entry-info"><strong>{item.title || "未命名条目"}</strong><span className="studio-entry-meta">{summary}{date && ` · 更新于 ${date}`}</span></span>
              <span className="studio-entry-flags"><StudioStatusBadge access={savedAccess}/>{isDirty && <span className="studio-unsaved">{item.access !== savedAccess ? `待保存：${accessLabels[item.access]}` : "未保存"}</span>}</span>
              {open ? <ChevronDown size={18} aria-hidden="true"/> : <ChevronRight size={18} aria-hidden="true"/>}
            </button>
          </div>
          {open && <div id={`editor-${item.id}`} className="studio-entry-editor">{renderEditor(item, items.findIndex(source => source.id === item.id), canReorder)}</div>}
        </article>;
      })}
    </div>
    {!page.items.length && <div className="studio-list-empty"><p>{items.length ? "没有符合条件的条目。" : `还没有${title}，可以从上方新增。`}</p>{items.length > 0 && <Button variant="outline" disabled={busy} onClick={() => changeView(defaultStudioView)}>清除筛选</Button>}</div>}
    <nav className="studio-list-pagination" aria-label={`${title}分页`}><span>第 {page.page} / {page.pages} 页 · 每页 {studioPageSize} 条</span><Button size="sm" variant="outline" disabled={busy || page.page <= 1} onClick={() => changeView({ page: page.page - 1 })}>上一页</Button><Button size="sm" variant="outline" disabled={busy || page.page >= page.pages} onClick={() => changeView({ page: page.page + 1 })}>下一页</Button></nav>
    <AlertDialog open={pending !== null} onOpenChange={open => { if (!open && !busy) setPending(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>将 {selection.length} 条设为{pending && accessLabels[pending]}？</AlertDialogTitle><AlertDialogDescription>{pending && accessDescriptions[pending]}{pending === "public" && entity === "series" && "所选系列中的照片也将对访客开放。"}</AlertDialogDescription></AlertDialogHeader><ul className="studio-bulk-titles">{selection.map(item => <li key={item.id}>{item.title}</li>)}</ul><AlertDialogFooter><AlertDialogCancel disabled={busy}>取消</AlertDialogCancel><AlertDialogAction disabled={busy || !selection.length} onClick={event => { event.preventDefault(); void confirmBulk(); }}>{busy ? "正在修改…" : "确认修改"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
