// Client-side checks improve UX only. The REAL enforcement is in the database trigger,
// RLS, bucket mime/size limits and the Edge Function.
export const MAX_BYTES = 25 * 1024 * 1024;
export const MAX_BATCH = 10;

const SIGS = [
  { mime: 'application/pdf', ext: 'pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'image/jpeg', ext: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx', bytes: [0x50, 0x4b, 0x03, 0x04] },
  { mime: 'application/vnd.ms-excel', ext: 'xls', bytes: [0xd0, 0xcf, 0x11, 0xe0] },
];
const EXT_OK = { pdf: ['pdf'], jpg: ['jpg', 'jpeg'], png: ['png'], xlsx: ['xlsx'], xls: ['xls'] };

/** Display-safe filename: no paths, control chars or odd symbols. */
export function sanitizeFilename(name = 'invoice') {
  const base = String(name).normalize('NFKC').split(/[\\/]/).pop();
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_{2,}/g, '_').replace(/^[._]+/, '').slice(0, 100);
  return clean || 'invoice';
}

/** Verifies size, extension AND real file signature (magic bytes), never trusting file.type. */
export async function inspectFile(file) {
  if (!file || !file.size) return { ok: false, error: 'File is empty' };
  if (file.size > MAX_BYTES) return { ok: false, error: 'File is larger than 25 MB' };
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const sig = SIGS.find((s) => s.bytes.every((b, i) => head[i] === b));
  if (!sig) return { ok: false, error: 'Unsupported or corrupted file (PDF, JPG, PNG, Excel only)' };
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!EXT_OK[sig.ext].includes(ext)) return { ok: false, error: 'File extension does not match its content' };
  return { ok: true, mime: sig.mime, ext: sig.ext };
}

export async function sha256(file) {
  const buf = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Map low-level errors to safe user-facing text (no SQL / stack details). */
export function friendlyError(e, fallback = 'Something went wrong. Please try again.') {
  const m = String(e?.message || '');
  if (/not authori[sz]ed|cannot approve|high-risk|not awaiting|not payment ready|payment ready|already exported|select 1/i.test(m)) return m;
  if (/row-level security|permission denied/i.test(m)) return 'You do not have permission for this action.';
  return fallback;
}
