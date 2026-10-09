"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, ImagePlus, Plus, Save, Star, Trash2 } from "lucide-react";
import type { AccessLevel, Essay, Favorite, Photo, Series, SiteContent } from "@/lib/default-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type Entity = "series" | "photo" | "essay" | "favorite";
type StudioTab = "series" | "essays" | "favorites";

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
const accessHelp: Record<AccessLevel, string> = { draft: "草稿：仅在工作室和主人视图中显示。", private: "私藏：主人可阅读，访客地址返回不存在。", public: "公开：所有访客都可以浏览。" };

function AccessSelect({ value, onChange }: { value: AccessLevel; onChange: (value: AccessLevel) => void }) {
  return <label className="access-select"><span>权限</span><NativeSelect value={value} onChange={(event)=>onChange(event.target.value as AccessLevel)} aria-label="内容权限"><NativeSelectOption value="draft">草稿</NativeSelectOption><NativeSelectOption value="private">私藏</NativeSelectOption><NativeSelectOption value="public">公开</NativeSelectOption></NativeSelect></label>;
}

function ConfirmDelete({ onConfirm }: { onConfirm:()=>void }) {
  return <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label="删除"><Trash2/></Button></AlertDialogTrigger><AlertDialogContent size="sm"><AlertDialogHeader><AlertDialogTitle>确认删除？</AlertDialogTitle><AlertDialogDescription>删除后无法从网站后台恢复。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={onConfirm}>删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

async function resizeForWeb(file:File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
  const width=Math.round(bitmap.width*scale), height=Math.round(bitmap.height*scale);
  const canvas=document.createElement("canvas"); canvas.width=width; canvas.height=height;
  canvas.getContext("2d")!.drawImage(bitmap,0,0,width,height);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob((value)=>value?resolve(value):reject(new Error("图片处理失败")),"image/webp",.86));
  bitmap.close();
  return {blob,width,height};
}

