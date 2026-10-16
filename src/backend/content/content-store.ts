import { narrativeForSave, assertPhotoCanMove, deletePhotoWithNarrative, emptyNarrativeJson, NarrativeConflict, type ChapterResolution } from "@/backend/content/series-narrative-store";
import { readNarrative } from "@/shared/series-narrative";
import { readLayout } from "@/shared/series-layout";
import { saveSeriesLayout, writePhotoWithLayout } from "@/backend/content/series-layout-store";
import { cache } from "react";
import { env } from "cloudflare:workers";
import { essayImageUrls } from "@/shared/essay-body";
import { visitorContent } from "@/shared/content-access";
import { defaultSiteCopy, validateSiteCopy } from "@/shared/site-copy";
import { defaultContent, defaultAbout, type AboutContent, type AccessLevel, type Essay, type Favorite, type Photo, type Series, type SiteContent } from "@/shared/content-model";

export type Entity = "series" | "photo" | "essay" | "favorite";
const accessLevels = new Set<AccessLevel>(["draft", "private", "public"]);

export function getDatabase(): D1Database | null { try { return env.DB ?? null; } catch { return null; } }
const now = () => Date.now();
const access = (value: unknown): AccessLevel => accessLevels.has(value as AccessLevel) ? value as AccessLevel : "draft";
function text(value: unknown, field: string, max = 5000): string { const result=String(value??"").trim(); if(!result&&["标题","标识","所属系列"].includes(field))throw new Error(`${field}不能为空`);if(result.length>max)throw new Error(`${field}内容过长`);return result; }
function number(value: unknown, fallback = 0): number { const result=Number(value??fallback);if(!Number.isFinite(result))throw new Error("数字格式无效");return result; }
function safeSlug(value: unknown): string { const result=text(value,"标识",160);if(!/^[a-z0-9\u4e00-\u9fff]+(?:-[a-z0-9\u4e00-\u9fff]+)*$/i.test(result))throw new Error("网址标识格式无效");return result; }
function safeUrl(value: unknown, externalOnly=false): string { const result=String(value??"").trim();if(!result)return "";if(!externalOnly&&result.startsWith("/")&&!result.startsWith("//"))return result;try{const url=new URL(result);if(["https:","http:"].includes(url.protocol))return result;}catch{}throw new Error("链接格式无效"); }

async function bootstrap(db:D1Database){
  const marker=await db.prepare("SELECT value FROM app_meta WHERE key=?").bind("access_v1_migrated").first();
  if(!marker)await db.batch([
    db.prepare("UPDATE series SET access=CASE WHEN published=1 THEN 'public' ELSE 'draft' END"),
    db.prepare("UPDATE essays SET access=CASE WHEN status!='published' THEN 'draft' WHEN visibility='public' THEN 'public' ELSE 'private' END"),
    db.prepare("UPDATE favorites SET access=CASE WHEN published=1 THEN 'public' ELSE 'draft' END"),
    db.prepare("INSERT OR REPLACE INTO app_meta (key,value) VALUES (?,?)").bind("access_v1_migrated",new Date().toISOString()),
  ]);
  if(await db.prepare("SELECT id FROM series WHERE deleted_at IS NULL LIMIT 1").first())return;
  const stamp=now(), statements:D1PreparedStatement[]=[];
  for(const item of defaultContent.series){
    statements.push(db.prepare("INSERT OR IGNORE INTO series (id,slug,title,description,cover_url,access,published,sort_order,version,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,1,?,NULL)").bind(item.id,item.slug,item.title,item.description,item.coverUrl,item.access,item.access==="public"?1:0,item.sortOrder,stamp));
    for(const photo of item.photos)statements.push(db.prepare("INSERT OR IGNORE INTO photos (id,series_id,image_url,original_url,width,height,alt,caption,location,taken_at,sort_order,version,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,NULL)").bind(photo.id,photo.seriesId,photo.imageUrl,photo.originalUrl,photo.width,photo.height,photo.alt,photo.caption,photo.location,photo.takenAt,photo.sortOrder,stamp));
  }
  for(const item of defaultContent.essays)statements.push(db.prepare("INSERT OR IGNORE INTO essays (id,slug,title,excerpt,body,access,visibility,status,published_at,sort_order,version,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,1,?,NULL)").bind(item.id,item.slug,item.title,item.excerpt,item.body,item.access,item.access==="public"?"public":"private",item.access==="draft"?"draft":"published",item.publishedAt,item.sortOrder,stamp));
  for(const item of defaultContent.favorites)statements.push(db.prepare("INSERT OR IGNORE INTO favorites (id,title,category,note,image_url,url,access,sort_order,published,version,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,1,?,NULL)").bind(item.id,item.title,item.category,item.note,item.imageUrl,item.url,item.access,item.sortOrder,item.access==="public"?1:0,stamp));
  await db.batch(statements);
}

