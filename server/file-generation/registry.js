
import path from 'node:path';

const formats = {
  // Plain text and programming languages
  txt: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  md: { mime: 'text/markdown; charset=utf-8', kind: 'text' },
  html: { mime: 'text/html; charset=utf-8', kind: 'text' },
  css: { mime: 'text/css; charset=utf-8', kind: 'text' },
  scss: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  less: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  js: { mime: 'text/javascript; charset=utf-8', kind: 'text' },
  mjs: { mime: 'text/javascript; charset=utf-8', kind: 'text' },
  cjs: { mime: 'text/javascript; charset=utf-8', kind: 'text' },
  ts: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  jsx: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  tsx: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  py: { mime: 'text/x-python; charset=utf-8', kind: 'text' },
  php: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  c: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  h: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  cpp: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  hpp: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  java: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  cs: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  go: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  rs: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  rb: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  swift: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  kt: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  dart: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  vue: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  svelte: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  sql: { mime: 'application/sql; charset=utf-8', kind: 'text' },
  sh: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  ps1: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  bat: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  json: { mime: 'application/json', kind: 'text' },
  xml: { mime: 'application/xml; charset=utf-8', kind: 'text' },
  csv: { mime: 'text/csv; charset=utf-8', kind: 'text' },
  tsv: { mime: 'text/tab-separated-values; charset=utf-8', kind: 'text' },
  yaml: { mime: 'application/yaml; charset=utf-8', kind: 'text' },
  yml: { mime: 'application/yaml; charset=utf-8', kind: 'text' },
  toml: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  ini: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  log: { mime: 'text/plain; charset=utf-8', kind: 'text' },
  env: { mime: 'text/plain; charset=utf-8', kind: 'text' },

  // Documents and office files
  pdf: { mime: 'application/pdf', kind: 'binary' },
  docx: {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    kind: 'binary',
  },
  pptx: {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    kind: 'binary',
  },
  xlsx: {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    kind: 'binary',
  },

  // Image files: these need actual image data, not just text.
  png: { mime: 'image/png', kind: 'binary' },
  jpg: { mime: 'image/jpeg', kind: 'binary' },
  jpeg: { mime: 'image/jpeg', kind: 'binary' },
  webp: { mime: 'image/webp', kind: 'binary' },
  svg: {
    mime: 'image/svg+xml; charset=utf-8',
    kind: 'text',
},

  // Archives
  zip: { mime: 'application/zip', kind: 'binary' },
};

export function getFormat(format) {
  if (typeof format !== 'string') return null;

  const extension = format.trim().replace(/^\./, '').toLowerCase();
  return formats[extension] ? { extension, ...formats[extension] } : null;
}

export function listFormats() {
  return Object.entries(formats).map(([extension, details]) => ({
    extension,
    ...details,
  }));
}

export function makeFilename(title, extension) {
  const safeTitle = String(title || 'mivchat-file')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);

  return path.basename(`${safeTitle || 'mivchat-file'}.${extension}`);
}
