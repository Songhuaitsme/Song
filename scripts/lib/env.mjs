import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

export async function loadLocalEnv(){
  const values={...process.env};
  try{for(const line of (await readFile(resolve(".env.local"),"utf8")).split(/\r?\n/)){const match=line.match(/^([A-Z0-9_]+)=(.*)$/);if(!match)continue;let value=match[2].trim();if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);values[match[1]]=value;}}catch{}
  return values;
}
export function required(env,name){const value=env[name];if(!value||String(value).startsWith("replace-with"))throw new Error(`请先在 .env.local 配置 ${name}`);return String(value);}
export function endpoint(env,kind="local"){return String(kind==="production"?env.SITE_URL:env.LOCAL_SITE_URL||"http://127.0.0.1:5173").replace(/\/$/,"");}
async function powershellRequest(url,secret,init={}){const directory=resolve("var","http"),id=randomUUID(),bodyPath=resolve(directory,`${id}.request`),outputPath=resolve(directory,`${id}.response`),metaPath=resolve(directory,`${id}.json`);await mkdir(directory,{recursive:true});let hasBody=false;if(init.body!=null){const body=typeof init.body==="string"?Buffer.from(init.body):Buffer.from(init.body);await writeFile(bodyPath,body);hasBody=true;}const contentType=new Headers(init.headers).get("content-type")??"application/octet-stream";const args=["-NoProfile","-File",resolve("scripts","lib","http-request.ps1"),"-Url",url,"-Method",init.method??"GET","-OutputPath",outputPath,"-MetaPath",metaPath,"-ContentType",contentType,...(hasBody?["-BodyPath",bodyPath]:[])];await new Promise((ok,fail)=>{const child=spawn("powershell.exe",args,{stdio:["ignore","ignore","pipe"],env:{...process.env,SONG_SYNC_SECRET:secret}});let error="";child.stderr.on("data",chunk=>error+=chunk);child.on("exit",code=>code===0?ok():fail(new Error(error||`PowerShell HTTP ${code}`)));child.on("error",fail);});const [body,meta]=await Promise.all([readFile(outputPath),readFile(metaPath,"utf8").then(JSON.parse)]);await Promise.all([rm(bodyPath,{force:true}),rm(outputPath,{force:true}),rm(metaPath,{force:true})]);return new Response(body,{status:meta.status,headers:{"content-type":meta.contentType||"application/octet-stream"}});}
export async function syncRequest(base,path,secret,init={}){const url=`${base}${path}`,remote=process.platform==="win32"&&url.startsWith("https://");const response=remote?await powershellRequest(url,secret,init):await fetch(url,{...init,headers:{"user-agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) SongSync/1.0",authorization:`Bearer ${secret}`,...init.headers}});if(!response.ok){const body=await response.text();throw new Error(`${response.status} ${body}`);}return response;}