function fallbackContent(includePrivate:boolean):SiteContent{const cloned=structuredClone(defaultContent);return includePrivate?cloned:visitorContent(cloned);}
const syncFields=(r:Record<string,unknown>)=>({version:Number(r.version??1),updatedAt:Number(r.updated_at??0),deletedAt:r.deleted_at==null?null:Number(r.deleted_at)});

export async function getSiteContent(includePrivate=false):Promise<SiteContent>{
  const db=getDatabase();if(!db)return fallbackContent(includePrivate);
  try{
    await bootstrap(db);const where=includePrivate?"deleted_at IS NULL":"deleted_at IS NULL AND access IN ('public','private')";
    const [sr,pr,er,fr]=await db.batch([
      db.prepare(`SELECT * FROM series WHERE ${where} ORDER BY sort_order,title`),
      db.prepare(`SELECT p.* FROM photos p JOIN series s ON s.id=p.series_id WHERE p.deleted_at IS NULL AND s.deleted_at IS NULL${includePrivate?"":" AND s.access='public'"} ORDER BY p.series_id,p.sort_order`),
      db.prepare(`SELECT * FROM essays WHERE ${where} ORDER BY sort_order,published_at DESC,title`),
      db.prepare(`SELECT * FROM favorites WHERE ${where} ORDER BY sort_order,title`),
    ]);
    const photos=(pr.results as Record<string,unknown>[]).map((r):Photo=>({id:String(r.id),seriesId:String(r.series_id),imageUrl:String(r.image_url),originalUrl:String(r.original_url),width:Number(r.width),height:Number(r.height),alt:String(r.alt),caption:String(r.caption),location:String(r.location),takenAt:String(r.taken_at),sortOrder:Number(r.sort_order),...syncFields(r)}));
    const series=(sr.results as Record<string,unknown>[]).map((r):Series=>({id:String(r.id),slug:String(r.slug),title:String(r.title),description:String(r.description),coverUrl:String(r.cover_url),access:access(r.access),sortOrder:Number(r.sort_order),narrative:readNarrative(r.narrative_json),layout:readLayout(r.layout_json),photos:photos.filter(p=>p.seriesId===String(r.id)),...syncFields(r)}));
    const essays=(er.results as Record<string,unknown>[]).map((r):Essay=>({id:String(r.id),slug:String(r.slug),title:String(r.title),excerpt:String(r.excerpt),body:String(r.body),access:access(r.access),publishedAt:String(r.published_at),sortOrder:Number(r.sort_order),...syncFields(r)}));
    const favorites=(fr.results as Record<string,unknown>[]).map((r):Favorite=>({id:String(r.id),title:String(r.title),category:String(r.category),note:String(r.note),imageUrl:String(r.image_url),url:String(r.url),access:access(r.access),sortOrder:Number(r.sort_order),...syncFields(r)}));
    const content={series,essays,favorites,about:await getAboutContent(),copy:await getSiteCopy()};
    return includePrivate?content:visitorContent(content);
  }catch(error){console.error("Content database unavailable",error);return fallbackContent(includePrivate);}
}

