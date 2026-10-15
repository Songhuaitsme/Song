"use client";

import { useEffect, useId, useState } from "react";
import { resolveTextColor, type TextColor } from "@/shared/site-copy";
import { colorPalette, isHexColor } from "@/shared/text-standards";

export function TextColorPicker({ value, onChange, allowInherit = false, defaultColor = "#242824" }: { value: TextColor | string; onChange: (color: TextColor) => void; allowInherit?: boolean; defaultColor?: string }) {
  const id = useId();
  const resolved = resolveTextColor(value as TextColor) ?? defaultColor;
  const [hex, setHex] = useState(resolved);
  useEffect(() => setHex(resolved), [resolved]);
  const choose = (color: TextColor) => { setHex(resolveTextColor(color) ?? defaultColor); onChange(color); };
  return <div className="text-color-picker">
    {allowInherit && <label className="color-inherit"><input type="checkbox" checked={value === "inherit"} onChange={event => choose(event.target.checked ? "inherit" : resolved as TextColor)}/>跟随文字标准</label>}
    <div className="text-color-swatches" role="group" aria-label="常用颜色">{colorPalette.map(([label, color]) => <button type="button" key={color} aria-label={`${label} ${color}`} title={`${label} ${color}`} aria-pressed={value !== "inherit" && resolved.toLowerCase() === color} style={{ backgroundColor: color }} onClick={() => choose(color)}/>)}</div>
    <div className="text-color-custom"><input type="color" aria-label="自定义取色器" value={resolved} onChange={event => choose(event.target.value as TextColor)}/><label htmlFor={id}>HEX</label><input id={id} aria-label="六位 HEX 颜色" type="text" value={hex} maxLength={7} pattern="#[0-9a-fA-F]{6}" required spellCheck={false} onChange={event => { const next = event.target.value; setHex(next); if (isHexColor(next)) onChange(next as TextColor); }}/></div>
    {!isHexColor(hex) && <small className="color-error">请输入完整颜色，例如 #365f83。</small>}
  </div>;
}
