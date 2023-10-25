export function escapeSpecialChars(str: string) {
  return str.replace(/,/g, '%2C').replace(/"/g, '%22')
}

export function unescapeSpecialChars(str: string) {
  return str.replace(/%2C/g, ',').replace(/%22/g, '"')
}
