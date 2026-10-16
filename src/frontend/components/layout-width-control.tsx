"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";

export function LayoutWidthControl({ index, value, onChange }: {
  index: number; value?: number; onChange(value: number | undefined, recordHistory: boolean): void;
}) {
  const [input, setInput] = useState(String(value ?? ""));
  const gestureChanged = useRef(false);
  useEffect(() => { setInput(String(value ?? "")); }, [value]);
  const valid = input === "" ? value === undefined : Number.isInteger(Number(input)) && Number(input) >= 25 && Number(input) <= 100;
  const resetGesture = () => { gestureChanged.current = false; };
  return <fieldset className="layout-width-control">
    <legend>展示宽度 <span>{value === undefined ? "模板默认" : `${value}% · 居中`}</span></legend>
    <div className="layout-width-presets" role="group" aria-label={`第 ${index} 组宽度预设`}>
      <Button size="sm" variant="outline" aria-pressed={value === undefined} onClick={() => onChange(undefined, true)}>模板默认</Button>
      {[100, 85, 70, 55].map(width => <Button key={width} size="sm" variant="outline" aria-pressed={value === width} onClick={() => onChange(width, true)}>{width}%</Button>)}
    </div>
    <div className="layout-width-inputs">
      <input type="range" min="25" max="100" step="1" value={value ?? 100} aria-label={`第 ${index} 组展示宽度`} aria-valuetext={value === undefined ? "模板默认；滑动以设置百分比" : `${value}%`} onPointerDown={resetGesture} onPointerUp={resetGesture} onPointerCancel={resetGesture} onKeyUp={resetGesture} onBlur={resetGesture} onChange={event => {
        onChange(Number(event.target.value), !gestureChanged.current); gestureChanged.current = true;
      }}/>
      <label><span className="sr-only">第 {index} 组宽度百分比</span><input type="number" min="25" max="100" step="1" value={input} placeholder="默认" aria-label={`第 ${index} 组宽度百分比`} aria-invalid={!valid} onChange={event => {
        const text = event.target.value; setInput(text);
        if (text !== "" && Number.isInteger(Number(text)) && Number(text) >= 25 && Number(text) <= 100) onChange(Number(text), true);
      }} onBlur={() => setInput(String(value ?? ""))} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }}/><span>%</span></label>
    </div>
    <p className="series-writing-hint" role={valid ? undefined : "alert"}>{valid ? "25%～100%，相对于正文版心；手机始终逐张全宽。" : "请输入 25～100 的整数，当前无效输入不会保存。"}</p>
  </fieldset>;
}
