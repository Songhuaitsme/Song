import { EditableText } from "@/components/editable-text";
import { getViewerContext } from "@/lib/admin-auth";
import type { SiteCopy, CopyPage } from "@/lib/site-copy";
export async function ExtraPageCopy({copy,page}:{copy:SiteCopy;page:CopyPage}) {
  const viewer=await getViewerContext();
  const rows=(copy.extras[page]??[]).filter((row)=>row.text.trim());
  return rows.length ? <div className="extra-page-copy">{rows.map((row)=><p key={row.id}><EditableText value={row.text} field={`extra|${page}|${row.id}`} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>)}</div> : null;
}
