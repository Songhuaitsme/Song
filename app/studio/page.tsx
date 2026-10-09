import { requireChatGPTUser, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { StudioDashboard } from "@/components/studio-dashboard";
import { getSiteContent } from "@/lib/content-store";
import { isSiteOwner } from "@/lib/owner-auth";
export const dynamic = "force-dynamic";
export default async function StudioPage(){const user=await requireChatGPTUser("/studio");if(!isSiteOwner(user))return <main className="access-denied"><p>此工作室只向网站所有者开放。</p><a href={chatGPTSignOutPath("/")} target="_top">退出当前账号</a></main>;const content=await getSiteContent(true);return <StudioDashboard initialContent={content} userName={user.displayName}/>}
