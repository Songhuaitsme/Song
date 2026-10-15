import { AwsClient } from "aws4fetch";

type Config = { R2_ACCESS_KEY_ID?: string; R2_SECRET_ACCESS_KEY?: string; R2_ACCOUNT_ID?: string; R2_BUCKET_NAME?: string };
export type DirectUploadMetadata = { fileName: string; mimeType: string; size: number; displaySize: number; checksum: string; displayChecksum: string; width: number; height: number; assignment: string };
export type DirectUploadTicket = DirectUploadMetadata & { id: string; originalKey: string; displayKey: string; expiresAt: number };
const encoder = new TextEncoder();
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const decode = (value: string) => Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), char => char.charCodeAt(0));
const signingKey = (secret: string) => crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

export function directUploadConfigured(config: Config) {
  return Boolean(config.R2_ACCESS_KEY_ID && config.R2_SECRET_ACCESS_KEY && /^[a-f0-9]{32}$/i.test(config.R2_ACCOUNT_ID ?? "") && config.R2_BUCKET_NAME);
}

export async function createDirectUpload(config: Config, input: DirectUploadMetadata, secret: string, now = Date.now()) {
  if (!directUploadConfigured(config) || secret.length < 32) throw new Error("直传配置不可用");
  if (!input.fileName || input.fileName.length > 512 || !["image/jpeg", "image/png", "image/webp"].includes(input.mimeType)) throw new Error("仅支持 JPEG、PNG 或 WebP 图片");
  if (!Number.isInteger(input.size) || input.size <= 0 || input.size > 25 * 1024 * 1024) throw new Error("原图不能超过 25MB");
  if (!Number.isInteger(input.displaySize) || input.displaySize <= 0 || input.displaySize > 8 * 1024 * 1024) throw new Error("展示图片不能超过 8MB");
  if (![input.checksum, input.displayChecksum].every(value => /^[a-f0-9]{64}$/.test(value))) throw new Error("图片校验信息无效");
  if (![input.width, input.height].every(value => Number.isInteger(value) && value > 0 && value <= 100000) || input.assignment.length > 512) throw new Error("图片信息无效");
  const id = crypto.randomUUID(), ext = input.mimeType === "image/jpeg" ? "jpg" : input.mimeType === "image/png" ? "png" : "webp";
  const payload: DirectUploadTicket = { ...input, id, originalKey: `media/original/${id}.${ext}`, displayKey: `media/display/${id}.webp`, expiresAt: now + 600000 };
  const encoded = encode(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode("r2-direct-v1:" + encoded));
  const ticket = encoded + "." + encode(new Uint8Array(signature));
  const client = new AwsClient({ accessKeyId: config.R2_ACCESS_KEY_ID!, secretAccessKey: config.R2_SECRET_ACCESS_KEY!, service: "s3", region: "auto" });
  const sign = async (key: string, contentType: string) => {
    const url = new URL(`https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${config.R2_BUCKET_NAME}/${key}`);
    url.searchParams.set("X-Amz-Expires", "600");
    return (await client.sign(new Request(url, { method: "PUT", headers: { "content-type": contentType } }), { aws: { signQuery: true, allHeaders: true } })).url;
  };
  const [originalUploadUrl, displayUploadUrl] = await Promise.all([sign(payload.originalKey, input.mimeType), sign(payload.displayKey, "image/webp")]);
  return { enabled: true as const, ticket, originalUploadUrl, displayUploadUrl };
}

export async function readDirectUploadTicket(ticket: string, secret: string, now = Date.now()): Promise<DirectUploadTicket> {
  if (secret.length < 32 || ticket.length > 12000) throw new Error("上传凭证无效");
  const [body, signature, extra] = ticket.split(".");
  if (!body || !signature || extra !== undefined) throw new Error("上传凭证无效");
  let valid = false;
  try { valid = await crypto.subtle.verify("HMAC", await signingKey(secret), decode(signature), encoder.encode("r2-direct-v1:" + body)); } catch {}
  if (!valid) throw new Error("上传凭证无效");
  const payload = JSON.parse(new TextDecoder().decode(decode(body))) as DirectUploadTicket;
  if (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= now) throw new Error("上传凭证已过期，请重新上传");
  return payload;
}
