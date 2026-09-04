const MIME_EXTENSIONS: Record<string, readonly string[]> = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/gif": ["gif"],
  "image/heic": ["heic", "heif"],
  "image/heif": ["heic", "heif"],
}

export function sniffMime(buffer: Uint8Array): string | null {
  if (buffer.length >= 5 && Buffer.from(buffer.subarray(0, 5)).toString() === "%PDF-") return "application/pdf"
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg"
  if (buffer.length >= 8 && Buffer.from(buffer.subarray(0, 8)).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png"
  if (buffer.length >= 12 && Buffer.from(buffer.subarray(0, 4)).toString() === "RIFF" && Buffer.from(buffer.subarray(8, 12)).toString() === "WEBP") return "image/webp"
  if (buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(Buffer.from(buffer.subarray(0, 6)).toString())) return "image/gif"
  if (buffer.length >= 12 && Buffer.from(buffer.subarray(4, 8)).toString() === "ftyp" && /heic|heix|hevc|hevx|mif1|msf1/.test(Buffer.from(buffer.subarray(8, 12)).toString())) return "image/heic"
  return null
}

export function validateFile(buffer: Uint8Array, declaredMime: string, fileName: string, maxBytes: number): string | null {
  if (buffer.byteLength === 0 || buffer.byteLength > maxBytes) return `File must be smaller than ${Math.floor(maxBytes / 1024 / 1024)}MB.`
  const actualMime = sniffMime(buffer)
  if (!actualMime || (declaredMime !== actualMime && !(actualMime === "image/heic" && declaredMime === "image/heif"))) return "File content does not match its declared type."
  const extension = fileName.toLowerCase().split(".").pop() || ""
  if (!MIME_EXTENSIONS[declaredMime]?.includes(extension)) return "File extension does not match its type."
  return null
}
