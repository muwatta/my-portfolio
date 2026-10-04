const MAX_FILE_BYTES = 5 * 1024 * 1024;

const FILE_RULES = {
  ".py": {
    maxBytes: MAX_FILE_BYTES,
    mime: ["text/x-python", "text/plain", "application/octet-stream"],
  },
  ".cpp": {
    maxBytes: MAX_FILE_BYTES,
    mime: ["text/x-c++", "text/x-c", "text/plain", "application/octet-stream"],
  },
  ".cc": {
    maxBytes: MAX_FILE_BYTES,
    mime: ["text/x-c++", "text/x-c", "text/plain", "application/octet-stream"],
  },
  ".cxx": {
    maxBytes: MAX_FILE_BYTES,
    mime: ["text/x-c++", "text/x-c", "text/plain", "application/octet-stream"],
  },
  ".h": {
    maxBytes: MAX_FILE_BYTES,
    mime: ["text/x-c", "text/x-c++", "text/plain", "application/octet-stream"],
  },
  ".hpp": {
    maxBytes: MAX_FILE_BYTES,
    mime: ["text/x-c++", "text/plain", "application/octet-stream"],
  },
  ".ipynb": { maxBytes: MAX_FILE_BYTES, mime: ["application/json", "text/plain"] },
  ".txt": { maxBytes: MAX_FILE_BYTES, mime: ["text/plain"] },
  ".md": { maxBytes: MAX_FILE_BYTES, mime: ["text/markdown", "text/plain"] },
  ".csv": {
    maxBytes: MAX_FILE_BYTES,
    mime: ["text/csv", "application/vnd.ms-excel", "text/plain"],
  },
  ".pdf": { maxBytes: MAX_FILE_BYTES, mime: ["application/pdf"] },
  ".png": { maxBytes: MAX_FILE_BYTES, mime: ["image/png"] },
  ".jpg": { maxBytes: MAX_FILE_BYTES, mime: ["image/jpeg"] },
  ".jpeg": { maxBytes: MAX_FILE_BYTES, mime: ["image/jpeg"] },
  ".webp": { maxBytes: MAX_FILE_BYTES, mime: ["image/webp"] },
  ".heic": { maxBytes: MAX_FILE_BYTES, mime: ["image/heic", "image/heif"] },
  ".heif": { maxBytes: MAX_FILE_BYTES, mime: ["image/heif", "image/heic"] },
  ".ino": {
    maxBytes: MAX_FILE_BYTES,
    mime: ["text/x-c++", "text/x-c", "text/plain", "application/octet-stream"],
  },
  ".log": { maxBytes: MAX_FILE_BYTES, mime: ["text/plain"] },
  ".zip": { maxBytes: MAX_FILE_BYTES, mime: ["application/zip"] },
  ".mp4": { maxBytes: MAX_FILE_BYTES, mime: ["video/mp4"] },
  ".mov": { maxBytes: MAX_FILE_BYTES, mime: ["video/quicktime"] },
  ".webm": { maxBytes: MAX_FILE_BYTES, mime: ["audio/webm"] },
  ".ogg": { maxBytes: MAX_FILE_BYTES, mime: ["audio/ogg"] },
  ".mp3": { maxBytes: MAX_FILE_BYTES, mime: ["audio/mpeg"] },
  ".m4a": { maxBytes: MAX_FILE_BYTES, mime: ["audio/mp4"] },
  ".docx": {
    maxBytes: MAX_FILE_BYTES,
    mime: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  },
};

export function validateAcademyFile(file) {
  if (!file) return { valid: false, error: "Choose a file first." };
  const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
  const rule = FILE_RULES[extension];
  if (!rule) return { valid: false, error: "This file type is not supported." };
  if (file.size > rule.maxBytes) {
    return { valid: false, error: `${extension} files must be 5 MB or smaller.` };
  }
  if (file.type && !rule.mime.includes(file.type)) {
    return {
      valid: false,
      error: "The file MIME type does not match its extension.",
    };
  }
  return { valid: true, extension };
}

export { FILE_RULES, MAX_FILE_BYTES };
