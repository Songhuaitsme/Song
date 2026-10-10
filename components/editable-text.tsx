"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { fontOptions, textColors, type TextFormat } from "@/lib/site-copy";
import type { SiteContent } from "@/lib/default-content";
type Entity="copy"|"series"|"essay"|"favorite"|"about"|"photo";
export function EditableText({value,editValue,field,entity="copy",id,enabled,csrf}:{value:string;editValue?:string;field:string;entity?:Entity;id?:string;enabled:boolean;csrf:string}){
 const [open,setOpen]=useState(false),[draft,setDraft]=useState(value),[busy,setBusy]=useState(false);
 const formatKey=`${entity}:${id??""}:${field}`;
 const [format,setFormat]=useState<TextFormat>({font:"inherit",size:0,bold:null}),[loading,setLoading]=useState(false);
 const ref=useRef<HTMLDialogElement>(null);const router=useRouter();
 useEffect(()=>{if(!open)return;setDraft(editValue??value);ref.current?.showModal();setLoading(true);const controller=new AbortController();
 fetch('/api/studio',{cache:'no-store',signal:controller.signal}).then(async res=>{if(!res.ok)throw new Error('请先登录工作室');return await res.json() as SiteContent}).then(content=>setFormat(content.copy.textFormats?.[formatKey]??{font:"inherit",size:0,bold:null})).catch(error=>{if(!controller.signal.aborted)toast.error(error.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort();
 },[open,value,editValue,formatKey]);
 const save=async()=>{setBusy(true);try{
  const res=await fetch('/api/studio',{cache:'no-store'});if(!res.ok)throw new Error('请先登录工作室');const content=await res.json() as SiteContent;
  let record:Record<string,unknown>;
  if(entity==='copy'){
   if(field.startsWith('extra|')){const [,page,rowId]=field.split('|');const extras=content.copy.extras as Record<string,{id:string;text:string}[]>;record={...content.copy,extras:{...extras,[page]:(extras[page]??[]).map(row=>row.id===rowId?{...row,text:draft}:row)}}}
   else record={...content.copy,values:{...content.copy.values,[field]:draft}};
   record.textFormats={...content.copy.textFormats,[formatKey]:format};
  }
  else if(entity==='about')record={...content.about,[field]:draft};
  else {const found=entity==='series'?content.series.find(x=>x.id===id):entity==='essay'?content.essays.find(x=>x.id===id):entity==='favorite'?content.favorites.find(x=>x.id===id):content.series.flatMap(x=>x.photos).find(x=>x.id===id);if(!found)throw new Error('内容已删除，请刷新页面');record={...found,[field]:draft};}
  const saved=await fetch('/api/studio',{method:'POST',headers:{'content-type':'application/json','x-csrf-token':csrf},body:JSON.stringify({action:'upsert',entity,record,...(entity!=="copy"?{textFormat:{key:formatKey,style:format}}:{})})});const result=await saved.json() as {error?:string};if(!saved.ok)throw new Error(result.error||'保存失败');setOpen(false);toast.success('已保存');router.refresh();
 }catch(error){toast.error(error instanceof Error?error.message:'保存失败')}finally{setBusy(false)}};
 if(!enabled)return <span data-text-format={encodeURIComponent(formatKey)}>{value}</span>;
 const launch=(event:React.SyntheticEvent)=>{event.preventDefault();event.stopPropagation();setOpen(true)};
 return <span className="editable-text" data-text-format={encodeURIComponent(formatKey)}>{value}<span className="nearby-edit" role="button" tabIndex={0} aria-label={`编辑文字：${value.slice(0,24)}`} onClick={launch} onKeyDown={(event)=>{if(event.key==='Enter'||event.key===' '){launch(event)}}}>编辑</span>{open&&createPortal(<dialog ref={ref} className="text-edit-dialog" onClick={event=>event.stopPropagation()} onCancel={()=>setOpen(false)} aria-labelledby="text-edit-title"><h2 id="text-edit-title">编辑文字</h2><fieldset className="inline-format-controls" disabled={busy||loading}><legend>字体格式</legend><label>字体<select value={format.font} onChange={event=>setFormat({...format,font:event.target.value as TextFormat["font"]})}><option value="inherit">跟随栏目默认</option>{fontOptions.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>字号（px）<input type="number" min={0} max={120} value={format.size} onChange={event=>setFormat({...format,size:Number(event.target.value)})}/></label><label>字重<select value={format.bold===null?"inherit":format.bold?"bold":"normal"} onChange={event=>setFormat({...format,bold:event.target.value==="inherit"?null:event.target.value==="bold"})}><option value="inherit">跟随栏目默认</option><option value="normal">常规</option><option value="bold">加粗</option></select></label><label>字体颜色<select value={format.color??"inherit"} onChange={event=>setFormat({...format,color:event.target.value as TextFormat["color"]})}><option value="inherit">跟随默认颜色</option><option value="black">黑色</option><option value="gray">灰色</option></select></label><button type="button" onClick={()=>setFormat({font:"inherit",size:0,bold:null})}>恢复默认格式</button><small>字号为 0 时跟随栏目默认；格式应用到这段文字。</small></fieldset><textarea style={{color:format.color&&format.color!=="inherit"?textColors[format.color]:undefined,fontFamily:format.font==="song"?'"Songti SC","SimSun",serif':format.font==="kai"?'"KaiTi","STKaiti",serif':format.font==="hei"?'"Microsoft YaHei",sans-serif':format.font==="sans"?'sans-serif':undefined,fontSize:format.size||undefined,fontWeight:format.bold===null?undefined:format.bold?700:400}} aria-label="文字内容" value={draft} maxLength={entity==='essay'||entity==='about'?10000:5000} onChange={event=>setDraft(event.target.value)}/><div className="row-actions"><button disabled={busy} onClick={()=>setDraft('')}>清空文字</button><button disabled={busy} onClick={()=>setOpen(false)}>取消</button><button disabled={busy||loading} onClick={save}>{busy?'正在保存…':'保存'}</button></div></dialog>,document.body)}</span>;
}