export async function upsertEntity(entity:Entity,record:Record<string,unknown>){
  const db=getDatabase();if(!db)throw new Error("数据库暂时不可用");await bootstrap(db);const id=String(record.id||crypto.randomUUID()),stamp=now();
  if(entity==="photo")await assertPhotoCanMove(db,id,record.seriesId);
  if(entity==="series"){
    if(Object.hasOwn(record,"layout")) {
      const level=access(record.access);
      return saveSeriesLayout(db,id,record,[safeSlug(record.slug),text(record.title,"标题",200),text(record.description,"简介",3000),safeUrl(record.coverUrl),level,level==="public"?1:0,number(record.sortOrder)]);
    }
    const level=access(record.access),narrative=await narrativeForSave(db,id,record),hasNarrative=narrative!==null;
    const json=hasNarrative?JSON.stringify(narrative):emptyNarrativeJson;
    const expected=hasNarrative&&typeof record.version==="number"?record.version:null;
    const result=await db.prepare("INSERT INTO series (id,slug,title,description,cover_url,access,published,sort_order,narrative_json,version,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,1,?,NULL) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,description=excluded.description,cover_url=excluded.cover_url,access=excluded.access,published=excluded.published,sort_order=excluded.sort_order,narrative_json=CASE WHEN ?=1 THEN excluded.narrative_json ELSE series.narrative_json END,version=series.version+1,updated_at=excluded.updated_at,deleted_at=NULL WHERE (? IS NULL OR series.version=?) AND (?=0 OR (SELECT COUNT(*) FROM photos WHERE series_id=series.id AND deleted_at IS NULL AND id IN (SELECT json_extract(value,'$.beforePhotoId') FROM json_each(?,'$.chapters')))=?)").bind(id,safeSlug(record.slug),text(record.title,"标题",200),text(record.description,"简介",3000),safeUrl(record.coverUrl),level,level==="public"?1:0,number(record.sortOrder),json,stamp,hasNarrative?1:0,expected,expected,hasNarrative?1:0,json,narrative?.chapters.length??0).run();
    if(result.meta.changes===0)throw new NarrativeConflict("系列或照片已更新，请刷新后再保存文字");
  }
  if(entity==="photo"){
    const statement=db.prepare("INSERT INTO photos (id,series_id,image_url,original_url,width,height,alt,caption,location,taken_at,sort_order,version,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,NULL) ON CONFLICT(id) DO UPDATE SET series_id=excluded.series_id,image_url=excluded.image_url,original_url=excluded.original_url,width=excluded.width,height=excluded.height,alt=excluded.alt,caption=excluded.caption,location=excluded.location,taken_at=excluded.taken_at,sort_order=excluded.sort_order,version=photos.version+1,updated_at=excluded.updated_at,deleted_at=NULL WHERE photos.series_id=excluded.series_id OR NOT EXISTS(SELECT 1 FROM series s,json_each(s.narrative_json,'$.chapters') c WHERE s.id=photos.series_id AND json_extract(c.value,'$.beforePhotoId')=photos.id)").bind(id,text(record.seriesId,"所属系列",100),safeUrl(record.imageUrl),safeUrl(record.originalUrl),number(record.width),number(record.height),text(record.alt,"替代文字",500),text(record.caption,"照片注释",3000),text(record.location,"地点",300),text(record.takenAt,"拍摄日期",100),number(record.sortOrder),stamp);
    const result=await writePhotoWithLayout(db,statement,{...record,id});
    if(result.meta.changes===0)throw new NarrativeConflict("这张照片已成为章节起点，请刷新后先调整章节");
  }
  if(entity==="essay"){const level=access(record.access);await db.prepare("INSERT INTO essays (id,slug,title,excerpt,body,access,visibility,status,published_at,sort_order,version,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,1,?,NULL) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,excerpt=excluded.excerpt,body=excluded.body,access=excluded.access,visibility=excluded.visibility,status=excluded.status,published_at=excluded.published_at,sort_order=excluded.sort_order,version=essays.version+1,updated_at=excluded.updated_at,deleted_at=NULL").bind(id,safeSlug(record.slug),text(record.title,"标题",200),text(record.excerpt,"摘要",1000),text(record.body,"正文",100000),level,level==="public"?"public":"private",level==="draft"?"draft":"published",text(record.publishedAt,"发布日期",30),number(record.sortOrder),stamp).run();}
  if(entity==="favorite"){const level=access(record.access);await db.prepare("INSERT INTO favorites (id,title,category,note,image_url,url,access,sort_order,published,version,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,1,?,NULL) ON CONFLICT(id) DO UPDATE SET title=excluded.title,category=excluded.category,note=excluded.note,image_url=excluded.image_url,url=excluded.url,access=excluded.access,sort_order=excluded.sort_order,published=excluded.published,version=favorites.version+1,updated_at=excluded.updated_at,deleted_at=NULL").bind(id,text(record.title,"标题",200),text(record.category,"分类",100),text(record.note,"短评",5000),safeUrl(record.imageUrl),safeUrl(record.url,true),level,number(record.sortOrder),level==="public"?1:0,stamp).run();}
  const table=entity==="favorite"?"favorites":entity==="essay"?"essays":entity==="photo"?"photos":"series";
  const stored=await db.prepare(`SELECT version,updated_at FROM ${table} WHERE id=?`).bind(id).first<{version:number;updated_at:number}>();
  return{id,version:stored?.version,updatedAt:stored?.updated_at};
}

