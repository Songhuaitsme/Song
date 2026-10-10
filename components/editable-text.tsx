"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SiteContent } from "@/lib/default-content";
type Entity="copy"|"series"|"essay"|"favorite"|"about"|"photo";
export function EditableText({value,editValue,field,entity="copy",id,enabled,csrf}:{value:string;editValue?:string;field:string;entity?:Entity;id?:string;enabled:boolean;csrf:string}){
 const [open,setOpen]=useState(false),[draft,setDraft]=useState(value),[busy,setBusy]=useState(false);
 const ref=useRef<HTMLDialogElement>(null);const router=useRouter();
 useEffect(()=>{if(open){setDraft(editValue??value);ref.current?.showModal()}},[open,value,editValue]);
 const save=async()=>{setBusy(true);try{
  const res=await fetch('/api/studio',{cache:'no-store'});if(!res.ok)throw new Error('请先登录工作室');const content=await res.json() as SiteContent;
  let record:Record<string,unknown>;
  if(entity==='copy'){
   if(field.startsWith('extra|')){const [,page,rowId]=field.split('|');const extras=content.copy.extras as Record<string,{id:string;text:string}[]>;record={...content.copy,extras:{...extras,[page]:(extras[page]??[]).map(row=>row.id===rowId?{...row,text:draft}:row)}}}
   else record={...content.copy,values:{...content.copy.values,[field]:draft}};
  }
  else if(entity==='about')record={...content.about,[field]:draft};
  else {const found=entity==='series'?content.series.find(x=>x.id===id):entity==='essay'?content.essays.find(x=>x.id===id):entity==='favorite'?content.favorites.find(x=>x.id===id):content.series.flatMap(x=>x.photos).find(x=>x.id===id);if(!found)throw new Error('内容已删除，请刷新页面');record={...found,[field]:draft};}
  const saved=await fetch('/api/studio',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify({action:'upsert',entity,record})});const result=await saved.json() as {error?:string};if(!saved.ok)throw new Error(result.error||'保存失败');setOpen(false);toast.success('已保存');router.refresh();
 }catch(error){toast.error(error instanceof Error?error.message:'保存失败')}finally{setBusy(false)}};
 if(!enabled)return <>{value}</>;
 const launch=(event:React.SyntheticEvent)=>{event.preventDefault();event.stopPropagation();setOpen(true)};
 return <span className="editable-text">{value}<span className="nearby-edit" role="button" tabIndex={0} aria-label={`编辑文字：${value.slice(0,24)}`} onClick={launch} onKeyDown={(event)=>{if(event.key==='Enter'||event.key===' '){launch(event)}}}>编辑</span>{open&&createPortal(<dialog ref={ref} className="text-edit-dialog" onClick={event=>event.stopPropagation()} onCancel={()=>setOpen(false)} aria-labelledby="text-edit-title"><h2 id="text-edit-title">编辑文字</h2><textarea aria-label="文字内容" value={draft} maxLength={entity==='essay'||entity==='about'?10000:5000} onChange={event=>setDraft(event.target.value)}/><div className="row-actions"><button disabled={busy} onClick={()=>setDraft('')}>清空文字</button><button disabled={busy} onClick={()=>setOpen(false)}>取消</button><button disabled={busy} onClick={save}>{busy?'正在保存…':'保存'}</button></div></dialog>,document.body)}</span>;
}
