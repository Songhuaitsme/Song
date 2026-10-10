import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function loadLocalEnv(){
  const values={...process.env};
  try{for(const line of (await readFile(resolve(".env.local"),"utf8")).split(/\r?\n/)){const match=line.match(/^([A-Z0-9_]+)=(.*)$/);if(!match)continue;let value=match[2].trim();if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);values[match[1]]=value;}}catch{}
  return values;
}
export function required(env,name){const value=env[name];if(!value||String(value).startsWith("replace-with"))throw new Error(`请先在 .env.local 配置 ${name}`);return String(value);}
export function endpoint(env,kind="local"){return String(kind==="production"?env.SITE_URL:env.LOCAL_SITE_URL||"http://127.0.0.1:5173").replace(/\/$/,"");}
export async function syncRequest(base,path,secret,init={}){const response=await fetch(`${base}${path}`,{...init,headers:{authorization:`Bearer ${secret}`,...init.headers}});if(!response.ok){const body=await response.text();throw new Error(`${response.status} ${body}`);}return response;}
