import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";

const envPath=resolve(".env.local");
try{await access(envPath);}catch{
  const rl=createInterface({input:process.stdin,output:process.stdout});
  const interactive=Boolean(process.stdin.isTTY);
  const username=interactive?(await rl.question("管理员账号 [song]: ")).trim()||"song":"song";
  const password=interactive?await rl.question("管理员密码（不会写入 Git）: "):"replace-with-your-password";
  rl.close();
  const template=await readFile(resolve(".env.example"),"utf8");
  const content=template.replace(/^ADMIN_USERNAME=.*$/m,`ADMIN_USERNAME=${username}`).replace(/^ADMIN_PASSWORD=.*$/m,`ADMIN_PASSWORD=${password}`).replace(/^SESSION_SECRET=.*$/m,`SESSION_SECRET=${randomBytes(48).toString("base64url")}`).replace(/^SYNC_SECRET=.*$/m,`SYNC_SECRET=${randomBytes(48).toString("base64url")}`);
  await writeFile(envPath,content,"utf8");console.log("已创建 .env.local");
}
await mkdir(resolve("var","backups"),{recursive:true});await mkdir(resolve("var","conflicts"),{recursive:true});await mkdir(resolve("media-source"),{recursive:true});
async function runWrangler(args){await new Promise((ok,fail)=>{const child=spawn(process.execPath,[resolve("node_modules","wrangler","bin","wrangler.js"),...args],{stdio:"inherit",env:process.env});child.on("exit",code=>code===0?ok():fail(new Error(`${args.join(" ")} 执行失败`)));child.on("error",fail);});}
await runWrangler(["d1","migrations","apply","site-creator-d1","--local","--persist-to",".wrangler/state"]);
await new Promise((ok,fail)=>{const child=spawn(process.execPath,["scripts/seed-local.mjs"],{stdio:"inherit",env:process.env});child.on("exit",code=>code===0?ok():fail(new Error("内容初始化失败")));child.on("error",fail);});
console.log("初始化完成。运行 npm run dev，然后访问 http://127.0.0.1:5173");
