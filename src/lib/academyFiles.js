const FILE_RULES = {
  ".py": {
    maxBytes: 200 * 1024,
    mime: ["text/x-python", "text/plain", "application/octet-stream"],
  },
  ".ipynb": { maxBytes: 1024 * 1024, mime: ["application/json", "text/plain"] },
  ".txt": { maxBytes: 1024 * 1024, mime: ["text/plain"] },
  ".md": { maxBytes: 1024 * 1024, mime: ["text/markdown", "text/plain"] },
  ".csv": {
    maxBytes: 1024 * 1024,
    mime: ["text/csv", "application/vnd.ms-excel", "text/plain"],
  },
  ".pdf": { maxBytes: 5 * 1024 * 1024, mime: ["application/pdf"] },
  // Screenshots are how most students will actually submit proof of a result:
  // a working program, a wired robot, a passing test. Without these the only
  // way to hand in work from a phone was to describe it in text.
  ".png": {
    maxBytes: 5 * 1024 * 1024,
    mime: ["image/png"],
  },
  ".jpg": { maxBytes: 5 * 1024 * 1024, mime: ["image/jpeg"] },
  ".jpeg": { maxBytes: 5 * 1024 * 1024, mime: ["image/jpeg"] },
  ".webp": { maxBytes: 5 * 1024 * 1024, mime: ["image/webp"] },
  ".heic": { maxBytes: 5 * 1024 * 1024, mime: ["image/heic", "image/heif"] },
  ".docx": {
    maxBytes: 5 * 1024 * 1024,
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
  if (file.size > rule.maxBytes)
    return {
      valid: false,
      error: `${extension} files must be smaller than ${Math.round(rule.maxBytes / 1024)} KB.`,
    };
  if (file.type && !rule.mime.includes(file.type))
    return {
      valid: false,
      error: "The file MIME type does not match its extension.",
    };
  return { valid: true, extension };
}

export { FILE_RULES };