export async function deleteEntity(entity:Entity,id:string,resolution?:ChapterResolution){const db=getDatabase();if(!db)throw new Error("数据库暂时不可用");if(entity==="photo")return deletePhotoWithNarrative(db,id,resolution);const stamp=now(),table=entity==="essay"?"essays":entity==="favorite"?"favorites":"series";const statements=[db.prepare(`UPDATE ${table} SET deleted_at=?,updated_at=?,version=version+1 WHERE id=?`).bind(stamp,stamp,id)];if(entity==="series")statements.push(db.prepare("UPDATE photos SET deleted_at=?,updated_at=?,version=version+1 WHERE series_id=? AND deleted_at IS NULL").bind(stamp,stamp,id));await db.batch(statements);return {};}

export async function getAssetAccess(assetUrl:string):Promise<AccessLevel|null>{const db=getDatabase();if(!db)return null;const[p,f,e,m]=await db.batch([db.prepare("SELECT s.access FROM photos p JOIN series s ON s.id=p.series_id WHERE p.deleted_at IS NULL AND s.deleted_at IS NULL AND (p.image_url=? OR p.original_url=?)").bind(assetUrl,assetUrl),db.prepare("SELECT access FROM favorites WHERE deleted_at IS NULL AND image_url=?").bind(assetUrl),db.prepare("SELECT access,body FROM essays WHERE deleted_at IS NULL AND instr(body,?)>0").bind(assetUrl),db.prepare("SELECT access FROM media_assets WHERE deleted_at IS NULL AND (display_url=? OR original_url=?)").bind(assetUrl,assetUrl)]);const levels=[...p.results,...f.results,...m.results].map(row=>access((row as Record<string,unknown>).access));for(const row of e.results as Record<string,unknown>[])if(essayImageUrls(String(row.body)).includes(assetUrl))levels.push(access(row.access));return levels.includes("public")?"public":levels.includes("private")?"private":levels.includes("draft")?"draft":null;}

export function validateAboutContent(record:Record<string,unknown>):AboutContent{return{title:text(record.title,"关于标题",200),body:text(record.body,"介绍正文",10000),note:text(record.note,"补充说明",2000)}}
async function getSetting<T>(key:string,fallback:T):Promise<T>{const db=getDatabase();if(!db)return structuredClone(fallback);try{const row=await db.prepare("SELECT value FROM site_settings WHERE key=? AND deleted_at IS NULL").bind(key).first<{value:string}>();if(row)return JSON.parse(row.value)as T;const legacy=await db.prepare("SELECT value FROM app_meta WHERE key=?").bind(key).first<{value:string}>();return legacy?JSON.parse(legacy.value)as T:structuredClone(fallback);}catch{return structuredClone(fallback)}}
async function saveSetting<T>(key:string,value:T):Promise<T>{const db=getDatabase();if(!db)throw new Error("数据库暂时不可用");await db.prepare("INSERT INTO site_settings (key,value,version,updated_at,deleted_at) VALUES (?,?,1,?,NULL) ON CONFLICT(key) DO UPDATE SET value=excluded.value,version=site_settings.version+1,updated_at=excluded.updated_at,deleted_at=NULL").bind(key,JSON.stringify(value),now()).run();return value}
export async function getAboutContent(){return validateAboutContent(await getSetting("about_content_v1",defaultAbout)as unknown as Record<string,unknown>)}
export async function saveAboutContent(record:Record<string,unknown>){return saveSetting("about_content_v1",validateAboutContent(record))}
export const getSiteCopy=cache(async()=>validateSiteCopy(await getSetting("site_copy_v1",defaultSiteCopy)as unknown as Record<string,unknown>));
export async function saveSiteCopy(record:Record<string,unknown>){const copy=validateSiteCopy(record);await saveSetting("site_copy_v1",copy);return copy}
export async function saveTextStandards(value:unknown){
  const current=await getSiteCopy();
  const validated=validateSiteCopy({...current,textStandards:value});
  const copy={...validated,textStandards:{...validated.textStandards!,overrides:current.textStandards?.overrides??validated.textStandards!.overrides}};
  return saveSiteCopy(copy);
}
