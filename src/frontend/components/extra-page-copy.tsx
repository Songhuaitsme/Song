import { EditableText } from "@/frontend/components/editable-text";
import { getViewerContext } from "@/backend/auth/admin-auth";
import type { SiteCopy, CopyPage } from "@/shared/site-copy";
export async function ExtraPageCopy({copy,page}:{copy:SiteCopy;page:CopyPage}) {
  const viewer=await getViewerContext();
  const rows=(copy.extras[page]??[]).filter((row)=>row.text.trim());
  return rows.length ? <div className="extra-page-copy">{rows.map((row)=><p data-text-page={page} data-text-role="body" key={row.id}><EditableText textPage={page} textRole="body" value={row.text} field={`extra|${page}|${row.id}`} enabled={viewer.ownerMode} csrf={viewer.csrfToken??""}/></p>)}</div> : null;
}
