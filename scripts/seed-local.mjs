import { readFile, mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const source=JSON.parse(await readFile(resolve("scripts","seeds","site-content.json"),"utf8"));
const allowed=new Set(["series","photos","essays","favorites","app_meta"]),stamp=Date.now();
const quote=value=>value==null?"NULL":typeof value==="number"?String(value):`'${String(value).replaceAll("'","''")}'`;
const statements=[];
for(const [name,entry] of Object.entries(source.tables)){if(!allowed.has(name))continue;for(const row of entry.rows??[]){const normalized={...row};if(name!=="app_meta"){normalized.version=1;normalized.updated_at=stamp;normalized.deleted_at=null;}const columns=Object.keys(normalized);statements.push(`INSERT OR REPLACE INTO ${name} (${columns.map(x=>`\`${x}\``).join(",")}) VALUES (${columns.map(x=>quote(normalized[x])).join(",")});`);}}
statements.push("INSERT OR IGNORE INTO site_settings (key,value,version,updated_at,deleted_at) SELECT key,value,1,"+stamp+",NULL FROM app_meta WHERE key IN ('about_content_v1','site_copy_v1');");
await mkdir(resolve("var"),{recursive:true});const sqlPath=resolve("var","seed-local.sql");await writeFile(sqlPath,statements.join("\n"),"utf8");
await new Promise((ok,fail)=>{const child=spawn(process.execPath,[resolve("node_modules","wrangler","bin","wrangler.js"),"d1","execute","site-creator-d1","--local","--persist-to",".wrangler/state","--file",sqlPath],{stdio:"inherit"});child.on("exit",code=>code===0?ok():fail(new Error("本地内容导入失败")));child.on("error",fail);});
console.log("已导入当前站点内容种子");
