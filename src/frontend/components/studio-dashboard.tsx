"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, ImagePlus, Plus, Save, Star, Trash2 } from "lucide-react";
import type { AccessLevel, Essay, Favorite, Photo, Series, SiteContent } from "@/shared/content-model";
import { Button } from "@/frontend/components/ui/button";
import { Input } from "@/frontend/components/ui/input";
import { Textarea } from "@/frontend/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/frontend/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/frontend/components/ui/alert-dialog";

import { EssayBody } from "@/frontend/components/essay-body";
import { imageMarkup } from "@/shared/essay-body";

import { PageCopyEditor } from "@/frontend/components/page-copy-editor";
import { ConflictCenter, MediaLibrary } from "@/frontend/components/studio-operations";
import { uploadMediaMultipart } from "@/frontend/upload-media";

type Entity = "series" | "photo" | "essay" | "favorite" | "about" | "copy";
type StudioTab = "series" | "essays" | "favorites" | "about" | "copy" | "media" | "sync";

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
  useEffect(()=>{if(!window.location.hash)return;const target=document.getElementById(decodeURIComponent(window.location.hash.slice(1)));if(target){let node:HTMLElement|null=target;while(node){if(node instanceof HTMLDetailsElement)node.open=true;node=node.parentElement}target.scrollIntoView({block:"center"})}},[]);
  const essayInputs = useRef(new Map<string, HTMLTextAreaElement>());
  const photoCount=useMemo(()=>content.series.reduce((sum,item)=>sum+item.photos.length,0),[content.series]);

  const reload=async()=>{const response=await fetch("/api/studio",{cache:"no-store"});if(response.status===403){window.location.assign("/login?returnTo=%2Fstudio");return;}if(response.ok)setContent(await response.json())};
  const save=async(entity:Entity,record:unknown,quiet=false)=>{setBusy(true);try{await api({action:"upsert",entity,record},csrfToken);if(!quiet)toast.success("已保存");}catch(error){toast.error(error instanceof Error?error.message:"保存失败");}finally{setBusy(false)}};
  const remove=async(entity:Entity,id:string)=>{try{await api({action:"delete",entity,id},csrfToken);await reload();toast.success("已删除");}catch(error){toast.error(error instanceof Error?error.message:"删除失败")}};

  useEffect(()=>{const context=document.modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();const register=async()=>{
    await context.registerTool({name:"list_site_content",title:"列出网站内容",description:"列出 SONG 网站当前的摄影系列、随笔和收藏条目。",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async()=>({series:content.series.map((item)=>({id:item.id,title:item.title,access:item.access,photos:item.photos.length})),essays:content.essays.map((item)=>({id:item.id,title:item.title,access:item.access})),favorites:content.favorites.map((item)=>({id:item.id,title:item.title,access:item.access}))})},{signal:lifecycle.signal});
    await context.registerTool({name:"create_draft_essay",title:"创建随笔草稿",description:"在 SONG 工作室创建一篇随笔草稿。",inputSchema:{type:"object",properties:{title:{type:"string"},body:{type:"string"}},required:["title"],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async(input)=>{const value=input as {title?:string;body?:string};if(!value.title?.trim())throw new Error("标题不能为空");const record={id:crypto.randomUUID(),slug:slugify(value.title),title:value.title.trim(),excerpt:"",body:value.body??"",access:"draft" as const,publishedAt:new Date().toISOString().slice(0,10),sortOrder:content.essays.length+1};await api({action:"upsert",entity:"essay",record},csrfToken);await reload();return {id:record.id,access:record.access};}},{signal:lifecycle.signal});
  };void register().catch(()=>{});return()=>lifecycle.abort();},[content,csrfToken]);

  const updateSeries=(id:string,patch:Partial<Series>)=>setContent((current)=>({...current,series:current.series.map((item)=>item.id===id?{...item,...patch}:item)}));
  const updatePhoto=(seriesId:string,id:string,patch:Partial<Photo>)=>setContent((current)=>({...current,series:current.series.map((item)=>item.id===seriesId?{...item,photos:item.photos.map((photo)=>photo.id===id?{...photo,...patch}:photo)}:item)}));
  const updateEssay=(id:string,patch:Partial<Essay>)=>setContent((current)=>({...current,essays:current.essays.map((item)=>item.id===id?{...item,...patch}:item)}));
  const updateFavorite=(id:string,patch:Partial<Favorite>)=>setContent((current)=>({...current,favorites:current.favorites.map((item)=>item.id===id?{...item,...patch}:item)}));
  const addSeries=()=>{const id=crypto.randomUUID();setContent((current)=>({...current,series:[...current.series,{id,slug:`new-series-${Date.now()}`,title:"新摄影系列",description:"",coverUrl:"",access:"draft",sortOrder:current.series.length+1,photos:[]}]}));requestAnimationFrame(()=>{const target=document.getElementById(id);if(target instanceof HTMLDetailsElement){target.open=true;target.scrollIntoView({block:"start",behavior:"smooth"})}})};
  const addEssay=()=>setContent((current)=>({...current,essays:[...current.essays,{id:crypto.randomUUID(),slug:`new-note-${Date.now()}`,title:"新的随笔",excerpt:"",body:"",access:"draft",publishedAt:new Date().toISOString().slice(0,10),sortOrder:current.essays.length+1}]}));
  const addFavorite=()=>setContent((current)=>({...current,favorites:[...current.favorites,{id:crypto.randomUUID(),title:"新的收藏",category:"其他",note:"",imageUrl:"",url:"",access:"draft",sortOrder:current.favorites.length+1}]}));

  const persistOrder=async(entity:Entity,records:unknown[])=>{setBusy(true);try{await Promise.all(records.map((record)=>api({action:"upsert",entity,record},csrfToken)));toast.success("展示顺序已更新");}catch(error){await reload();toast.error(error instanceof Error?error.message:"排序保存失败");}finally{setBusy(false)}};
  const movePhoto=async(series:Series,index:number,direction:-1|1)=>{const next=index+direction;if(next<0||next>=series.photos.length||busy)return;const photos=[...series.photos];[photos[index],photos[next]]=[photos[next],photos[index]];const normalized=photos.map((item,itemIndex)=>({...item,sortOrder:itemIndex+1}));setContent((current)=>({...current,series:current.series.map((item)=>item.id===series.id?{...item,photos:normalized}:item)}));await persistOrder("photo",[normalized[index],normalized[next]]);};
  const moveSeries=async(index:number,direction:-1|1)=>{const next=index+direction;if(next<0||next>=content.series.length||busy)return;const items=[...content.series];[items[index],items[next]]=[items[next],items[index]];const normalized=items.map((item,itemIndex)=>({...item,sortOrder:itemIndex+1}));setContent((current)=>({...current,series:normalized}));await persistOrder("series",[normalized[index],normalized[next]]);};
  const moveEssay=async(index:number,direction:-1|1)=>{const next=index+direction;if(next<0||next>=content.essays.length||busy)return;const items=[...content.essays];[items[index],items[next]]=[items[next],items[index]];const normalized=items.map((item,itemIndex)=>({...item,sortOrder:itemIndex+1}));setContent((current)=>({...current,essays:normalized}));await persistOrder("essay",[normalized[index],normalized[next]]);};
  const moveFavorite=async(index:number,direction:-1|1)=>{const next=index+direction;if(next<0||next>=content.favorites.length||busy)return;const items=[...content.favorites];[items[index],items[next]]=[items[next],items[index]];const normalized=items.map((item,itemIndex)=>({...item,sortOrder:itemIndex+1}));setContent((current)=>({...current,favorites:normalized}));await persistOrder("favorite",[normalized[index],normalized[next]]);};

  const insertEssayImage=async(event:React.ChangeEvent<HTMLInputElement>,essay:Essay)=>{
    const file=event.target.files?.[0];if(!file)return;
    setBusy(true);
    try {
      if(file.size>25*1024*1024)throw new Error("图片不能超过 25MB");
      if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("仅支持 JPEG、PNG 或 WebP 图片");
      const resized=await resizeForWeb(file);
      const result=await uploadMediaMultipart({original:file,display:resized.blob,width:resized.width,height:resized.height,csrfToken,assignment:`essay:${essay.id}`});
      const input=essayInputs.current.get(essay.id);
      const position=input?.selectionStart;
      const markup=imageMarkup(result.imageUrl);
      setContent((current)=>({...current,essays:current.essays.map((item)=>{
        if(item.id!==essay.id)return item;
        const at=Math.min(position??item.body.length,item.body.length);
        return {...item,body:item.body.slice(0,at)+"\n\n"+markup+"\n\n"+item.body.slice(at)};
      })}));
      toast.success("图片已插入，点击保存后生效");
    }catch(error){toast.error(error instanceof Error?error.message:"图片插入失败");}
    finally{setBusy(false);event.target.value="";}
  };

  const setCover=async(series:Series,photo:Photo)=>{const updated={...series,coverUrl:photo.imageUrl};updateSeries(series.id,{coverUrl:photo.imageUrl});await save("series",updated);};
  const upload=async(event:React.ChangeEvent<HTMLInputElement>,series:Series)=>{const file=event.target.files?.[0];if(!file)return;setBusy(true);try{const resized=await resizeForWeb(file);const result=await uploadMediaMultipart({original:file,display:resized.blob,width:resized.width,height:resized.height,csrfToken,assignment:`series:${series.id}`});const photo:Photo={id:crypto.randomUUID(),seriesId:series.id,imageUrl:result.imageUrl,originalUrl:result.originalUrl,width:resized.width,height:resized.height,alt:"新上传的摄影作品",caption:"",location:"",takenAt:"",sortOrder:series.photos.length+1};await api({action:"upsert",entity:"photo",record:photo},csrfToken);if(!series.coverUrl)await api({action:"upsert",entity:"series",record:{...series,coverUrl:photo.imageUrl}},csrfToken);await reload();toast.success("照片已上传");}catch(error){toast.error(error instanceof Error?error.message:"上传失败");}finally{setBusy(false);event.target.value=""}};

  return <div className="studio-shell"><header className="studio-top"><div><span>SONG / 工作室</span><h1>内容编辑</h1><p>{userName} · {content.series.length} 个系列 · {photoCount} 张照片</p></div><div className="studio-top-actions"><a href="/" target="_blank" rel="noreferrer"><Eye/>查看网站</a><form action="/api/auth/logout" method="post"><input type="hidden" name="csrf" value={csrfToken}/><input type="hidden" name="returnTo" value="/"/><button type="submit">退出登录</button></form></div></header>
    <Tabs defaultValue={initialTab}><TabsList variant="line" className="studio-tabs"><TabsTrigger value="series">摄影</TabsTrigger><TabsTrigger value="essays">随笔</TabsTrigger><TabsTrigger value="favorites">收藏</TabsTrigger><TabsTrigger value="about">关于</TabsTrigger><TabsTrigger value="copy">首页与导航</TabsTrigger><TabsTrigger value="media">媒体库</TabsTrigger><TabsTrigger value="sync">同步冲突</TabsTrigger></TabsList>
      <TabsContent value="series"><PageCopyEditor pages={["series","story"]} value={content.copy} busy={busy} onChange={(copy)=>setContent((current)=>({...current,copy}))} onSave={()=>save("copy",content.copy)}/><div className="studio-actions"><div><h2>摄影系列</h2><p>使用箭头决定系列在摄影页的展示顺序；第 1 个系列会成为顶部主视觉。</p></div><div className="row-actions"><Button variant="outline" onClick={()=>document.querySelectorAll<HTMLDetailsElement>(".series-editor").forEach((item)=>item.open=true)}>展开全部</Button><Button variant="outline" onClick={()=>document.querySelectorAll<HTMLDetailsElement>(".series-editor").forEach((item)=>item.open=false)}>折叠全部</Button><Button onClick={addSeries}><Plus/>新建系列</Button></div></div>{content.series.map((series,index)=><details className="studio-card series-editor" id={series.id} key={series.id}><summary><span>{series.title || "未命名系列"}</span><small>{series.photos.length} 张照片 · 点击展开 / 折叠</small></summary><div className="studio-card-head"><span className="sort-position">顺序 {String(index+1).padStart(2,"0")}</span><Input value={series.title} onChange={(event)=>updateSeries(series.id,{title:event.target.value,slug:slugify(event.target.value)})} aria-label="系列标题"/><AccessSelect value={series.access} onChange={(value)=>updateSeries(series.id,{access:value})}/><Button variant="outline" size="icon" disabled={busy||index===0} onClick={()=>moveSeries(index,-1)} aria-label="系列上移"><ArrowUp/></Button><Button variant="outline" size="icon" disabled={busy||index===content.series.length-1} onClick={()=>moveSeries(index,1)} aria-label="系列下移"><ArrowDown/></Button><Button disabled={busy} onClick={()=>save("series",series)}><Save/>保存系列</Button><ConfirmDelete onConfirm={()=>remove("series",series.id)}/></div><p className="privacy-note">{accessHelp[series.access]}</p><Textarea value={series.description} onChange={(event)=>updateSeries(series.id,{description:event.target.value})} placeholder="系列简介"/><div className="photo-admin-list">{series.photos.map((photo,photoIndex)=><article id={photo.id} key={photo.id}><div className="photo-admin-preview"><span>第 {String(photoIndex+1).padStart(2,"0")} 张</span><img src={photo.imageUrl} alt=""/></div><div><Input value={photo.alt} onChange={(event)=>updatePhoto(series.id,photo.id,{alt:event.target.value})} placeholder="替代文字"/><Textarea value={photo.caption} onChange={(event)=>updatePhoto(series.id,photo.id,{caption:event.target.value})} placeholder="照片注释"/><Input value={photo.location} onChange={(event)=>updatePhoto(series.id,photo.id,{location:event.target.value})} placeholder="地点（可选）"/><Input type="date" value={photo.takenAt} onChange={(event)=>updatePhoto(series.id,photo.id,{takenAt:event.target.value})} aria-label="拍摄日期"/><div className="row-actions"><Button variant="outline" size="icon" disabled={busy||photoIndex===0} onClick={()=>movePhoto(series,photoIndex,-1)} aria-label="照片上移"><ArrowUp/></Button><Button variant="outline" size="icon" disabled={busy||photoIndex===series.photos.length-1} onClick={()=>movePhoto(series,photoIndex,1)} aria-label="照片下移"><ArrowDown/></Button><Button variant="outline" onClick={()=>setCover(series,photo)} disabled={busy||series.coverUrl===photo.imageUrl}><Star/>{series.coverUrl===photo.imageUrl?"当前封面":"设为封面"}</Button><Button disabled={busy} onClick={()=>save("photo",photo)}><Save/>保存</Button><ConfirmDelete onConfirm={()=>remove("photo",photo.id)}/></div></div></article>)}</div><label className="upload-button"><ImagePlus/>上传照片<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event)=>upload(event,series)} disabled={busy}/></label></details>)}</TabsContent>
      <TabsContent value="essays"><PageCopyEditor pages={["essays","essay"]} value={content.copy} busy={busy} onChange={(copy)=>setContent((current)=>({...current,copy}))} onSave={()=>save("copy",content.copy)}/><div className="studio-actions"><div><h2>随笔</h2><p>从上到下即为随笔列表的公开展示顺序。</p></div><Button onClick={addEssay}><Plus/>新建随笔</Button></div><div className="studio-stack">{content.essays.map((item,index)=><section className="studio-card" id={item.id} key={item.id}><div className="studio-card-head"><span className="sort-position">顺序 {String(index+1).padStart(2,"0")}</span><Input value={item.title} onChange={(event)=>updateEssay(item.id,{title:event.target.value,slug:slugify(event.target.value)})} aria-label="随笔标题"/><AccessSelect value={item.access} onChange={(value)=>updateEssay(item.id,{access:value})}/><Button variant="outline" size="icon" disabled={busy||index===0} onClick={()=>moveEssay(index,-1)} aria-label="随笔上移"><ArrowUp/></Button><Button variant="outline" size="icon" disabled={busy||index===content.essays.length-1} onClick={()=>moveEssay(index,1)} aria-label="随笔下移"><ArrowDown/></Button><Button disabled={busy} onClick={()=>save("essay",item)}><Save/>保存</Button><ConfirmDelete onConfirm={()=>remove("essay",item.id)}/></div><p className="privacy-note">{accessHelp[item.access]}</p><label>发布日期<Input type="date" value={item.publishedAt} onChange={(event)=>updateEssay(item.id,{publishedAt:event.target.value})}/></label><Input value={item.excerpt} onChange={(event)=>updateEssay(item.id,{excerpt:event.target.value})} placeholder="摘要"/><label className="essay-image-upload"><ImagePlus/>插入图片<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event)=>insertEssayImage(event,item)}/></label><p className="privacy-note">在正文中定位光标后插入图片；图片说明可填在图片标记的方括号内，删除整行标记即可移除图片。插入后请点击保存。</p><Textarea ref={(node)=>{if(node)essayInputs.current.set(item.id,node);else essayInputs.current.delete(item.id);}} className="essay-editor" value={item.body} onChange={(event)=>updateEssay(item.id,{body:event.target.value})} placeholder="使用空行分隔段落"/><details className="essay-preview"><summary>预览正文与图片</summary><EssayBody body={item.body}/></details></section>)}</div></TabsContent>
      <TabsContent value="favorites"><PageCopyEditor pages={["collection"]} value={content.copy} busy={busy} onChange={(copy)=>setContent((current)=>({...current,copy}))} onSave={()=>save("copy",content.copy)}/><div className="studio-actions"><div><h2>收藏</h2><p>使用箭头调整收藏条目在公开页面中的先后位置。</p></div><Button onClick={addFavorite}><Plus/>新增收藏</Button></div><div className="studio-stack">{content.favorites.map((item,index)=><section className="studio-card" id={item.id} key={item.id}><div className="studio-card-head"><span className="sort-position">顺序 {String(index+1).padStart(2,"0")}</span><Input value={item.title} onChange={(event)=>updateFavorite(item.id,{title:event.target.value})} aria-label="收藏标题"/><AccessSelect value={item.access} onChange={(value)=>updateFavorite(item.id,{access:value})}/><Button variant="outline" size="icon" disabled={busy||index===0} onClick={()=>moveFavorite(index,-1)} aria-label="收藏上移"><ArrowUp/></Button><Button variant="outline" size="icon" disabled={busy||index===content.favorites.length-1} onClick={()=>moveFavorite(index,1)} aria-label="收藏下移"><ArrowDown/></Button><Button disabled={busy} onClick={()=>save("favorite",item)}><Save/>保存</Button><ConfirmDelete onConfirm={()=>remove("favorite",item.id)}/></div><p className="privacy-note">{accessHelp[item.access]}</p><div className="favorite-fields"><Input value={item.category} onChange={(event)=>updateFavorite(item.id,{category:event.target.value})} placeholder="分类"/><Input value={item.url} onChange={(event)=>updateFavorite(item.id,{url:event.target.value})} placeholder="外部链接（可选）"/></div><Input value={item.imageUrl} onChange={(event)=>updateFavorite(item.id,{imageUrl:event.target.value})} placeholder="图片地址（可选）"/><Textarea value={item.note} onChange={(event)=>updateFavorite(item.id,{note:event.target.value})} placeholder="为什么喜欢它"/></section>)}</div></TabsContent>
      <TabsContent value="about"><PageCopyEditor pages={["about"]} value={content.copy} busy={busy} onChange={(copy)=>setContent((current)=>({...current,copy}))} onSave={()=>save("copy",content.copy)}/><div className="studio-actions"><div><h2>关于页</h2><p>编辑标题、介绍与补充说明，保存后会显示在公开的关于页。</p></div><a href="/about" target="_blank" rel="noreferrer">查看关于页</a></div><section className="studio-card about-editor"><label htmlFor="about-title">标题</label><Textarea id="about-title" maxLength={200} value={content.about.title} onChange={(event)=>setContent((current)=>({...current,about:{...current.about,title:event.target.value}}))}/><p className="privacy-note">按回车换行；清空标题可隐藏。</p><label htmlFor="about-body">介绍正文</label><Textarea id="about-body" className="essay-editor" maxLength={10000} value={content.about.body} onChange={(event)=>setContent((current)=>({...current,about:{...current.about,body:event.target.value}}))}/><p className="privacy-note">使用空行分隔段落。</p><label htmlFor="about-note">补充说明 / 联系方式（可选）</label><Textarea id="about-note" maxLength={2000} value={content.about.note} onChange={(event)=>setContent((current)=>({...current,about:{...current.about,note:event.target.value}}))}/><div className="row-actions"><Button disabled={busy} onClick={()=>save("about",content.about)}><Save/>{busy ? "正在保存…" : "保存关于页"}</Button></div></section></TabsContent>
      <TabsContent value="copy"><PageCopyEditor pages={["global","home"]} value={content.copy} busy={busy} onChange={(copy)=>setContent((current)=>({...current,copy}))} onSave={()=>save("copy",content.copy)}/></TabsContent>
      <TabsContent value="media"><MediaLibrary csrfToken={csrfToken}/></TabsContent>
      <TabsContent value="sync"><ConflictCenter csrfToken={csrfToken}/></TabsContent>
    </Tabs></div>;
}
