import { env } from "cloudflare:workers";
import { getDatabase } from "@/backend/content/content-store";

export const SYNC_SCHEMA_VERSION = 3;
export type SyncEntity = "series"|"photos"|"essays"|"favorites"|"site_settings"|"media_assets";
const tables:SyncEntity[]=["series","photos","essays","favorites","site_settings","media_assets"];

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
export async function importSync(payload:{schemaVersion?:number;changes?:Array<{entity:string;data:Record<string,unknown>;baseVersion:number}>}){
  if(payload.schemaVersion!==SYNC_SCHEMA_VERSION)throw new Error("数据库结构版本不一致，请先升级两端代码");
  const db=getDatabase();if(!db)throw new Error("数据库暂时不可用");const applied:string[]=[],conflicts:string[]=[];
  for(const change of payload.changes??[]){
    const entity=table(change.entity),data=change.data,id=String(data.id??data.key??"");if(!id)throw new Error("同步记录缺少标识");
    const keyColumn=entity==="site_settings"?"key":"id";
    const current=await db.prepare(`SELECT * FROM ${entity} WHERE ${keyColumn}=?`).bind(id).first<Record<string,unknown>>();
    if(current&&Number(current.version)!==Number(change.baseVersion)){
      const conflictId=crypto.randomUUID();await db.prepare("INSERT INTO sync_conflicts (id,entity,record_id,local_version,remote_version,local_data,remote_data,status,created_at,resolved_at) VALUES (?,?,?,?,?,?,?,?,?,NULL)").bind(conflictId,entity,id,Number(current.version),Number(data.version??change.baseVersion+1),JSON.stringify(current),JSON.stringify(data),"open",Date.now()).run();conflicts.push(conflictId);continue;
    }
    await writeRow(db,entity,data);applied.push(`${entity}:${id}`);
  }
  return{applied,conflicts};
}

async function writeRow(db:D1Database,entity:SyncEntity,d:Record<string,unknown>){
  if(entity==="series")return db.prepare("INSERT INTO series (id,slug,title,description,cover_url,access,published,sort_order,version,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,description=excluded.description,cover_url=excluded.cover_url,access=excluded.access,published=excluded.published,sort_order=excluded.sort_order,version=excluded.version,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at").bind(d.id,d.slug,d.title,d.description,d.cover_url,d.access,d.published,d.sort_order,d.version,d.updated_at,d.deleted_at??null).run();
  if(entity==="photos")return db.prepare("INSERT INTO photos (id,series_id,image_url,original_url,width,height,alt,caption,location,taken_at,sort_order,version,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET series_id=excluded.series_id,image_url=excluded.image_url,original_url=excluded.original_url,width=excluded.width,height=excluded.height,alt=excluded.alt,caption=excluded.caption,location=excluded.location,taken_at=excluded.taken_at,sort_order=excluded.sort_order,version=excluded.version,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at").bind(d.id,d.series_id,d.image_url,d.original_url,d.width,d.height,d.alt,d.caption,d.location,d.taken_at,d.sort_order,d.version,d.updated_at,d.deleted_at??null).run();
  if(entity==="essays")return db.prepare("INSERT INTO essays (id,slug,title,excerpt,body,access,visibility,status,published_at,sort_order,version,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,excerpt=excluded.excerpt,body=excluded.body,access=excluded.access,visibility=excluded.visibility,status=excluded.status,published_at=excluded.published_at,sort_order=excluded.sort_order,version=excluded.version,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at").bind(d.id,d.slug,d.title,d.excerpt,d.body,d.access,d.visibility,d.status,d.published_at,d.sort_order,d.version,d.updated_at,d.deleted_at??null).run();
  if(entity==="favorites")return db.prepare("INSERT INTO favorites (id,title,category,note,image_url,url,access,sort_order,published,version,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,category=excluded.category,note=excluded.note,image_url=excluded.image_url,url=excluded.url,access=excluded.access,sort_order=excluded.sort_order,published=excluded.published,version=excluded.version,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at").bind(d.id,d.title,d.category,d.note,d.image_url,d.url,d.access,d.sort_order,d.published,d.version,d.updated_at,d.deleted_at??null).run();
  if(entity==="site_settings")return db.prepare("INSERT INTO site_settings (key,value,version,updated_at,deleted_at) VALUES (?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,version=excluded.version,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at").bind(d.key,d.value,d.version,d.updated_at,d.deleted_at??null).run();
  return db.prepare("INSERT INTO media_assets (id,original_key,display_key,original_url,display_url,file_name,mime_type,checksum,perceptual_hash,size,width,height,access,assignment,version,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET original_key=excluded.original_key,display_key=excluded.display_key,original_url=excluded.original_url,display_url=excluded.display_url,file_name=excluded.file_name,mime_type=excluded.mime_type,checksum=excluded.checksum,perceptual_hash=excluded.perceptual_hash,size=excluded.size,width=excluded.width,height=excluded.height,access=excluded.access,assignment=excluded.assignment,version=excluded.version,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at").bind(d.id,d.original_key,d.display_key,d.original_url,d.display_url,d.file_name,d.mime_type,d.checksum,d.perceptual_hash,d.size,d.width,d.height,d.access,d.assignment,d.version,d.created_at,d.updated_at,d.deleted_at??null).run();
}

export async function listConflicts(){const db=getDatabase();if(!db)return[];const rows=await db.prepare("SELECT * FROM sync_conflicts WHERE status='open' ORDER BY created_at DESC").all<Record<string,unknown>>();return rows.results.map(r=>({...r,local_data:JSON.parse(String(r.local_data)),remote_data:JSON.parse(String(r.remote_data))}));}
export async function resolveConflict(id:string,resolution:"local"|"remote"|"manual",manual?:Record<string,unknown>){const db=getDatabase();if(!db)throw new Error("数据库暂时不可用");const row=await db.prepare("SELECT * FROM sync_conflicts WHERE id=? AND status='open'").bind(id).first<Record<string,unknown>>();if(!row)throw new Error("冲突不存在或已经处理");if(resolution!=="local"){const selected=resolution==="remote"?JSON.parse(String(row.remote_data)):manual;if(!selected)throw new Error("请提供合并后的内容");await writeRow(db,table(String(row.entity)),selected);}await db.prepare("UPDATE sync_conflicts SET status='resolved',resolved_at=? WHERE id=?").bind(Date.now(),id).run();}
