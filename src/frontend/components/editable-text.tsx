"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { fontOptions, resolveTextColor, type CopyPage, type TextFormat } from "@/shared/site-copy";
import { applyTextFormat, findStandard, fontFamilies, inheritedFormat, previewPixels, resolveStandard, scopedFormatKey, type TextRole } from "@/shared/text-standards";
import { TextColorPicker } from "@/frontend/components/text-color-picker";
import type { Series, SiteContent } from "@/shared/content-model";
import { seriesPhotoOrder } from "@/shared/series-layout-operations";

type Entity = "copy" | "series" | "essay" | "favorite" | "about" | "photo";
type Props = { value: string; editValue?: string; field: string; entity?: Entity; id?: string; enabled: boolean; csrf: string; textPage?: CopyPage; textRole?: TextRole };
export function EditableText({ value, editValue, field, entity = "copy", id, enabled, csrf, textPage, textRole }: Props) {
  const [open, setOpen] = useState(false), [draft, setDraft] = useState(value), [busy, setBusy] = useState(false);
  const formatKey = `${entity}:${id ?? ""}:${field}`;
  const scopedKey = textPage && textRole ? scopedFormatKey(textPage, textRole, formatKey) : undefined;
  const [format, setFormat] = useState<TextFormat>(inheritedFormat), [loading, setLoading] = useState(false);
  const [standardNote, setStandardNote] = useState("");
  const [standardsEnabled, setStandardsEnabled] = useState(false);
  const [standardColor, setStandardColor] = useState("#242824"), [formatReset, setFormatReset] = useState(0);
  const ref = useRef<HTMLDialogElement>(null), router = useRouter(), dialogId = useId();
  useEffect(() => {
    if (!open) return;
    setDraft(editValue ?? value);
    ref.current?.showModal();
    setLoading(true);
    const controller = new AbortController();
    fetch('/api/studio', { cache: 'no-store', signal: controller.signal }).then(async res => {
      if (!res.ok) throw new Error('请先登录工作室');
      return await res.json() as SiteContent;
    }).then(content => {
      setStandardsEnabled(!!content.copy.textStandards);
      setFormat(content.copy.textStandards ? content.copy.textStandards.overrides[scopedKey ?? ""] ?? inheritedFormat() : content.copy.textFormats?.[formatKey] ?? inheritedFormat());
      const def = textPage && textRole ? findStandard(textPage, textRole) : undefined;
      if (def && content.copy.textStandards) {
        const style = resolveStandard(content.copy.textStandards, def);
        setStandardColor(style.color);
        setStandardNote(`${def.label}：${fontOptions.find(([font]) => font === style.font)?.[1]} · ${style.color} · 桌面样例 ${previewPixels(def, style, "desktop")}px / 手机样例 ${previewPixels(def, style, "mobile")}px`);
      } else setStandardNote("尚未启用文字标准，当前修改沿用旧格式规则。");
    }).catch(error => { if (!controller.signal.aborted) toast.error(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, value, editValue, formatKey, scopedKey, textPage, textRole]);
  const save = async () => {
    if ([...ref.current?.querySelectorAll<HTMLInputElement>("input") ?? []].some(input => !input.reportValidity())) return;
    setBusy(true);
    try {
      const res = await fetch('/api/studio', { cache: 'no-store' });
      if (!res.ok) throw new Error('请先登录工作室');
      const content = await res.json() as SiteContent;
      let record: Record<string, unknown>;
      if (entity === 'copy') {
        const formatted = applyTextFormat(content.copy, formatKey, format, textPage, textRole);
        if (field.startsWith('extra|')) {
          const [, page, rowId] = field.split('|');
          const extras = content.copy.extras as Record<string, { id: string; text: string }[]>;
          record = { ...formatted, extras: { ...extras, [page]: (extras[page] ?? []).map(row => row.id === rowId ? { ...row, text: draft } : row) } };
        } else record = { ...formatted, values: { ...content.copy.values, [field]: draft } };
      } else if (entity === 'about') record = { ...content.about, [field]: draft };
      else {
        const found = entity === 'series' ? content.series.find(x => x.id === id) : entity === 'essay' ? content.essays.find(x => x.id === id) : entity === 'favorite' ? content.favorites.find(x => x.id === id) : content.series.flatMap(x => x.photos).find(x => x.id === id);
        if (!found) throw new Error('内容已删除，请刷新页面');
        record = { ...found, [field]: draft };
        if (entity === "series") record.photoOrder = seriesPhotoOrder(found as Series);
      }
      const saved = await fetch('/api/studio', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify({ action: 'upsert', entity, record, ...(entity !== "copy" ? { textFormat: { key: formatKey, style: format, page: textPage, role: textRole } } : {}) }) });
      const result = await saved.json() as { error?: string };
      if (!saved.ok) throw new Error(result.error || '保存失败');
      setOpen(false); toast.success('已保存'); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : '保存失败'); }
    finally { setBusy(false); }
  };
  const attributes = { "data-text-format": encodeURIComponent(formatKey), "data-scoped-format": scopedKey ? encodeURIComponent(scopedKey) : undefined, "data-text-page": textPage, "data-text-role": textRole };
  if (!enabled) return <span {...attributes}>{value}</span>;
  const launch = (event: React.SyntheticEvent) => { event.preventDefault(); event.stopPropagation(); setOpen(true); };
  return <span className="editable-text" {...attributes}>{value}
    <span className="nearby-edit" role="button" tabIndex={0} aria-label={`编辑文字：${value.slice(0, 24)}`} onClick={launch} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') launch(event); }}>编辑</span>
    {open && createPortal(<dialog ref={ref} className="text-edit-dialog" onClick={event => event.stopPropagation()} onCancel={() => setOpen(false)} aria-labelledby={dialogId}>
      <h2 id={dialogId}>编辑文字</h2>
      <div className="text-edit-body">
        <fieldset className="inline-format-controls" disabled={busy || loading}>
          <legend>字体格式</legend>
          <label>字体<select value={format.font} onChange={event => setFormat({ ...format, font: event.target.value as TextFormat["font"] })}><option value="inherit">跟随文字标准</option>{fontOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label>基准字号（px）<input type="number" min={0} max={120} step={1} value={format.size} onChange={event => setFormat({ ...format, size: Number(event.target.value) })}/></label>
          <label>字重<select value={format.bold === null ? "inherit" : format.bold ? "bold" : "normal"} onChange={event => setFormat({ ...format, bold: event.target.value === "inherit" ? null : event.target.value === "bold" })}><option value="inherit">跟随文字标准</option><option value="normal">常规</option><option value="bold">加粗</option></select></label>
          <div className="inline-format-color"><span>字体颜色</span><TextColorPicker key={formatReset} allowInherit defaultColor={standardColor} value={format.color ?? "inherit"} onChange={color => setFormat({ ...format, color })}/></div>
          <button type="button" onClick={() => { setFormat(inheritedFormat()); setFormatReset(current => current + 1); }}>恢复跟随标准</button>
          <small>{standardNote}</small><small>{standardsEnabled ? "格式仅覆盖当前页面中这段文字的用途；字号 0 表示跟随标准，手机保留响应式比例。" : "字号 0 表示默认大小。"}</small>
        </fieldset>
        <textarea style={{ color: resolveTextColor(format.color), fontFamily: format.font === "inherit" ? undefined : fontFamilies[format.font], fontSize: format.size ? `max(var(--editor-font-min, 24px), ${format.size}px)` : undefined, fontWeight: format.bold === null ? undefined : format.bold ? 700 : 400 }} aria-label="文字内容" value={draft} maxLength={entity === 'essay' || entity === 'about' ? 10000 : 5000} onChange={event => setDraft(event.target.value)}/>
      </div>
      <div className="row-actions"><button disabled={busy} onClick={() => setDraft('')}>清空文字</button><button disabled={busy} onClick={() => setOpen(false)}>取消</button><button disabled={busy || loading} onClick={save}>{busy ? '正在保存…' : '保存'}</button></div>
    </dialog>, document.body)}
  </span>;
}
