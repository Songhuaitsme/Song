type UploadSession = {
  id: string;
  originalKey: string;
  displayKey: string;
  originalUploadId: string;
  displayUploadId: string;
};

type UploadedPart = { etag: string; partNumber: number };

export type UploadedMedia = { id: string; imageUrl: string; originalUrl: string };

const chunkSize = 5 * 1024 * 1024;
const singleRequestLimit = 8 * 1024 * 1024;
let directDisabledUntil = 0;

class UploadError extends Error {
  constructor(message: string, readonly status = 0) { super(message); }
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  let body: T & { error?: string };
  try { body = await response.json(); }
  catch { throw new UploadError(`上传请求失败（HTTP ${response.status}）`, response.status); }
  if (!response.ok) throw new UploadError(body.error ?? "上传失败", response.status);
  return body;
}

function uploadRequest<T>(url: string, method: "POST" | "PUT", body: Blob | FormData, csrfToken: string, onProgress?: (ratio: number) => void): Promise<T> {
  if (typeof XMLHttpRequest === "undefined") {
    return requestJson<T>(url, {
      method, body,
      headers: { "x-csrf-token": csrfToken, ...(body instanceof Blob ? { "content-type": "application/octet-stream" } : {}) },
    });
  }
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(method, url);
    request.timeout = 180_000;
    request.setRequestHeader("x-csrf-token", csrfToken);
    if (body instanceof Blob) request.setRequestHeader("content-type", "application/octet-stream");
    request.upload.onprogress = event => {
      if (event.lengthComputable && event.total > 0) onProgress?.(event.loaded / event.total);
    };
    request.onerror = () => reject(new UploadError("上传连接中断，请检查网络后重试"));
    request.ontimeout = () => reject(new UploadError("上传超时，请检查网络后重试"));
    request.onabort = () => reject(new UploadError("上传已取消"));
    request.onload = () => {
      let result: T & { error?: string };
      try { result = JSON.parse(request.responseText); }
      catch { reject(new UploadError(`上传请求失败（HTTP ${request.status}）`, request.status)); return; }
      if (request.status < 200 || request.status >= 300) {
        reject(new UploadError(result.error ?? "上传失败", request.status)); return;
      }
      resolve(result);
    };
    request.send(body);
  });
}

async function sha256(file: Blob) {
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, "0")).join("");
}

async function putSignedObject(url: string, body: Blob, contentType: string, onProgress: (ratio: number) => void) {
  if (typeof XMLHttpRequest === "undefined") {
    const response = await fetch(url, { method: "PUT", body, headers: { "content-type": contentType }, credentials: "omit" });
    await response.arrayBuffer();
    if (!response.ok) throw new UploadError(`图片直传失败（HTTP ${response.status}）`, response.status);
    onProgress(1); return;
  }
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url); request.timeout = 180000;
    request.setRequestHeader("content-type", contentType);
    request.upload.onprogress = event => { if (event.lengthComputable && event.total) onProgress(event.loaded / event.total); };
    request.onerror = () => reject(new UploadError("无法连接图片存储，请检查网络后重试"));
    request.ontimeout = () => reject(new UploadError("图片直传超时，请检查网络后重试"));
    request.onabort = () => reject(new UploadError("上传已取消"));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) { onProgress(1); resolve(); }
      else reject(new UploadError(`图片直传失败（HTTP ${request.status}）`, request.status));
    };
    request.send(body);
  });
}

type UploadInput = {
  original: File; display: Blob; width: number; height: number; csrfToken: string;
  assignment?: string; onProgress?: (progress: number) => void;
};

