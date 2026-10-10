import { authorizeSync, importSync } from "@/backend/sync/sync-service";
export async function POST(request:Request){if(!authorizeSync(request))return new Response("Not found",{status:404});try{return Response.json(await importSync(await request.json()));}catch(error){return Response.json({error:error instanceof Error?error.message:"导入失败"},{status:409});}}
