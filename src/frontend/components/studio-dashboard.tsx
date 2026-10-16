"use client";
import { SeriesLayoutEditor, type LayoutHistory } from "./series-layout-editor";
import { reconcileLayout, layoutPhotos } from "@/shared/series-layout";
import { moveLayoutPhoto, seriesPhotoOrder } from "@/shared/series-layout-operations";
import { SeriesNarrativeEditor, SeriesPhotoDelete } from "./series-narrative-editor";
import { emptyNarrative, type SeriesNarrative } from "@/shared/series-narrative";
import type { ChapterResolution } from "@/backend/content/series-narrative-store";


import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, ImagePlus, Save, Star, Trash2 } from "lucide-react";
import type { AccessLevel, Essay, Favorite, Photo, Series, SiteContent } from "@/shared/content-model";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Textarea } from "@/frontend/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/frontend/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/frontend/components/ui/alert-dialog";

import { EssayBody } from "@/frontend/components/essay-body";
import { imageMarkup } from "@/shared/essay-body";

import { TextStandardsEditor } from "@/frontend/components/text-standards-editor";
import { PageCopyEditor } from "@/frontend/components/page-copy-editor";
import { ConflictCenter, MediaLibrary } from "@/frontend/components/studio-operations";
import { uploadMediaMultipart } from "@/frontend/upload-media";
import { prepareImageForUpload, formatImageSize, type CompressionMode } from "@/frontend/resize-image";
import { UploadCompressionSettings } from "@/frontend/components/upload-compression-settings";
import { SeriesPhotoUpload } from "@/frontend/components/series-photo-upload";
import { StudioContentList } from "@/frontend/components/studio-content-list";
import { displayOrder, mergeStudioReload, sameStudioValue, studioItemDirty, type BulkAccessResult } from "@/shared/studio-list";

type Entity = "series" | "photo" | "essay" | "favorite" | "about" | "copy";
type StudioTab = "series" | "essays" | "favorites" | "about" | "copy" | "media" | "sync" | "typography";

declare global {
  interface Document {
    modelContext?: { registerTool(tool: { name:string; title?:string; description:string; inputSchema:object; annotations?:{readOnlyHint?:boolean;untrustedContentHint?:boolean}; execute(input:unknown):unknown|Promise<unknown> }, options?:{signal?:AbortSignal}):void|Promise<void> };
  }
}

async function api(body: unknown, csrfToken: string): Promise<Record<string, unknown>> {
  const response = await fetch("/api/studio", { method:"POST", headers:{"content-type":"application/json","x-csrf-token":csrfToken}, body:JSON.stringify(body) });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "操作失败");
  return data;
}

const slugify = (value:string) => value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g,"-").replace(/(^-|-$)/g,"") || `item-${Date.now()}`;
const accessHelp: Record<AccessLevel, string> = { draft: "草稿：仅在工作室和主人视图中显示。", private: "私藏：访客可见标题与简介，正文、照片及收藏详情仅主人可阅读。", public: "公开：所有访客都可以浏览。" };

function AccessSelect({ value, onChange }: { value: AccessLevel; onChange: (value: AccessLevel) => void }) {
  return <label className="access-select"><span>权限</span><NativeSelect value={value} onChange={(event)=>onChange(event.target.value as AccessLevel)} aria-label="内容权限"><NativeSelectOption value="draft">草稿</NativeSelectOption><NativeSelectOption value="private">私藏</NativeSelectOption><NativeSelectOption value="public">公开</NativeSelectOption></NativeSelect></label>;
}

