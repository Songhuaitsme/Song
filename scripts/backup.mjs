import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadLocalEnv, required, endpoint, syncRequest } from "./lib/env.mjs";
const env=await loadLocalEnv(),kind=process.argv.includes("--production")?"production":"local",base=endpoint(env,kind),secret=required(env,"SYNC_SECRET");
const data=await (await syncRequest(base,"/api/sync/export?since=0",secret)).json();await mkdir(resolve("var","backups"),{recursive:true});const file=resolve("var","backups",`${new Date().toISOString().replaceAll(":","-")}-${kind}.json`);await writeFile(file,JSON.stringify(data,null,2),"utf8");console.log(file);
