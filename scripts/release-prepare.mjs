import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const npmCli=process.env.npm_execpath||resolve("node_modules","npm","bin","npm-cli.js");async function run(name){await new Promise((ok,fail)=>{const child=spawn(process.execPath,[npmCli,"run",name],{stdio:"inherit"});child.on("exit",code=>code===0?ok():fail(new Error(`${name} 未通过`)));child.on("error",fail);});}
for(const task of ["typecheck","test","build"])await run(task);await rm(resolve("dist","server",".dev.vars"),{force:true});await mkdir(resolve("var","release"),{recursive:true});const manifest={preparedAt:new Date().toISOString(),commit:process.env.GIT_COMMIT??"working-tree",checks:["typecheck","test","build","secret-artifact-cleanup"],databaseMigrations:"append-only"};await writeFile(resolve("var","release","manifest.json"),JSON.stringify(manifest,null,2));console.log("发布准备完成：var/release/manifest.json");