function ConfirmDelete({ onConfirm, disabled }: { onConfirm:()=>void; disabled?:boolean }) {
  return <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" disabled={disabled} aria-label="删除"><Trash2/></Button></AlertDialogTrigger><AlertDialogContent size="sm"><AlertDialogHeader><AlertDialogTitle>确认删除？</AlertDialogTitle><AlertDialogDescription>删除后无法从网站后台恢复。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={onConfirm}>删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

function committedRecord(current: SiteContent, entity: Entity, value: unknown, meta: Record<string,unknown> = {}): SiteContent {
  const record=value as Record<string,unknown>;
  const version={version:typeof meta.version==="number"?meta.version:record.version as number|undefined,updatedAt:typeof meta.updatedAt==="number"?meta.updatedAt:Date.now()};
  if(entity==="series") {
    const previous=current.series.find(item=>item.id===record.id);
    const orders=(meta.photoOrder??[]) as {id:string;sortOrder:number;version:number;updatedAt?:number}[];
    const photos=(previous?.photos??[]).map(photo=>{const order=orders.find(row=>row.id===photo.id);return order?{...photo,...order,updatedAt:order.updatedAt??photo.updatedAt}:photo;}).sort((a,b)=>a.sortOrder-b.sortOrder);
    const storedRecord={...record};delete storedRecord.draftPhotoOrder;
    const saved={...storedRecord,...version,photos,...(Object.hasOwn(meta,"layout")?{layout:meta.layout,narrative:meta.narrative}:{})} as Series;
    return {...current,series:previous?current.series.map(item=>item.id===saved.id?saved:item):[...current.series,saved]};
  }
  if(entity==="photo")return {...current,series:current.series.map(series=>series.id===record.seriesId?{...series,photos:series.photos.some(photo=>photo.id===record.id)?series.photos.map(photo=>photo.id===record.id?{...record,...version} as Photo:photo):[...series.photos,{...record,...version} as Photo]}:series)};
  if(entity==="favorite")return {...current,favorites:current.favorites.some(item=>item.id===record.id)?current.favorites.map(item=>item.id===record.id?{...record,...version} as Favorite:item):[...current.favorites,{...record,...version} as Favorite]};
  if(entity==="essay")return {...current,essays:current.essays.some(item=>item.id===record.id)?current.essays.map(item=>item.id===record.id?{...record,...version} as Essay:item):[...current.essays,{...record,...version} as Essay]};
  if(entity==="copy")return {...current,copy:value as SiteContent["copy"]};
  if(entity==="about")return {...current,about:value as SiteContent["about"]};
  return current;
}

export function StudioDashboard({ initialContent, userName, csrfToken, initialTab }: { initialContent:SiteContent; userName:string; csrfToken:string; initialTab:StudioTab }) {
  const [content,setContent]=useState(initialContent);
  const layoutHistories=useRef(new Map<string,LayoutHistory>());
  const layoutHistory=(id:string)=>{let history=layoutHistories.current.get(id);if(!history){history={past:[],future:[]};layoutHistories.current.set(id,history);}return history;};
  const [savedContent,setSavedContent]=useState(initialContent);
  const savedRef=useRef(initialContent);
  const commitSaved=(change:(current:SiteContent)=>SiteContent)=>{savedRef.current=change(savedRef.current);setSavedContent(savedRef.current);};
  const [seriesReveal,setSeriesReveal]=useState<{id:string;token:number}>();
  const [favoriteReveal,setFavoriteReveal]=useState<{id:string;token:number}>();
  const [essayReveal,setEssayReveal]=useState<{id:string;token:number}>();
  const [busy,setBusy]=useState(false);
  const [compressionMode,setCompressionMode]=useState<CompressionMode>("balanced");
  const [activeTab,setActiveTab]=useState<StudioTab>(initialTab);
  const changeTab=(value:string)=>{setActiveTab(value as StudioTab);const url=new URL(window.location.href);url.searchParams.set("tab",value);url.hash="";window.history.replaceState(window.history.state,"",url);};
  useEffect(()=>{if(!window.location.hash)return;const target=document.getElementById(decodeURIComponent(window.location.hash.slice(1)));if(target){let node:HTMLElement|null=target;while(node){if(node instanceof HTMLDetailsElement)node.open=true;node=node.parentElement}target.scrollIntoView({block:"center"})}},[]);
  const essayInputs = useRef(new Map<string, HTMLTextAreaElement>());
  const photoCount=useMemo(()=>content.series.reduce((sum,item)=>sum+item.photos.length,0),[content.series]);

  const reload=async()=>{const response=await fetch("/api/studio",{cache:"no-store"});if(response.status===403){window.location.assign("/login?returnTo=%2Fstudio");return;}if(!response.ok)throw new Error("无法刷新内容，请重试");const incoming=await response.json() as SiteContent;const before=savedRef.current;setContent(current=>mergeStudioReload(current,before,incoming));commitSaved(()=>incoming);};
  const save=async(entity:Entity,record:unknown,quiet=false)=>{setBusy(true);try{const payload=entity==="series"&&Object.hasOwn(record as object,"layout")?{...record as Series,photoOrder:seriesPhotoOrder(record as Series)}:record;const result=await api({action:"upsert",entity,record:payload},csrfToken);commitSaved(current=>committedRecord(current,entity,record,result));setContent(current=>{const latest=record as {id:string};if(entity==="series")return {...current,series:current.series.map(item=>item.id===latest.id?committedRecord({...current,series:[item]},"series",item,result).series[0]:item)};if(entity==="photo")return {...current,series:current.series.map(item=>({...item,photos:item.photos.map(photo=>photo.id===latest.id?{...photo,version:result.version as number,updatedAt:result.updatedAt as number}:photo)}))};if(entity==="favorite")return {...current,favorites:current.favorites.map(item=>item.id===latest.id?{...item,version:result.version as number,updatedAt:result.updatedAt as number}:item)};if(entity==="essay")return {...current,essays:current.essays.map(item=>item.id===latest.id?{...item,version:result.version as number,updatedAt:result.updatedAt as number}:item)};return current;});if(!quiet)toast.success("已保存");return true;}catch(error){toast.error(error instanceof Error?error.message:"保存失败");return false;}finally{setBusy(false)}};
  const remove=async(entity:Entity,id:string,chapterResolution?:ChapterResolution)=>{
    setBusy(true);
    try {
      const result=await api({action:"delete",entity,id,chapterResolution},csrfToken);
      const update=result.series as {id:string;narrative:SeriesNarrative;version:number;updatedAt:number}|undefined;
      const prune=(current:SiteContent):SiteContent=>({...current,
        series:(entity==="series"?current.series.filter(item=>item.id!==id):entity==="photo"?current.series.map(item=>({...item,photos:item.photos.filter(photo=>photo.id!==id)})):current.series).map(item=>update&&item.id===update.id?{...item,...update}:item),
        favorites:entity==="favorite"?current.favorites.filter(item=>item.id!==id):current.favorites,
        essays:entity==="essay"?current.essays.filter(item=>item.id!==id):current.essays});
      setContent(prune);commitSaved(prune);await reload();toast.success("已删除");return true;
    }catch(error){toast.error(error instanceof Error?error.message:"删除失败");return false;}finally{setBusy(false)}
  };
  const bulkAccess=async(entity:"series"|"favorite"|"essay",ids:string[],access:AccessLevel)=>{setBusy(true);try{const result=await api({action:"set-access",entity,ids,access},csrfToken) as unknown as BulkAccessResult;const merge=(current:SiteContent)=>{const key=entity==="series"?"series":entity==="essay"?"essays":"favorites";return {...current,[key]:current[key].map(item=>{const update=result.updated.find(row=>row.id===item.id);return update?{...item,...update}:item;})};};setContent(merge);commitSaved(merge);return result;}finally{setBusy(false)}};
  const listDirty=content.essays.some(item=>studioItemDirty(item,savedContent.essays.find(saved=>saved.id===item.id)))||content.series.some(item=>studioItemDirty(item,savedContent.series.find(saved=>saved.id===item.id)))||content.favorites.some(item=>studioItemDirty(item,savedContent.favorites.find(saved=>saved.id===item.id)));
  useEffect(()=>{if(!listDirty)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[listDirty]);

  useEffect(()=>{const context=document.modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();const register=async()=>{
    await context.registerTool({name:"list_site_content",title:"列出网站内容",description:"列出 SONG 网站当前的摄影系列、随笔和收藏条目。",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async()=>({series:content.series.map((item)=>({id:item.id,title:item.title,access:item.access,photos:item.photos.length})),essays:content.essays.map((item)=>({id:item.id,title:item.title,access:item.access})),favorites:content.favorites.map((item)=>({id:item.id,title:item.title,access:item.access}))})},{signal:lifecycle.signal});
    await context.registerTool({name:"create_draft_essay",title:"创建随笔草稿",description:"在 SONG 工作室创建一篇随笔草稿。",inputSchema:{type:"object",properties:{title:{type:"string"},body:{type:"string"}},required:["title"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input)=>{const value=input as {title?:string;body?:string};if(!value.title?.trim())throw new Error("标题不能为空");const record={id:crypto.randomUUID(),slug:slugify(value.title),title:value.title.trim(),excerpt:"",body:value.body??"",access:"draft" as const,publishedAt:new Date().toISOString().slice(0,10),sortOrder:content.essays.length+1};await api({action:"upsert",entity:"essay",record},csrfToken);await reload();return {id:record.id,access:record.access};}},{signal:lifecycle.signal});
  };void register().catch(()=>{});return()=>lifecycle.abort();},[content,csrfToken]);

  const updateSeries=(id:string,patch:Partial<Series>)=>setContent((current)=>({...current,series:current.series.map((item)=>{
    if(item.id!==id)return item;const next={...item,...patch};
    if(patch.narrative&&next.layout)next.layout=reconcileLayout(next.layout,next.photos,patch.narrative.chapters);
    return next;
  })}));
  const updatePhoto=(seriesId:string,id:string,patch:Partial<Photo>)=>setContent((current)=>({...current,series:current.series.map((item)=>item.id===seriesId?{...item,photos:item.photos.map((photo)=>photo.id===id?{...photo,...patch}:photo)}:item)}));
  const updateEssay=(id:string,patch:Partial<Essay>)=>setContent((current)=>({...current,essays:current.essays.map((item)=>item.id===id?{...item,...patch}:item)}));
  const updateFavorite=(id:string,patch:Partial<Favorite>)=>setContent((current)=>({...current,favorites:current.favorites.map((item)=>item.id===id?{...item,...patch}:item)}));
  const addSeries=()=>{const id=crypto.randomUUID();setContent((current)=>({...current,series:[...current.series,{id,slug:`new-series-${Date.now()}`,title:"新摄影系列",description:"",coverUrl:"",access:"draft",sortOrder:Math.max(0,...current.series.map(item=>item.sortOrder))+1,photos:[]}]}));setSeriesReveal({id,token:Date.now()});};
  const addEssay=()=>{const id=crypto.randomUUID();setContent((current)=>({...current,essays:[...current.essays,{id,slug:`new-note-${Date.now()}`,title:"新的随笔",excerpt:"",body:"",access:"draft",publishedAt:new Date().toISOString().slice(0,10),sortOrder:Math.max(0,...current.essays.map(item=>item.sortOrder))+1}]}));setEssayReveal({id,token:Date.now()});};
  const addFavorite=()=>{const id=crypto.randomUUID();setContent((current)=>({...current,favorites:[...current.favorites,{id,title:"新的收藏",category:"其他",note:"",imageUrl:"",url:"",access:"draft",sortOrder:Math.max(0,...current.favorites.map(item=>item.sortOrder))+1}]}));setFavoriteReveal({id,token:Date.now()});};

  const persistOrder=async(entity:Entity,records:unknown[])=>{setBusy(true);try{const results=await Promise.allSettled(records.map(async record=>{const payload=entity==="series"&&Object.hasOwn(record as object,"layout")?{...record as Series,photoOrder:seriesPhotoOrder(record as Series)}:record;const result=await api({action:"upsert",entity,record:payload},csrfToken);commitSaved(current=>committedRecord(current,entity,record,result));if(entity==="series"||entity==="favorite"||entity==="essay"){const key=entity==="series"?"series":entity==="essay"?"essays":"favorites";const value=record as Series|Favorite|Essay;setContent(current=>({...current,[key]:displayOrder(current[key].map(item=>item.id===value.id?{...item,sortOrder:value.sortOrder,version:result.version as number,updatedAt:result.updatedAt as number}:item))}));}}));const failed=results.find(result=>result.status==="rejected");if(failed?.status==="rejected")throw failed.reason;toast.success("展示顺序已更新");}catch(error){await reload();toast.error(error instanceof Error?error.message:"排序保存失败");}finally{setBusy(false)}};
  const movePhoto=(series:Series,index:number,direction:-1|1)=>{if(busy)return;const photo=layoutPhotos(series.photos,series.layout,series.draftPhotoOrder)[index];if(!photo)return;const history=layoutHistory(series.id);history.past.push({layout:structuredClone(series.layout??null),order:series.draftPhotoOrder?[...series.draftPhotoOrder]:undefined});history.future.length=0;updateSeries(series.id,{layout:moveLayoutPhoto(series.layout,layoutPhotos(series.photos,null,series.draftPhotoOrder),series.narrative?.chapters??[],photo.id,direction)});toast.success("顺序已调整，保存系列后生效");};
  const refreshUploadedSeries=(fresh:Series)=>{
    const before=savedRef.current.series.find(item=>item.id===fresh.id);
    const expected=before?.layout?reconcileLayout(before.layout,fresh.photos,before.narrative?.chapters):null;
    const concurrent=!!before&&(!sameStudioValue(expected,fresh.layout??null)||!sameStudioValue(before.narrative??emptyNarrative(),fresh.narrative??emptyNarrative())||["title","slug","description","access","sortOrder"].some(key=>before[key as keyof Series]!==fresh[key as keyof Series]));
    commitSaved(current=>({...current,series:current.series.map(item=>item.id===fresh.id?fresh:item)}));
    setContent(current=>({...current,series:current.series.map(item=>{
      if(item.id!==fresh.id)return item;
      const photos=fresh.photos.map(photo=>{const draft=item.photos.find(p=>p.id===photo.id),previous=before?.photos.find(p=>p.id===photo.id);if(!draft||sameStudioValue(draft,previous))return photo;const conflict=!!previous&&photo.version!==previous.version;return {...photo,...draft,version:conflict?draft.version:photo.version,updatedAt:photo.updatedAt,sortOrder:photo.sortOrder};});
      const draftPhotoOrder=item.draftPhotoOrder?[...item.draftPhotoOrder.filter(id=>fresh.photos.some(p=>p.id===id)),...fresh.photos.filter(p=>!item.draftPhotoOrder!.includes(p.id)).map(p=>p.id)]:undefined;
      return {...item,version:concurrent?item.version:fresh.version,updatedAt:fresh.updatedAt,layout:item.layout?reconcileLayout(item.layout,fresh.photos,item.narrative?.chapters):null,draftPhotoOrder,photos};
    })}));
    if(concurrent)toast.error("上传期间系列另有修改，当前排版草稿已保留。请重新载入并核对，避免覆盖新内容。");
  };
  const moveSeries=async(index:number,direction:-1|1)=>{const next=index+direction;if(next<0||next>=content.series.length||busy||content.series.some(item=>studioItemDirty(item,savedRef.current.series.find(saved=>saved.id===item.id))))return;const items=[...content.series];[items[index],items[next]]=[items[next],items[index]];const normalized=items.map((item,itemIndex)=>({...item,sortOrder:itemIndex+1}));await persistOrder("series",normalized.filter(item=>item.sortOrder!==content.series.find(previous=>previous.id===item.id)?.sortOrder));};
  const moveEssay=async(index:number,direction:-1|1)=>{const next=index+direction;if(next<0||next>=content.essays.length||busy||content.essays.some(item=>studioItemDirty(item,savedRef.current.essays.find(saved=>saved.id===item.id))))return;const items=[...content.essays];[items[index],items[next]]=[items[next],items[index]];const normalized=items.map((item,itemIndex)=>({...item,sortOrder:itemIndex+1}));await persistOrder("essay",normalized.filter(item=>item.sortOrder!==content.essays.find(previous=>previous.id===item.id)?.sortOrder));};
  const moveFavorite=async(index:number,direction:-1|1)=>{const next=index+direction;if(next<0||next>=content.favorites.length||busy||content.favorites.some(item=>studioItemDirty(item,savedRef.current.favorites.find(saved=>saved.id===item.id))))return;const items=[...content.favorites];[items[index],items[next]]=[items[next],items[index]];const normalized=items.map((item,itemIndex)=>({...item,sortOrder:itemIndex+1}));await persistOrder("favorite",normalized.filter(item=>item.sortOrder!==content.favorites.find(previous=>previous.id===item.id)?.sortOrder));};

  const insertEssayImage=async(event:React.ChangeEvent<HTMLInputElement>,essay:Essay)=>{
    const file=event.target.files?.[0];if(!file)return;
    setBusy(true);
    try {
      const resized=await prepareImageForUpload(file,compressionMode);
      const result=await uploadMediaMultipart({original:resized.original,display:resized.blob,width:resized.width,height:resized.height,csrfToken,assignment:`essay:${essay.id}`});
      const input=essayInputs.current.get(essay.id);
      const position=input?.selectionStart;
      const markup=imageMarkup(result.imageUrl);
      setContent((current)=>({...current,essays:current.essays.map((item)=>{
        if(item.id!==essay.id)return item;
        const at=Math.min(position??item.body.length,item.body.length);
        return {...item,body:item.body.slice(0,at)+"\n\n"+markup+"\n\n"+item.body.slice(at)};
      })}));
      toast.success(`图片已插入（${formatImageSize(file.size)} → ${formatImageSize(resized.original.size)}），点击保存后生效`);
    }catch(error){toast.error(error instanceof Error?error.message:"图片插入失败");}
    finally{setBusy(false);event.target.value="";}
  };

  const setCover=async(series:Series,photo:Photo)=>{const updated={...series,coverUrl:photo.imageUrl};updateSeries(series.id,{coverUrl:photo.imageUrl});await save("series",updated);};
  const addUploadedPhoto=(photo:Photo)=>{setContent(current=>({...current,series:current.series.map(series=>series.id===photo.seriesId?{...series,photos:series.photos.some(item=>item.id===photo.id)?series.photos:[...series.photos,photo].sort((a,b)=>a.sortOrder-b.sortOrder)}:series)}));commitSaved(current=>committedRecord(current,"photo",photo));};

  return <div className="studio-shell"><header className="studio-top"><div><span>SONG / 工作室</span><h1>内容编辑</h1><p>{userName} · {content.series.length} 个系列 · {photoCount} 张照片</p></div><div className="studio-top-actions"><a href="/" target="_blank" rel="noreferrer"><Eye/>查看网站</a><form action="/api/auth/logout" method="post"><input type="hidden" name="csrf" value={csrfToken}/><input type="hidden" name="returnTo" value="/"/><button type="submit">退出登录</button></form></div></header>
    <UploadCompressionSettings value={compressionMode} onChange={setCompressionMode} disabled={busy}/>
    <Tabs value={activeTab} onValueChange={changeTab}><TabsList variant="line" className="studio-tabs"><TabsTrigger disabled={busy} value="series">摄影</TabsTrigger><TabsTrigger disabled={busy} value="essays">随笔</TabsTrigger><TabsTrigger disabled={busy} value="favorites">收藏</TabsTrigger><TabsTrigger disabled={busy} value="about">关于</TabsTrigger><TabsTrigger disabled={busy} value="copy">首页与导航</TabsTrigger><TabsTrigger disabled={busy} value="typography">文字标准</TabsTrigger><TabsTrigger disabled={busy} value="media">媒体库</TabsTrigger><TabsTrigger disabled={busy} value="sync">同步冲突</TabsTrigger></TabsList>
      <TabsContent value="series"><StudioContentList items={content.series} savedItems={savedContent.series} entity="series" busy={busy} reveal={seriesReveal} onCreate={addSeries} onSetAccess={(ids,access)=>bulkAccess("series",ids,access)} renderEditor={(series,index,canReorder)=><><div className="studio-card-head"><span className="sort-position">顺序 {String(index+1).padStart(2,"0")}</span><Input value={series.title} onChange={(event)=>updateSeries(series.id,{title:event.target.value,slug:slugify(event.target.value)})} aria-label="系列标题"/><AccessSelect value={series.access} onChange={(value)=>updateSeries(series.id,{access:value})}/><Button variant="outline" size="icon" disabled={busy||!canReorder||index===0} onClick={()=>moveSeries(index,-1)} aria-label="系列上移"><ArrowUp/></Button><Button variant="outline" size="icon" disabled={busy||!canReorder||index===content.series.length-1} onClick={()=>moveSeries(index,1)} aria-label="系列下移"><ArrowDown/></Button><Button disabled={busy} onClick={()=>save("series",series)}><Save/>保存系列</Button><ConfirmDelete disabled={busy} onConfirm={()=>remove("series",series.id)}/></div><p className="privacy-note">{accessHelp[series.access]}</p><label>系列短简介<Textarea aria-label="系列短简介" value={series.description} maxLength={3000} onChange={(event)=>updateSeries(series.id,{description:event.target.value})} placeholder="用于摄影目录和私藏系列的介绍"/></label><SeriesNarrativeEditor series={series} copy={content.copy} busy={busy} onChange={(narrative)=>updateSeries(series.id,{narrative})} onSave={()=>{void save("series",series);}}/>{!sameStudioValue(series.narrative??emptyNarrative(),savedContent.series.find(item=>item.id===series.id)?.narrative??emptyNarrative())&&<p className="privacy-note">系列文字有未保存更改，请先保存，再删除照片。</p>}<SeriesLayoutEditor series={series} copy={content.copy} busy={busy} history={layoutHistory(series.id)} onHistoryChange={(history)=>layoutHistories.current.set(series.id,history)} onChange={(draft)=>updateSeries(series.id,{layout:draft.layout,draftPhotoOrder:draft.order})} onSave={()=>{void save("series",series);}}/><div className="photo-admin-list">{layoutPhotos(series.photos,series.layout,series.draftPhotoOrder).map((photo,photoIndex)=><article id={photo.id} key={photo.id}><div className="photo-admin-preview"><span>第 {String(photoIndex+1).padStart(2,"0")} 张</span><img src={photo.imageUrl} alt=""/></div><div><label>替代文字<span className="series-writing-hint">客观描述画面，帮助无法看到图片的读者理解内容。</span><Input value={photo.alt} onChange={(event)=>updatePhoto(series.id,photo.id,{alt:event.target.value})} placeholder="画面中有哪些主体、环境与动作"/></label><label>作品注释（可选）<span className="series-writing-hint">补充现场细节、拍摄取舍或个人发现；建议 20～80 字。</span><Textarea value={photo.caption} maxLength={3000} onChange={(event)=>updatePhoto(series.id,photo.id,{caption:event.target.value})} placeholder="照片注释"/></label><Input value={photo.location} onChange={(event)=>updatePhoto(series.id,photo.id,{location:event.target.value})} placeholder="地点（可选）"/><Input type="date" value={photo.takenAt} onChange={(event)=>updatePhoto(series.id,photo.id,{takenAt:event.target.value})} aria-label="拍摄日期"/><div className="row-actions"><Button variant="outline" size="icon" disabled={busy||photoIndex===0} onClick={()=>movePhoto(series,photoIndex,-1)} aria-label="照片上移"><ArrowUp/></Button><Button variant="outline" size="icon" disabled={busy||photoIndex===series.photos.length-1} onClick={()=>movePhoto(series,photoIndex,1)} aria-label="照片下移"><ArrowDown/></Button><Button variant="outline" onClick={()=>setCover(series,photo)} disabled={busy||series.coverUrl===photo.imageUrl}><Star/>{series.coverUrl===photo.imageUrl?"当前封面":"设为封面"}</Button><Button disabled={busy} onClick={()=>save("photo",photo)}><Save/>保存</Button><SeriesPhotoDelete series={series} photo={photo} busy={busy} narrativeDirty={!sameStudioValue(series.narrative??emptyNarrative(),savedContent.series.find(item=>item.id===series.id)?.narrative??emptyNarrative())||!sameStudioValue(series.layout??null,savedContent.series.find(item=>item.id===series.id)?.layout??null)||!!series.draftPhotoOrder} onConfirm={(resolution)=>remove("photo",photo.id,resolution)}/></div></div></article>)}</div><SeriesPhotoUpload series={series} csrfToken={csrfToken} compressionMode={compressionMode} busy={busy} onBusyChange={setBusy} onPhotoAdded={addUploadedPhoto} onSeriesRefreshed={refreshUploadedSeries} onSeriesSaved={(record)=>commitSaved(current=>committedRecord(current,"series",record))} onCoverChange={(coverUrl)=>{updateSeries(series.id,{coverUrl});commitSaved(current=>({...current,series:current.series.map(item=>item.id===series.id?{...item,coverUrl}:item)}));}}/></>}/><details className="studio-page-copy"><summary>页面文字设置</summary><PageCopyEditor pages={["series","story"]} value={content.copy} busy={busy} onChange={(copy)=>setContent((current)=>({...current,copy}))} onSave={()=>save("copy",content.copy)}/></details></TabsContent>
      <TabsContent value="essays"><StudioContentList items={content.essays} savedItems={savedContent.essays} entity="essay" busy={busy} reveal={essayReveal} onCreate={addEssay} onSetAccess={(ids,access)=>bulkAccess("essay",ids,access)} renderEditor={(item,index,canReorder)=><><div className="studio-card-head"><span className="sort-position">顺序 {String(index+1).padStart(2,"0")}</span><Input value={item.title} onChange={(event)=>updateEssay(item.id,{title:event.target.value,slug:slugify(event.target.value)})} aria-label="随笔标题"/><AccessSelect value={item.access} onChange={(value)=>updateEssay(item.id,{access:value})}/><Button variant="outline" size="icon" disabled={busy||!canReorder||index===0} onClick={()=>moveEssay(index,-1)} aria-label="随笔上移"><ArrowUp/></Button><Button variant="outline" size="icon" disabled={busy||!canReorder||index===content.essays.length-1} onClick={()=>moveEssay(index,1)} aria-label="随笔下移"><ArrowDown/></Button><Button disabled={busy} onClick={()=>save("essay",item)}><Save/>保存</Button><ConfirmDelete disabled={busy} onConfirm={()=>remove("essay",item.id)}/></div><p className="privacy-note">{accessHelp[item.access]}</p><label>发布日期<Input type="date" value={item.publishedAt} onChange={(event)=>updateEssay(item.id,{publishedAt:event.target.value})}/></label><Input value={item.excerpt} onChange={(event)=>updateEssay(item.id,{excerpt:event.target.value})} placeholder="摘要"/><label className="essay-image-upload"><ImagePlus/>插入图片<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event)=>insertEssayImage(event,item)}/></label><p className="privacy-note">在正文中定位光标后插入图片；图片说明可填在图片标记的方括号内，删除整行标记即可移除图片。插入后请点击保存。</p><Textarea ref={(node)=>{if(node)essayInputs.current.set(item.id,node);else essayInputs.current.delete(item.id);}} className="essay-editor" value={item.body} onChange={(event)=>updateEssay(item.id,{body:event.target.value})} placeholder="使用空行分隔段落"/><details className="essay-preview"><summary>预览正文与图片</summary><EssayBody body={item.body}/></details></>}/><details className="studio-page-copy"><summary>页面文字设置</summary><PageCopyEditor pages={["essays","essay"]} value={content.copy} busy={busy} onChange={(copy)=>setContent((current)=>({...current,copy}))} onSave={()=>save("copy",content.copy)}/></details></TabsContent>
      <TabsContent value="favorites"><StudioContentList items={content.favorites} savedItems={savedContent.favorites} entity="favorite" busy={busy} reveal={favoriteReveal} onCreate={addFavorite} onSetAccess={(ids,access)=>bulkAccess("favorite",ids,access)} renderEditor={(item,index,canReorder)=><><div className="studio-card-head"><span className="sort-position">顺序 {String(index+1).padStart(2,"0")}</span><Input value={item.title} onChange={(event)=>updateFavorite(item.id,{title:event.target.value})} aria-label="收藏标题"/><AccessSelect value={item.access} onChange={(value)=>updateFavorite(item.id,{access:value})}/><Button variant="outline" size="icon" disabled={busy||!canReorder||index===0} onClick={()=>moveFavorite(index,-1)} aria-label="收藏上移"><ArrowUp/></Button><Button variant="outline" size="icon" disabled={busy||!canReorder||index===content.favorites.length-1} onClick={()=>moveFavorite(index,1)} aria-label="收藏下移"><ArrowDown/></Button><Button disabled={busy} onClick={()=>save("favorite",item)}><Save/>保存</Button><ConfirmDelete disabled={busy} onConfirm={()=>remove("favorite",item.id)}/></div><p className="privacy-note">{accessHelp[item.access]}</p><div className="favorite-fields"><Input value={item.category} onChange={(event)=>updateFavorite(item.id,{category:event.target.value})} placeholder="分类"/><Input value={item.url} onChange={(event)=>updateFavorite(item.id,{url:event.target.value})} placeholder="外部链接（可选）"/></div><Input value={item.imageUrl} onChange={(event)=>updateFavorite(item.id,{imageUrl:event.target.value})} placeholder="图片地址（可选）"/><Textarea value={item.note} onChange={(event)=>updateFavorite(item.id,{note:event.target.value})} placeholder="为什么喜欢它"/></>}/><details className="studio-page-copy"><summary>页面文字设置</summary><PageCopyEditor pages={["collection"]} value={content.copy} busy={busy} onChange={(copy)=>setContent((current)=>({...current,copy}))} onSave={()=>save("copy",content.copy)}/></details></TabsContent>
      <TabsContent value="about"><PageCopyEditor pages={["about"]} value={content.copy} busy={busy} onChange={(copy)=>setContent((current)=>({...current,copy}))} onSave={()=>save("copy",content.copy)}/><div className="studio-actions"><div><h2>关于页</h2><p>编辑标题、介绍与补充说明，保存后会显示在公开的关于页。</p></div><a href="/about" target="_blank" rel="noreferrer">查看关于页</a></div><section className="studio-card about-editor"><label htmlFor="about-title">标题</label><Textarea id="about-title" maxLength={200} value={content.about.title} onChange={(event)=>setContent((current)=>({...current,about:{...current.about,title:event.target.value}}))}/><p className="privacy-note">按回车换行；清空标题可隐藏。</p><label htmlFor="about-body">介绍正文</label><Textarea id="about-body" className="essay-editor" maxLength={10000} value={content.about.body} onChange={(event)=>setContent((current)=>({...current,about:{...current.about,body:event.target.value}}))}/><p className="privacy-note">使用空行分隔段落。</p><label htmlFor="about-note">补充说明 / 联系方式（可选）</label><Textarea id="about-note" maxLength={2000} value={content.about.note} onChange={(event)=>setContent((current)=>({...current,about:{...current.about,note:event.target.value}}))}/><div className="row-actions"><Button disabled={busy} onClick={()=>save("about",content.about)}><Save/>{busy ? "正在保存…" : "保存关于页"}</Button></div></section></TabsContent>
      <TabsContent value="typography"><TextStandardsEditor series={content.series} value={content.copy} busy={busy} onSave={async(copy)=>{setBusy(true);try{const result=await api({action:"typography",entity:"copy",record:{textStandards:copy.textStandards}},csrfToken);setContent(current=>({...current,copy:{...current.copy,textStandards:(result.copy as SiteContent["copy"]).textStandards}}));toast.success("文字标准已保存");}catch(error){toast.error(error instanceof Error?error.message:"保存失败");}finally{setBusy(false)}}}/></TabsContent>
      <TabsContent value="copy"><PageCopyEditor pages={["global","home"]} value={content.copy} busy={busy} onChange={(copy)=>setContent((current)=>({...current,copy}))} onSave={()=>save("copy",content.copy)}/></TabsContent>
      <TabsContent value="media"><MediaLibrary csrfToken={csrfToken} compressionMode={compressionMode} onBusyChange={setBusy}/></TabsContent>
      <TabsContent value="sync"><ConflictCenter csrfToken={csrfToken}/></TabsContent>
    </Tabs></div>;
}
