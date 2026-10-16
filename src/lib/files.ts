// File validation shared by upload + solve routes.
// We check the declared type AND the real file signature, and reject PDFs carrying active content.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "text/plain": "txt",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
} as const;

export type AllowedMime = keyof typeof ALLOWED;

export function extToMime(name: string): AllowedMime | null {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf": return "application/pdf";
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "webp": return "image/webp";
    case "txt": return "text/plain";
    case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default: return null;
  }
}

function startsWith(buf: Buffer, bytes: number[]) {
  return bytes.every((b, i) => buf[i] === b);
}

export type Validation = { ok: true; mime: AllowedMime; ext: string } | { ok: false; error: string };

export function validateFile(name: string, declared: string, buf: Buffer): Validation {
  if (buf.length === 0) return { ok: false, error: "The file is empty." };
  if (buf.length > MAX_UPLOAD_BYTES) return { ok: false, error: "File is larger than 10 MB." };

  const mime = (declared in ALLOWED ? declared : extToMime(name)) as AllowedMime | null;
  if (!mime || !(mime in ALLOWED)) {
    return { ok: false, error: "Unsupported file type. Use PDF, PNG, JPG, WEBP, DOCX or TXT." };
  }

  // Real signature must match the type
  let signatureOk = false;
  switch (mime) {
    case "application/pdf":
      signatureOk = startsWith(buf, [0x25, 0x50, 0x44, 0x46]);
      break;
    case "image/png":
      signatureOk = startsWith(buf, [0x89, 0x50, 0x4e, 0x47]);
      break;
    case "image/jpeg":
      signatureOk = startsWith(buf, [0xff, 0xd8, 0xff]);
      break;
    case "image/webp":
      signatureOk = startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && buf.subarray(8, 12).toString() === "WEBP";
      break;
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      signatureOk = startsWith(buf, [0x50, 0x4b, 0x03, 0x04]);
      break;
    case "text/plain":
      signatureOk = !buf.subarray(0, 4096).includes(0);
      break;
  }
  if (!signatureOk) return { ok: false, error: "File contents do not match its type." };

  if (mime === "application/pdf") {
    const text = buf.toString("latin1");
    if (/\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA)\b/.test(text)) {
      return { ok: false, error: "This PDF contains active content (scripts or embedded files) and was rejected." };
    }
  }

  return { ok: true, mime, ext: ALLOWED[mime] };
}

export function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}
