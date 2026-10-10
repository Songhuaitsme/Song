import { getAdminSession } from "@/backend/auth/admin-auth";
import { listMedia } from "@/storage/media-store";
export async function GET(request:Request){if(!await getAdminSession(request))return Response.json({error:"无权访问"},{status:403});return Response.json({assets:await listMedia()},{headers:{"cache-control":"no-store"}});}
