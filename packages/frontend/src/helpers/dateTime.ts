/**
 * in YYYY-MM-DD format
 */
export function dateString() {
  const date = new Date()
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}
