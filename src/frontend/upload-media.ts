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

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "上传失败");
  return body;
}

async function sha256(file: File) {
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, "0")).join("");
}

async function uploadParts(blob: Blob, key: string, uploadId: string, csrfToken: string, onPart?: (bytes: number) => void) {
  const parts: UploadedPart[] = [];
  for (let offset = 0, partNumber = 1; offset < blob.size; offset += chunkSize, partNumber += 1) {
    const query = new URLSearchParams({ key, uploadId, partNumber: String(partNumber) });
    parts.push(await requestJson<UploadedPart>(`/api/upload/multipart?${query}`, {
      method: "PUT",
      headers: { "content-type": "application/octet-stream", "x-csrf-token": csrfToken },
      body: blob.slice(offset, Math.min(blob.size, offset + chunkSize)),
    }));
    onPart?.(Math.min(chunkSize, blob.size - offset));
  }
  return parts;
}

export async function uploadMediaMultipart(input: {
  original: File;
  display: Blob;
  width: number;
  height: number;
  csrfToken: string;
  assignment?: string;
  onProgress?: (progress: number) => void;
}): Promise<UploadedMedia> {
  if (input.original.size > 25 * 1024 * 1024) throw new Error("图片不能超过 25MB");
  const session = await requestJson<UploadSession>("/api/upload/multipart", {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrf-token": input.csrfToken },
    body: JSON.stringify({ action: "init", fileName: input.original.name, mimeType: input.original.type, size: input.original.size }),
  });
  let uploadedBytes = 0;
  const totalBytes = input.original.size + input.display.size;
  const onPart = (bytes: number) => {
    uploadedBytes += bytes;
    input.onProgress?.(.95 * uploadedBytes / totalBytes);
  };
  const [checksum, originalParts, displayParts] = await Promise.all([
    sha256(input.original),
    uploadParts(input.original, session.originalKey, session.originalUploadId, input.csrfToken, onPart),
    uploadParts(input.display, session.displayKey, session.displayUploadId, input.csrfToken, onPart),
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
