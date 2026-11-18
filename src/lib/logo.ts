export const LOGO_MAX_BYTES = 1024 * 1024;

const SIGNATURES = [
  { type: "image/png", ext: "png", matches: (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { type: "image/jpeg", ext: "jpg", matches: (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: "image/webp",
    ext: "webp",
    // "RIFF" .... "WEBP"
    matches: (b: Uint8Array) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
] as const;

/**
 * Identifies an image from its first bytes rather than trusting the file name
 * or the browser-supplied MIME type, which are both easy to fake.
 */
export function sniffImage(bytes: Uint8Array) {
  return SIGNATURES.find((s) => s.matches(bytes)) ?? null;
}
