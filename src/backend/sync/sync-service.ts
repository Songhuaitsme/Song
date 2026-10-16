import { validateNarrativeSync, syncVersionGuard, type SyncChange } from "./narrative-sync";
import { readNarrative } from "@/shared/series-narrative";
import { readLayout } from "@/shared/series-layout";
import { env } from "cloudflare:workers";
import { getDatabase } from "@/backend/content/content-store";
import { validateMessageRow } from "@/shared/guestbook";

export const SYNC_SCHEMA_VERSION = 7;
export type SyncEntity = "series"|"photos"|"essays"|"favorites"|"site_settings"|"media_assets"|"guestbook_messages";
const tables:SyncEntity[]=["series","photos","essays","favorites","site_settings","media_assets","guestbook_messages"];

function secret(){try{return env.SYNC_SECRET??"";}catch{return "";}}
function constantTimeTextEqual(a:string,b:string){const left=new TextEncoder().encode(a),right=new TextEncoder().encode(b),length=Math.max(left.length,right.length);let difference=left.length^right.length;for(let i=0;i<length;i++)difference|=(left[i]??0)^(right[i]??0);return difference===0;}
export function authorizeSync(request:Request){const header=request.headers.get("authorization")??"";const expected=secret();return expected.length>=32&&header.startsWith("Bearer ")&&constantTimeTextEqual(header.slice(7),expected);}

export async function exportSync(since=0){
  const db=getDatabase();if(!db)throw new Error("数据库暂时不可用");
  const result:Record<string,unknown[]>={};let revision=since;
  for(const table of tables){const key=table==="site_settings"?"key":"id",operator=since<=0?">=":">";const rows=await db.prepare(`SELECT * FROM ${table} WHERE updated_at${operator}? ORDER BY updated_at,${key}`).bind(Math.max(0,since)).all<Record<string,unknown>>();result[table]=rows.results;for(const row of rows.results)revision=Math.max(revision,Number(row.updated_at??0));}
  return{schemaVersion:SYNC_SCHEMA_VERSION,revision,generatedAt:Date.now(),records:result};
}

function table(entity:string):SyncEntity{if(!tables.includes(entity as SyncEntity))throw new Error("同步内容类型无效");return entity as SyncEntity;}
export async function importSync(payload:{schemaVersion?:number;changes?:SyncChange[]}){
  if(payload.schemaVersion!==SYNC_SCHEMA_VERSION)throw new Error("数据库结构版本不一致，请先升级两端代码");
  const db=getDatabase();if(!db)throw new Error("数据库暂时不可用");
  const staged=[];const blocked=new Set<string>();
  for(const change of payload.changes??[]){
    const entity=table(change.entity),data=change.data,id=String(data.id??data.key??"");
    if(entity==="guestbook_messages")validateMessageRow(data);
    if(!id||!Number.isInteger(change.baseVersion)||change.baseVersion<0)throw new Error("同步记录或基础版本无效");
    const current=await db.prepare(`SELECT * FROM ${entity} WHERE ${entity==="site_settings"?"key":"id"}=?`).bind(id).first<Record<string,unknown>>();
    const groups=entity==="series"?[id]:entity==="photos"?[String(data.series_id),...(current?[String(current.series_id)]:[])]:[];
    const conflict=Number(current?.version??0)!==change.baseVersion;
    if(conflict)for(const group of groups)blocked.add(group);
    staged.push({change:{...change,entity},current,id,groups,conflict});
  }
  // Related photo edits stay with a conflicting series, so chapter anchors remain intact.
  let expanded=true;while(expanded){expanded=false;for(const row of staged)if(row.groups.some(group=>blocked.has(group)))for(const group of row.groups)if(!blocked.has(group)){blocked.add(group);expanded=true;}}
  const accepted=staged.filter(row=>!row.conflict&&!row.groups.some(group=>blocked.has(group)));
  // Opaque conflict IDs share a prefix for one connected series/photo group.
  // This keeps layout and canonical order resolvable together without mixing runs.
  const components=new Map<string,Set<string>>();
  for(const row of staged)if(row.groups.length){const union=new Set(row.groups.flatMap(id=>[...(components.get(id)??[id])]));for(const id of union)components.set(id,union);}
  const conflictGroups=new Map<string,string>();
  const dependencies=await validateNarrativeSync(db,accepted.map(row=>row.change));
  const statements:D1PreparedStatement[]=[],applied:string[]=[],conflicts:string[]=[];
  if(accepted.length)statements.push(syncVersionGuard(db,[...accepted.map(row=>row.change),...dependencies]));
  for(const row of [...staged].sort((a,b)=>tables.indexOf(table(a.change.entity))-tables.indexOf(table(b.change.entity)))){
    if(row.conflict||row.groups.some(group=>blocked.has(group))){
      const component=row.groups.length?[...(components.get(row.groups[0])??row.groups)].sort().join("|"):null;
      if(component&&!conflictGroups.has(component))conflictGroups.set(component,crypto.randomUUID());
      const id=(component?conflictGroups.get(component)+":":"")+crypto.randomUUID();conflicts.push(id);
      statements.push(db.prepare("INSERT INTO sync_conflicts (id,entity,record_id,local_version,remote_version,local_data,remote_data,status,created_at,resolved_at) VALUES (?,?,?,?,?,?,?,?,?,NULL)").bind(id,row.change.entity,row.id,Number(row.current?.version??0),Number(row.change.data.version??row.change.baseVersion+1),JSON.stringify(row.current??{}),JSON.stringify(row.change.data),"open",Date.now()));
    }else{statements.push(prepareSyncRow(db,table(row.change.entity),row.change.data));applied.push(`${row.change.entity}:${row.id}`);}
  }
  if(statements.length)await db.batch(statements);
  return{applied,conflicts};
}

