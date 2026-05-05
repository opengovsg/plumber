/**
 * Hex encoding utilities for variable modifiers
 * Browser-compatible implementation (no Node.js Buffer)
 */

export const hexEncode = (str: string): string => {
  return Array.from(new TextEncoder().encode(str))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const hexDecode = (hex: string): string => {
  const bytes = hex.match(/.{2}/g)?.map((b) => parseInt(b, 16)) || []
  return new TextDecoder().decode(new Uint8Array(bytes))
}
