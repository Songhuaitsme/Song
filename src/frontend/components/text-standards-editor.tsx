"use client";

import { useEffect, useRef, useState } from "react";
import { fontOptions, pageGroups, type SiteCopy } from "@/shared/site-copy";
import { defaultStandard, enableTextStandards, fontFamilies, previewPixels, resolveStandard, standardDefinitions, standardId, standardSize, updateStandard, type StandardStyle, type TextStandards } from "@/shared/text-standards";
import { Button } from "@/frontend/components/ui/button";
import { TextColorPicker } from "@/frontend/components/text-color-picker";
import { StoryCoverPreview } from "@/frontend/components/story-cover-preview";
import type { Series } from "@/shared/content-model";

export function TextStandardsEditor({ value, busy, onSave, series = [] }: { value: SiteCopy; busy: boolean; onSave: (copy: SiteCopy) => Promise<void>; series?: Series[] }) {
  const [draft, setDraft] = useState<TextStandards>(() => structuredClone(enableTextStandards(value).textStandards!));
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [resetGeneration, setResetGeneration] = useState(0), [groupResets, setGroupResets] = useState<Record<string, number>>({});
  const lastSaved = useRef(value);
  useEffect(() => { if (lastSaved.current === value) return; lastSaved.current = value; setDraft(structuredClone(enableTextStandards(value).textStandards!)); }, [value]);
  const update = (key: string, style: StandardStyle) => setDraft(current => updateStandard(current, key, style));
  const changed = JSON.stringify(draft) !== JSON.stringify(enableTextStandards(value).textStandards);
  const cancel = () => { setDraft(structuredClone(enableTextStandards(value).textStandards!)); setResetGeneration(current => current + 1); };
  return <form className="text-standards-editor" onSubmit={event => { event.preventDefault(); void onSave({ ...enableTextStandards(value), textStandards: draft }); }}>
    <div className="studio-actions"><div><h2>全站文字标准</h2><p>{value.textStandards ? "已启用。新内容自动跟随标准，单条格式只影响对应页面和用途。" : "尚未启用。下面为已确认的标准预览；点击“应用并保存标准”后生效，旧格式保留归档。"}</p></div><Button type="submit" disabled={busy || (!!value.textStandards && !changed)}>{busy ? "正在保存…" : value.textStandards ? "保存文字标准" : "应用并保存标准"}</Button></div>
    <div className="standard-toolbar"><label>样例预览<select value={device} onChange={event => setDevice(event.target.value as typeof device)}><option value="desktop">桌面 · 1440px</option><option value="mobile">移动 · 390px</option></select></label><Button type="button" variant="outline" disabled={busy} onClick={cancel}>取消修改</Button><p>字号 0 表示保留当前页面的响应式默认值。首页桌面字号为基准的 1.3 倍；手机按原有标题比例缩小。行距和字距沿用原设置。</p></div>
    <fieldset className="standard-fieldset" disabled={busy}>
      {pageGroups.map(([page, label]) => <details className="studio-card standard-page-group" key={page} open={page === "home" || page === "story"}><summary>{label}</summary>{(page === "story" || page === "series") && <StoryCoverPreview page={page} copy={{ ...enableTextStandards(value), textStandards: draft }} series={series} device={device}/>} {standardDefinitions.filter(def => def.page === page).map(def => {
        const key = standardId(def.page, def.role);
        const style = resolveStandard(draft, def);
        const previewSize = standardSize(def, style, device);
        // Evaluate viewport-based sizes in an isolated iframe using the selected
        // viewport, so a phone preview never uses the studio window's vw units.
        const document = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:${def.role.startsWith("overlay") ? "#242824" : "#f7f7f4"};color:${style.color};font-family:${fontFamilies[style.font]};font-size:${previewSize};font-weight:${style.bold ? 700 : 400};line-height:1.5;overflow-wrap:anywhere}</style><body>${def.sample}</body></html>`;
        return <section className="standard-row" key={key} id={`standard-${key}`}>
          <div className="standard-row-heading"><h3>{def.label}</h3><Button type="button" variant="outline" onClick={() => { update(key, defaultStandard(def)); setGroupResets(current => ({ ...current, [key]: (current[key] ?? 0) + 1 })); }}>恢复该组标准</Button></div>
          <div className="standard-controls"><label>字体<select value={style.font} onChange={event => update(key, { ...style, font: event.target.value as StandardStyle["font"] })}>{fontOptions.map(([font, name]) => <option value={font} key={font}>{name}</option>)}</select></label><label>基准字号（px）<input type="number" min={0} max={120} step={1} value={style.size} onChange={event => update(key, { ...style, size: Number(event.target.value) })}/><small>0 为响应式默认；自定义为 10–120</small></label><label>字重<select value={style.bold ? "bold" : "normal"} onChange={event => update(key, { ...style, bold: event.target.value === "bold" })}><option value="normal">常规 · 400</option><option value="bold">加粗 · 700</option></select></label><div><span>颜色</span><TextColorPicker key={`${resetGeneration}:${groupResets[key] ?? 0}`} value={style.color} onChange={color => update(key, { ...style, color })}/></div></div>
          <p className="standard-size-note">当前标准：{fontOptions.find(([font]) => font === style.font)?.[1]} · {style.color} · {style.bold ? "700" : "400"}；{device === "desktop" ? "桌面" : "移动"}实际字号：<strong>{previewPixels(def, style, device)}px</strong>{style.size === 0 && "（响应式默认）"}</p>
          <div className={`standard-preview standard-preview-${device}`}><iframe title={`${label}：${def.label}样例`} sandbox="" srcDoc={document} style={{ width: device === "desktop" ? 1440 : 390 }}/></div>
        </section>;
      })}</details>)}
    </fieldset>
    <div className="row-actions"><Button type="button" variant="outline" disabled={busy} onClick={cancel}>取消修改</Button><Button type="submit" disabled={busy || (!!value.textStandards && !changed)}>{value.textStandards ? "保存文字标准" : "应用并保存标准"}</Button></div>
  </form>;
}