function prepareSyncRow(db:D1Database,entity:SyncEntity,d:Record<string,unknown>){
  if(entity==="guestbook_messages"){
    validateMessageRow(d);
    return db.prepare("INSERT INTO guestbook_messages(id,nickname,body,reply,visibility,created_at,replied_at,version,updated_at,deleted_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET nickname=excluded.nickname,body=excluded.body,reply=excluded.reply,visibility=excluded.visibility,created_at=excluded.created_at,replied_at=excluded.replied_at,version=excluded.version,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at").bind(d.id,d.nickname,d.body,d.reply,d.visibility,d.created_at,d.replied_at??null,d.version,d.updated_at,d.deleted_at??null);
  }
  if(entity==="series"){
    const present=d.narrative_json!==undefined,json=JSON.stringify(readNarrative(d.narrative_json)),hasLayout=d.layout_json!==undefined,layout=readLayout(d.layout_json);
    return db.prepare("INSERT INTO series (id,slug,title,description,cover_url,access,published,sort_order,narrative_json,layout_json,version,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,description=excluded.description,cover_url=excluded.cover_url,access=excluded.access,published=excluded.published,sort_order=excluded.sort_order,narrative_json=CASE WHEN ?=1 THEN excluded.narrative_json ELSE series.narrative_json END,layout_json=CASE WHEN ?=1 THEN excluded.layout_json ELSE series.layout_json END,version=excluded.version,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at").bind(d.id,d.slug,d.title,d.description,d.cover_url,d.access,d.published,d.sort_order,json,layout?JSON.stringify(layout):null,d.version,d.updated_at,d.deleted_at??null,present?1:0,hasLayout?1:0);
  }
  if(entity==="photos")return db.prepare("INSERT INTO photos (id,series_id,image_url,original_url,width,height,alt,caption,location,taken_at,sort_order,version,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET series_id=excluded.series_id,image_url=excluded.image_url,original_url=excluded.original_url,width=excluded.width,height=excluded.height,alt=excluded.alt,caption=excluded.caption,location=excluded.location,taken_at=excluded.taken_at,sort_order=excluded.sort_order,version=excluded.version,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at").bind(d.id,d.series_id,d.image_url,d.original_url,d.width,d.height,d.alt,d.caption,d.location,d.taken_at,d.sort_order,d.version,d.updated_at,d.deleted_at??null);
  if(entity==="essays")return db.prepare("INSERT INTO essays (id,slug,title,excerpt,body,access,visibility,status,published_at,sort_order,version,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,excerpt=excluded.excerpt,body=excluded.body,access=excluded.access,visibility=excluded.visibility,status=excluded.status,published_at=excluded.published_at,sort_order=excluded.sort_order,version=excluded.version,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at").bind(d.id,d.slug,d.title,d.excerpt,d.body,d.access,d.visibility,d.status,d.published_at,d.sort_order,d.version,d.updated_at,d.deleted_at??null);
  if(entity==="favorites")return db.prepare("INSERT INTO favorites (id,title,category,note,image_url,url,access,sort_order,published,version,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,category=excluded.category,note=excluded.note,image_url=excluded.image_url,url=excluded.url,access=excluded.access,sort_order=excluded.sort_order,published=excluded.published,version=excluded.version,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at").bind(d.id,d.title,d.category,d.note,d.image_url,d.url,d.access,d.sort_order,d.published,d.version,d.updated_at,d.deleted_at??null);
  if(entity==="site_settings")return db.prepare("INSERT INTO site_settings (key,value,version,updated_at,deleted_at) VALUES (?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,version=excluded.version,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at").bind(d.key,d.value,d.version,d.updated_at,d.deleted_at??null);
  return db.prepare("INSERT INTO media_assets (id,original_key,display_key,original_url,display_url,file_name,mime_type,checksum,perceptual_hash,size,width,height,access,assignment,version,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET original_key=excluded.original_key,display_key=excluded.display_key,original_url=excluded.original_url,display_url=excluded.display_url,file_name=excluded.file_name,mime_type=excluded.mime_type,checksum=excluded.checksum,perceptual_hash=excluded.perceptual_hash,size=excluded.size,width=excluded.width,height=excluded.height,access=excluded.access,assignment=excluded.assignment,version=excluded.version,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at").bind(d.id,d.original_key,d.display_key,d.original_url,d.display_url,d.file_name,d.mime_type,d.checksum,d.perceptual_hash,d.size,d.width,d.height,d.access,d.assignment,d.version,d.created_at,d.updated_at,d.deleted_at??null);
}

