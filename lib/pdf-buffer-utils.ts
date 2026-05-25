/**
 * pdf.js can detach ArrayBuffers after first use. Always pass a fresh copy.
 */
export function copyPdfBytes(source: Buffer | ArrayBuffer | Uint8Array): Uint8Array {
  if (Buffer.isBuffer(source)) {
    return Uint8Array.from(source);
  }
  if (source instanceof Uint8Array) {
    return Uint8Array.from(source);
  }
  return Uint8Array.from(new Uint8Array(source));
}
