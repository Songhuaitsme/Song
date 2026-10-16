"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/frontend/components/ui/button";
import type { MediaAsset, SyncConflict } from "@/shared/content-model";
import { uploadMediaMultipart } from "@/frontend/upload-media";
import { prepareImageForUpload, formatImageSize, type CompressionMode } from "@/frontend/resize-image";

async function json(url:string,init?:RequestInit):Promise<Record<string,any>>{const response=await fetch(url,init);const body=await response.json() as Record<string,any>;if(!response.ok)throw new Error(body.error??"请求失败");return body;}
export function MediaLibrary({csrfToken,compressionMode,onBusyChange}:{csrfToken:string;compressionMode:CompressionMode;onBusyChange(value:boolean):void}) {
  const [assets,setAssets]=useState<MediaAsset[]>([]),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0);
  const [status,setStatus]=useState(""),[summary,setSummary]=useState("");
  const load=useCallback(()=>json("/api/media").then(data=>setAssets(data.assets)),[]);
  useEffect(()=>{load().catch(error=>toast.error(error.message));},[load]);
  async function upload(files:File[]) {
    if(!files.length||busy)return;
    setBusy(true);onBusyChange(true);setSummary("");
    let done=0,failed=0,sourceBytes=0,storedBytes=0;
    try {
      for(const [index,file] of files.entries()) {
        try {
          setProgress(0);setStatus(`正在处理图片 ${index+1}/${files.length}`);
          const prepared=await prepareImageForUpload(file,compressionMode);
          setStatus(`正在上传 ${index+1}/${files.length}`);
          await uploadMediaMultipart({original:prepared.original,display:prepared.blob,width:prepared.width,height:prepared.height,csrfToken,assignment:"unassigned",onProgress:value=>setProgress(Math.round(value*100))});
          done++;sourceBytes+=file.size;storedBytes+=prepared.original.size;
        } catch(error) {failed++;toast.error(`${file.name}：${error instanceof Error?error.message:"导入失败"}`);}
      }
      await load();
      setSummary(`已导入 ${done} 张${failed?`，${failed} 张未完成`:""}；图片体积合计 ${formatImageSize(sourceBytes)} → ${formatImageSize(storedBytes)}`);
      if(done)toast.success(`已导入 ${done} 张图片并设为私藏`);
    }catch(error){toast.error(error instanceof Error?error.message:"导入失败");}
    finally{setBusy(false);onBusyChange(false);}
  }
  return <section><div className="studio-actions"><div><h2>媒体库</h2><p>使用上方选择的上传方式；未关联图片默认私藏，把展示地址粘贴到照片或收藏后再发布。</p></div><label className="upload-button">{busy?`${status} · ${progress}%`:"批量导入图片"}<input multiple type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>{const files=Array.from(event.target.files??[]);event.target.value="";void upload(files);}}/></label></div>
    {summary&&<p className="privacy-note" role="status">{summary}</p>}
    <div className="media-library-grid">{assets.map(asset=><article className="studio-card" key={asset.id}><img src={asset.displayUrl} alt=""/><h3>{asset.fileName}</h3><p>{asset.width} × {asset.height} · {formatImageSize(asset.size)} · {asset.access}</p><code>{asset.displayUrl}</code></article>)}</div>
    {!assets.length&&<p className="privacy-note">媒体库为空，点击上方按钮可一次选择多张图片。</p>}
  </section>;
}

export function ConflictCenter({csrfToken}:{csrfToken:string}){const[items,setItems]=useState<SyncConflict[]>([]),[busy,setBusy]=useState(false);const load=useCallback(()=>json("/api/sync/conflicts").then(data=>setItems(data.conflicts)),[]);useEffect(()=>{load().catch(error=>toast.error(error.message));},[load]);async function resolve(id:string,resolution:"local"|"remote"){setBusy(true);try{await json("/api/sync/conflicts",{method:"PUT",headers:{"content-type":"application/json","x-csrf-token":csrfToken},body:JSON.stringify({id,resolution})});await load();toast.success("冲突已处理");}catch(error){toast.error(error instanceof Error?error.message:"处理失败");}finally{setBusy(false);}}
return <section><div className="studio-actions"><div><h2>同步冲突</h2><p>两端同时修改同一条内容时不会覆盖；在这里选择保留哪一端。</p></div><Button variant="outline" onClick={()=>load()} disabled={busy}>刷新</Button></div><div className="studio-stack">{items.map(item=><article className="studio-card" key={item.id}><h3>{item.entity} / {item.recordId}</h3><div className="conflict-grid"><details><summary>本地版本 {item.localVersion}</summary><pre>{JSON.stringify(item.localData,null,2)}</pre></details><details><summary>线上版本 {item.remoteVersion}</summary><pre>{JSON.stringify(item.remoteData,null,2)}</pre></details></div><div className="row-actions"><Button disabled={busy} onClick={()=>resolve(item.id,"local")}>采用本地</Button><Button variant="outline" disabled={busy} onClick={()=>resolve(item.id,"remote")}>采用线上</Button></div></article>)}</div>{!items.length&&<p className="privacy-note">当前没有待处理冲突。</p>}</section>}