export async function listConflicts(){const db=getDatabase();if(!db)return[];const rows=await db.prepare("SELECT * FROM sync_conflicts WHERE status='open' ORDER BY created_at DESC").all<Record<string,unknown>>();return rows.results.map(r=>({...r,recordId:r.record_id,localVersion:r.local_version,remoteVersion:r.remote_version,localData:JSON.parse(String(r.local_data)),remoteData:JSON.parse(String(r.remote_data)),createdAt:r.created_at,resolvedAt:r.resolved_at,groupCount:String(r.id).includes(":")?rows.results.filter(other=>String(other.id).split(":")[0]===String(r.id).split(":")[0]).length:1,local_data:JSON.parse(String(r.local_data)),remote_data:JSON.parse(String(r.remote_data))}));}
export async function resolveConflict(id:string,resolution:"local"|"remote"|"manual",manual?:Record<string,unknown>){
  if(!["local","remote","manual"].includes(resolution))throw new Error("解决方式无效");
  const db=getDatabase();if(!db)return;
  const row=await db.prepare("SELECT * FROM sync_conflicts WHERE id=? AND status='open'").bind(id).first<Record<string,unknown>>();if(!row)throw new Error("冲突不存在或已经处理");
  if(id.includes(":")){
    const prefix=id.split(":")[0]+":";
    const related=await db.prepare("SELECT * FROM sync_conflicts WHERE status='open' AND id LIKE ?").bind(prefix+"%").all<Record<string,unknown>>();
    if(resolution==="manual"&&related.results.length>1)throw new Error("关联排版冲突请先选择整组版本，再进行手动编辑");
    const finishes=related.results.map(item=>db.prepare("UPDATE sync_conflicts SET status='resolved',resolved_at=? WHERE id=?").bind(Date.now(),item.id));
    if(resolution==="local"){await db.batch(finishes);return;}
    const changes:SyncChange[]=[];
    for(const item of related.results){const entity=table(String(item.entity));const current=await db.prepare(`SELECT version FROM ${entity} WHERE ${entity==="site_settings"?"key":"id"}=?`).bind(item.record_id).first<{version:number}>();
      if(Number(current?.version??0)!==Number(item.local_version))throw new Error("冲突记录之后又有新编辑，请保留本地版本并重新同步，避免覆盖新内容");
      const selected=resolution==="manual"?manual:JSON.parse(String(item.remote_data));if(!selected)throw new Error("请提供合并后的内容");
      changes.push({entity,data:{...selected,[entity==="site_settings"?"key":"id"]:item.record_id,version:Number(current?.version??0)+1,updated_at:Date.now()},baseVersion:Number(current?.version??0)});
    }
    const dependencies=await validateNarrativeSync(db,changes);
    await db.batch([syncVersionGuard(db,[...changes,...dependencies]),...[...changes].sort((a,b)=>tables.indexOf(table(a.entity))-tables.indexOf(table(b.entity))).map(change=>prepareSyncRow(db,table(change.entity),change.data)),...finishes]);return;
  }
  const finish=db.prepare("UPDATE sync_conflicts SET status='resolved',resolved_at=? WHERE id=?").bind(Date.now(),id);
  if(resolution==="local"){await finish.run();return;}
  const entity=table(String(row.entity)),selected=resolution==="remote"?JSON.parse(String(row.remote_data)):manual;if(!selected)throw new Error("请提供合并后的内容");
  const current=await db.prepare(`SELECT version FROM ${entity} WHERE ${entity==="site_settings"?"key":"id"}=?`).bind(row.record_id).first<{version:number}>();
  if(Number(current?.version??0)!==Number(row.local_version))throw new Error("冲突记录之后又有新编辑，请保留本地版本并重新同步，避免覆盖新内容");
  const data={...selected,[entity==="site_settings"?"key":"id"]:row.record_id,version:Number(current?.version??0)+1,updated_at:Date.now()};
  const change={entity,data,baseVersion:Number(current?.version??0)};
  const dependencies=await validateNarrativeSync(db,[change]);
  await db.batch([syncVersionGuard(db,[change,...dependencies]),prepareSyncRow(db,entity,data),finish]);
}
