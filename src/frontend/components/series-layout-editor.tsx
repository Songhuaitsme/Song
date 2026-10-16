"use client";
import { useRef, useState, type PointerEvent, type CSSProperties } from "react";
import { toast } from "sonner";
import type { Series, SiteContent } from "@/shared/content-model";
import { automaticLayout, layoutTemplates, layoutIds, layoutPhotos, reconcileLayout, type SeriesLayout, type LayoutGroup } from "@/shared/series-layout";
import { editLayout, type LayoutCommand, type LayoutDraft } from "@/shared/series-layout-operations";
import { SeriesStoryPreview } from "./series-narrative-editor";
import { Button } from "./ui/button";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";

export type LayoutHistory = { past: LayoutDraft[]; future: LayoutDraft[] };
type Drag = { type: "photo" | "group"; id: string; x: number; y: number; moved: boolean };
export function SeriesLayoutEditor({ series, copy, busy, history, onHistoryChange, onChange, onSave }: {
  series: Series; copy: SiteContent["copy"]; busy: boolean; history: LayoutHistory;
  onHistoryChange(history: LayoutHistory): void;
  onChange(value: LayoutDraft): void; onSave(): void;
}) {
  const layout = series.layout ?? null, chapters = series.narrative?.chapters ?? [];
  const [preview, setPreview] = useState(false), [status, setStatus] = useState(""), [dragging, setDragging] = useState(false);
  const [target, setTarget] = useState("");
  const drag = useRef<Drag | null>(null), cropDrag = useRef<{ x:number; y:number; startX:number; startY:number; width:number; height:number; groupId:string; photoId:string; layout:SeriesLayout } | null>(null);
  const root = useRef<HTMLElement>(null);
  const snapshot = (): LayoutDraft => ({layout:structuredClone(layout),order:series.draftPhotoOrder?[...series.draftPhotoOrder]:undefined});
  const commit = (value: SeriesLayout | null, message = "排版已更新，保存后生效", recordHistory = true, restore?:LayoutDraft) => {
    const next = value ? reconcileLayout(value, series.photos, chapters) : null;
    const order=next?undefined:restore?restore.order:layout?layoutIds(layout):series.draftPhotoOrder;
    if (JSON.stringify({layout:next,order}) === JSON.stringify({layout,order:series.draftPhotoOrder})) return;
    if (recordHistory) onHistoryChange({past:[...history.past,snapshot()].slice(-100),future:[]});
    onChange({layout:next,order}); setStatus(message);
  };
  const command = (value: LayoutCommand) => {
    if (!layout) return;
    try {
      const next = editLayout(layout, value, series.photos, chapters);
      const split = value.type.startsWith("move") && next.groups.length > layout.groups.length + (value.type === "move-photo" && !value.groupId ? 1 : 0);
      commit(next, split ? "已按新的章节边界拆分组合，可撤销。保存后生效。" : undefined);
    } catch(error) { const message=error instanceof Error?error.message:"无法调整排版";setStatus(message);toast.error(message); }
  };
  const updateGroup = (id: string, change: Partial<LayoutGroup>) => { if(layout)commit({...layout,groups:layout.groups.map(group=>group.id===id?{...group,...change}:group)}); };
  const undo = (redo = false) => {
    const source=redo?history.future:history.past, destination=redo?history.past:history.future;
    if(!source.length)return;onHistoryChange(redo?{past:[...destination,snapshot()],future:source.slice(0,-1)}:{past:source.slice(0,-1),future:[...destination,snapshot()]});const previous=source[source.length-1];commit(previous.layout,redo?"已重做，保存后生效":"已撤销，保存后生效",false,previous);
  };
  const start = (event: PointerEvent<HTMLButtonElement>, type: Drag["type"], id: string) => {
    if(busy||event.button!==0)return;event.currentTarget.setPointerCapture(event.pointerId);drag.current={type,id,x:event.clientX,y:event.clientY,moved:false};
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const current=drag.current;if(!current)return;
    if(Math.hypot(event.clientX-current.x,event.clientY-current.y)>6){current.moved=true;setDragging(true);const hit=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-layout-drop]');setTarget(hit?.dataset.layoutDrop??"");
      const bounds=root.current?.getBoundingClientRect();if(bounds&&event.clientY>innerHeight-70)window.scrollBy(0,16);else if(event.clientY<70)window.scrollBy(0,-16);
    }
  };
  const finish = (event: PointerEvent<HTMLButtonElement>) => {
    const current=drag.current;drag.current=null;setDragging(false);setTarget("");if(!current?.moved)return;
    const hit=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-layout-drop]');if(!hit||!root.current?.contains(hit))return;
    const groupId=hit.dataset.groupId, before=Number(hit.dataset.before??0);
    if(current.type==="group")command({type:"move-group",id:current.id,before:groupId?layout!.groups.findIndex(group=>group.id===groupId):before});
    else command({type:"move-photo",id:current.id,groupId,before});
  };
  const handle = (type: Drag["type"], id: string) => ({onPointerDown:(event:PointerEvent<HTMLButtonElement>)=>start(event,type,id),onPointerMove:move,onPointerUp:finish,onPointerCancel:()=>{drag.current=null;setDragging(false);setTarget("");}});
  const crop = (groupId:string, photoId:string, x:number, y:number, baseline?:SeriesLayout) => {
    const current=baseline??layout;if(!current)return;
    const next={...current,groups:current.groups.map(group=>group.id!==groupId?group:{...group,items:group.items.map(item=>item.photoId!==photoId?item:{...item,x:Math.round(Math.max(0,Math.min(100,x))),y:Math.round(Math.max(0,Math.min(100,y)))})})};
    if(baseline){onChange({layout:next});setStatus("取景位置已更新，保存后生效");}else commit(next);
  };
  return <section ref={root} className={`series-layout-editor${dragging?" is-dragging":""}`} id={`series-layout-${series.id}`} aria-label="图片排版">
    <div className="series-writing-heading"><div><h3>图片排版</h3><p>拖动照片或整组，选择组合样式。手机始终逐张完整展示。</p></div><Button disabled={busy} onClick={onSave}>保存排版</Button></div>
    <div className="layout-editor-tools">
      {!layout&&<Button disabled>自动排版 · 当前</Button>}
      <Button variant={layout?"default":"outline"} aria-pressed={!!layout} disabled={busy||!!layout} onClick={()=>{commit(automaticLayout(layoutPhotos(series.photos,null,series.draftPhotoOrder),chapters));setPreview(true);}}>自定义排版{layout?" · 当前":""}</Button>
      {layout&&<AlertDialog><AlertDialogTrigger asChild><Button variant="outline" disabled={busy}>自动排版</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>恢复自动排版？</AlertDialogTitle><AlertDialogDescription>清除自定义分组和取景设置，保留全部照片与文字。保存后才会影响网站，也可以撤销。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={()=>commit(null)}>恢复自动</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
      <Button variant="outline" disabled={busy||!history.past.length} onClick={()=>undo()}>撤销</Button><Button variant="outline" disabled={busy||!history.future.length} onClick={()=>undo(true)}>重做</Button>
      <Button variant="outline" aria-expanded={preview} onClick={()=>setPreview(!preview)}>{preview?"收起预览":"打开预览"}</Button>
    </div>
    <p className="layout-editor-status" role="status" aria-live="polite">{status||"默认完整显示；固定画框比例不符时会保留背景，可为单张照片选择“填满”。"}</p>
    <div className={`layout-editor-workspace${preview?" has-preview":""}`}>
      <fieldset disabled={busy} className="layout-editor-groups"><legend className="sr-only">图片分组</legend>
        {!layout&&<p className="series-writing-hint">当前根据照片比例自动组合。切换自定义后，将沿用当前分组开始编辑。</p>}
        {layout&&!layout.groups.length&&<p>上传照片后即可排版，新照片将追加为独立组。</p>}
        {layout?.groups.map((group,groupIndex)=>{
          const chapter=chapters.find(chapter=>chapter.beforePhotoId===group.items[0].photoId);
          const following=layout.groups[groupIndex+1],canMerge=!!following&&group.items.length+following.items.length<=4&&!chapters.some(chapter=>following.items.some(item=>item.photoId===chapter.beforePhotoId));
          return <div key={group.id}>
            <div className={`layout-drop-zone${target===`insert-${groupIndex}`?" is-target":""}`} data-layout-drop={`insert-${groupIndex}`} data-before={groupIndex}>{dragging?"放在这里，独立成组或移动整组":""}</div>
            {chapter&&<p className="layout-chapter-divider">章节 · {chapter.title||"未命名章节"}</p>}
            <article className={`layout-editor-group${target===group.id?" is-target":""}`} data-layout-drop={group.id} data-group-id={group.id} data-before={group.items.length}>
              <div className="layout-group-toolbar"><button type="button" className="layout-drag-handle" {...handle("group",group.id)} aria-label={`拖动第 ${groupIndex+1} 组，也可使用上下移动按钮`}>⠿ 第 {groupIndex+1} 组</button><div>
                <Button size="sm" variant="outline" disabled={groupIndex===0} onClick={()=>command({type:"move-group",id:group.id,before:groupIndex-1})}>上移组</Button><Button size="sm" variant="outline" disabled={groupIndex===layout.groups.length-1} onClick={()=>command({type:"move-group",id:group.id,before:groupIndex+2})}>下移组</Button>
                <Button size="sm" variant="outline" disabled={!canMerge} title={!canMerge?"仅可合并同一章节内、总计不超过四张的相邻组":undefined} onClick={()=>command({type:"merge",id:group.id})}>合并下一组</Button><Button size="sm" variant="outline" disabled={group.items.length<2} onClick={()=>command({type:"split",id:group.id})}>拆分整组</Button>
              </div></div>
              <div className="layout-template-choices" role="group" aria-label={`第 ${groupIndex+1} 组模板`}>{layoutTemplates.filter(template=>template.count===group.items.length).map(template=><button key={template.id} type="button" className="layout-template-choice" aria-pressed={template.id===group.template} onClick={()=>updateGroup(group.id,{template:template.id})}><span aria-hidden="true" className={`layout-template-icon template-${template.id}`}>{group.items.map((_,index)=><i key={index}>{index+1}</i>)}</span>{template.label}</button>)}</div>
              <label className="layout-gap-choice">图片间距<NativeSelect aria-label={`第 ${groupIndex+1} 组图片间距`} value={group.gap} onChange={event=>updateGroup(group.id,{gap:event.target.value as LayoutGroup["gap"]})}><NativeSelectOption value="space">留白 · 24px</NativeSelectOption><NativeSelectOption value="seamless">无缝 · 0px</NativeSelectOption></NativeSelect></label>
              <div className="layout-photo-controls">{group.items.map((frame,slot)=>{
                const photo=series.photos.find(photo=>photo.id===frame.photoId)!;
                const globalIndex=layout.groups.slice(0,groupIndex).reduce((sum,item)=>sum+item.items.length,0)+slot;
                const join=(direction:-1|1)=>{const destination=layout.groups[groupIndex+direction];if(destination)command({type:"move-photo",id:photo.id,groupId:destination.id,before:direction===-1?destination.items.length:0});};
                const canJoin=(direction:-1|1)=>{const destination=layout.groups[groupIndex+direction];if(!destination||destination.items.length>=4)return false;const merged=direction===-1?[...destination.items,frame]:[frame,...destination.items];return !merged.slice(1).some(item=>chapters.some(chapter=>chapter.beforePhotoId===item.photoId));};
                return <div className="layout-photo-control" key={photo.id} data-photo-id={photo.id} data-layout-drop={`${group.id}-${slot}`} data-group-id={group.id} data-before={slot}>
                  <div className="layout-crop-frame" style={{aspectRatio:group.template==="left-wide"||group.template==="right-wide"?(slot===(group.template==="left-wide"?0:1)?4/3:2/3):group.template==="large-left"||group.template==="large-right"?1:group.template==="quad"?3/2:photo.width/photo.height,"--crop-position":`${frame.x}% ${frame.y}%`,"--crop-fit":frame.fit} as CSSProperties} onPointerDown={event=>{if(frame.fit!=="cover"||event.button!==0||!layout||busy)return;const box=event.currentTarget.getBoundingClientRect();event.currentTarget.setPointerCapture(event.pointerId);cropDrag.current={x:frame.x,y:frame.y,startX:event.clientX,startY:event.clientY,width:Math.max(0,photo.width*Math.max(box.width/photo.width,box.height/photo.height)-box.width),height:Math.max(0,photo.height*Math.max(box.width/photo.width,box.height/photo.height)-box.height),groupId:group.id,photoId:photo.id,layout:structuredClone(layout)};}} onPointerMove={event=>{const current=cropDrag.current;if(current)crop(current.groupId,current.photoId,current.width?current.x-(event.clientX-current.startX)/current.width*100:current.x,current.height?current.y-(event.clientY-current.startY)/current.height*100:current.y,current.layout);}} onPointerUp={()=>{const current=cropDrag.current;if(current){onHistoryChange({past:[...history.past,{layout:current.layout}].slice(-100),future:[]});cropDrag.current=null;setStatus("取景位置已更新，可撤销。保存后生效。");}}} onPointerCancel={()=>{const current=cropDrag.current;if(current){onChange({layout:current.layout});cropDrag.current=null;}}}>
                    <img src={photo.imageUrl} alt={photo.alt||`第 ${globalIndex+1} 张照片`} loading="lazy" draggable={false}/>
                  </div>
                  <button type="button" className="layout-drag-handle" {...handle("photo",photo.id)} aria-label={`拖动第 ${globalIndex+1} 张照片，也可使用移动按钮`}>⠿ 照片 {String(globalIndex+1).padStart(2,"0")} · 格子 {slot+1}</button>
                  <div className="layout-photo-actions">
                    <Button size="sm" variant="outline" disabled={slot===0} onClick={()=>command({type:"move-photo",id:photo.id,groupId:group.id,before:slot-1})}>前移</Button><Button size="sm" variant="outline" disabled={slot===group.items.length-1} onClick={()=>command({type:"move-photo",id:photo.id,groupId:group.id,before:slot+2})}>后移</Button>
                    <Button size="sm" variant="outline" disabled={group.items.length===1} onClick={()=>command({type:"move-photo",id:photo.id,before:groupIndex+1})}>独立展示</Button>
                    <Button size="sm" variant="outline" disabled={!canJoin(-1)} onClick={()=>join(-1)}>移入上一组</Button><Button size="sm" variant="outline" disabled={!canJoin(1)} onClick={()=>join(1)}>移入下一组</Button>
                  </div>
                  <label>显示方式<NativeSelect aria-label={`照片 ${globalIndex+1} 显示方式`} value={frame.fit} onChange={event=>updateGroup(group.id,{items:group.items.map(item=>item.photoId===photo.id?{...item,fit:event.target.value as "contain"|"cover"}:item)})}><NativeSelectOption value="contain">完整 · 保留构图</NativeSelectOption><NativeSelectOption value="cover">填满 · 允许裁切</NativeSelectOption></NativeSelect></label>
                  {frame.fit==="cover"&&<div className="layout-crop-sliders"><p>拖动上方图片调整取景。原比例模板保持原构图，固定画框模板可裁切填满。</p>{(["x","y"] as const).map(axis=><label key={axis}>{axis==="x"?"水平":"垂直"}取景 · {frame[axis]}%<input type="range" min="0" max="100" value={frame[axis]} aria-label={`照片 ${globalIndex+1} ${axis==="x"?"水平":"垂直"}取景`} onChange={event=>crop(group.id,photo.id,axis==="x"?Number(event.target.value):frame.x,axis==="y"?Number(event.target.value):frame.y)}/></label>)}</div>}
                </div>;
              })}</div>
              {!canMerge&&following&&<p className="series-writing-hint">合并需要在同一章节内，且总计不超过四张。</p>}
            </article>
          </div>;
        })}
        {layout&&<div className={`layout-drop-zone${target===`insert-${layout.groups.length}`?" is-target":""}`} data-layout-drop={`insert-${layout.groups.length}`} data-before={layout.groups.length}>{dragging?"放在这里，追加为独立组或移动整组":""}</div>}
      </fieldset>
      {preview&&<aside className="layout-live-preview" aria-label="未保存排版预览"><p>实时预览 · 使用当前未保存内容</p><SeriesStoryPreview series={series} copy={copy}/></aside>}
    </div>
  </section>;
}
