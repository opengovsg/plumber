/**
 * Encodes a UTF-8 string to hexadecimal representation
 *
 * @example
 * hexEncode('table:col1,col2') // '7461626c653a636f6c312c636f6c32'
 */
export const hexEncode = (str: string): string =>
  Buffer.from(str, 'utf8').toString('hex')

/**
 * Decodes a hexadecimal string back to UTF-8
 *
 * @example
 * hexDecode('7461626c653a636f6c312c636f6c32') // 'table:col1,col2'
 */
export const hexDecode = (hex: string): string =>
  Buffer.from(hex, 'hex').toString('utf8')
