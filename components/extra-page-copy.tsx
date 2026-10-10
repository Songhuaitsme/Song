import type { SiteCopy, CopyPage } from "@/lib/site-copy";
export function ExtraPageCopy({copy,page}:{copy:SiteCopy;page:CopyPage}) {
  const rows=(copy.extras[page]??[]).filter((row)=>row.text.trim());
  return rows.length ? <div className="extra-page-copy">{rows.map((row)=><p key={row.id}>{row.text}</p>)}</div> : null;
}
