export const LOGO_MAX_BYTES = 1024 * 1024;

const SIGNATURES = [
  { type: "image/png", ext: "png", matches: (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { type: "image/jpeg", ext: "jpg", matches: (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
] as const;

/**
 * Identifies an image from its first bytes rather than trusting the file name
 * or the browser-supplied MIME type, which are both easy to fake.
 * Only PNG and JPEG are stored, because those are what PDFs can embed; the
 * uploader converts WebP to PNG in the browser before sending it.
 */
export function sniffImage(bytes: Uint8Array) {
  return SIGNATURES.find((s) => s.matches(bytes)) ?? null;
}
