import { env } from "cloudflare:workers";
import type { ChatGPTUser } from "@/app/chatgpt-auth";
export function isSiteOwner(user: ChatGPTUser | null) {
  if (!user) return false;
  let ownerEmail = "";
  try { ownerEmail = env.OWNER_EMAIL ?? ""; } catch {}
  if (!ownerEmail && user.email === "seedy@sites.test") return true;
  return Boolean(ownerEmail) && user.email.toLowerCase() === ownerEmail.toLowerCase();
}
