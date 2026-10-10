import { env } from "cloudflare:workers";
import { getDatabase } from "@/backend/content/content-store";
import type { AccessLevel, MediaAsset } from "@/shared/content-model";

const allowedMime = new Set(["image/jpeg", "image/png", "image/webp"]);
export const assetUrl = (key:string) => `/api/assets/${key}`;
export function validObjectKey(key:string){return Boolean(key)&&!key.split("/").some(part=>!part||part==="."||part==="..");}
function extension(file:File){return file.name.split(".").pop()?.replace(/[^a-z0-9]/gi,"").toLowerCase()||"jpg";}
async function checksum(buffer:ArrayBuffer){const hash=await crypto.subtle.digest("SHA-256",buffer);return [...new Uint8Array(hash)].map(value=>value.toString(16).padStart(2,"0")).join("");}
export async function beginMultipart(fileName:string,mimeType:string){if(!env.BUCKET)throw new Error("图片存储暂时不可用");const id=crypto.randomUUID(),ext=fileName.split(".").pop()?.replace(/[^a-z0-9]/gi,"").toLowerCase()||"jpg",originalKey=`media/original/${id}.${ext}`,displayKey=`media/display/${id}.webp`;const [original,display]=await Promise.all([env.BUCKET.createMultipartUpload(originalKey,{httpMetadata:{contentType:mimeType,cacheControl:"private, no-store"}}),env.BUCKET.createMultipartUpload(displayKey,{httpMetadata:{contentType:"image/webp",cacheControl:"private, no-store"}})]);return{id,originalKey,displayKey,originalUploadId:original.uploadId,displayUploadId:display.uploadId};}
export async function uploadMultipartPart(key:string,uploadId:string,partNumber:number,body:ArrayBuffer){if(!env.BUCKET||!validObjectKey(key))throw new Error("图片存储暂时不可用");return env.BUCKET.resumeMultipartUpload(key,uploadId).uploadPart(partNumber,body);}
export async function finishMultipart(input:{id:string;originalKey:string;displayKey:string;originalUploadId:string;displayUploadId:string;originalParts:R2UploadedPart[];displayParts:R2UploadedPart[];fileName:string;mimeType:string;checksum:string;size:number;width:number;height:number;access?:AccessLevel;assignment?:string}){if(!env.BUCKET)throw new Error("图片存储暂时不可用");await env.BUCKET.resumeMultipartUpload(input.originalKey,input.originalUploadId).complete(input.originalParts);try{await env.BUCKET.resumeMultipartUpload(input.displayKey,input.displayUploadId).complete(input.displayParts);}catch(error){await env.BUCKET.delete(input.originalKey);throw error;}const db=getDatabase();if(!db)throw new Error("数据库暂时不可用");const stamp=Date.now();await db.prepare("INSERT OR IGNORE INTO media_assets (id,original_key,display_key,original_url,display_url,file_name,mime_type,checksum,perceptual_hash,size,width,height,access,assignment,version,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,NULL)").bind(input.id,input.originalKey,input.displayKey,assetUrl(input.originalKey),assetUrl(input.displayKey),input.fileName,input.mimeType,input.checksum,"",input.size,input.width,input.height,input.access??"private",input.assignment??"unassigned",stamp,stamp).run();return{id:input.id,imageUrl:assetUrl(input.displayKey),originalUrl:assetUrl(input.originalKey)};}

export async function storeMedia(input:{original:File;display:File;width:number;height:number;access?:AccessLevel;assignment?:string}){
  if(!env.BUCKET)throw new Error("图片存储暂时不可用");
  if(input.original.size>25*1024*1024)throw new Error("原图不能超过 25MB");
  if(input.display.size>8*1024*1024||input.display.type!=="image/webp")throw new Error("展示图片格式无效");
  if(!allowedMime.has(input.original.type))throw new Error("仅支持 JPEG、PNG 或 WebP 图片");
  const id=crypto.randomUUID(),originalKey=`media/original/${id}.${extension(input.original)}`,displayKey=`media/display/${id}.webp`;
  const originalBuffer=await input.original.arrayBuffer(),displayBuffer=await input.display.arrayBuffer();
  await env.BUCKET.put(originalKey,originalBuffer,{httpMetadata:{contentType:input.original.type,cacheControl:"private, no-store"}});
  try{await env.BUCKET.put(displayKey,displayBuffer,{httpMetadata:{contentType:"image/webp",cacheControl:"private, no-store"}});}catch(error){await env.BUCKET.delete(originalKey);throw error;}
  const stamp=Date.now(),access=input.access??"private",assignment=input.assignment??"unassigned",db=getDatabase();
  if(!db){await env.BUCKET.delete([originalKey,displayKey]);throw new Error("数据库暂时不可用");}
  await db.prepare("INSERT INTO media_assets (id,original_key,display_key,original_url,display_url,file_name,mime_type,checksum,perceptual_hash,size,width,height,access,assignment,version,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,NULL)").bind(id,originalKey,displayKey,assetUrl(originalKey),assetUrl(displayKey),input.original.name,input.original.type,await checksum(originalBuffer),"",input.original.size,input.width,input.height,access,assignment,stamp,stamp).run();
  return{id,imageUrl:assetUrl(displayKey),originalUrl:assetUrl(originalKey),checksum:await checksum(originalBuffer)};
}

export async function listMedia(includeDeleted=false):Promise<MediaAsset[]>{
  const db=getDatabase();if(!db)return[];const result=await db.prepare(`SELECT * FROM media_assets ${includeDeleted?"":"WHERE deleted_at IS NULL"} ORDER BY created_at DESC`).all<Record<string,unknown>>();
  return result.results.map(r=>({id:String(r.id),originalKey:String(r.original_key),displayKey:String(r.display_key),originalUrl:String(r.original_url),displayUrl:String(r.display_url),fileName:String(r.file_name),mimeType:String(r.mime_type),checksum:String(r.checksum),perceptualHash:String(r.perceptual_hash),size:Number(r.size),width:Number(r.width),height:Number(r.height),access:String(r.access)as AccessLevel,assignment:String(r.assignment),version:Number(r.version),createdAt:Number(r.created_at),updatedAt:Number(r.updated_at),deletedAt:r.deleted_at==null?null:Number(r.deleted_at)}));
}

export async function getMediaObject(key:string){if(!env.BUCKET||!validObjectKey(key))return null;return env.BUCKET.get(key);}
export async function putSyncedObject(key:string,body:ArrayBuffer,contentType:string){if(!env.BUCKET||!validObjectKey(key))throw new Error("图片存储暂时不可用");await env.BUCKET.put(key,body,{httpMetadata:{contentType,cacheControl:"private, no-store"}});}