async function tryDirectUpload(input: UploadInput): Promise<UploadedMedia | null> {
  if (Date.now() < directDisabledUntil) return null;
  const [checksum, displayChecksum] = await Promise.all([sha256(input.original), sha256(input.display)]);
  const session = await requestJson<{ enabled: boolean; ticket: string; originalUploadUrl: string; displayUploadUrl: string }>("/api/upload/direct", {
    method: "POST", headers: { "content-type": "application/json", "x-csrf-token": input.csrfToken },
    body: JSON.stringify({ action: "init", fileName: input.original.name, mimeType: input.original.type, size: input.original.size, displaySize: input.display.size, checksum, displayChecksum, width: input.width, height: input.height, assignment: input.assignment ?? "unassigned" }),
  });
  if (!session.enabled) { directDisabledUntil = Date.now() + 60000; return null; }
  const loaded = [0, 0], total = input.original.size + input.display.size;
  const report = (index: number, size: number) => (ratio: number) => {
    loaded[index] = Math.max(loaded[index], Math.min(1, ratio) * size);
    input.onProgress?.(.95 * (loaded[0] + loaded[1]) / total);
  };
  const transfers = await Promise.allSettled([
    putSignedObject(session.originalUploadUrl, input.original, input.original.type, report(0, input.original.size)),
    putSignedObject(session.displayUploadUrl, input.display, "image/webp", report(1, input.display.size)),
  ]);
  const failed = transfers.find(result => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
  return requestJson<UploadedMedia>("/api/upload/direct", {
    method: "POST", headers: { "content-type": "application/json", "x-csrf-token": input.csrfToken },
    body: JSON.stringify({ action: "complete", ticket: session.ticket }),
  });
}

async function uploadParts(blob: Blob, key: string, uploadId: string, csrfToken: string, onBytes: (bytes: number) => void) {
  const count = Math.ceil(blob.size / chunkSize);
  const parts = new Array<UploadedPart>(count);
  const loaded = new Array<number>(count).fill(0);
  let next = 0;
  const workers = await Promise.allSettled(Array.from({ length: Math.min(2, count) }, async () => {
    while (next < count) {
      const index = next++, partNumber = index + 1;
      const body = blob.slice(index * chunkSize, Math.min(blob.size, (index + 1) * chunkSize));
      const report = (ratio: number) => {
        loaded[index] = Math.max(loaded[index], Math.min(1, ratio) * body.size);
        onBytes(loaded.reduce((sum, bytes) => sum + bytes, 0));
      };
      const query = new URLSearchParams({ key, uploadId, partNumber: String(partNumber) });
      for (let attempt = 0; ; attempt++) {
        try {
          parts[index] = await uploadRequest<UploadedPart>(`/api/upload/multipart?${query}`, "PUT", body, csrfToken, report);
          report(1); break;
        } catch (error) {
          if (attempt >= 2 || (error instanceof UploadError && error.status > 0 && error.status < 500 && ![408, 429].includes(error.status))) throw error;
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
    }
  }));
  const failed = workers.find(result => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
  return parts;
}

export async function uploadMediaMultipart(input: UploadInput): Promise<UploadedMedia> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(input.original.type)) throw new Error("仅支持 JPEG、PNG 或 WebP 图片");
  if (!input.original.size) throw new Error("图片文件为空");
  if (input.original.size > 25 * 1024 * 1024) throw new Error("图片不能超过 25MB");
  if (!input.display.size || input.display.size > 8 * 1024 * 1024 || input.display.type !== "image/webp") throw new Error("展示图片格式或大小无效");
  input.onProgress?.(0);
  const direct = await tryDirectUpload(input);
  if (direct) { input.onProgress?.(1); return direct; }
  // Small photos avoid multipart setup, completion, and their extra network round trips.
  if (input.original.size <= chunkSize && input.original.size + input.display.size <= singleRequestLimit) {
    const form = new FormData();
    form.append("original", input.original);
    form.append("display", input.display, "display.webp");
    form.append("width", String(input.width));
    form.append("height", String(input.height));
    form.append("assignment", input.assignment ?? "unassigned");
    const result = await uploadRequest<UploadedMedia>("/api/upload", "POST", form, input.csrfToken, ratio => input.onProgress?.(.95 * ratio));
    input.onProgress?.(1);
    return result;
  }
  const session = await requestJson<UploadSession>("/api/upload/multipart", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": input.csrfToken },
    body: JSON.stringify({ action: "init", fileName: input.original.name, mimeType: input.original.type, size: input.original.size }),
  });
  const uploadedBytes = [0, 0];
  const totalBytes = input.original.size + input.display.size;
  const onBytes = (index: number) => (bytes: number) => {
    uploadedBytes[index] = bytes;
    input.onProgress?.(.95 * (uploadedBytes[0] + uploadedBytes[1]) / totalBytes);
  };
  const [checksum, originalParts, displayParts] = await Promise.all([
    sha256(input.original),
    uploadParts(input.original, session.originalKey, session.originalUploadId, input.csrfToken, onBytes(0)),
    uploadParts(input.display, session.displayKey, session.displayUploadId, input.csrfToken, onBytes(1)),
  ]);
  const result = await requestJson<UploadedMedia>("/api/upload/multipart", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": input.csrfToken },
    body: JSON.stringify({
      action: "complete",
      ...session,
      originalParts,
      displayParts,
      fileName: input.original.name,
      mimeType: input.original.type,
      checksum,
      size: input.original.size,
      width: input.width,
      height: input.height,
      assignment: input.assignment ?? "unassigned",
    }),
  });
  input.onProgress?.(1);
  return result;
}