export function StudioDashboard({ initialContent, userName, csrfToken, initialTab }: { initialContent:SiteContent; userName:string; csrfToken:string; initialTab:StudioTab }) {
  const [content,setContent]=useState(initialContent);
  const [busy,setBusy]=useState(false);
  const photoCount=useMemo(()=>content.series.reduce((sum,item)=>sum+item.photos.length,0),[content.series]);

  const reload=async()=>{const response=await fetch("/api/studio",{cache:"no-store"});if(response.status===403){window.location.assign("/login?returnTo=%2Fstudio");return;}if(response.ok)setContent(await response.json())};
  const save=async(entity:Entity,record:unknown,quiet=false)=>{setBusy(true);try{await api({action:"upsert",entity,record},csrfToken);if(!quiet)toast.success("已保存");}catch(error){toast.error(error instanceof Error?error.message:"保存失败");}finally{setBusy(false)}};
  const remove=async(entity:Entity,id:string)=>{try{await api({action:"delete",entity,id},csrfToken);await reload();toast.success("已删除");}catch(error){toast.error(error instanceof Error?error.message:"删除失败")}};

  useEffect(()=>{const context=document.modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();const register=async()=>{
    await context.registerTool({name:"list_site_content",title:"列出网站内容",description:"列出 SONG 网站当前的摄影系列、随笔和收藏条目。",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async()=>({series:content.series.map((item)=>({id:item.id,title:item.title,access:item.access,photos:item.photos.length})),essays:content.essays.map((item)=>({id:item.id,title:item.title,access:item.access})),favorites:content.favorites.map((item)=>({id:item.id,title:item.title,access:item.access}))})},{signal:lifecycle.signal});
    await context.registerTool({name:"create_draft_essay",title:"创建随笔草稿",description:"在 SONG 工作室创建一篇随笔草稿。",inputSchema:{type:"object",properties:{title:{type:"string"},body:{type:"string"}},required:["title"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input)=>{const value=input as {title?:string;body?:string};if(!value.title?.trim())throw new Error("标题不能为空");const record={id:crypto.randomUUID(),slug:slugify(value.title),title:value.title.trim(),excerpt:"",body:value.body??"",access:"draft" as const,publishedAt:new Date().toISOString().slice(0,10)};await api({action:"upsert",entity:"essay",record},csrfToken);await reload();return {id:record.id,access:record.access};}},{signal:lifecycle.signal});
  };void register().catch(()=>{});return()=>lifecycle.abort();},[content,csrfToken]);

  const updateSeries=(id:string,patch:Partial<Series>)=>setContent((current)=>({...current,series:current.series.map((item)=>item.id===id?{...item,...patch}:item)}));
  const updatePhoto=(seriesId:string,id:string,patch:Partial<Photo>)=>setContent((current)=>({...current,series:current.series.map((item)=>item.id===seriesId?{...item,photos:item.photos.map((photo)=>photo.id===id?{...photo,...patch}:photo)}:item)}));
  const updateEssay=(id:string,patch:Partial<Essay>)=>setContent((current)=>({...current,essays:current.essays.map((item)=>item.id===id?{...item,...patch}:item)}));
  const updateFavorite=(id:string,patch:Partial<Favorite>)=>setContent((current)=>({...current,favorites:current.favorites.map((item)=>item.id===id?{...item,...patch}:item)}));
  const addSeries=()=>setContent((current)=>({...current,series:[...current.series,{id:crypto.randomUUID(),slug:`new-series-${Date.now()}`,title:"新摄影系列",description:"",coverUrl:"",access:"draft",sortOrder:current.series.length+1,photos:[]}]}));
  const addEssay=()=>setContent((current)=>({...current,essays:[{id:crypto.randomUUID(),slug:`new-note-${Date.now()}`,title:"新的随笔",excerpt:"",body:"",access:"draft",publishedAt:new Date().toISOString().slice(0,10)},...current.essays]}));
  const addFavorite=()=>setContent((current)=>({...current,favorites:[...current.favorites,{id:crypto.randomUUID(),title:"新的收藏",category:"其他",note:"",imageUrl:"",url:"",access:"draft",sortOrder:current.favorites.length+1}]}));

  const movePhoto=async(series:Series,index:number,direction:-1|1)=>{const next=index+direction;if(next<0||next>=series.photos.length)return;const photos=[...series.photos];[photos[index],photos[next]]=[photos[next],photos[index]];const normalized=photos.map((item,itemIndex)=>({...item,sortOrder:itemIndex+1}));setContent((current)=>({...current,series:current.series.map((item)=>item.id===series.id?{...item,photos:normalized}:item)}));await Promise.all([save("photo",normalized[index],true),save("photo",normalized[next],true)]);toast.success("顺序已更新");};
  const moveSeries=async(index:number,direction:-1|1)=>{const next=index+direction;if(next<0||next>=content.series.length)return;const items=[...content.series];[items[index],items[next]]=[items[next],items[index]];const normalized=items.map((item,itemIndex)=>({...item,sortOrder:itemIndex+1}));setContent((current)=>({...current,series:normalized}));await Promise.all([save("series",normalized[index],true),save("series",normalized[next],true)]);toast.success("顺序已更新");};
  const moveFavorite=async(index:number,direction:-1|1)=>{const next=index+direction;if(next<0||next>=content.favorites.length)return;const items=[...content.favorites];[items[index],items[next]]=[items[next],items[index]];const normalized=items.map((item,itemIndex)=>({...item,sortOrder:itemIndex+1}));setContent((current)=>({...current,favorites:normalized}));await Promise.all([save("favorite",normalized[index],true),save("favorite",normalized[next],true)]);toast.success("顺序已更新");};

  const setCover=async(series:Series,photo:Photo)=>{const updated={...series,coverUrl:photo.imageUrl};updateSeries(series.id,{coverUrl:photo.imageUrl});await save("series",updated);};
  const upload=async(event:React.ChangeEvent<HTMLInputElement>,series:Series)=>{const file=event.target.files?.[0];if(!file)return;setBusy(true);try{const resized=await resizeForWeb(file);const form=new FormData();form.append("original",file);form.append("display",new File([resized.blob],"display.webp",{type:"image/webp"}));const response=await fetch("/api/upload",{method:"POST",headers:{"x-csrf-token":csrfToken},body:form});const result=await response.json() as {imageUrl?:string;originalUrl?:string;error?:string};if(!response.ok||!result.imageUrl||!result.originalUrl)throw new Error(result.error||"上传失败");const photo:Photo={id:crypto.randomUUID(),seriesId:series.id,imageUrl:result.imageUrl,originalUrl:result.originalUrl,width:resized.width,height:resized.height,alt:"新上传的摄影作品",caption:"",location:"",takenAt:"",sortOrder:series.photos.length+1};await api({action:"upsert",entity:"photo",record:photo},csrfToken);if(!series.coverUrl)await api({action:"upsert",entity:"series",record:{...series,coverUrl:photo.imageUrl}},csrfToken);await reload();toast.success("照片已上传");}catch(error){toast.error(error instanceof Error?error.message:"上传失败");}finally{setBusy(false);event.target.value=""}};

  return <div className="studio-shell"><header className="studio-top"><div><span>SONG / 工作室</span><h1>内容编辑</h1><p>{userName} · {content.series.length} 个系列 · {photoCount} 张照片</p></div><div className="studio-top-actions"><a href="/" target="_blank" rel="noreferrer"><Eye/>查看网站</a><form action="/api/auth/logout" method="post"><input type="hidden" name="csrf" value={csrfToken}/><input type="hidden" name="returnTo" value="/"/><button type="submit">退出登录</button></form></div></header>
    <Tabs defaultValue={initialTab}><TabsList variant="line" className="studio-tabs"><TabsTrigger value="series">摄影</TabsTrigger><TabsTrigger value="essays">随笔</TabsTrigger><TabsTrigger value="favorites">收藏</TabsTrigger></TabsList>
      <TabsContent value="series"><div className="studio-actions"><h2>摄影系列</h2><Button onClick={addSeries}><Plus/>新建系列</Button></div>{content.series.map((series,index)=><section className="studio-card" id={series.id} key={series.id}><div className="studio-card-head"><Input value={series.title} onChange={(event)=>updateSeries(series.id,{title:event.target.value,slug:slugify(event.target.value)})} aria-label="系列标题"/><AccessSelect value={series.access} onChange={(value)=>updateSeries(series.id,{access:value})}/><Button variant="outline" size="icon" onClick={()=>moveSeries(index,-1)} aria-label="系列上移"><ArrowUp/></Button><Button variant="outline" size="icon" onClick={()=>moveSeries(index,1)} aria-label="系列下移"><ArrowDown/></Button><Button disabled={busy} onClick={()=>save("series",series)}><Save/>保存系列</Button><ConfirmDelete onConfirm={()=>remove("series",series.id)}/></div><p className="privacy-note">{accessHelp[series.access]}</p><Textarea value={series.description} onChange={(event)=>updateSeries(series.id,{description:event.target.value})} placeholder="系列简介"/><div className="photo-admin-list">{series.photos.map((photo,photoIndex)=><article key={photo.id}><img src={photo.imageUrl} alt=""/><div><Input value={photo.alt} onChange={(event)=>updatePhoto(series.id,photo.id,{alt:event.target.value})} placeholder="替代文字"/><Textarea value={photo.caption} onChange={(event)=>updatePhoto(series.id,photo.id,{caption:event.target.value})} placeholder="照片注释"/><Input value={photo.location} onChange={(event)=>updatePhoto(series.id,photo.id,{location:event.target.value})} placeholder="地点（可选）"/><div className="row-actions"><Button variant="outline" size="icon" onClick={()=>movePhoto(series,photoIndex,-1)} aria-label="照片上移"><ArrowUp/></Button><Button variant="outline" size="icon" onClick={()=>movePhoto(series,photoIndex,1)} aria-label="照片下移"><ArrowDown/></Button><Button variant="outline" onClick={()=>setCover(series,photo)} disabled={series.coverUrl===photo.imageUrl}><Star/>{series.coverUrl===photo.imageUrl?"当前封面":"设为封面"}</Button><Button disabled={busy} onClick={()=>save("photo",photo)}><Save/>保存</Button><ConfirmDelete onConfirm={()=>remove("photo",photo.id)}/></div></div></article>)}</div><label className="upload-button"><ImagePlus/>上传照片<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event)=>upload(event,series)} disabled={busy}/></label></section>)}</TabsContent>
      <TabsContent value="essays"><div className="studio-actions"><h2>随笔</h2><Button onClick={addEssay}><Plus/>新建随笔</Button></div><div className="studio-stack">{content.essays.map((item)=><section className="studio-card" id={item.id} key={item.id}><div className="studio-card-head"><Input value={item.title} onChange={(event)=>updateEssay(item.id,{title:event.target.value,slug:slugify(event.target.value)})} aria-label="随笔标题"/><AccessSelect value={item.access} onChange={(value)=>updateEssay(item.id,{access:value})}/><Button disabled={busy} onClick={()=>save("essay",item)}><Save/>保存</Button><ConfirmDelete onConfirm={()=>remove("essay",item.id)}/></div><p className="privacy-note">{accessHelp[item.access]}</p><Input value={item.excerpt} onChange={(event)=>updateEssay(item.id,{excerpt:event.target.value})} placeholder="摘要"/><Textarea className="essay-editor" value={item.body} onChange={(event)=>updateEssay(item.id,{body:event.target.value})} placeholder="使用空行分隔段落"/></section>)}</div></TabsContent>
      <TabsContent value="favorites"><div className="studio-actions"><h2>收藏</h2><Button onClick={addFavorite}><Plus/>新增收藏</Button></div><div className="studio-stack">{content.favorites.map((item,index)=><section className="studio-card" id={item.id} key={item.id}><div className="studio-card-head"><Input value={item.title} onChange={(event)=>updateFavorite(item.id,{title:event.target.value})} aria-label="收藏标题"/><AccessSelect value={item.access} onChange={(value)=>updateFavorite(item.id,{access:value})}/><Button variant="outline" size="icon" onClick={()=>moveFavorite(index,-1)} aria-label="收藏上移"><ArrowUp/></Button><Button variant="outline" size="icon" onClick={()=>moveFavorite(index,1)} aria-label="收藏下移"><ArrowDown/></Button><Button disabled={busy} onClick={()=>save("favorite",item)}><Save/>保存</Button><ConfirmDelete onConfirm={()=>remove("favorite",item.id)}/></div><p className="privacy-note">{accessHelp[item.access]}</p><div className="favorite-fields"><Input value={item.category} onChange={(event)=>updateFavorite(item.id,{category:event.target.value})} placeholder="分类"/><Input value={item.url} onChange={(event)=>updateFavorite(item.id,{url:event.target.value})} placeholder="外部链接（可选）"/></div><Input value={item.imageUrl} onChange={(event)=>updateFavorite(item.id,{imageUrl:event.target.value})} placeholder="图片地址（可选）"/><Textarea value={item.note} onChange={(event)=>updateFavorite(item.id,{note:event.target.value})} placeholder="为什么喜欢它"/></section>)}</div></TabsContent>
    </Tabs></div>;
}
